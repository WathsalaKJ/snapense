"""Tests for /api/budgets: CRUD, upsert-on-category, and spend aggregation."""

from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from models import Budget, Category, Transaction, db

BUDGETS_URL = "/api/budgets"


def _groceries_id():
    return Category.query.filter_by(name="Groceries").one().id


def _seed_transaction(user_id, category_id, amount, when=None):
    db.session.add(
        Transaction(
            user_id=user_id,
            merchant_name="Test Merchant",
            transaction_date=when or date.today().replace(day=1),
            total_amount=amount,
            category_id=category_id,
        )
    )
    db.session.commit()


class TestListBudgets:
    def test_requires_authentication(self, client):
        assert client.get(BUDGETS_URL).status_code == 401

    def test_empty_when_no_budgets(self, client, auth_headers):
        response = client.get(BUDGETS_URL, headers=auth_headers)
        assert response.status_code == 200
        assert response.get_json()["budgets"] == []

    def test_includes_amount_spent_this_month(
        self, client, auth_headers, registered_user
    ):
        category_id = _groceries_id()
        client.post(
            BUDGETS_URL,
            json={"category_id": category_id, "monthly_limit": 300},
            headers=auth_headers,
        )
        _seed_transaction(registered_user["user"]["id"], category_id, 45.50)
        _seed_transaction(registered_user["user"]["id"], category_id, 10.00)

        response = client.get(BUDGETS_URL, headers=auth_headers)
        budgets = response.get_json()["budgets"]

        assert len(budgets) == 1
        assert budgets[0]["monthly_limit"] == 300.0
        assert budgets[0]["amount_spent_this_month"] == 55.50

    def test_amount_spent_is_zero_with_no_transactions(
        self, client, auth_headers
    ):
        client.post(
            BUDGETS_URL,
            json={"category_id": _groceries_id(), "monthly_limit": 300},
            headers=auth_headers,
        )
        response = client.get(BUDGETS_URL, headers=auth_headers)
        assert response.get_json()["budgets"][0]["amount_spent_this_month"] == 0.0

    def test_only_returns_the_current_users_budgets(self, client, auth_headers):
        other = client.post(
            "/api/auth/register",
            json={
                "email": "grace@example.com",
                "password": "correct-horse-battery",
                "full_name": "Grace Hopper",
            },
        ).get_json()
        other_headers = {"Authorization": "Bearer {}".format(other["access_token"])}

        client.post(
            BUDGETS_URL,
            json={"category_id": _groceries_id(), "monthly_limit": 100},
            headers=other_headers,
        )

        response = client.get(BUDGETS_URL, headers=auth_headers)
        assert response.get_json()["budgets"] == []


