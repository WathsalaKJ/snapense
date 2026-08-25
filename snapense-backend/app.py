"""Snapense API - application factory, extensions, and CLI commands."""

import os

import click
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from werkzeug.exceptions import HTTPException

from config import get_config
from models import DEFAULT_CATEGORIES, Category, db

migrate = Migrate()
jwt = JWTManager()


def create_app(config_name=None):
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

    from services import ocr_service

    ocr_service.configure(app)

    register_blueprints(app)
    register_error_handlers(app)
    register_cli(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "snapense-api"}), 200

    return app


def register_blueprints(app):
    from routes.auth_routes import auth_bp
    from routes.dashboard_routes import dashboard_bp
    from routes.insight_routes import insight_bp
    from routes.receipt_routes import receipt_bp
    from routes.transaction_routes import transaction_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(transaction_bp, url_prefix="/api/transactions")
    app.register_blueprint(receipt_bp, url_prefix="/api/receipts")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(insight_bp, url_prefix="/api/insights")


def register_error_handlers(app):
    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        return jsonify({"error": error.description}), error.code

    @app.errorhandler(Exception)
    def handle_unexpected(error):  # pragma: no cover
        app.logger.exception("Unhandled error")
        if app.config.get("DEBUG"):
            raise error
        return jsonify({"error": "Internal server error."}), 500

    @jwt.unauthorized_loader
    def missing_token(reason):
        return jsonify({"error": "Missing or invalid Authorization header."}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify({"error": "Invalid token."}), 422

    @jwt.expired_token_loader
    def expired_token(header, payload):
        return jsonify({"error": "Token has expired."}), 401


def seed_categories():
    """Insert the default categories; existing rows are updated, not duplicated."""
    created, updated = 0, 0
    for name, color_hex, icon_name in DEFAULT_CATEGORIES:
        category = Category.query.filter_by(name=name).first()
        if category is None:
            db.session.add(
                Category(
                    name=name,
                    color_hex=color_hex,
                    icon_name=icon_name,
                    is_default=True,
                )
            )
            created += 1
        else:
            category.color_hex = color_hex
            category.icon_name = icon_name
            category.is_default = True
            updated += 1
    db.session.commit()
    return created, updated


def register_cli(app):
    @app.cli.command("seed-categories")
    def seed_categories_command():
        """Seed the default spending categories."""
        created, updated = seed_categories()
        click.echo("Categories seeded: {} created, {} updated.".format(created, updated))

    @app.cli.command("create-tables")
    def create_tables_command():
        """Create tables directly from the models (bypasses Alembic)."""
        db.create_all()
        click.echo("Tables created.")


app = create_app()


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_RUN_HOST", "0.0.0.0"),
        port=int(os.getenv("FLASK_RUN_PORT", "5000")),
    )
