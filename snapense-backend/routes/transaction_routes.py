"""Transaction CRUD. Receipt upload lives in routes/receipt_routes.py."""

from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from models import Category, LineItem, Transaction, db
from services import anomaly_service, categorization_service
from utils import file_storage

transaction_bp = Blueprint("transactions", __name__)

MAX_PAGE_SIZE = 100


def _error(message, status=400):
    return jsonify({"error": message}), status


def _current_user_id():
    return int(get_jwt_identity())


def _parse_date(value, field="transaction_date"):
    """Return (date, error_message)."""
    if value in (None, ""):
        return None, None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date(), None
    except ValueError:
        return None, "{} must be an ISO date (YYYY-MM-DD).".format(field)


def _get_owned_transaction(transaction_id):
    return Transaction.query.filter_by(
        id=transaction_id, user_id=_current_user_id()
    ).first()


def _apply_line_items(transaction, raw_items):
    transaction.line_items.clear()
    for raw in raw_items or []:
        name = (raw.get("item_name") or "").strip()
        if not name:
            continue
        transaction.line_items.append(
            LineItem(
                item_name=name[:200],
                quantity=raw.get("quantity") or 1,
                unit_price=raw.get("unit_price"),
                line_total=raw.get("line_total"),
                category_id=raw.get("category_id"),
            )
        )


@transaction_bp.get("")
@jwt_required()
def list_transactions():
    user_id = _current_user_id()
    query = Transaction.query.filter_by(user_id=user_id)

    # ?category= accepts either a numeric id or a category name; ?category_id=
    # stays supported for callers that already have the id.
    category_id = request.args.get("category_id", type=int)
    category_raw = (request.args.get("category") or "").strip()
    if category_raw and not category_id:
        if category_raw.isdigit():
            category_id = int(category_raw)
        else:
            match = Category.query.filter(
                func.lower(Category.name) == category_raw.lower()
            ).first()
            if match is None:
                return _error("Unknown category '{}'.".format(category_raw), 404)
            category_id = match.id

    if category_id:
        query = query.filter(Transaction.category_id == category_id)

    if request.args.get("is_anomaly") in ("true", "1"):
        query = query.filter(Transaction.is_anomaly.is_(True))

    start, error = _parse_date(request.args.get("start_date"), "start_date")
    if error:
        return _error(error)
    if start:
        query = query.filter(Transaction.transaction_date >= start)

    end, error = _parse_date(request.args.get("end_date"), "end_date")
    if error:
        return _error(error)
    if end:
        query = query.filter(Transaction.transaction_date <= end)

    search = (request.args.get("q") or "").strip()
    if search:
        query = query.filter(Transaction.merchant_name.ilike("%{}%".format(search)))

    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(request.args.get("per_page", 25, type=int), MAX_PAGE_SIZE)

    pagination = query.order_by(
        Transaction.transaction_date.desc().nullslast(), Transaction.id.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify(
        {
            "transactions": [t.to_dict() for t in pagination.items],
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "pages": pagination.pages,
        }
    ), 200


@transaction_bp.get("/<int:transaction_id>")
@jwt_required()
def get_transaction(transaction_id):
    transaction = _get_owned_transaction(transaction_id)
    if transaction is None:
        return _error("Transaction not found.", 404)
    return jsonify({"transaction": transaction.to_dict()}), 200


@transaction_bp.post("")
@jwt_required()
def create_transaction():
    user_id = _current_user_id()
    data = request.get_json(silent=True) or {}

    if data.get("total_amount") is None:
        return _error("total_amount is required.")

    transaction_date, error = _parse_date(data.get("transaction_date"))
    if error:
        return _error(error)

    transaction = Transaction(
        user_id=user_id,
        merchant_name=(data.get("merchant_name") or "").strip()[:200] or None,
        transaction_date=transaction_date,
        total_amount=data["total_amount"],
        tax_amount=data.get("tax_amount"),
        category_id=data.get("category_id"),
        receipt_image_url=data.get("receipt_image_url"),
        ocr_raw_text=data.get("ocr_raw_text"),
        ocr_confidence=data.get("ocr_confidence"),
    )
    _apply_line_items(transaction, data.get("line_items"))

    db.session.add(transaction)
    db.session.flush()

    categorization_service.categorize_transaction(transaction)
    categorization_service.categorize_line_items(transaction)
    anomaly_service.flag_transaction(transaction)

    db.session.commit()
    return jsonify({"transaction": transaction.to_dict()}), 201


@transaction_bp.patch("/<int:transaction_id>")
@jwt_required()
def update_transaction(transaction_id):
    transaction = _get_owned_transaction(transaction_id)
    if transaction is None:
        return _error("Transaction not found.", 404)

    data = request.get_json(silent=True) or {}

    if "transaction_date" in data:
        transaction_date, error = _parse_date(data.get("transaction_date"))
        if error:
            return _error(error)
        transaction.transaction_date = transaction_date

    for field in ("merchant_name", "total_amount", "tax_amount", "category_id"):
        if field in data:
            setattr(transaction, field, data[field])

    if "line_items" in data:
        _apply_line_items(transaction, data.get("line_items"))
        db.session.flush()
        categorization_service.categorize_line_items(transaction)

    anomaly_service.flag_transaction(transaction)
    db.session.commit()
    return jsonify({"transaction": transaction.to_dict()}), 200


@transaction_bp.delete("/<int:transaction_id>")
@jwt_required()
def delete_transaction(transaction_id):
    transaction = _get_owned_transaction(transaction_id)
    if transaction is None:
        return _error("Transaction not found.", 404)

    receipt = transaction.receipt_image_url
    db.session.delete(transaction)
    db.session.commit()

    if receipt:
        file_storage.delete_receipt(receipt)

    return jsonify({"deleted": transaction_id}), 200


@transaction_bp.get("/categories")
@jwt_required()
def list_categories():
    categories = Category.query.order_by(Category.id.asc()).all()
    return jsonify({"categories": [c.to_dict() for c in categories]}), 200
