"""Stored spending insights, plus on-demand generation from recent activity."""

from datetime import date, datetime, timedelta
from decimal import Decimal

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from models import Category, SpendingInsight, Transaction, db
from services import anomaly_service

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


def build_insights(user_id, start, end):
    """Derive insight rows for a period. Returns unsaved SpendingInsight objects."""
    current = _category_totals(user_id, start, end)
    if not current:
        return []

    span = max((end - start).days, 1)
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=span)
    previous = {row.id: _as_float(row.total) for row in _category_totals(user_id, previous_start, previous_end)}

    period_total = sum(_as_float(row.total) for row in current)
    insights = []

    top = current[0]
    insights.append(
        SpendingInsight(
            user_id=user_id,
            category_id=top.id,
            period_start=start,
            period_end=end,
            insight_text=(
                "{} was your largest category at {:.2f} across {} transactions, "
                "or {:.0f}% of the {:.2f} you spent this period.".format(
                    top.name,
                    _as_float(top.total),
                    int(top.count),
                    (_as_float(top.total) / period_total * 100) if period_total else 0,
                    period_total,
                )
            ),
        )
    )

    for row in current:
        before = previous.get(row.id)
        now = _as_float(row.total)
        if not before:
            continue
        change = (now - before) / before * 100
        if abs(change) < 25:
            continue
        direction = "up" if change > 0 else "down"
        insights.append(
            SpendingInsight(
                user_id=user_id,
                category_id=row.id,
                period_start=start,
                period_end=end,
                insight_text=(
                    "{} spending is {} {:.0f}% versus the previous period "
                    "({:.2f} vs {:.2f}).".format(
                        row.name, direction, abs(change), now, before
                    )
                ),
            )
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
    if flagged:
        insights.append(
            SpendingInsight(
                user_id=user_id,
                period_start=start,
                period_end=end,
                insight_text=(
                    "{} transaction(s) this period were flagged as unusual and "
                    "are worth a review.".format(int(flagged))
                ),
            )
        )

    return insights


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
    if replace:
        SpendingInsight.query.filter_by(
            user_id=user_id, period_start=start, period_end=end
        ).delete(synchronize_session=False)

    insights = build_insights(user_id, start, end)
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
