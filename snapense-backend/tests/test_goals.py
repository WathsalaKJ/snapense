"""Tests for /api/goals: CRUD, manual contributions, and the auto-surplus
computation that reads budget under-spend.

Surplus-attribution rule under test (see goal_routes._auto_saved_by_goal):
each month's total surplus across all budgets is split evenly across every
goal that already existed during that month (created_at on or before that
month's last day).
"""

from datetime import date, datetime, timezone

from models import Category, GoalContribution, SavingsGoal, Transaction, db
from routes.dashboard_routes import _shift_months

GOALS_URL = "/api/goals"
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


def _create_budget(client, headers, monthly_limit, category_id=None):
    client.post(
        BUDGETS_URL,
        json={
            "category_id": category_id or _groceries_id(),
            "monthly_limit": monthly_limit,
        },
        headers=headers,
    )


def _create_goal(client, headers, name="Vacation", target_amount=1000, target_date=None):
    payload = {"name": name, "target_amount": target_amount}
    if target_date is not None:
        payload["target_date"] = target_date
    return client.post(GOALS_URL, json=payload, headers=headers).get_json()["goal"]


def _backdate_goal(goal_id, when_date):
    """Force a goal's created_at into a specific month for testing
    month-eligibility, bypassing the API (which always stamps "now")."""
    goal = db.session.get(SavingsGoal, goal_id)
    goal.created_at = datetime.combine(when_date, datetime.min.time(), tzinfo=timezone.utc)
    db.session.commit()


def _other_user_headers(client):
    other = client.post(
        "/api/auth/register",
        json={
            "email": "grace@example.com",
            "password": "correct-horse-battery",
            "full_name": "Grace Hopper",
        },
    ).get_json()
    return {"Authorization": "Bearer {}".format(other["access_token"])}


class TestCreateGoal:
    def test_creates_a_goal(self, client, auth_headers):
        response = client.post(
            GOALS_URL,
            json={"name": "Vacation", "target_amount": 5000, "target_date": "2026-12-01"},
            headers=auth_headers,
        )
        body = response.get_json()["goal"]

        assert response.status_code == 201
        assert body["name"] == "Vacation"
        assert body["target_amount"] == 5000.0
        assert body["target_date"] == "2026-12-01"
        assert body["auto_saved_amount"] == 0.0
        assert body["manual_amount"] == 0.0
        assert body["current_amount"] == 0.0
        assert body["is_complete"] is False

    def test_requires_name(self, client, auth_headers):
        response = client.post(
            GOALS_URL, json={"target_amount": 100}, headers=auth_headers
        )
        assert response.status_code == 400

    def test_requires_positive_target_amount(self, client, auth_headers):
        response = client.post(
            GOALS_URL, json={"name": "X", "target_amount": 0}, headers=auth_headers
        )
        assert response.status_code == 400

    def test_rejects_bad_target_date_format(self, client, auth_headers):
        response = client.post(
            GOALS_URL,
            json={"name": "X", "target_amount": 100, "target_date": "12/01/2026"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_requires_authentication(self, client):
        response = client.post(GOALS_URL, json={"name": "X", "target_amount": 100})
        assert response.status_code == 401


class TestUpdateGoal:
    def test_updates_fields_partially(self, client, auth_headers):
        goal = _create_goal(client, auth_headers, name="Old", target_amount=100)
        response = client.patch(
            "{}/{}".format(GOALS_URL, goal["id"]),
            json={"name": "New"},
            headers=auth_headers,
        )
        body = response.get_json()["goal"]
        assert response.status_code == 200
        assert body["name"] == "New"
        assert body["target_amount"] == 100.0

    def test_returns_404_for_unknown_goal(self, client, auth_headers):
        response = client.patch(
            "{}/999999".format(GOALS_URL), json={"name": "X"}, headers=auth_headers
        )
        assert response.status_code == 404


class TestDeleteGoal:
    def test_deletes_an_owned_goal(self, client, auth_headers):
        goal = _create_goal(client, auth_headers)
        response = client.delete(
            "{}/{}".format(GOALS_URL, goal["id"]), headers=auth_headers
        )
        assert response.status_code == 200
        assert SavingsGoal.query.count() == 0

    def test_cascade_deletes_contributions(self, client, auth_headers):
        goal = _create_goal(client, auth_headers)
        client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 100},
            headers=auth_headers,
        )
        assert GoalContribution.query.count() == 1

        client.delete("{}/{}".format(GOALS_URL, goal["id"]), headers=auth_headers)
        assert GoalContribution.query.count() == 0


