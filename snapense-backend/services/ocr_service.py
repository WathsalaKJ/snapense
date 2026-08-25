"""Receipt extraction via a vision LLM.

The provider is chosen with ``LLM_PROVIDER`` and the model with ``LLM_MODEL``,
both read from ``.env``, so swapping models -- or moving off Gemini entirely --
is a config change rather than a code change. Adding a provider means writing
one adapter and registering it in ``_PROVIDERS``.

The model is asked for a single JSON object and nothing else. Everything it
returns is still treated as untrusted: the JSON is re-parsed, every field is
coerced to the right type, and anything unusable is dropped rather than
propagated into the database.
"""

import json
import mimetypes
import os
import re
from datetime import datetime

from flask import current_app

from models import Category

# The exact contract we ask the model for. Kept verbatim in the prompt so the
# shape the model sees and the shape we validate against cannot drift apart.
RESPONSE_SCHEMA = """{
  "merchant_name": string,
  "transaction_date": "YYYY-MM-DD",
  "total_amount": number,
  "tax_amount": number,
  "line_items": [
    {"item_name": string, "quantity": number, "unit_price": number,
     "line_total": number, "suggested_category": string}
  ]
}"""

CATEGORY_HINT = (
    "Groceries, Dining, Transport, Entertainment, Shopping, Utilities, Health, Other"
)

PROMPT = """You are a receipt parser. Read the attached receipt image and return the data as JSON.

Return ONLY a single JSON object matching exactly this shape, with no prose, no explanation and no markdown fences:

{schema}

Rules:
- transaction_date must be ISO format YYYY-MM-DD. If the receipt shows no date, use null.
- total_amount is the final amount paid, including tax.
- tax_amount is the tax charged. Use 0 if the receipt shows no tax.
- All amounts are plain numbers with no currency symbols or thousands separators.
- line_items contains one entry per purchased item. Skip subtotal, tax, total,
  change, and payment-method lines. If no line items are legible, use [].
- quantity defaults to 1 when the receipt does not show one.
- suggested_category must be exactly one of: {categories}
- If a value is not legible, use null rather than guessing.
""".format(schema=RESPONSE_SCHEMA, categories=CATEGORY_HINT)

MAX_LINE_ITEMS = 200
FALLBACK_CATEGORY = "Other"

DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y")


class OcrError(RuntimeError):
    """Raised when the receipt could not be read into usable data."""


# --------------------------------------------------------------------------
# Provider adapters
# --------------------------------------------------------------------------


def _read_image(image_path):
    if not os.path.exists(image_path):
        raise OcrError("Receipt image not found at {}.".format(image_path))

    mime_type, _ = mimetypes.guess_type(image_path)
    if mime_type is None:
        mime_type = "image/jpeg"

    with open(image_path, "rb") as handle:
        return handle.read(), mime_type


def _call_gemini(image_bytes, mime_type):
    """Send the image to Gemini and return the raw response text."""
    api_key = current_app.config.get("GEMINI_API_KEY")
    if not api_key:
        raise OcrError(
            "GEMINI_API_KEY is not set. Add it to .env before scanning receipts."
        )

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:  # pragma: no cover - dependency missing
        raise OcrError(
            "google-genai is not installed. Run: pip install -r requirements.txt"
        ) from exc

    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model=current_app.config["LLM_MODEL"],
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                PROMPT,
            ],
            config=types.GenerateContentConfig(
                # Ask the API itself to constrain output to JSON, so a stray
                # sentence from the model cannot break parsing.
                response_mime_type="application/json",
                temperature=0,
                max_output_tokens=current_app.config["LLM_MAX_OUTPUT_TOKENS"],
            ),
        )
    except Exception as exc:  # network, auth, quota, safety block
        raise OcrError("Vision model request failed: {}".format(exc)) from exc

    text = getattr(response, "text", None)
    if not text or not text.strip():
        raise OcrError("Vision model returned an empty response.")
    return text


