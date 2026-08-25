"""Rule-based categorisation of merchants and line items.

Keyword matching keeps categorisation predictable and dependency-free. The
scoring is deliberately simple: the category with the most keyword hits wins,
falling back to "Other".
"""

import re

from models import Category

FALLBACK_CATEGORY = "Other"

CATEGORY_KEYWORDS = {
    "Groceries": (
        "grocer", "supermarket", "market", "foods", "mart", "aldi", "lidl",
        "kroger", "safeway", "tesco", "walmart", "costco", "trader joe",
        "whole foods", "produce", "bakery", "butcher", "dairy", "milk",
        "bread", "eggs", "vegetable", "fruit",
    ),
    "Dining": (
        "restaurant", "cafe", "caffe", "coffee", "espresso", "bistro", "diner",
        "grill", "pizzeria", "pizza", "burger", "sushi", "taco", "bar ",
        "brewery", "pub", "starbucks", "mcdonald", "kfc", "subway", "chipotle",
        "doordash", "ubereats", "uber eats", "grubhub", "deliveroo", "takeaway",
        "latte", "sandwich", "meal",
    ),
    "Transport": (
        "uber", "lyft", "taxi", "cab", "metro", "subway station", "transit",
        "railway", "rail", "train", "bus", "airline", "airways", "flight",
        "parking", "toll", "shell", "chevron", "exxon", "bp ", "petrol",
        "gas station", "fuel", "diesel", "ev charge",
    ),
    "Entertainment": (
        "cinema", "movie", "theater", "theatre", "netflix", "spotify", "hulu",
        "disney", "prime video", "hbo", "concert", "festival", "museum",
        "gallery", "arcade", "bowling", "steam", "playstation", "xbox",
        "nintendo", "ticket",
    ),
    "Shopping": (
        "amazon", "ebay", "etsy", "target", "ikea", "h&m", "zara", "uniqlo",
        "nike", "adidas", "apparel", "clothing", "shoes", "boutique",
        "department store", "electronics", "best buy", "hardware", "furniture",
        "shirt", "jeans", "jacket",
    ),
    "Utilities": (
        "electric", "power co", "energy", "water", "sewer", "gas company",
        "internet", "broadband", "fiber", "comcast", "xfinity", "verizon",
        "at&t", "t-mobile", "vodafone", "telecom", "mobile bill", "utility",
        "council tax", "rent",
    ),
    "Health": (
        "pharmacy", "chemist", "drugstore", "walgreens", "cvs", "boots",
        "clinic", "hospital", "medical", "dental", "dentist", "optician",
        "doctor", "physio", "therapy", "gym", "fitness", "wellness",
        "vitamin", "prescription",
    ),
}


def _normalise(text):
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def score_categories(text):
    """Return {category_name: hit_count} for every category with a match."""
    haystack = _normalise(text)
    if not haystack:
        return {}

    scores = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        hits = sum(1 for keyword in keywords if keyword in haystack)
        if hits:
            scores[category] = hits
    return scores


def predict_category_name(*text_parts):
    """Best-guess category name from merchant text, OCR text, item names."""
    combined = " ".join(part for part in text_parts if part)
    scores = score_categories(combined)
    if not scores:
        return FALLBACK_CATEGORY
    return max(scores.items(), key=lambda pair: pair[1])[0]


def resolve_category(*text_parts):
    """Return the Category row matching the prediction, or the Other row."""
    name = predict_category_name(*text_parts)
    category = Category.query.filter_by(name=name).first()
    if category is None:
        category = Category.query.filter_by(name=FALLBACK_CATEGORY).first()
    return category


def categorize_transaction(transaction, commit=False):
    """Assign ``transaction.category`` in place when it has none."""
    if transaction.category_id is not None:
        return transaction.category

    item_names = " ".join(item.item_name or "" for item in transaction.line_items)
    category = resolve_category(
        transaction.merchant_name, item_names, transaction.ocr_raw_text
    )
    if category is not None:
        transaction.category_id = category.id

    if commit:
        from models import db

        db.session.commit()
    return category


def categorize_line_items(transaction):
    """Categorise each line item independently of the parent transaction."""
    for item in transaction.line_items:
        if item.category_id is not None:
            continue
        category = resolve_category(item.item_name)
        if category is not None:
            item.category_id = category.id
