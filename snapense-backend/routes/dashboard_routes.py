"""Aggregate spending views for the app's dashboard screens.

The month grouping uses ``extract`` rather than ``date_trunc`` so the same
queries run on Postgres and on SQLite (which the test suite uses).
"""

from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from models import Category, Transaction, db

dashboard_bp = Blueprint("dashboard", __name__)

TREND_MONTHS = 6
DEFAULT_ANOMALY_LIMIT = 20


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


def _month_start(value):
    return value.replace(day=1)


def _shift_months(value, months):
    """Move a date by whole months, clamping the day to the target month."""
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


def _month_end(value):
    return value.replace(day=monthrange(value.year, value.month)[1])


def _period_filter(user_id, start, end):
    return (
        Transaction.user_id == user_id,
        Transaction.transaction_date >= start,
        Transaction.transaction_date <= end,
    )


def _resolve_period():
    """Return (start, end, error). Defaults to the trailing 30 days."""
    today = date.today()
    start_raw = request.args.get("start_date")
    end_raw = request.args.get("end_date")

    try:
        start = (
            datetime.strptime(start_raw, "%Y-%m-%d").date()
            if start_raw
            else today - timedelta(days=30)
        )
        end = datetime.strptime(end_raw, "%Y-%m-%d").date() if end_raw else today
    except ValueError:
        return None, None, "Dates must be ISO format (YYYY-MM-DD)."

    if start > end:
        return None, None, "start_date must be on or before end_date."
    return start, end, None


def period_totals(user_id, start, end):
    """Headline numbers for a date range."""
    totals = (
        db.session.query(
            func.coalesce(func.sum(Transaction.total_amount), 0),
            func.count(Transaction.id),
            func.coalesce(func.avg(Transaction.total_amount), 0),
            func.coalesce(func.sum(Transaction.tax_amount), 0),
        )
        .filter(*_period_filter(user_id, start, end))
        .one()
    )

    anomaly_count = (
        db.session.query(func.count(Transaction.id))
        .filter(*_period_filter(user_id, start, end), Transaction.is_anomaly.is_(True))
        .scalar()
    )

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total_spent": round(_as_float(totals[0]), 2),
        "transaction_count": int(totals[1] or 0),
        "average_transaction": round(_as_float(totals[2]), 2),
        "total_tax": round(_as_float(totals[3]), 2),
        "anomaly_count": int(anomaly_count or 0),
    }


