"""Savings goals: progress combines auto-inferred budget surplus with
manual contributions the user logs directly. See SavingsGoal in models.py -
nothing about progress is stored, it's all computed here on each request.
"""

from datetime import date, datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from models import Budget, GoalContribution, SavingsGoal, db
from routes.dashboard_routes import (
    _as_float,
    _month_end,
    _month_start,
    _shift_months,
    category_breakdown,
)

goal_bp = Blueprint("goals", __name__)


def _error(message, status=400):
    return jsonify({"error": message}), status


def _current_user_id():
    return int(get_jwt_identity())


def _get_owned_goal(goal_id):
    return SavingsGoal.query.filter_by(id=goal_id, user_id=_current_user_id()).first()


def _parse_date(raw, field_name):
    """Returns (date_or_None, error_or_None)."""
    if raw is None:
        return None, None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date(), None
    except ValueError:
        return None, "{} must be in YYYY-MM-DD format.".format(field_name)


def _surplus_by_month(user_id, month_starts):
    """Total surplus (sum across all of the user's budgets of
    max(0, monthly_limit - amount_spent)) for each given month.

    Reuses category_breakdown() for the spend query - the same pattern
    GET /api/budgets/history uses to get every budget's category spend for
    a month in one call. Same known simplification as budget_history: each
    month is judged against every budget's CURRENT monthly_limit, since
    Budget keeps no history of past limit changes.
    """
    budgets = Budget.query.filter_by(user_id=user_id).all()
    surplus = {}
    for month_start in month_starts:
        if not budgets:
            surplus[month_start] = 0.0
            continue
        month_end = _month_end(month_start)
        breakdown, _total = category_breakdown(user_id, month_start, month_end)
        spent_by_category = {row["category_id"]: row["total"] for row in breakdown}
        surplus[month_start] = sum(
            max(
                0.0,
                float(budget.monthly_limit) - spent_by_category.get(budget.category_id, 0.0),
            )
            for budget in budgets
        )
    return surplus


def _auto_saved_by_goal(user_id, goals):
    """Automatic surplus-based savings per goal (part A of progress).

    Surplus-attribution rule - the one genuinely subjective design call in
    this feature: for each calendar month from the user's earliest goal's
    creation month through the current month, that month's TOTAL surplus
    across all budgets is split EVENLY across every goal that already
    existed during that month (created_at on or before that month's last
    day). A goal created partway through the window is simply excluded
    from the split for months before it existed, so it can never be
    retroactively credited for surplus that accrued before it was created;
    from its creation month onward it shares each month's surplus equally
    with whichever other goals were also already around at the time.

    Known simplification: the lookback isn't capped (unlike
    GET /api/budgets/history's MAX_HISTORY_MONTHS), since a goal has no
    natural end date to bound it - it runs from the earliest goal's
    creation month to the current month every time.
    """
    if not goals:
        return {}

    earliest_month = _month_start(min(goal.created_at.date() for goal in goals))
    current_month = _month_start(date.today())

    month_starts = []
    cursor = earliest_month
    while cursor <= current_month:
        month_starts.append(cursor)
        cursor = _shift_months(cursor, 1)

    surplus_by_month = _surplus_by_month(user_id, month_starts)

    auto_saved = {goal.id: 0.0 for goal in goals}
    for month_start in month_starts:
        month_end = _month_end(month_start)
        eligible = [goal for goal in goals if goal.created_at.date() <= month_end]
        if not eligible:
            continue
        share = surplus_by_month[month_start] / len(eligible)
        for goal in eligible:
            auto_saved[goal.id] += share

    return {goal_id: round(total, 2) for goal_id, total in auto_saved.items()}


def _manual_saved_by_goal(user_id, goal_ids):
    """Sum of logged GoalContribution.amount per goal (part B of progress)."""
    manual = {goal_id: 0.0 for goal_id in goal_ids}
    if not goal_ids:
        return manual

    rows = (
        db.session.query(
            GoalContribution.goal_id,
            func.coalesce(func.sum(GoalContribution.amount), 0),
        )
        .filter(
            GoalContribution.user_id == user_id,
            GoalContribution.goal_id.in_(goal_ids),
        )
        .group_by(GoalContribution.goal_id)
        .all()
    )
    manual.update({goal_id: round(_as_float(total), 2) for goal_id, total in rows})
    return manual


def _goal_payload(goal, auto_saved_amount, manual_amount):
    target_amount = float(goal.target_amount)
    current_amount = round(auto_saved_amount + manual_amount, 2)
    # percent_complete is clamped to 100 for a sane progress bar; is_complete
    # below still uses the uncapped current_amount so overshoot is detected.
    percent_complete = (
        round(min(current_amount / target_amount, 1.0) * 100, 2) if target_amount else 0.0
    )
    return {
        **goal.to_dict(),
        "auto_saved_amount": auto_saved_amount,
        "manual_amount": manual_amount,
        "current_amount": current_amount,
        "percent_complete": percent_complete,
        "is_complete": current_amount >= target_amount,
    }


