"""Generates a maintenance work order (the PDF's 'generate maintenance
work orders' feature) from the structured ML output. Tries Groq first;
ALWAYS falls back to a templated rules-based work order if the key is
missing or the call fails.
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


def _rules_based_work_order(analysis: dict) -> str:
    if not analysis["high_risk"]:
        return (
            f"{analysis['asset_type']} ({analysis['asset_id']}): health score "
            f"{analysis['health_score']}/100, no action required. Continue routine "
            f"monitoring."
        )
    return (
        f"WORK ORDER — {analysis['asset_type']} ({analysis['asset_id']}): "
        f"failure probability {analysis['failure_probability']*100:.1f}%, diagnosed "
        f"issue: {analysis['predicted_issue']}. Latest readings — wear: "
        f"{analysis['telemetry']['wear_min']} min, torque: {analysis['telemetry']['torque_nm']} Nm. "
        f"Schedule inspection within 48 hours."
    )


def generate_work_order(analysis: dict) -> dict:
    fallback_text = _rules_based_work_order(analysis)

    if not HAS_GROQ or analysis["status"] != "success":
        return {"text": fallback_text, "source": "rules"}

    try:
        client = Groq(api_key=GROQ_API_KEY)
        prompt = (
            "You are a facility maintenance operations assistant. Given this asset's "
            "structured ML diagnosis, write a short work order (2-4 sentences) for a "
            "maintenance technician. Be specific and concrete. If the asset is healthy, "
            "just confirm no action needed.\n\n"
            f"{analysis}"
        )
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
        )
        text = response.choices[0].message.content.strip()
        if not text:
            raise ValueError("Groq returned an empty work order")
        return {"text": text, "source": "groq"}
    except Exception as exc:
        logger.warning("Groq maintenance work order failed: %s", exc)
        return {"text": fallback_text, "source": "rules_fallback_after_groq_error"}