def category_breakdown(user_id, start, end):
    """Spend per category over a date range, with each category's share."""
    rows = (
        db.session.query(
            Category.id,
            Category.name,
            Category.color_hex,
            Category.icon_name,
            func.coalesce(func.sum(Transaction.total_amount), 0).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(*_period_filter(user_id, start, end))
        .group_by(Category.id, Category.name, Category.color_hex, Category.icon_name)
        .order_by(func.sum(Transaction.total_amount).desc())
        .all()
    )

    grand_total = sum(_as_float(row.total) for row in rows)
    return [
        {
            "category_id": row.id,
            "name": row.name,
            "color_hex": row.color_hex,
            "icon_name": row.icon_name,
            "total": round(_as_float(row.total), 2),
            "transaction_count": int(row.count),
            "share_pct": (
                round(_as_float(row.total) / grand_total * 100, 2)
                if grand_total
                else 0.0
            ),
        }
        for row in rows
    ], round(grand_total, 2)


def monthly_trend(user_id, months=TREND_MONTHS, reference=None):
    """Spend per calendar month, oldest first, with empty months zero-filled."""
    reference = reference or date.today()
    first_month = _month_start(_shift_months(_month_start(reference), -(months - 1)))
    last_day = _month_end(reference)

    year_col = func.extract("year", Transaction.transaction_date)
    month_col = func.extract("month", Transaction.transaction_date)

    rows = (
        db.session.query(
            year_col.label("year"),
            month_col.label("month"),
            func.coalesce(func.sum(Transaction.total_amount), 0).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .filter(*_period_filter(user_id, first_month, last_day))
        .group_by(year_col, month_col)
        .all()
    )

    totals = {
        (int(row.year), int(row.month)): (_as_float(row.total), int(row.count))
        for row in rows
    }

    points = []
    for offset in range(months):
        bucket = _shift_months(first_month, offset)
        total, count = totals.get((bucket.year, bucket.month), (0.0, 0))
        points.append(
            {
                "month": bucket.strftime("%Y-%m"),
                "total": round(total, 2),
                "transaction_count": count,
            }
        )
    return points


def recent_anomalies(user_id, limit=DEFAULT_ANOMALY_LIMIT):
    transactions = (
        Transaction.query.filter_by(user_id=user_id, is_anomaly=True)
        .order_by(Transaction.transaction_date.desc().nullslast(), Transaction.id.desc())
        .limit(limit)
        .all()
    )
    return [t.to_dict(include_line_items=False) for t in transactions]


@dashboard_bp.get("/summary")
@jwt_required()
def summary():
    """Everything the dashboard screen needs in one round trip.

    Defaults to the current calendar month; pass ?month=YYYY-MM to look back.
    """
    user_id = _current_user_id()

    month_raw = request.args.get("month")
    if month_raw:
        try:
            reference = datetime.strptime(month_raw, "%Y-%m").date()
        except ValueError:
            return _error("month must be in YYYY-MM format.")
        end = _month_end(reference)
    else:
        reference = date.today()
        end = reference

    start = _month_start(reference)

    current = period_totals(user_id, start, end)

    previous_month = _shift_months(start, -1)
    previous = period_totals(
        user_id, previous_month, _month_end(previous_month)
    )
    change_pct = (
        round(
            (current["total_spent"] - previous["total_spent"])
            / previous["total_spent"]
            * 100,
            2,
        )
        if previous["total_spent"]
        else None
    )

    breakdown, breakdown_total = category_breakdown(user_id, start, end)
    limit = min(request.args.get("anomaly_limit", DEFAULT_ANOMALY_LIMIT, type=int), 100)

    return jsonify(
        {
            "month": {
                **current,
                "label": start.strftime("%Y-%m"),
                "previous_month_total": previous["total_spent"],
                "change_pct": change_pct,
            },
            "by_category": breakdown,
            "by_category_total": breakdown_total,
            "monthly_trend": monthly_trend(user_id, TREND_MONTHS, reference),
            "anomalies": recent_anomalies(user_id, limit),
        }
    ), 200


@dashboard_bp.get("/by-category")
@jwt_required()
def by_category():
    user_id = _current_user_id()
    start, end, error = _resolve_period()
    if error:
        return _error(error)

    breakdown, total = category_breakdown(user_id, start, end)
    return jsonify(
        {
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "total": total,
            "categories": breakdown,
        }
    ), 200


@dashboard_bp.get("/trend")
@jwt_required()
def trend():
    """Daily or monthly spend totals across the period."""
    user_id = _current_user_id()
    granularity = request.args.get("granularity", "month")
    if granularity not in ("day", "month"):
        return _error("granularity must be 'day' or 'month'.")

    if granularity == "month":
        months = min(max(request.args.get("months", TREND_MONTHS, type=int), 1), 36)
        return jsonify(
            {"granularity": "month", "points": monthly_trend(user_id, months)}
        ), 200

    start, end, error = _resolve_period()
    if error:
        return _error(error)

    rows = (
        db.session.query(
            Transaction.transaction_date.label("bucket"),
            func.coalesce(func.sum(Transaction.total_amount), 0).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .filter(*_period_filter(user_id, start, end))
        .group_by(Transaction.transaction_date)
        .order_by(Transaction.transaction_date.asc())
        .all()
    )

    return jsonify(
        {
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "granularity": "day",
            "points": [
                {
                    "bucket": row.bucket.isoformat(),
                    "total": round(_as_float(row.total), 2),
                    "transaction_count": int(row.count),
                }
                for row in rows
            ],
        }
    ), 200


@dashboard_bp.get("/top-merchants")
@jwt_required()
def top_merchants():
    user_id = _current_user_id()
    start, end, error = _resolve_period()
    if error:
        return _error(error)

    limit = min(request.args.get("limit", 5, type=int), 50)
    rows = (
        db.session.query(
            Transaction.merchant_name,
            func.coalesce(func.sum(Transaction.total_amount), 0).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .filter(
            *_period_filter(user_id, start, end),
            Transaction.merchant_name.isnot(None),
        )
        .group_by(Transaction.merchant_name)
        .order_by(func.sum(Transaction.total_amount).desc())
        .limit(limit)
        .all()
    )

    return jsonify(
        {
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "merchants": [
                {
                    "merchant_name": row.merchant_name,
                    "total": round(_as_float(row.total), 2),
                    "transaction_count": int(row.count),
                }
                for row in rows
            ],
        }
    ), 200


@dashboard_bp.get("/anomalies")
@jwt_required()
def anomalies():
    user_id = _current_user_id()
    limit = min(request.args.get("limit", DEFAULT_ANOMALY_LIMIT, type=int), 100)
    return jsonify({"anomalies": recent_anomalies(user_id, limit)}), 200
