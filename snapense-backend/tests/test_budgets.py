"""Tests for /api/budgets: CRUD, upsert-on-category, and spend aggregation."""

from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from models import Budget, Category, Transaction, db
from routes.dashboard_routes import _shift_months

BUDGETS_URL = "/api/budgets"
HISTORY_URL = "/api/budgets/history"


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


class TestBudgetHistory:
    def test_requires_authentication(self, client):
        assert client.get(HISTORY_URL).status_code == 401

    def test_empty_when_no_budgets(self, client, auth_headers):
        response = client.get(HISTORY_URL, headers=auth_headers)
        assert response.status_code == 200
        assert response.get_json() == {"months": 6, "budgets": []}

    def test_defaults_to_six_months_all_zero_with_no_transactions(
        self, client, auth_headers
    ):
        category_id = _groceries_id()
        client.post(
            BUDGETS_URL,
            json={"category_id": category_id, "monthly_limit": 300},
            headers=auth_headers,
        )

        response = client.get(HISTORY_URL, headers=auth_headers)
        body = response.get_json()

        assert body["months"] == 6
        assert len(body["budgets"]) == 1
        history = body["budgets"][0]["history"]
        assert len(history) == 6
        assert all(month["amount_spent"] == 0.0 for month in history)
        assert all(month["over_budget"] is False for month in history)
        assert all(month["monthly_limit"] == 300.0 for month in history)

    def test_covers_multiple_months_including_one_with_no_transactions(
        self, client, auth_headers, registered_user
    ):
        category_id = _groceries_id()
        user_id = registered_user["user"]["id"]
        client.post(
            BUDGETS_URL,
            json={"category_id": category_id, "monthly_limit": 300},
            headers=auth_headers,
        )

        this_month = date.today().replace(day=1)
        two_months_ago = _shift_months(this_month, -2)
        # Deliberately nothing seeded for the month in between - it should
        # come back as 0, not be missing or error.
        _seed_transaction(user_id, category_id, 120.00, when=two_months_ago)
        _seed_transaction(user_id, category_id, 80.00, when=this_month)

        response = client.get(HISTORY_URL + "?months=3", headers=auth_headers)
        history = response.get_json()["budgets"][0]["history"]

        assert [m["month"] for m in history] == [
            two_months_ago.strftime("%Y-%m"),
            _shift_months(this_month, -1).strftime("%Y-%m"),
            this_month.strftime("%Y-%m"),
        ]
        assert history[0]["amount_spent"] == 120.00
        assert history[1]["amount_spent"] == 0.0
        assert history[2]["amount_spent"] == 80.00

    def test_over_budget_flag_reflects_each_months_spend(
        self, client, auth_headers, registered_user
    ):
        category_id = _groceries_id()
        user_id = registered_user["user"]["id"]
        client.post(
            BUDGETS_URL,
            json={"category_id": category_id, "monthly_limit": 100},
            headers=auth_headers,
        )

        this_month = date.today().replace(day=1)
        last_month = _shift_months(this_month, -1)
        _seed_transaction(user_id, category_id, 150.00, when=last_month)
        _seed_transaction(user_id, category_id, 40.00, when=this_month)

        response = client.get(HISTORY_URL + "?months=2", headers=auth_headers)
        history = response.get_json()["budgets"][0]["history"]

        assert history[0]["amount_spent"] == 150.00
        assert history[0]["over_budget"] is True
        assert history[1]["amount_spent"] == 40.00
        assert history[1]["over_budget"] is False

    def test_uses_the_current_monthly_limit_retroactively(
        self, client, auth_headers, registered_user
    ):
        """Known simplification: Budget doesn't snapshot limits over time, so
        every month is judged against today's limit, even months before the
        limit changed."""
        category_id = _groceries_id()
        user_id = registered_user["user"]["id"]
        last_month = _shift_months(date.today().replace(day=1), -1)

        client.post(
            BUDGETS_URL,
            json={"category_id": category_id, "monthly_limit": 100},
            headers=auth_headers,
        )
        # 60 was within the old 100 limit...
        _seed_transaction(user_id, category_id, 60.00, when=last_month)

        # ...but the limit is lowered after the fact.
        client.post(
            BUDGETS_URL,
            json={"category_id": category_id, "monthly_limit": 50},
            headers=auth_headers,
        )

        response = client.get(HISTORY_URL + "?months=2", headers=auth_headers)
        history = response.get_json()["budgets"][0]["history"]

        assert history[0]["monthly_limit"] == 50.0
        assert history[0]["amount_spent"] == 60.00
        assert history[0]["over_budget"] is True

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

        response = client.get(HISTORY_URL, headers=auth_headers)
        assert response.get_json()["budgets"] == []

    def test_months_param_is_floored_and_capped(self, client, auth_headers):
        client.post(
            BUDGETS_URL,
            json={"category_id": _groceries_id(), "monthly_limit": 100},
            headers=auth_headers,
        )

        too_few = client.get(HISTORY_URL + "?months=0", headers=auth_headers).get_json()
        assert too_few["months"] == 1
        assert len(too_few["budgets"][0]["history"]) == 1

        too_many = client.get(HISTORY_URL + "?months=100", headers=auth_headers).get_json()
        assert too_many["months"] == 12
        assert len(too_many["budgets"][0]["history"]) == 12

    def test_non_numeric_months_falls_back_to_the_default(self, client, auth_headers):
        client.post(
            BUDGETS_URL,
            json={"category_id": _groceries_id(), "monthly_limit": 100},
            headers=auth_headers,
        )
        response = client.get(HISTORY_URL + "?months=lots", headers=auth_headers)
        assert response.get_json()["months"] == 6

    def test_covers_multiple_budgets_independently(
        self, client, auth_headers, registered_user
    ):
        groceries_id = _groceries_id()
        dining_id = Category.query.filter_by(name="Dining").one().id
        user_id = registered_user["user"]["id"]

        client.post(
            BUDGETS_URL,
            json={"category_id": groceries_id, "monthly_limit": 300},
            headers=auth_headers,
        )
        client.post(
            BUDGETS_URL,
            json={"category_id": dining_id, "monthly_limit": 100},
            headers=auth_headers,
        )
        _seed_transaction(user_id, groceries_id, 200.00)
        _seed_transaction(user_id, dining_id, 20.00)

        response = client.get(HISTORY_URL, headers=auth_headers)
        by_category = {
            budget["category_id"]: budget for budget in response.get_json()["budgets"]
        }

        assert by_category[groceries_id]["history"][-1]["amount_spent"] == 200.00
        assert by_category[dining_id]["history"][-1]["amount_spent"] == 20.00
