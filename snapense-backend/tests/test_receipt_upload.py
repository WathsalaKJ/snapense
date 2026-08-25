"""Tests for POST /api/receipts/upload with the vision LLM mocked out.

The mock replaces ``ocr_service._call_vision_model`` -- the single seam where
the app talks to the provider -- so everything downstream of the network call
(JSON parsing, validation, category mapping, Transaction/LineItem creation,
anomaly detection) runs for real.
"""

import io
import json
from datetime import date

import pytest
from PIL import Image

from models import Category, LineItem, Transaction, db
from services import ocr_service

UPLOAD_URL = "/api/receipts/upload"


GOOD_RESPONSE = {
    "merchant_name": "Whole Foods Market",
    "transaction_date": "2026-08-20",
    "total_amount": 54.30,
    "tax_amount": 3.10,
    "line_items": [
        {
            "item_name": "Organic Milk",
            "quantity": 2,
            "unit_price": 3.50,
            "line_total": 7.00,
            "suggested_category": "Groceries",
        },
        {
            "item_name": "Sourdough Bread",
            "quantity": 1,
            "unit_price": 4.25,
            "line_total": 4.25,
            "suggested_category": "Groceries",
        },
    ],
}


@pytest.fixture()
def receipt_image():
    """A small in-memory PNG standing in for a photo of a receipt."""

    def _make():
        buffer = io.BytesIO()
        Image.new("RGB", (48, 64), color="white").save(buffer, format="PNG")
        buffer.seek(0)
        return {"receipt": (buffer, "receipt.png")}

    return _make


@pytest.fixture()
def mock_llm(monkeypatch):
    """Point the vision-model seam at a canned response."""

    def _install(payload):
        text = payload if isinstance(payload, str) else json.dumps(payload)
        calls = []

        def fake_call(image_bytes, mime_type):
            calls.append({"bytes": image_bytes, "mime_type": mime_type})
            return text

        monkeypatch.setattr(ocr_service, "_call_vision_model", fake_call)
        return calls

    return _install


