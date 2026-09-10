"""Tests for /api/transactions: manual (no-image) create, and delete.

There was previously no dedicated test file for this blueprint at all, even
though it backs both receipt-derived and manually-entered transactions.
"""

from datetime import date

from models import Category, LineItem, Transaction, db

TRANSACTIONS_URL = "/api/transactions"


def _category_id(name):
    return Category.query.filter_by(name=name).one().id


def _seed_transaction(user_id, category_id=None, amount=25.0, when=None):
    transaction = Transaction(
        user_id=user_id,
        merchant_name="Test Merchant",
        transaction_date=when or date.today(),
        total_amount=amount,
        category_id=category_id,
    )
    db.session.add(transaction)
    db.session.commit()
    return transaction


class TestCreateTransaction:
    """POST /api/transactions - manual entry, no receipt image."""

    def test_requires_authentication(self, client):
        response = client.post(TRANSACTIONS_URL, json={"total_amount": 10})
        assert response.status_code == 401

    def test_creates_a_minimal_transaction(self, client, auth_headers):
        response = client.post(
            TRANSACTIONS_URL,
            json={"merchant_name": "Corner Store", "total_amount": 12.5},
            headers=auth_headers,
        )
        body = response.get_json()

        assert response.status_code == 201, body
        transaction = body["transaction"]
        assert transaction["merchant_name"] == "Corner Store"
        assert transaction["total_amount"] == 12.5
        assert transaction["receipt_image_url"] is None
        assert Transaction.query.count() == 1

    def test_creates_with_category_date_tax_and_line_items(self, client, auth_headers):
        category_id = _category_id("Groceries")
        response = client.post(
            TRANSACTIONS_URL,
            json={
                "merchant_name": "Whole Foods",
                "transaction_date": "2026-08-20",
                "total_amount": 54.30,
                "tax_amount": 3.10,
                "category_id": category_id,
                "line_items": [
                    {"item_name": "Milk", "quantity": 1, "unit_price": 3.5, "line_total": 3.5},
                ],
            },
            headers=auth_headers,
        )
        body = response.get_json()

        assert response.status_code == 201, body
        transaction = body["transaction"]
        assert transaction["transaction_date"] == "2026-08-20"
        assert transaction["tax_amount"] == 3.10
        assert transaction["category_id"] == category_id
        assert len(transaction["line_items"]) == 1
        assert LineItem.query.count() == 1

    def test_creates_with_notes(self, client, auth_headers):
        response = client.post(
            TRANSACTIONS_URL,
            json={"total_amount": 8, "notes": "Split with roommate"},
            headers=auth_headers,
        )
        body = response.get_json()
        assert response.status_code == 201, body
        assert body["transaction"]["notes"] == "Split with roommate"

    def test_total_amount_is_required(self, client, auth_headers):
        response = client.post(
            TRANSACTIONS_URL, json={"merchant_name": "No amount"}, headers=auth_headers
        )
        assert response.status_code == 400
        assert "total_amount" in response.get_json()["error"]
        assert Transaction.query.count() == 0

    def test_total_amount_must_be_a_number(self, client, auth_headers):
        response = client.post(
            TRANSACTIONS_URL,
            json={"total_amount": "not-a-number"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert Transaction.query.count() == 0

    def test_total_amount_must_be_non_negative(self, client, auth_headers):
        response = client.post(
            TRANSACTIONS_URL, json={"total_amount": -5}, headers=auth_headers
        )
        assert response.status_code == 400
        assert Transaction.query.count() == 0

    def test_tax_amount_must_be_non_negative(self, client, auth_headers):
        response = client.post(
            TRANSACTIONS_URL,
            json={"total_amount": 10, "tax_amount": -1},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert Transaction.query.count() == 0

    def test_unknown_category_id_returns_404_not_a_500(self, client, auth_headers):
        response = client.post(
            TRANSACTIONS_URL,
            json={"total_amount": 10, "category_id": 999999},
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert Transaction.query.count() == 0

    def test_malformed_date_is_rejected(self, client, auth_headers):
        response = client.post(
            TRANSACTIONS_URL,
            json={"total_amount": 10, "transaction_date": "not-a-date"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert Transaction.query.count() == 0

    def test_created_transaction_is_scoped_to_the_authenticated_user(
        self, client, auth_headers, registered_user
    ):
        response = client.post(
            TRANSACTIONS_URL, json={"total_amount": 10}, headers=auth_headers
        )
        transaction_id = response.get_json()["transaction"]["id"]
        stored = db.session.get(Transaction, transaction_id)
        assert stored.user_id == registered_user["user"]["id"]

    def test_runs_anomaly_detection_on_the_new_transaction(self, client, auth_headers, registered_user):
        """A manually-entered amount far outside prior history should still get flagged."""
        user_id = registered_user["user"]["id"]
        category_id = _category_id("Groceries")
        for amount in (20, 21, 22, 23, 24, 25):
            _seed_transaction(user_id, category_id=category_id, amount=amount)

        response = client.post(
            TRANSACTIONS_URL,
            json={"total_amount": 900, "category_id": category_id},
            headers=auth_headers,
        )
        transaction = response.get_json()["transaction"]
        assert transaction["is_anomaly"] is True


class TestDeleteTransaction:
    """DELETE /api/transactions/<id>."""

    def test_requires_authentication(self, client, registered_user):
        transaction = _seed_transaction(registered_user["user"]["id"])
        response = client.delete("{}/{}".format(TRANSACTIONS_URL, transaction.id))
        assert response.status_code == 401

    def test_deletes_an_owned_transaction(self, client, auth_headers, registered_user):
        transaction = _seed_transaction(registered_user["user"]["id"])

        response = client.delete(
            "{}/{}".format(TRANSACTIONS_URL, transaction.id), headers=auth_headers
        )
        body = response.get_json()

        assert response.status_code == 200, body
        assert body["deleted"] == transaction.id
        assert db.session.get(Transaction, transaction.id) is None

    def test_deleting_cascades_to_line_items(self, client, auth_headers, registered_user):
        transaction = _seed_transaction(registered_user["user"]["id"])
        transaction.line_items.append(LineItem(item_name="Widget", line_total=5))
        db.session.commit()
        assert LineItem.query.count() == 1

        client.delete("{}/{}".format(TRANSACTIONS_URL, transaction.id), headers=auth_headers)

        assert LineItem.query.count() == 0

    def test_returns_404_for_a_nonexistent_transaction(self, client, auth_headers):
        response = client.delete("{}/999999".format(TRANSACTIONS_URL), headers=auth_headers)
        assert response.status_code == 404
        assert "not found" in response.get_json()["error"].lower()

    def test_cannot_delete_another_users_transaction(self, client, auth_headers, registered_user):
        transaction = _seed_transaction(registered_user["user"]["id"])

        other = client.post(
            "/api/auth/register",
            json={
                "email": "grace@example.com",
                "password": "correct-horse-battery",
                "full_name": "Grace Hopper",
            },
        ).get_json()
        other_headers = {"Authorization": "Bearer {}".format(other["access_token"])}

        response = client.delete(
            "{}/{}".format(TRANSACTIONS_URL, transaction.id), headers=other_headers
        )

        assert response.status_code == 404
        assert db.session.get(Transaction, transaction.id) is not None
