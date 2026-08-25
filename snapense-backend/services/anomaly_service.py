"""Anomaly detection over a user's spending history.

Three independent checks run against each transaction; the first that fires
sets ``is_anomaly`` and a human-readable ``anomaly_reason``:

1. Statistical outlier - the amount sits more than ANOMALY_ZSCORE_THRESHOLD
   standard deviations above the user's mean for that category. Needs at least
   ANOMALY_MIN_HISTORY prior transactions in the category, and skips silently
   below that rather than flagging on a thin sample.
2. Duplicate receipt - same merchant, same amount, same day.
3. Category spike - this month's category spend is far above the trailing
   monthly average.
"""

import statistics
from datetime import timedelta
from decimal import Decimal

from flask import current_app
from sqlalchemy import func

from models import Category, Transaction, db

DUPLICATE_WINDOW_DAYS = 1
SPIKE_MULTIPLIER = 2.0


def _to_float(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _threshold():
    return float(current_app.config.get("ANOMALY_ZSCORE_THRESHOLD", 2.5))


def _min_history():
    return int(current_app.config.get("ANOMALY_MIN_HISTORY", 5))


def _history_amounts(user_id, category_id, exclude_id=None):
    query = Transaction.query.filter(
        Transaction.user_id == user_id,
        Transaction.category_id == category_id,
    )
    if exclude_id is not None:
        query = query.filter(Transaction.id != exclude_id)
    return [
        _to_float(amount)
        for (amount,) in query.with_entities(Transaction.total_amount).all()
        if amount is not None
    ]


def _category_name(category_id):
    if category_id is None:
        return None
    category = db.session.get(Category, category_id)
    return category.name if category else None


def _outlier_reason(amount, mean, category_id):
    """Phrase the flag as a multiple of the user's average, which reads better
    to a person than a z-score does."""
    name = _category_name(category_id)
    label = "{} spend".format(name) if name else "spend in this category"
    if mean > 0:
        return "This is {:.1f}x higher than your average {}.".format(
            amount / mean, label
        )
    return "This is well above your average {}.".format(label)


def check_statistical_outlier(transaction):
    """Flag amounts far above the user's own average for that category.

    Skips quietly when there is not enough history for the mean and standard
    deviation to mean anything.
    """
    amount = _to_float(transaction.total_amount)
    if amount is None or transaction.category_id is None:
        return None

    history = _history_amounts(
        transaction.user_id, transaction.category_id, exclude_id=transaction.id
    )
    if len(history) < _min_history():
        return None

    mean = statistics.fmean(history)
    stdev = statistics.pstdev(history)

    if stdev <= 0:
        # Every prior transaction was the same amount; fall back to a ratio.
        if amount > mean * SPIKE_MULTIPLIER:
            return _outlier_reason(amount, mean, transaction.category_id)
        return None

    zscore = (amount - mean) / stdev
    if zscore >= _threshold():
        return _outlier_reason(amount, mean, transaction.category_id)
    return None


def check_duplicate(transaction):
    """Flag a probable double-scan of the same receipt."""
    if not transaction.merchant_name or transaction.transaction_date is None:
        return None

    window_start = transaction.transaction_date - timedelta(days=DUPLICATE_WINDOW_DAYS)
    window_end = transaction.transaction_date + timedelta(days=DUPLICATE_WINDOW_DAYS)

    query = Transaction.query.filter(
        Transaction.user_id == transaction.user_id,
        Transaction.merchant_name == transaction.merchant_name,
        Transaction.total_amount == transaction.total_amount,
        Transaction.transaction_date.between(window_start, window_end),
    )
    if transaction.id is not None:
        query = query.filter(Transaction.id != transaction.id)

    if query.first() is not None:
        return "Possible duplicate: same merchant and amount already recorded near this date."
    return None


def check_category_spike(transaction):
    """Flag a category whose current-month spend jumped past its own trend."""
    if transaction.category_id is None or transaction.transaction_date is None:
        return None

    period_start = transaction.transaction_date.replace(day=1)
    baseline_start = period_start - timedelta(days=180)

    current_total = (
        db.session.query(func.coalesce(func.sum(Transaction.total_amount), 0))
        .filter(
            Transaction.user_id == transaction.user_id,
            Transaction.category_id == transaction.category_id,
            Transaction.transaction_date >= period_start,
        )
        .scalar()
    )

    monthly_totals = (
        db.session.query(
            func.sum(Transaction.total_amount).label("total"),
        )
        .filter(
            Transaction.user_id == transaction.user_id,
            Transaction.category_id == transaction.category_id,
            Transaction.transaction_date >= baseline_start,
            Transaction.transaction_date < period_start,
        )
        .group_by(
            func.extract("year", Transaction.transaction_date),
            func.extract("month", Transaction.transaction_date),
        )
        .all()
    )

    baseline = [_to_float(row.total) for row in monthly_totals if row.total is not None]
    if len(baseline) < 2:
        return None

    average = statistics.fmean(baseline)
    current = _to_float(current_total) or 0.0
    if average > 0 and current > average * SPIKE_MULTIPLIER:
        return (
            "This category is at {:.2f} this month versus a {:.2f} monthly "
            "average.".format(current, average)
        )
    return None


CHECKS = (check_statistical_outlier, check_duplicate, check_category_spike)


def evaluate(transaction):
    """Return the first anomaly reason found, or None."""
    for check in CHECKS:
        reason = check(transaction)
        if reason:
            return reason
    return None


def flag_transaction(transaction, commit=False):
    """Set is_anomaly/anomaly_reason on the transaction in place."""
    reason = evaluate(transaction)
    transaction.is_anomaly = reason is not None
    transaction.anomaly_reason = reason
    if commit:
        db.session.commit()
    return transaction


def rescan_user(user_id):
    """Re-evaluate every transaction for a user; returns the flagged count."""
    flagged = 0
    transactions = (
        Transaction.query.filter_by(user_id=user_id)
        .order_by(Transaction.transaction_date.asc(), Transaction.id.asc())
        .all()
    )
    for transaction in transactions:
        flag_transaction(transaction)
        if transaction.is_anomaly:
            flagged += 1
    db.session.commit()
    return flagged