class TestAutoSurplus:
    def test_accumulates_across_months(self, client, auth_headers, registered_user):
        """Surplus from several past months should sum into auto_saved_amount."""
        user_id = registered_user["user"]["id"]
        category_id = _groceries_id()
        _create_budget(client, auth_headers, 300, category_id)

        this_month = date.today().replace(day=1)
        two_months_ago = _shift_months(this_month, -2)
        last_month = _shift_months(this_month, -1)

        _seed_transaction(user_id, category_id, 100, when=two_months_ago)  # surplus 200
        _seed_transaction(user_id, category_id, 250, when=last_month)  # surplus 50
        _seed_transaction(user_id, category_id, 300, when=this_month)  # surplus 0

        goal = _create_goal(client, auth_headers, target_amount=100000)
        _backdate_goal(goal["id"], two_months_ago)

        response = client.get(GOALS_URL, headers=auth_headers)
        body = response.get_json()["goals"][0]
        assert body["auto_saved_amount"] == 250.0

    def test_over_budget_month_contributes_zero(
        self, client, auth_headers, registered_user
    ):
        user_id = registered_user["user"]["id"]
        category_id = _groceries_id()
        _create_budget(client, auth_headers, 100, category_id)

        this_month = date.today().replace(day=1)
        _seed_transaction(user_id, category_id, 150, when=this_month)  # over budget

        goal = _create_goal(client, auth_headers, target_amount=1000)
        _backdate_goal(goal["id"], this_month)

        response = client.get(GOALS_URL, headers=auth_headers)
        assert response.get_json()["goals"][0]["auto_saved_amount"] == 0.0

    def test_multi_goal_surplus_split_evenly(self, client, auth_headers, registered_user):
        user_id = registered_user["user"]["id"]
        category_id = _groceries_id()
        _create_budget(client, auth_headers, 300, category_id)

        this_month = date.today().replace(day=1)
        _seed_transaction(user_id, category_id, 100, when=this_month)  # surplus 200

        goal_a = _create_goal(client, auth_headers, name="A", target_amount=100000)
        goal_b = _create_goal(client, auth_headers, name="B", target_amount=100000)
        _backdate_goal(goal_a["id"], this_month)
        _backdate_goal(goal_b["id"], this_month)

        response = client.get(GOALS_URL, headers=auth_headers)
        by_name = {g["name"]: g for g in response.get_json()["goals"]}
        assert by_name["A"]["auto_saved_amount"] == 100.0
        assert by_name["B"]["auto_saved_amount"] == 100.0

    def test_goal_not_credited_for_months_before_it_existed(
        self, client, auth_headers, registered_user
    ):
        user_id = registered_user["user"]["id"]
        category_id = _groceries_id()
        _create_budget(client, auth_headers, 300, category_id)

        this_month = date.today().replace(day=1)
        last_month = _shift_months(this_month, -1)

        _seed_transaction(user_id, category_id, 100, when=last_month)  # surplus 200
        _seed_transaction(user_id, category_id, 50, when=this_month)  # surplus 250

        goal_a = _create_goal(client, auth_headers, name="A", target_amount=100000)
        _backdate_goal(goal_a["id"], last_month)  # existed for both months

        goal_b = _create_goal(client, auth_headers, name="B", target_amount=100000)
        # goal_b keeps its real created_at (this month) - not backdated.

        response = client.get(GOALS_URL, headers=auth_headers)
        by_name = {g["name"]: g for g in response.get_json()["goals"]}

        # last_month: only A existed -> A gets the full 200.
        # this_month: both exist -> 250 split evenly, 125 each.
        assert by_name["A"]["auto_saved_amount"] == 325.0
        assert by_name["B"]["auto_saved_amount"] == 125.0


