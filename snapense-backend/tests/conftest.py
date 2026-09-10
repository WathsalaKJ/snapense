"""Shared pytest fixtures. Tests run against an in-memory SQLite database."""

import pytest
from sqlalchemy import event
from sqlalchemy.engine import Engine

from app import create_app, seed_categories
from models import db

# SQLite ignores foreign key constraints - including ON DELETE CASCADE/SET
# NULL - unless a connection explicitly turns them on with this pragma.
# Without it, the test suite would never actually exercise the cascade
# behaviour the models declare (e.g. deleting a Transaction cascading to its
# LineItems), even though production Postgres enforces it by default. Guarded
# to sqlite so pointing TEST_DATABASE_URL at Postgres is unaffected.
@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    if type(dbapi_connection).__module__.startswith("sqlite3"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


@pytest.fixture()
def app(tmp_path):
    application = create_app("testing")
    # Keep uploaded fixtures out of the repo's uploads/ directory.
    application.config["UPLOAD_FOLDER"] = str(tmp_path / "uploads")
    with application.app_context():
        db.create_all()
        seed_categories()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def user_payload():
    return {
        "email": "ada@example.com",
        "password": "correct-horse-battery",
        "full_name": "Ada Lovelace",
    }


@pytest.fixture()
def registered_user(client, user_payload):
    """Register a user and hand back the credentials plus the issued tokens."""
    response = client.post("/api/auth/register", json=user_payload)
    assert response.status_code == 201, response.get_json()
    return {**user_payload, **response.get_json()}


@pytest.fixture()
def auth_headers(registered_user):
    return {"Authorization": "Bearer {}".format(registered_user["access_token"])}
