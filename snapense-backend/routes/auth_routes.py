"""Registration, login, token refresh, and profile."""

import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)
from sqlalchemy.exc import IntegrityError

from models import User, db

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
MIN_PASSWORD_LENGTH = 8


def _error(message, status=400):
    return jsonify({"error": message}), status


def _tokens_for(user):
    identity = str(user.id)
    return {
        "access_token": create_access_token(identity=identity),
        "refresh_token": create_refresh_token(identity=identity),
    }


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()

    if not EMAIL_RE.match(email):
        return _error("A valid email is required.")
    if len(password) < MIN_PASSWORD_LENGTH:
        return _error(
            "Password must be at least {} characters.".format(MIN_PASSWORD_LENGTH)
        )
    if not full_name:
        return _error("full_name is required.")

    if User.query.filter_by(email=email).first():
        return _error("An account with that email already exists.", 409)

    user = User(email=email, full_name=full_name)
    user.set_password(password)

    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _error("An account with that email already exists.", 409)

    return jsonify({"user": user.to_dict(), **_tokens_for(user)}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if user is None or not user.check_password(password):
        return _error("Invalid email or password.", 401)

    return jsonify({"user": user.to_dict(), **_tokens_for(user)}), 200


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    return jsonify({"access_token": create_access_token(identity=identity)}), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return _error("User not found.", 404)
    return jsonify({"user": user.to_dict()}), 200


@auth_bp.patch("/me")
@jwt_required()
def update_me():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return _error("User not found.", 404)

    data = request.get_json(silent=True) or {}
    if "full_name" in data:
        full_name = (data.get("full_name") or "").strip()
        if not full_name:
            return _error("full_name cannot be empty.")
        user.full_name = full_name

    if "password" in data:
        password = data.get("password") or ""
        if len(password) < MIN_PASSWORD_LENGTH:
            return _error(
                "Password must be at least {} characters.".format(MIN_PASSWORD_LENGTH)
            )
        user.set_password(password)

    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200