class TestUploadHappyPath:
    def test_creates_transaction_with_line_items(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        mock_llm(GOOD_RESPONSE)

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        body = response.get_json()

        assert response.status_code == 201, body
        transaction = body["transaction"]
        assert transaction["merchant_name"] == "Whole Foods Market"
        assert transaction["transaction_date"] == "2026-08-20"
        assert transaction["total_amount"] == 54.30
        assert transaction["tax_amount"] == 3.10
        assert len(transaction["line_items"]) == 2
        assert body["needs_review"] is False

        assert Transaction.query.count() == 1
        assert LineItem.query.count() == 2

    def test_maps_suggested_category_to_a_real_foreign_key(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        mock_llm(GOOD_RESPONSE)
        client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )

        groceries = Category.query.filter_by(name="Groceries").one()
        transaction = Transaction.query.one()
        assert transaction.category_id == groceries.id
        assert all(item.category_id == groceries.id for item in transaction.line_items)

    def test_stores_the_image_and_raw_response(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        mock_llm(GOOD_RESPONSE)
        body = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        ).get_json()

        transaction = Transaction.query.one()
        assert transaction.receipt_image_url
        assert "Whole Foods" in transaction.ocr_raw_text
        assert body["receipt_image_url"].startswith("/api/receipts/")

    def test_sends_the_image_bytes_to_the_model(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        calls = mock_llm(GOOD_RESPONSE)
        client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )

        assert len(calls) == 1
        assert calls[0]["mime_type"] == "image/png"
        assert calls[0]["bytes"].startswith(b"\x89PNG")

    def test_accepts_a_fenced_json_response(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        """Models often wrap JSON in markdown fences despite instructions."""
        mock_llm("```json\n" + json.dumps(GOOD_RESPONSE) + "\n```")

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        assert response.status_code == 201
        assert response.get_json()["transaction"]["total_amount"] == 54.30

    def test_tolerates_prose_around_the_json(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        mock_llm(
            "Here is the receipt data:\n"
            + json.dumps(GOOD_RESPONSE)
            + "\nLet me know if you need anything else."
        )

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        assert response.status_code == 201


class TestUploadDegradedResponses:
    def test_malformed_json_returns_502_and_creates_nothing(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        mock_llm("{'merchant_name': 'Broken', total_amount: }")

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )

        assert response.status_code == 502
        assert "JSON" in response.get_json()["error"]
        assert Transaction.query.count() == 0
        assert LineItem.query.count() == 0

    def test_non_json_response_returns_502(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        mock_llm("I'm sorry, I can't read that image.")

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        assert response.status_code == 502
        assert Transaction.query.count() == 0

    def test_empty_receipt_returns_502(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        mock_llm(
            {
                "merchant_name": None,
                "transaction_date": None,
                "total_amount": None,
                "tax_amount": None,
                "line_items": [],
            }
        )

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        assert response.status_code == 502
        assert Transaction.query.count() == 0

    def test_unknown_suggested_category_falls_back_instead_of_failing(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        """A hallucinated category must never become a dangling foreign key."""
        payload = {
            **GOOD_RESPONSE,
            "merchant_name": "Mystery Shop",
            "line_items": [
                {
                    "item_name": "Unidentifiable Thing",
                    "quantity": 1,
                    "unit_price": 9.99,
                    "line_total": 9.99,
                    "suggested_category": "Interdimensional Snacks",
                }
            ],
        }
        mock_llm(payload)

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )

        assert response.status_code == 201
        transaction = Transaction.query.one()
        assert transaction.category_id is not None
        assert db.session.get(Category, transaction.category_id).name == "Other"

    def test_missing_total_is_recovered_from_line_items(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        payload = {**GOOD_RESPONSE, "total_amount": None}
        mock_llm(payload)

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )

        assert response.status_code == 201
        # 7.00 + 4.25 line items, plus the 3.10 of tax the model did report.
        assert response.get_json()["transaction"]["total_amount"] == 14.35

    def test_string_amounts_are_coerced(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        payload = {**GOOD_RESPONSE, "total_amount": "$1,054.30", "tax_amount": "3.10"}
        mock_llm(payload)

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        assert response.status_code == 201
        assert response.get_json()["transaction"]["total_amount"] == 1054.30

    def test_garbage_line_items_are_dropped_not_fatal(
        self, client, auth_headers, receipt_image, mock_llm
    ):
        payload = {
            **GOOD_RESPONSE,
            "line_items": [
                {"item_name": "Valid Item", "quantity": 1, "line_total": 5.00},
                {"item_name": "", "line_total": 3.00},
                {"quantity": 2},
                "not-an-object",
                None,
            ],
        }
        mock_llm(payload)

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )

        assert response.status_code == 201
        assert len(response.get_json()["transaction"]["line_items"]) == 1


class TestUploadValidation:
    def test_requires_authentication(self, client, receipt_image):
        response = client.post(
            UPLOAD_URL, data=receipt_image(), content_type="multipart/form-data"
        )
        assert response.status_code == 401

    def test_requires_a_file(self, client, auth_headers):
        response = client.post(
            UPLOAD_URL, data={}, headers=auth_headers, content_type="multipart/form-data"
        )
        assert response.status_code == 400
        assert "required" in response.get_json()["error"]

    def test_rejects_unsupported_file_types(self, client, auth_headers, mock_llm):
        mock_llm(GOOD_RESPONSE)
        data = {"receipt": (io.BytesIO(b"MZ\x90\x00"), "malware.exe")}

        response = client.post(
            UPLOAD_URL,
            data=data,
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        assert response.status_code == 400
        assert "Unsupported file type" in response.get_json()["error"]
        assert Transaction.query.count() == 0


class TestUploadAnomalyDetection:
    def _seed_history(self, user_id, amounts):
        groceries = Category.query.filter_by(name="Groceries").one()
        for index, amount in enumerate(amounts):
            db.session.add(
                Transaction(
                    user_id=user_id,
                    merchant_name="Corner Store {}".format(index),
                    transaction_date=date(2026, 7, index + 1),
                    total_amount=amount,
                    category_id=groceries.id,
                )
            )
        db.session.commit()

    def test_outlier_is_flagged_with_a_readable_reason(
        self, client, auth_headers, registered_user, receipt_image, mock_llm
    ):
        self._seed_history(registered_user["user"]["id"], [20, 21, 22, 23, 24, 25])
        mock_llm({**GOOD_RESPONSE, "total_amount": 900.00, "line_items": []})

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        transaction = response.get_json()["transaction"]

        assert transaction["is_anomaly"] is True
        assert "higher than your average Groceries spend" in transaction["anomaly_reason"]

    def test_thin_history_is_skipped_gracefully(
        self, client, auth_headers, registered_user, receipt_image, mock_llm
    ):
        """Fewer than ANOMALY_MIN_HISTORY prior rows: no flag, no error."""
        self._seed_history(registered_user["user"]["id"], [20, 21])
        mock_llm({**GOOD_RESPONSE, "total_amount": 900.00, "line_items": []})

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        transaction = response.get_json()["transaction"]

        assert response.status_code == 201
        assert transaction["is_anomaly"] is False
        assert transaction["anomaly_reason"] is None

    def test_normal_amount_is_not_flagged(
        self, client, auth_headers, registered_user, receipt_image, mock_llm
    ):
        self._seed_history(registered_user["user"]["id"], [50, 52, 54, 56, 58, 60])
        mock_llm({**GOOD_RESPONSE, "total_amount": 55.00, "line_items": []})

        response = client.post(
            UPLOAD_URL,
            data=receipt_image(),
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        assert response.get_json()["transaction"]["is_anomaly"] is False