class TestCreateOrUpdateBudget:
    def test_creates_a_new_budget(self, client, auth_headers):
        response = client.post(
            BUDGETS_URL,
            json={"category_id": _groceries_id(), "monthly_limit": 250},
            headers=auth_headers,
        )
        body = response.get_json()

        assert response.status_code == 201
        assert body["budget"]["category_id"] == _groceries_id()
        assert body["budget"]["monthly_limit"] == 250.0
        assert body["budget"]["amount_spent_this_month"] == 0.0
        assert Budget.query.count() == 1

    def test_posting_again_for_the_same_category_updates_instead_of_duplicating(
        self, client, auth_headers
    ):
        category_id = _groceries_id()
        client.post(
            BUDGETS_URL,
            json={"category_id": category_id, "monthly_limit": 250},
            headers=auth_headers,
        )
        response = client.post(
            BUDGETS_URL,
            json={"category_id": category_id, "monthly_limit": 400},
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.get_json()["budget"]["monthly_limit"] == 400.0
        assert Budget.query.count() == 1
        assert Budget.query.one().monthly_limit == 400

    def test_requires_category_id(self, client, auth_headers):
        response = client.post(
            BUDGETS_URL, json={"monthly_limit": 100}, headers=auth_headers
        )
        assert response.status_code == 400
        assert "category_id" in response.get_json()["error"]

    def test_requires_monthly_limit(self, client, auth_headers):
        response = client.post(
            BUDGETS_URL,
            json={"category_id": _groceries_id()},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "monthly_limit" in response.get_json()["error"]

    def test_rejects_a_negative_monthly_limit(self, client, auth_headers):
        response = client.post(
            BUDGETS_URL,
            json={"category_id": _groceries_id(), "monthly_limit": -5},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_rejects_a_non_numeric_monthly_limit(self, client, auth_headers):
        response = client.post(
            BUDGETS_URL,
            json={"category_id": _groceries_id(), "monthly_limit": "lots"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_rejects_an_unknown_category_id(self, client, auth_headers):
        response = client.post(
            BUDGETS_URL,
            json={"category_id": 999999, "monthly_limit": 100},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_requires_authentication(self, client):
        response = client.post(
            BUDGETS_URL, json={"category_id": 1, "monthly_limit": 100}
        )
        assert response.status_code == 401

    def test_two_users_can_each_budget_the_same_category(
        self, client, auth_headers
    ):
        other = client.post(
            "/api/auth/register",
            json={
                "email": "grace@example.com",
                "password": "correct-horse-battery",
                "full_name": "Grace Hopper",
            },
        ).get_json()
        other_headers = {"Authorization": "Bearer {}".format(other["access_token"])}
        category_id = _groceries_id()

        client.post(
            BUDGETS_URL,
            json={"category_id": category_id, "monthly_limit": 100},
            headers=auth_headers,
        )
        response = client.post(
            BUDGETS_URL,
            json={"category_id": category_id, "monthly_limit": 200},
            headers=other_headers,
        )

        assert response.status_code == 201
        assert Budget.query.count() == 2


class TestBudgetUniqueConstraint:
    def test_duplicate_user_category_pair_is_rejected_at_the_db_level(
        self, app, registered_user
    ):
        """The (user_id, category_id) uniqueness must hold even if application
        logic is bypassed, so it has to be a real DB constraint."""
        category_id = _groceries_id()
        user_id = registered_user["user"]["id"]

        db.session.add(Budget(user_id=user_id, category_id=category_id, monthly_limit=100))
        db.session.commit()

        db.session.add(Budget(user_id=user_id, category_id=category_id, monthly_limit=200))
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


class TestDeleteBudget:
    def test_deletes_an_owned_budget(self, client, auth_headers):
        created = client.post(
            BUDGETS_URL,
            json={"category_id": _groceries_id(), "monthly_limit": 100},
            headers=auth_headers,
        ).get_json()["budget"]

        response = client.delete(
            "{}/{}".format(BUDGETS_URL, created["id"]), headers=auth_headers
        )
        assert response.status_code == 200
        assert response.get_json()["deleted"] == created["id"]
        assert Budget.query.count() == 0

    def test_returns_404_for_an_unknown_budget(self, client, auth_headers):
        response = client.delete(
            "{}/999999".format(BUDGETS_URL), headers=auth_headers
        )
        assert response.status_code == 404

    def test_cannot_delete_another_users_budget(self, client, auth_headers):
        other = client.post(
            "/api/auth/register",
            json={
                "email": "grace@example.com",
                "password": "correct-horse-battery",
                "full_name": "Grace Hopper",
            },
        ).get_json()
        other_headers = {"Authorization": "Bearer {}".format(other["access_token"])}

        created = client.post(
            BUDGETS_URL,
            json={"category_id": _groceries_id(), "monthly_limit": 100},
            headers=other_headers,
        ).get_json()["budget"]

        response = client.delete(
            "{}/{}".format(BUDGETS_URL, created["id"]), headers=auth_headers
        )
        assert response.status_code == 404
        assert Budget.query.count() == 1

    def test_requires_authentication(self, client):
        assert client.delete("{}/1".format(BUDGETS_URL)).status_code == 401
