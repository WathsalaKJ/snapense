"""Stored spending insights, plus on-demand generation from recent activity."""

from datetime import date, datetime, timedelta
from decimal import Decimal

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from models import Budget, Category, SpendingInsight, Transaction, db
from services import anomaly_service, insight_service
from services.insight_service import InsightGenerationError

insight_bp = Blueprint("insights", __name__)

DEFAULT_PERIOD_DAYS = 30


def _error(message, status=400):
    return jsonify({"error": message}), status


def _current_user_id():
    return int(get_jwt_identity())


def _as_float(value):
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _category_totals(user_id, start, end):
    return (
        db.session.query(
            Category.id,
            Category.name,
            func.coalesce(func.sum(Transaction.total_amount), 0).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        .group_by(Category.id, Category.name)
        .order_by(func.sum(Transaction.total_amount).desc())
        .all()
    )


def _budget_status(user_id, current_totals):
    """This period's spend against each budget's monthly limit, if any exist."""
    budgets = (
        db.session.query(Budget, Category.name)
        .join(Category, Category.id == Budget.category_id)
        .filter(Budget.user_id == user_id)
        .all()
    )
    if not budgets:
        return []

    spent_by_category = {row.id: _as_float(row.total) for row in current_totals}
    status = []
    for budget, category_name in budgets:
        limit = _as_float(budget.monthly_limit)
        spent = spent_by_category.get(budget.category_id, 0.0)
        status.append(
            {
                "category": category_name,
                "monthly_limit": round(limit, 2),
                "spent_this_period": round(spent, 2),
                "percent_used": round(spent / limit * 100, 1) if limit else None,
            }
        )
    return status


def _build_insight_payload(user_id, start, end):
    """Gather the structured spending data an AI insight is generated from.

    Returns None when there's no spending in the period to summarize.
    """
    current = _category_totals(user_id, start, end)
    if not current:
        return None

    span = max((end - start).days, 1)
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=span)
    previous = {row.id: _as_float(row.total) for row in _category_totals(user_id, previous_start, previous_end)}

    period_total = sum(_as_float(row.total) for row in current)
    top = current[0]

    category_changes = []
    for row in current:
        before = previous.get(row.id)
        now = _as_float(row.total)
        if not before:
            continue
        change = (now - before) / before * 100
        if abs(change) < 25:
            continue
        category_changes.append(
            {
                "category": row.name,
                "change_percent": round(change, 1),
                "current_amount": round(now, 2),
                "previous_amount": round(before, 2),
            }
        )

    flagged = (
        db.session.query(func.count(Transaction.id))
        .filter(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
            Transaction.is_anomaly.is_(True),
        )
        .scalar()
    )

    return {
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "total_spent": round(period_total, 2),
        "top_category": {
            "name": top.name,
            "amount": round(_as_float(top.total), 2),
            "percent_of_total": round(
                (_as_float(top.total) / period_total * 100) if period_total else 0, 1
            ),
            "transaction_count": int(top.count),
        },
        "category_changes": category_changes,
        "anomaly_count": int(flagged or 0),
        "budgets": _budget_status(user_id, current),
    }


def build_insights(user_id, start, end):
    """Gather this period's spending data and turn it into one AI-written insight.

    Returns an empty list when there's no spending data for the period.
    Raises InsightGenerationError if the Gemini call fails.
    """
    payload = _build_insight_payload(user_id, start, end)
    if payload is None:
        return []

    insight_text = insight_service.generate_insight_text(payload)

    return [
        SpendingInsight(
            user_id=user_id,
            period_start=start,
            period_end=end,
            insight_text=insight_text,
        )
    ]


def _resolve_period():
    today = date.today()
    start_raw = request.args.get("start_date") or (request.get_json(silent=True) or {}).get("start_date")
    end_raw = request.args.get("end_date") or (request.get_json(silent=True) or {}).get("end_date")

    try:
        start = (
            datetime.strptime(start_raw, "%Y-%m-%d").date()
            if start_raw
            else today - timedelta(days=DEFAULT_PERIOD_DAYS)
        )
        end = datetime.strptime(end_raw, "%Y-%m-%d").date() if end_raw else today
    except ValueError:
        return None, None, "Dates must be ISO format (YYYY-MM-DD)."

    if start > end:
        return None, None, "start_date must be on or before end_date."
    return start, end, None


@insight_bp.get("")
@jwt_required()
def list_insights():
    user_id = _current_user_id()
    limit = min(request.args.get("limit", 20, type=int), 100)

    query = SpendingInsight.query.filter_by(user_id=user_id)
    category_id = request.args.get("category_id", type=int)
    if category_id:
        query = query.filter(SpendingInsight.category_id == category_id)

    rows = query.order_by(SpendingInsight.created_at.desc()).limit(limit).all()
    return jsonify({"insights": [row.to_dict() for row in rows]}), 200


@insight_bp.post("/generate")
@jwt_required()
def generate():
    """Recompute insights for a period and persist them."""
    user_id = _current_user_id()
    start, end, error = _resolve_period()
    if error:
        return _error(error)

    replace = (request.get_json(silent=True) or {}).get("replace", True)

    try:
        insights = build_insights(user_id, start, end)
    except InsightGenerationError as exc:
        current_app.logger.warning(
            "Insight generation failed for user %s: %s", user_id, exc
        )
        return _error(str(exc), 502)

    if replace:
        SpendingInsight.query.filter_by(
            user_id=user_id, period_start=start, period_end=end
        ).delete(synchronize_session=False)

    db.session.add_all(insights)
    db.session.commit()

    return jsonify(
        {
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "generated": len(insights),
            "insights": [row.to_dict() for row in insights],
        }
    ), 201


@insight_bp.post("/rescan-anomalies")
@jwt_required()
def rescan_anomalies():
    """Re-run anomaly detection across the user's full history."""
    flagged = anomaly_service.rescan_user(_current_user_id())
    return jsonify({"flagged": flagged}), 200


@insight_bp.delete("/<int:insight_id>")
@jwt_required()
def delete_insight(insight_id):
    insight = SpendingInsight.query.filter_by(
        id=insight_id, user_id=_current_user_id()
    ).first()
    if insight is None:
        return _error("Insight not found.", 404)

    db.session.delete(insight)
    db.session.commit()
    return jsonify({"deleted": insight_id}), 200
