"""Tests for POST /api/insights/generate with the Gemini call mocked out.

The mock replaces ``insight_service._call_text_model`` -- the single seam
where the app talks to the provider -- so everything downstream (payload
assembly, persistence, error handling) runs for real.
"""

from datetime import date, timedelta

import pytest

from models import Budget, Category, SpendingInsight, Transaction, db
from services import insight_service

GENERATE_URL = "/api/insights/generate"


def _category_id(name):
    return Category.query.filter_by(name=name).one().id


def _seed_transaction(user_id, category_name, amount, when):
    db.session.add(
        Transaction(
            user_id=user_id,
            merchant_name="Test Merchant",
            transaction_date=when,
            total_amount=amount,
            category_id=_category_id(category_name),
        )
    )
    db.session.commit()


@pytest.fixture()
def mock_llm(monkeypatch):
    """Point the text-model seam at a canned response, or make it raise."""

    def _install(text=None, exc=None):
        calls = []

        def fake_call(payload):
            calls.append(payload)
            if exc is not None:
                raise exc
            return text

        monkeypatch.setattr(insight_service, "_call_text_model", fake_call)
        return calls

    return _install


class TestGenerateHappyPath:
    def test_creates_one_consolidated_insight(
        self, client, auth_headers, registered_user, mock_llm
    ):
        user_id = registered_user["user"]["id"]
        today = date.today()
        _seed_transaction(user_id, "Groceries", 120.00, today)
        _seed_transaction(user_id, "Dining", 40.00, today)

        calls = mock_llm(text="You spent the most on Groceries this period.")

        response = client.post(GENERATE_URL, json={}, headers=auth_headers)
        body = response.get_json()

        assert response.status_code == 201, body
        assert body["generated"] == 1
        assert len(body["insights"]) == 1
        assert body["insights"][0]["insight_text"] == (
            "You spent the most on Groceries this period."
        )
        assert SpendingInsight.query.count() == 1
        assert len(calls) == 1

    def test_payload_sent_to_model_has_top_category_and_totals(
        self, client, auth_headers, registered_user, mock_llm
    ):
        user_id = registered_user["user"]["id"]
        today = date.today()
        _seed_transaction(user_id, "Groceries", 150.00, today)
        _seed_transaction(user_id, "Dining", 50.00, today)

        calls = mock_llm(text="Insight text.")
        client.post(GENERATE_URL, json={}, headers=auth_headers)

        assert len(calls) == 1
        payload = calls[0]
        assert payload["total_spent"] == 200.00
        assert payload["top_category"]["name"] == "Groceries"
        assert payload["top_category"]["amount"] == 150.00
        assert payload["top_category"]["percent_of_total"] == 75.0
        assert payload["anomaly_count"] == 0

    def test_payload_includes_category_change_above_threshold(
        self, client, auth_headers, registered_user, mock_llm
    ):
        user_id = registered_user["user"]["id"]
        today = date.today()
        previous_period_day = today - timedelta(days=40)

        _seed_transaction(user_id, "Groceries", 200.00, today)
        _seed_transaction(user_id, "Groceries", 50.00, previous_period_day)

        calls = mock_llm(text="Insight text.")
        client.post(
            GENERATE_URL,
            json={
                "start_date": (today - timedelta(days=30)).isoformat(),
                "end_date": today.isoformat(),
            },
            headers=auth_headers,
        )

        payload = calls[0]
        assert len(payload["category_changes"]) == 1
        change = payload["category_changes"][0]
        assert change["category"] == "Groceries"
        assert change["current_amount"] == 200.00
        assert change["previous_amount"] == 50.00

    def test_payload_includes_budget_status_when_budgets_exist(
        self, client, auth_headers, registered_user, mock_llm
    ):
        user_id = registered_user["user"]["id"]
        today = date.today()
        db.session.add(
            Budget(user_id=user_id, category_id=_category_id("Groceries"), monthly_limit=100)
        )
        db.session.commit()
        _seed_transaction(user_id, "Groceries", 80.00, today)

        calls = mock_llm(text="Insight text.")
        client.post(GENERATE_URL, json={}, headers=auth_headers)

        budgets = calls[0]["budgets"]
        assert len(budgets) == 1
        assert budgets[0]["category"] == "Groceries"
        assert budgets[0]["monthly_limit"] == 100.0
        assert budgets[0]["spent_this_period"] == 80.00
        assert budgets[0]["percent_used"] == 80.0

    def test_no_spending_returns_zero_generated_without_calling_model(
        self, client, auth_headers, mock_llm
    ):
        calls = mock_llm(text="Insight text.")
        response = client.post(GENERATE_URL, json={}, headers=auth_headers)
        body = response.get_json()

        assert response.status_code == 201
        assert body["generated"] == 0
        assert body["insights"] == []
        assert len(calls) == 0

    def test_replace_deletes_prior_insight_for_the_period(
        self, client, auth_headers, registered_user, mock_llm
    ):
        user_id = registered_user["user"]["id"]
        today = date.today()
        _seed_transaction(user_id, "Groceries", 100.00, today)

        mock_llm(text="First insight.")
        client.post(GENERATE_URL, json={}, headers=auth_headers)
        assert SpendingInsight.query.count() == 1

        mock_llm(text="Second insight.")
        client.post(GENERATE_URL, json={"replace": True}, headers=auth_headers)

        assert SpendingInsight.query.count() == 1
        assert SpendingInsight.query.one().insight_text == "Second insight."


