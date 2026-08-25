"""Tests for /api/auth: registration, login, and token-protected access."""

from models import User


class TestRegister:
    def test_happy_path(self, client, user_payload):
        response = client.post("/api/auth/register", json=user_payload)
        body = response.get_json()

        assert response.status_code == 201
        assert body["user"]["email"] == "ada@example.com"
        assert body["user"]["full_name"] == "Ada Lovelace"
        assert body["access_token"]
        assert body["refresh_token"]

        stored = User.query.filter_by(email="ada@example.com").one()
        assert stored.check_password(user_payload["password"])

    def test_password_hash_is_never_returned(self, client, user_payload):
        body = client.post("/api/auth/register", json=user_payload).get_json()
        assert "password_hash" not in body["user"]
        assert "password" not in body["user"]

    def test_password_is_hashed_not_stored_plaintext(self, client, user_payload):
        client.post("/api/auth/register", json=user_payload)
        stored = User.query.filter_by(email="ada@example.com").one()
        assert stored.password_hash != user_payload["password"]

    def test_email_is_normalised_to_lowercase(self, client, user_payload):
        response = client.post(
            "/api/auth/register", json={**user_payload, "email": "  ADA@Example.COM  "}
        )
        assert response.status_code == 201
        assert response.get_json()["user"]["email"] == "ada@example.com"

    def test_duplicate_email_is_rejected(self, client, user_payload):
        client.post("/api/auth/register", json=user_payload)
        response = client.post("/api/auth/register", json=user_payload)

        assert response.status_code == 409
        assert "already exists" in response.get_json()["error"]
        assert User.query.filter_by(email="ada@example.com").count() == 1

    def test_duplicate_is_caught_case_insensitively(self, client, user_payload):
        client.post("/api/auth/register", json=user_payload)
        response = client.post(
            "/api/auth/register", json={**user_payload, "email": "ADA@EXAMPLE.COM"}
        )
        assert response.status_code == 409

    def test_invalid_email_is_rejected(self, client, user_payload):
        response = client.post(
            "/api/auth/register", json={**user_payload, "email": "not-an-email"}
        )
        assert response.status_code == 400
        assert "valid email" in response.get_json()["error"]

    def test_short_password_is_rejected(self, client, user_payload):
        response = client.post(
            "/api/auth/register", json={**user_payload, "password": "short"}
        )
        assert response.status_code == 400
        assert "at least 8 characters" in response.get_json()["error"]
        assert User.query.count() == 0

    def test_missing_full_name_is_rejected(self, client, user_payload):
        response = client.post(
            "/api/auth/register", json={**user_payload, "full_name": "   "}
        )
        assert response.status_code == 400
        assert "full_name" in response.get_json()["error"]

    def test_empty_body_is_rejected(self, client):
        response = client.post("/api/auth/register", json={})
        assert response.status_code == 400


class TestLogin:
    def test_happy_path(self, client, registered_user):
        response = client.post(
            "/api/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"],
            },
        )
        body = response.get_json()

        assert response.status_code == 200
        assert body["user"]["email"] == registered_user["email"]
        assert body["access_token"]
        assert body["refresh_token"]

    def test_login_is_case_insensitive_on_email(self, client, registered_user):
        response = client.post(
            "/api/auth/login",
            json={"email": "ADA@EXAMPLE.COM", "password": registered_user["password"]},
        )
        assert response.status_code == 200

    def test_wrong_password_is_rejected(self, client, registered_user):
        response = client.post(
            "/api/auth/login",
            json={"email": registered_user["email"], "password": "wrong-password"},
        )
        assert response.status_code == 401
        assert response.get_json()["error"] == "Invalid email or password."

    def test_unknown_email_is_rejected(self, client):
        response = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "correct-horse-battery"},
        )
        assert response.status_code == 401
        assert response.get_json()["error"] == "Invalid email or password."

    def test_unknown_email_and_wrong_password_look_identical(
        self, client, registered_user
    ):
        """The error must not reveal whether the account exists."""
        wrong_password = client.post(
            "/api/auth/login",
            json={"email": registered_user["email"], "password": "wrong-password"},
        )
        unknown_email = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "wrong-password"},
        )
        assert wrong_password.get_json() == unknown_email.get_json()
        assert wrong_password.status_code == unknown_email.status_code

    def test_missing_password_is_rejected(self, client, registered_user):
        response = client.post(
            "/api/auth/login", json={"email": registered_user["email"]}
        )
        assert response.status_code == 401


class TestProtectedAccess:
    def test_me_returns_the_current_user(self, client, auth_headers):
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        assert response.get_json()["user"]["email"] == "ada@example.com"

    def test_me_without_a_token_is_rejected(self, client):
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_me_with_a_garbage_token_is_rejected(self, client):
        response = client.get(
            "/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"}
        )
        assert response.status_code == 422

    def test_refresh_issues_a_new_access_token(self, client, registered_user):
        response = client.post(
            "/api/auth/refresh",
            headers={
                "Authorization": "Bearer {}".format(registered_user["refresh_token"])
            },
        )
        assert response.status_code == 200
        assert response.get_json()["access_token"]

    def test_access_token_is_not_accepted_for_refresh(self, client, registered_user):
        response = client.post(
            "/api/auth/refresh",
            headers={
                "Authorization": "Bearer {}".format(registered_user["access_token"])
            },
        )
        assert response.status_code == 422
