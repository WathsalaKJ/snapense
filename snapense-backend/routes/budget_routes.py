"""Per-category monthly budgets and progress against them."""

from calendar import monthrange
from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from models import Budget, Category, db
from routes.dashboard_routes import category_breakdown

budget_bp = Blueprint("budgets", __name__)


def _error(message, status=400):
    return jsonify({"error": message}), status


def _current_user_id():
    return int(get_jwt_identity())


def _current_month_bounds():
    today = date.today()
    start = today.replace(day=1)
    end = today.replace(day=monthrange(today.year, today.month)[1])
    return start, end


def _spent_by_category(user_id):
    start, end = _current_month_bounds()
    breakdown, _total = category_breakdown(user_id, start, end)
    return {row["category_id"]: row["total"] for row in breakdown}


def _get_owned_budget(budget_id):
    return Budget.query.filter_by(id=budget_id, user_id=_current_user_id()).first()


@budget_bp.get("")
@jwt_required()
def list_budgets():
    user_id = _current_user_id()
    spent_by_category = _spent_by_category(user_id)

    budgets = Budget.query.filter_by(user_id=user_id).order_by(Budget.id.asc()).all()
    return jsonify(
        {
            "budgets": [
                {
                    **budget.to_dict(),
                    "amount_spent_this_month": spent_by_category.get(
                        budget.category_id, 0.0
                    ),
                }
                for budget in budgets
            ]
        }
    ), 200


@budget_bp.post("")
@jwt_required()
def create_or_update_budget():
    user_id = _current_user_id()
    data = request.get_json(silent=True) or {}

    category_id = data.get("category_id")
    if not category_id:
        return _error("category_id is required.")

    if data.get("monthly_limit") is None:
        return _error("monthly_limit is required.")
    try:
        monthly_limit = float(data["monthly_limit"])
    except (TypeError, ValueError):
        return _error("monthly_limit must be a number.")
    if monthly_limit < 0:
        return _error("monthly_limit must be non-negative.")

    if db.session.get(Category, category_id) is None:
        return _error("Unknown category_id.", 404)

    budget = Budget.query.filter_by(user_id=user_id, category_id=category_id).first()
    if budget is None:
        budget = Budget(
            user_id=user_id, category_id=category_id, monthly_limit=monthly_limit
        )
        db.session.add(budget)
        status = 201
    else:
        budget.monthly_limit = monthly_limit
        status = 200

    db.session.commit()

    spent_by_category = _spent_by_category(user_id)
    return jsonify(
        {
            "budget": {
                **budget.to_dict(),
                "amount_spent_this_month": spent_by_category.get(
                    budget.category_id, 0.0
                ),
            }
        }
    ), status


@budget_bp.delete("/<int:budget_id>")
@jwt_required()
def delete_budget(budget_id):
    budget = _get_owned_budget(budget_id)
    if budget is None:
        return _error("Budget not found.", 404)

    db.session.delete(budget)
    db.session.commit()
    return jsonify({"deleted": budget_id}), 200