# A canned response used only when LLM_PROVIDER=stub. It exists so the capture
# -> upload -> review flow can be exercised end to end without a provider key
# (and so tests of that flow do not need network access). It is never reachable
# unless the environment explicitly selects it.
STUB_RECEIPT = {
    "merchant_name": "Whole Foods Market",
    "transaction_date": "2026-08-20",
    "total_amount": 31.76,
    "tax_amount": 2.42,
    "line_items": [
        {
            "item_name": "Organic Bananas",
            "quantity": 1,
            "unit_price": 3.49,
            "line_total": 3.49,
            "suggested_category": "Groceries",
        },
        {
            "item_name": "Almond Milk 64oz",
            "quantity": 1,
            "unit_price": 5.99,
            "line_total": 5.99,
            "suggested_category": "Groceries",
        },
        {
            "item_name": "Rotisserie Chicken",
            "quantity": 1,
            "unit_price": 12.99,
            "line_total": 12.99,
            "suggested_category": "Groceries",
        },
        {
            "item_name": "Sparkling Water 12pk",
            "quantity": 1,
            "unit_price": 6.87,
            "line_total": 6.87,
            "suggested_category": "Groceries",
        },
    ],
}


def _call_stub(image_bytes, mime_type):
    """Dev-only adapter: ignores the image and returns a fixed receipt."""
    current_app.logger.warning(
        "LLM_PROVIDER=stub: returning canned receipt data, not reading the image."
    )
    return json.dumps(STUB_RECEIPT)


_PROVIDERS = {
    "gemini": _call_gemini,
    "stub": _call_stub,
}


def _call_vision_model(image_bytes, mime_type):
    """Dispatch to the configured provider. This is the seam tests mock."""
    provider = current_app.config.get("LLM_PROVIDER", "gemini")
    adapter = _PROVIDERS.get(provider)
    if adapter is None:
        raise OcrError(
            "Unknown LLM_PROVIDER '{}'. Supported: {}.".format(
                provider, ", ".join(sorted(_PROVIDERS))
            )
        )
    return adapter(image_bytes, mime_type)


def configure(app):
    """Warn at startup if receipt scanning cannot work."""
    provider = app.config.get("LLM_PROVIDER")
    if provider == "stub":
        app.logger.warning(
            "LLM_PROVIDER=stub: receipt scanning returns canned data. "
            "Set LLM_PROVIDER=gemini with a GEMINI_API_KEY for real extraction."
        )
    elif provider not in _PROVIDERS:
        app.logger.warning(
            "LLM_PROVIDER '%s' is not supported; receipt scanning is disabled.",
            provider,
        )
    elif provider == "gemini" and not app.config.get("GEMINI_API_KEY"):
        app.logger.warning(
            "GEMINI_API_KEY is not set; POST /api/receipts/upload will return 502."
        )


# --------------------------------------------------------------------------
# Parsing and validation
# --------------------------------------------------------------------------


