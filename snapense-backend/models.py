"""SQLAlchemy models for Snapense."""

from datetime import datetime, timezone
from decimal import Decimal

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint, Index
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc)


def _decimal_to_float(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return value


def _iso(value):
    return value.isoformat() if value is not None else None


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    transactions = db.relationship(
        "Transaction",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )
    insights = db.relationship(
        "SpendingInsight",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "created_at": _iso(self.created_at),
            "updated_at": _iso(self.updated_at),
        }

    def __repr__(self):
        return "<User {} {}>".format(self.id, self.email)


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    color_hex = db.Column(db.String(7), nullable=False, default="#9CA3AF")
    icon_name = db.Column(db.String(60), nullable=False, default="more-horizontal")
    is_default = db.Column(db.Boolean, nullable=False, default=False)

    transactions = db.relationship("Transaction", back_populates="category")
    line_items = db.relationship("LineItem", back_populates="category")
    insights = db.relationship("SpendingInsight", back_populates="category")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "color_hex": self.color_hex,
            "icon_name": self.icon_name,
            "is_default": self.is_default,
        }

    def __repr__(self):
        return "<Category {} {}>".format(self.id, self.name)


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    merchant_name = db.Column(db.String(200), nullable=True)
    transaction_date = db.Column(db.Date, nullable=True, index=True)
    total_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    tax_amount = db.Column(db.Numeric(12, 2), nullable=True)
    category_id = db.Column(
        db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    receipt_image_url = db.Column(db.String(500), nullable=True)
    ocr_raw_text = db.Column(db.Text, nullable=True)
    ocr_confidence = db.Column(db.Float, nullable=True)
    is_anomaly = db.Column(db.Boolean, nullable=False, default=False, index=True)
    anomaly_reason = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    user = db.relationship("User", back_populates="transactions")
    category = db.relationship("Category", back_populates="transactions")
    line_items = db.relationship(
        "LineItem",
        back_populates="transaction",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="LineItem.id",
    )

    __table_args__ = (
        CheckConstraint("total_amount >= 0", name="ck_transactions_total_non_negative"),
        Index("ix_transactions_user_date", "user_id", "transaction_date"),
    )

    def to_dict(self, include_line_items=True):
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "merchant_name": self.merchant_name,
            "transaction_date": _iso(self.transaction_date),
            "total_amount": _decimal_to_float(self.total_amount),
            "tax_amount": _decimal_to_float(self.tax_amount),
            "category_id": self.category_id,
            "category": self.category.to_dict() if self.category else None,
            "receipt_image_url": self.receipt_image_url,
            "ocr_raw_text": self.ocr_raw_text,
            "ocr_confidence": self.ocr_confidence,
            "is_anomaly": self.is_anomaly,
            "anomaly_reason": self.anomaly_reason,
            "created_at": _iso(self.created_at),
            "updated_at": _iso(self.updated_at),
        }
        if include_line_items:
            data["line_items"] = [item.to_dict() for item in self.line_items]
        return data

    def __repr__(self):
        return "<Transaction {} {}>".format(self.id, self.merchant_name)


class LineItem(db.Model):
    __tablename__ = "line_items"

    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(
        db.Integer,
        db.ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Numeric(10, 3), nullable=False, default=1)
    unit_price = db.Column(db.Numeric(12, 2), nullable=True)
    line_total = db.Column(db.Numeric(12, 2), nullable=True)
    category_id = db.Column(
        db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    transaction = db.relationship("Transaction", back_populates="line_items")
    category = db.relationship("Category", back_populates="line_items")

    def to_dict(self):
        return {
            "id": self.id,
            "transaction_id": self.transaction_id,
            "item_name": self.item_name,
            "quantity": _decimal_to_float(self.quantity),
            "unit_price": _decimal_to_float(self.unit_price),
            "line_total": _decimal_to_float(self.line_total),
            "category_id": self.category_id,
            "category": self.category.to_dict() if self.category else None,
            "created_at": _iso(self.created_at),
        }

    def __repr__(self):
        return "<LineItem {} {}>".format(self.id, self.item_name)


class SpendingInsight(db.Model):
    __tablename__ = "spending_insights"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    insight_text = db.Column(db.Text, nullable=False)
    category_id = db.Column(
        db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    period_start = db.Column(db.Date, nullable=True)
    period_end = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    user = db.relationship("User", back_populates="insights")
    category = db.relationship("Category", back_populates="insights")

    __table_args__ = (Index("ix_spending_insights_user_created", "user_id", "created_at"),)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "insight_text": self.insight_text,
            "category_id": self.category_id,
            "category": self.category.to_dict() if self.category else None,
            "period_start": _iso(self.period_start),
            "period_end": _iso(self.period_end),
            "created_at": _iso(self.created_at),
        }

    def __repr__(self):
        return "<SpendingInsight {} user={}>".format(self.id, self.user_id)


# Category colours. "Other" keeps a neutral grey; the rest are the app palette.
DEFAULT_CATEGORIES = [
    ("Groceries", "#6EE7B7", "shopping-cart"),
    ("Dining", "#FDBA74", "utensils"),
    ("Transport", "#93C5FD", "car"),
    ("Entertainment", "#C4B5FD", "film"),
    ("Shopping", "#F9A8D4", "bag"),
    ("Utilities", "#67E8F9", "zap"),
    ("Health", "#BEF264", "heart"),
    ("Other", "#9CA3AF", "more-horizontal"),
]