def _serialize_goals(user_id, goals):
    auto_saved = _auto_saved_by_goal(user_id, goals)
    manual_saved = _manual_saved_by_goal(user_id, [goal.id for goal in goals])
    return [
        _goal_payload(goal, auto_saved[goal.id], manual_saved[goal.id]) for goal in goals
    ]


@goal_bp.get("")
@jwt_required()
def list_goals():
    user_id = _current_user_id()
    goals = SavingsGoal.query.filter_by(user_id=user_id).order_by(SavingsGoal.id.asc()).all()
    return jsonify({"goals": _serialize_goals(user_id, goals)}), 200


@goal_bp.post("")
@jwt_required()
def create_goal():
    user_id = _current_user_id()
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    if not name:
        return _error("name is required.")

    if data.get("target_amount") is None:
        return _error("target_amount is required.")
    try:
        target_amount = float(data["target_amount"])
    except (TypeError, ValueError):
        return _error("target_amount must be a number.")
    if target_amount <= 0:
        return _error("target_amount must be greater than zero.")

    target_date, error = _parse_date(data.get("target_date"), "target_date")
    if error:
        return _error(error)

    goal = SavingsGoal(
        user_id=user_id, name=name, target_amount=target_amount, target_date=target_date
    )
    db.session.add(goal)
    db.session.commit()

    return jsonify({"goal": _serialize_goals(user_id, [goal])[0]}), 201


@goal_bp.patch("/<int:goal_id>")
@jwt_required()
def update_goal(goal_id):
    user_id = _current_user_id()
    goal = _get_owned_goal(goal_id)
    if goal is None:
        return _error("Savings goal not found.", 404)

    data = request.get_json(silent=True) or {}

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return _error("name cannot be empty.")
        goal.name = name

    if "target_amount" in data:
        try:
            target_amount = float(data["target_amount"])
        except (TypeError, ValueError):
            return _error("target_amount must be a number.")
        if target_amount <= 0:
            return _error("target_amount must be greater than zero.")
        goal.target_amount = target_amount

    if "target_date" in data:
        target_date, error = _parse_date(data.get("target_date"), "target_date")
        if error:
            return _error(error)
        goal.target_date = target_date

    db.session.commit()
    return jsonify({"goal": _serialize_goals(user_id, [goal])[0]}), 200


@goal_bp.delete("/<int:goal_id>")
@jwt_required()
def delete_goal(goal_id):
    goal = _get_owned_goal(goal_id)
    if goal is None:
        return _error("Savings goal not found.", 404)

    db.session.delete(goal)
    db.session.commit()
    return jsonify({"deleted": goal_id}), 200


@goal_bp.get("/<int:goal_id>/contributions")
@jwt_required()
def list_contributions(goal_id):
    goal = _get_owned_goal(goal_id)
    if goal is None:
        return _error("Savings goal not found.", 404)

    contributions = (
        GoalContribution.query.filter_by(goal_id=goal.id)
        .order_by(GoalContribution.contributed_at.desc(), GoalContribution.id.desc())
        .all()
    )
    return jsonify(
        {"contributions": [contribution.to_dict() for contribution in contributions]}
    ), 200


@goal_bp.post("/<int:goal_id>/contributions")
@jwt_required()
def create_contribution(goal_id):
    user_id = _current_user_id()
    goal = _get_owned_goal(goal_id)
    if goal is None:
        return _error("Savings goal not found.", 404)

    data = request.get_json(silent=True) or {}

    if data.get("amount") is None:
        return _error("amount is required.")
    try:
        amount = float(data["amount"])
    except (TypeError, ValueError):
        return _error("amount must be a number.")
    if amount <= 0:
        return _error("amount must be greater than zero.")

    contributed_at, error = _parse_date(data.get("contributed_at"), "contributed_at")
    if error:
        return _error(error)

    contribution = GoalContribution(
        goal_id=goal.id,
        user_id=user_id,
        amount=amount,
        note=data.get("note") or None,
        contributed_at=contributed_at or date.today(),
    )
    db.session.add(contribution)
    db.session.commit()

    return jsonify({"contribution": contribution.to_dict()}), 201


@goal_bp.delete("/<int:goal_id>/contributions/<int:contribution_id>")
@jwt_required()
def delete_contribution(goal_id, contribution_id):
    goal = _get_owned_goal(goal_id)
    if goal is None:
        return _error("Savings goal not found.", 404)

    contribution = GoalContribution.query.filter_by(
        id=contribution_id, goal_id=goal.id, user_id=_current_user_id()
    ).first()
    if contribution is None:
        return _error("Contribution not found.", 404)

    db.session.delete(contribution)
    db.session.commit()
    return jsonify({"deleted": contribution_id}), 200