class TestManualContributions:
    def test_manual_adds_on_top_of_auto_saved(
        self, client, auth_headers, registered_user
    ):
        user_id = registered_user["user"]["id"]
        category_id = _groceries_id()
        _create_budget(client, auth_headers, 300, category_id)

        this_month = date.today().replace(day=1)
        _seed_transaction(user_id, category_id, 50, when=this_month)  # surplus 250

        goal = _create_goal(client, auth_headers, target_amount=100000)
        _backdate_goal(goal["id"], this_month)

        client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 1000, "note": "Bonus"},
            headers=auth_headers,
        )

        response = client.get(GOALS_URL, headers=auth_headers)
        body = response.get_json()["goals"][0]
        assert body["auto_saved_amount"] == 250.0
        assert body["manual_amount"] == 1000.0
        assert body["current_amount"] == 1250.0

    def test_lists_contribution_history(self, client, auth_headers):
        goal = _create_goal(client, auth_headers)
        client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 500, "note": "First", "contributed_at": "2026-09-01"},
            headers=auth_headers,
        )
        client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 300, "contributed_at": "2026-09-03"},
            headers=auth_headers,
        )

        response = client.get(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]), headers=auth_headers
        )
        contributions = response.get_json()["contributions"]
        assert len(contributions) == 2
        # Newest contributed_at first.
        assert contributions[0]["amount"] == 300.0
        assert contributions[1]["note"] == "First"

    def test_deleting_a_contribution_reduces_the_total(self, client, auth_headers):
        goal = _create_goal(client, auth_headers)
        first = client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 500},
            headers=auth_headers,
        ).get_json()["contribution"]
        client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 300},
            headers=auth_headers,
        )

        before = client.get(GOALS_URL, headers=auth_headers).get_json()["goals"][0]
        assert before["manual_amount"] == 800.0

        client.delete(
            "{}/{}/contributions/{}".format(GOALS_URL, goal["id"], first["id"]),
            headers=auth_headers,
        )

        after = client.get(GOALS_URL, headers=auth_headers).get_json()["goals"][0]
        assert after["manual_amount"] == 300.0

    def test_rejects_non_positive_amount(self, client, auth_headers):
        goal = _create_goal(client, auth_headers)
        response = client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 0},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_returns_404_for_unknown_goal(self, client, auth_headers):
        response = client.post(
            "{}/999999/contributions".format(GOALS_URL),
            json={"amount": 100},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestIsComplete:
    def test_flips_true_once_target_is_reached(self, client, auth_headers):
        goal = _create_goal(client, auth_headers, target_amount=100)
        client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 100},
            headers=auth_headers,
        )
        body = client.get(GOALS_URL, headers=auth_headers).get_json()["goals"][0]
        assert body["is_complete"] is True
        assert body["percent_complete"] == 100.0

    def test_stays_false_while_under_target(self, client, auth_headers):
        goal = _create_goal(client, auth_headers, target_amount=1000)
        client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 100},
            headers=auth_headers,
        )
        body = client.get(GOALS_URL, headers=auth_headers).get_json()["goals"][0]
        assert body["is_complete"] is False
        assert body["percent_complete"] == 10.0

    def test_percent_complete_clamps_at_100_when_overshooting(
        self, client, auth_headers
    ):
        goal = _create_goal(client, auth_headers, target_amount=100)
        client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 250},
            headers=auth_headers,
        )
        body = client.get(GOALS_URL, headers=auth_headers).get_json()["goals"][0]
        assert body["is_complete"] is True
        assert body["percent_complete"] == 100.0
        assert body["current_amount"] == 250.0


class TestCrossUserIsolation:
    def test_list_only_returns_own_goals(self, client, auth_headers):
        other_headers = _other_user_headers(client)
        _create_goal(client, other_headers)

        response = client.get(GOALS_URL, headers=auth_headers)
        assert response.get_json()["goals"] == []

    def test_cannot_patch_another_users_goal(self, client, auth_headers):
        other_headers = _other_user_headers(client)
        goal = _create_goal(client, other_headers)

        response = client.patch(
            "{}/{}".format(GOALS_URL, goal["id"]),
            json={"name": "Hijacked"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_cannot_delete_another_users_goal(self, client, auth_headers):
        other_headers = _other_user_headers(client)
        goal = _create_goal(client, other_headers)

        response = client.delete(
            "{}/{}".format(GOALS_URL, goal["id"]), headers=auth_headers
        )
        assert response.status_code == 404
        assert SavingsGoal.query.count() == 1

    def test_cannot_list_another_users_contributions(self, client, auth_headers):
        other_headers = _other_user_headers(client)
        goal = _create_goal(client, other_headers)

        response = client.get(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]), headers=auth_headers
        )
        assert response.status_code == 404

    def test_cannot_create_contribution_on_another_users_goal(
        self, client, auth_headers
    ):
        other_headers = _other_user_headers(client)
        goal = _create_goal(client, other_headers)

        response = client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 100},
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert GoalContribution.query.count() == 0

    def test_cannot_delete_another_users_contribution(self, client, auth_headers):
        other_headers = _other_user_headers(client)
        goal = _create_goal(client, other_headers)
        contribution = client.post(
            "{}/{}/contributions".format(GOALS_URL, goal["id"]),
            json={"amount": 100},
            headers=other_headers,
        ).get_json()["contribution"]

        response = client.delete(
            "{}/{}/contributions/{}".format(GOALS_URL, goal["id"], contribution["id"]),
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert GoalContribution.query.count() == 1

    def test_requires_authentication_on_every_route(self, client):
        assert client.get(GOALS_URL).status_code == 401
        assert client.post(GOALS_URL, json={}).status_code == 401
        assert client.patch("{}/1".format(GOALS_URL), json={}).status_code == 401
        assert client.delete("{}/1".format(GOALS_URL)).status_code == 401
        assert client.get("{}/1/contributions".format(GOALS_URL)).status_code == 401
        assert (
            client.post("{}/1/contributions".format(GOALS_URL), json={}).status_code
            == 401
        )
        assert (
            client.delete("{}/1/contributions/1".format(GOALS_URL)).status_code == 401
        )
