"""Receipt upload: image in, fully-populated transaction out."""

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt_identity, jwt_required

from models import LineItem, Transaction, db
from services import anomaly_service, ocr_service
from services.ocr_service import OcrError
from utils import file_storage

receipt_bp = Blueprint("receipts", __name__)


def _error(message, status=400):
    return jsonify({"error": message}), status


def _current_user_id():
    return int(get_jwt_identity())


@receipt_bp.post("/upload")
@jwt_required()
def upload_receipt():
    """Accept a multipart receipt image and turn it into a transaction.

    Pipeline: store the image -> read it with the vision LLM -> build the
    Transaction and its LineItems -> run anomaly detection -> return the
    full transaction.
    """
    user_id = _current_user_id()

    upload = (
        request.files.get("receipt")
        or request.files.get("file")
        or request.files.get("image")
    )
    if upload is None or not upload.filename:
        return _error("A receipt image is required in the 'receipt' field.")
    if not file_storage.allowed_file(upload.filename):
        return _error(
            "Unsupported file type. Allowed: {}.".format(
                ", ".join(sorted(current_app.config["ALLOWED_EXTENSIONS"]))
            )
        )

    absolute_path, relative_path = file_storage.save_receipt(upload, user_id)

    try:
        receipt = ocr_service.extract_receipt(absolute_path)
    except OcrError as exc:
        # Nothing usable came back, so don't leave a half-built transaction or
        # an orphaned image behind.
        file_storage.delete_receipt(relative_path)
        current_app.logger.warning("Receipt OCR failed for user %s: %s", user_id, exc)
        return _error(str(exc), 502)

    transaction = Transaction(
        user_id=user_id,
        merchant_name=receipt["merchant_name"],
        transaction_date=receipt["transaction_date"],
        total_amount=receipt["total_amount"] or 0,
        tax_amount=receipt["tax_amount"],
        category_id=receipt["category_id"],
        receipt_image_url=relative_path,
        ocr_raw_text=receipt.get("raw_response"),
    )

    for item in receipt["line_items"]:
        transaction.line_items.append(
            LineItem(
                item_name=item["item_name"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                line_total=item["line_total"],
                category_id=item.get("category_id"),
            )
        )

    db.session.add(transaction)
    db.session.flush()

    anomaly_service.flag_transaction(transaction)
    db.session.commit()

    return jsonify(
        {
            "transaction": transaction.to_dict(),
            "receipt_image_url": file_storage.public_url(relative_path),
            "needs_review": not receipt["total_amount"],
        }
    ), 201


@receipt_bp.get("/<path:path>")
@jwt_required()
def serve_receipt(path):
    """Serve a stored receipt image, scoped to the owning user."""
    user_id = _current_user_id()
    if not path.startswith("{}/".format(user_id)):
        return _error("Receipt not found.", 404)
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], path)
