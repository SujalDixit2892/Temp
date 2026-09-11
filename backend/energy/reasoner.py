"""Turns the analyzer's structured output into a short human-readable
recommendation. Tries Groq first; ALWAYS falls back to a templated
rules-based recommendation if the key is missing or the call fails.
Never let the absence of Groq mean the endpoint returns nothing useful.
"""

import logging
import os

from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
logger = logging.getLogger(__name__)

try:
    from groq import Groq

    HAS_GROQ = bool(GROQ_API_KEY)
except ImportError:
    HAS_GROQ = False


def _rules_based_summary(analysis: dict, facility_id: str) -> str:
    wastage_days = analysis.get("wastage_days_count", 0)
    forecast = analysis.get("forecast_next_day_kwh")
    if wastage_days == 0:
        return (
            f"{facility_id}: consumption tracked close to model expectations over the "
            f"evaluated window. Forecasted next-day usage: {forecast} kWh. No wastage "
            f"pattern flagged."
        )
    return (
        f"{facility_id}: {wastage_days} day(s) with consumption exceeding model "
        f"expectations by 25%+ were found in the evaluated window. Forecasted "
        f"next-day usage: {forecast} kWh. Recommend reviewing HVAC and lighting "
        f"schedules on the flagged dates for after-hours or off-peak waste."
    )


def generate_recommendation(analysis: dict, facility_id: str) -> dict:
    fallback_text = _rules_based_summary(analysis, facility_id)

    if not HAS_GROQ or analysis.get("status") != "success":
        return {"text": fallback_text, "source": "rules"}

    try:
        client = Groq(api_key=GROQ_API_KEY)
        prompt = (
            "You are an energy operations assistant for a facility management platform. "
            "Given this structured analysis, write a 2-3 sentence actionable recommendation "
            "for a facility operator. Be specific and concrete, no fluff.\n\n"
            f"Facility: {facility_id}\n"
            f"Analysis: {analysis}"
        )
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
        )
        text = response.choices[0].message.content.strip()
        if not text:
            raise ValueError("Groq returned an empty recommendation")
        return {"text": text, "source": "groq"}
    except Exception as exc:
        logger.warning("Groq energy recommendation failed: %s", exc)
        return {"text": fallback_text, "source": "rules_fallback_after_groq_error"}
