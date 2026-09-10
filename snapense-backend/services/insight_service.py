"""Turns structured spending data into a short AI-written insight via Gemini.

Mirrors services/ocr_service.py's provider setup: ``LLM_PROVIDER`` and
``LLM_MODEL`` select the model, ``GEMINI_API_KEY`` is read from ``.env``, and
``_call_text_model`` is the single seam swapped out in tests.
"""

import json

from flask import current_app

PROMPT_TEMPLATE = """You are a friendly personal finance assistant. Based on the spending data below, write a short insight for the user.

Spending data (JSON):
{payload}

Rules:
- 2-4 sentences, or a few short bullet points if that reads better.
- Conversational tone, not robotic. Address the user directly ("you").
- Only mention things actually present in the data -- never invent categories, amounts, or comparisons.
- Mention the top spending category and its share of the period.
- Call out any category with a large swing versus the previous period, if any are listed.
- Mention the anomaly count and any budgets close to or over their limit, if present.
- Plain text only: no markdown formatting, no headings, no emoji.
- All amounts in the data are in Sri Lankan Rupees. The numbers are plain (e.g. 6500 or 6500.0)
  with no currency symbol -- you must add one yourself. Always format amounts as "Rs. X,XXX.XX"
  (thousands separator, two decimal places), for example write "Rs. 6,500.00", not "$6,500" or
  "6500". Never use "$" or the word "dollars" anywhere in your response.
"""


def _build_prompt(payload):
    """Render the prompt sent to the text model for a given spending payload."""
    return PROMPT_TEMPLATE.format(payload=json.dumps(payload, indent=2))


class InsightGenerationError(RuntimeError):
    """Raised when an AI-written insight could not be produced."""


def _call_gemini(payload):
    """Send the spending payload to Gemini and return the raw response text."""
    api_key = current_app.config.get("GEMINI_API_KEY")
    if not api_key:
        raise InsightGenerationError(
            "GEMINI_API_KEY is not set. Add it to .env before generating insights."
        )

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:  # pragma: no cover - dependency missing
        raise InsightGenerationError(
            "google-genai is not installed. Run: pip install -r requirements.txt"
        ) from exc

    client = genai.Client(api_key=api_key)
    prompt = _build_prompt(payload)

    try:
        response = client.models.generate_content(
            model=current_app.config["LLM_MODEL"],
            contents=[prompt],
            config=types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=current_app.config["LLM_MAX_OUTPUT_TOKENS"],
            ),
        )
    except Exception as exc:  # network, auth, quota, safety block
        raise InsightGenerationError(
            "Insight model request failed: {}".format(exc)
        ) from exc

    text = getattr(response, "text", None)
    if not text or not text.strip():
        raise InsightGenerationError("Insight model returned an empty response.")
    return text.strip()


# A canned response used only when LLM_PROVIDER=stub, so the generate flow can
# be exercised end to end without a provider key (and so tests of that flow do
# not need network access). Never reachable unless explicitly selected.
STUB_INSIGHT = (
    "Your spending looks steady this period, with no major surprises worth flagging."
)


def _call_stub(payload):
    current_app.logger.warning(
        "LLM_PROVIDER=stub: returning canned insight text, not calling Gemini."
    )
    return STUB_INSIGHT


_PROVIDERS = {
    "gemini": _call_gemini,
    "stub": _call_stub,
}


def _call_text_model(payload):
    """Dispatch to the configured provider. This is the seam tests mock."""
    provider = current_app.config.get("LLM_PROVIDER", "gemini")
    adapter = _PROVIDERS.get(provider)
    if adapter is None:
        raise InsightGenerationError(
            "Unknown LLM_PROVIDER '{}'. Supported: {}.".format(
                provider, ", ".join(sorted(_PROVIDERS))
            )
        )
    return adapter(payload)


def generate_insight_text(payload):
    """Turn a structured spending-data payload into an AI-written insight.

    Raises InsightGenerationError when the model call fails or returns
    nothing usable, so a broken or blank insight is never persisted.
    """
    text = _call_text_model(payload)
    if not text or not text.strip():
        raise InsightGenerationError("Insight model returned an empty response.")
    return text.strip()