class TestGenerateFailureHandling:
    def test_model_failure_returns_502_and_persists_nothing(
        self, client, auth_headers, registered_user, mock_llm
    ):
        user_id = registered_user["user"]["id"]
        _seed_transaction(user_id, "Groceries", 100.00, date.today())

        mock_llm(exc=insight_service.InsightGenerationError("Insight model request failed."))

        response = client.post(GENERATE_URL, json={}, headers=auth_headers)

        assert response.status_code == 502
        assert "failed" in response.get_json()["error"]
        assert SpendingInsight.query.count() == 0

    def test_model_failure_does_not_wipe_a_previous_insight(
        self, client, auth_headers, registered_user, mock_llm
    ):
        """A failed regeneration attempt must not delete the last good insight."""
        user_id = registered_user["user"]["id"]
        today = date.today()
        _seed_transaction(user_id, "Groceries", 100.00, today)

        mock_llm(text="Good insight.")
        client.post(GENERATE_URL, json={}, headers=auth_headers)
        assert SpendingInsight.query.count() == 1

        mock_llm(exc=insight_service.InsightGenerationError("boom"))
        response = client.post(GENERATE_URL, json={"replace": True}, headers=auth_headers)

        assert response.status_code == 502
        assert SpendingInsight.query.count() == 1
        assert SpendingInsight.query.one().insight_text == "Good insight."

    def test_empty_model_response_returns_502_not_a_blank_insight(
        self, client, auth_headers, registered_user, mock_llm
    ):
        user_id = registered_user["user"]["id"]
        _seed_transaction(user_id, "Groceries", 100.00, date.today())
        mock_llm(text="   ")

        response = client.post(GENERATE_URL, json={}, headers=auth_headers)
        assert response.status_code == 502
        assert SpendingInsight.query.count() == 0


class TestGenerateValidation:
    def test_requires_authentication(self, client):
        assert client.post(GENERATE_URL, json={}).status_code == 401

    def test_rejects_malformed_dates(self, client, auth_headers):
        response = client.post(
            GENERATE_URL, json={"start_date": "not-a-date"}, headers=auth_headers
        )
        assert response.status_code == 400

    def test_rejects_start_after_end(self, client, auth_headers):
        response = client.post(
            GENERATE_URL,
            json={"start_date": "2026-02-01", "end_date": "2026-01-01"},
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestInsightServiceProviderDispatch:
    """Unit-level coverage of the provider seam itself, mirroring OCR's."""

    def test_unknown_provider_raises_generation_error(self, app):
        app.config["LLM_PROVIDER"] = "not-a-real-provider"
        with app.app_context():
            with pytest.raises(insight_service.InsightGenerationError):
                insight_service._call_text_model({"total_spent": 1})

    def test_stub_provider_returns_canned_text(self, app):
        app.config["LLM_PROVIDER"] = "stub"
        with app.app_context():
            text = insight_service._call_text_model({"total_spent": 1})
            assert text == insight_service.STUB_INSIGHT

    def test_gemini_provider_without_api_key_raises(self, app):
        app.config["LLM_PROVIDER"] = "gemini"
        app.config["GEMINI_API_KEY"] = ""
        with app.app_context():
            with pytest.raises(insight_service.InsightGenerationError):
                insight_service._call_text_model({"total_spent": 1})

    def test_prompt_instructs_model_to_use_lkr_not_dollars(self):
        """The payload's amounts are raw numbers, so the prompt itself must tell
        Gemini to render them as Rs. -- otherwise it defaults to $.
        """
        prompt = insight_service._build_prompt({"total_spent": 6500})

        assert "Sri Lankan Rupees" in prompt
        assert "Rs." in prompt
        assert "Rs. 6,500.00" in prompt
        assert "Never use \"$\"" in prompt