def _strip_code_fences(text):
    fenced = re.match(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", text, re.DOTALL)
    return fenced.group(1) if fenced else text


def _extract_json_object(text):
    """Pull the first balanced {...} block out of a response."""
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return None


def parse_model_json(raw_text):
    """Parse the model's reply into a dict, tolerating fences and stray prose."""
    if not raw_text or not raw_text.strip():
        raise OcrError("Vision model returned an empty response.")

    candidate = _strip_code_fences(raw_text.strip())

    try:
        parsed = json.loads(candidate)
    except (ValueError, TypeError):
        block = _extract_json_object(candidate)
        if block is None:
            raise OcrError("Vision model did not return JSON.")
        try:
            parsed = json.loads(block)
        except (ValueError, TypeError) as exc:
            raise OcrError("Vision model returned malformed JSON.") from exc

    if not isinstance(parsed, dict):
        raise OcrError("Vision model returned JSON that is not an object.")
    return parsed


def _coerce_number(value, minimum=None):
    """Best-effort number coercion; returns None when unusable."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        cleaned = re.sub(r"[^\d.\-]", "", value.replace(",", ""))
        if cleaned in ("", "-", ".", "-."):
            return None
        try:
            number = float(cleaned)
        except ValueError:
            return None
    else:
        return None

    if number != number or number in (float("inf"), float("-inf")):
        return None
    if minimum is not None and number < minimum:
        return None
    return round(number, 2)


def _coerce_string(value, limit):
    if value is None or isinstance(value, bool):
        return None
    if not isinstance(value, str):
        value = str(value)
    cleaned = value.strip()
    if not cleaned or cleaned.lower() in ("null", "none", "n/a", "unknown"):
        return None
    return cleaned[:limit]


def _coerce_date(value):
    if not value or not isinstance(value, str):
        return None
    candidate = value.strip()[:10]
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(candidate, fmt).date()
        except ValueError:
            continue
    return None


def _coerce_line_item(raw):
    if not isinstance(raw, dict):
        return None

    name = _coerce_string(raw.get("item_name"), 200)
    if not name:
        return None

    quantity = _coerce_number(raw.get("quantity"), minimum=0) or 1
    unit_price = _coerce_number(raw.get("unit_price"), minimum=0)
    line_total = _coerce_number(raw.get("line_total"), minimum=0)

    # Fill in whichever of the pair the model omitted.
    if line_total is None and unit_price is not None:
        line_total = round(unit_price * quantity, 2)
    if unit_price is None and line_total is not None and quantity:
        unit_price = round(line_total / quantity, 2)

    return {
        "item_name": name,
        "quantity": quantity,
        "unit_price": unit_price,
        "line_total": line_total,
        "suggested_category": _coerce_string(raw.get("suggested_category"), 80),
    }


def validate_receipt(parsed):
    """Coerce a parsed model response into the fields the models store."""
    line_items = []
    raw_items = parsed.get("line_items")
    if isinstance(raw_items, list):
        for raw in raw_items[:MAX_LINE_ITEMS]:
            item = _coerce_line_item(raw)
            if item is not None:
                line_items.append(item)

    total = _coerce_number(parsed.get("total_amount"), minimum=0)
    tax = _coerce_number(parsed.get("tax_amount"), minimum=0)

    # A missing total is recoverable when the line items add up.
    if total is None and line_items:
        summed = sum(item["line_total"] or 0 for item in line_items)
        if summed > 0:
            total = round(summed + (tax or 0), 2)

    return {
        "merchant_name": _coerce_string(parsed.get("merchant_name"), 200),
        "transaction_date": _coerce_date(parsed.get("transaction_date")),
        "total_amount": total,
        "tax_amount": tax,
        "line_items": line_items,
    }


# --------------------------------------------------------------------------
# Category mapping
# --------------------------------------------------------------------------


def _category_lookup():
    return {c.name.lower(): c for c in Category.query.all()}


def resolve_suggested_category(suggested, lookup=None, fallback_text=None):
    """Map a model-suggested category name onto a real Category row.

    Falls back to keyword matching on the merchant/item text, then to "Other",
    so a hallucinated category name can never produce a dangling foreign key.
    """
    lookup = _category_lookup() if lookup is None else lookup

    if suggested:
        exact = lookup.get(suggested.strip().lower())
        if exact is not None:
            return exact

    if fallback_text:
        from services import categorization_service

        predicted = categorization_service.predict_category_name(fallback_text)
        guessed = lookup.get(predicted.lower())
        if guessed is not None:
            return guessed

    return lookup.get(FALLBACK_CATEGORY.lower())


def map_categories(receipt):
    """Attach category_id to the receipt and each of its line items."""
    lookup = _category_lookup()

    item_names = " ".join(item["item_name"] for item in receipt["line_items"])
    suggestions = [
        item.get("suggested_category")
        for item in receipt["line_items"]
        if item.get("suggested_category")
    ]
    # The transaction takes the most common suggestion across its line items.
    dominant = max(set(suggestions), key=suggestions.count) if suggestions else None

    category = resolve_suggested_category(
        dominant,
        lookup,
        fallback_text=" ".join(
            part for part in (receipt.get("merchant_name"), item_names) if part
        ),
    )
    receipt["category_id"] = category.id if category else None
    receipt["category_name"] = category.name if category else None

    for item in receipt["line_items"]:
        item_category = resolve_suggested_category(
            item.get("suggested_category"), lookup, fallback_text=item["item_name"]
        )
        item["category_id"] = item_category.id if item_category else None

    return receipt


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------


def extract_receipt(image_path):
    """Full pipeline: image path -> validated, category-mapped receipt dict.

    Raises OcrError when the image cannot be turned into usable data.
    """
    image_bytes, mime_type = _read_image(image_path)
    raw_text = _call_vision_model(image_bytes, mime_type)
    receipt = validate_receipt(parse_model_json(raw_text))

    if receipt["total_amount"] is None and not receipt["line_items"]:
        raise OcrError("Could not read any amounts from this receipt.")

    receipt["raw_response"] = raw_text
    return map_categories(receipt)
