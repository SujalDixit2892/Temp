"""Combines occupancy + security findings into one recommendation. Tries
Groq first; ALWAYS falls back to a templated rules-based summary.
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


def _rules_based_summary(occupancy_results: list[dict], security_summary: dict, facility_id: str) -> str:
    overcrowded = [z for z in occupancy_results if z.get("status") == "overcrowded"]
    parts = [f"{facility_id}:"]

    if overcrowded:
        zone_list = ", ".join(z["zone_type"] for z in overcrowded)
        parts.append(f"{len(overcrowded)} zone(s) currently overcrowded ({zone_list}).")
    else:
        parts.append("No zones currently overcrowded.")

    if security_summary["threat_level"] == "High":
        parts.append(
            f"ACTIVE SECURITY THREAT: {len(security_summary['active_threats'])} high-severity event(s) require immediate review."
        )
    elif security_summary["anomalies"]:
        parts.append(f"{len(security_summary['anomalies'])} unusual access pattern(s) flagged for review.")
    else:
        parts.append("No active security threats.")

    return " ".join(parts)


def generate_recommendation(occupancy_results: list[dict], security_summary: dict, facility_id: str) -> dict:
    fallback_text = _rules_based_summary(occupancy_results, security_summary, facility_id)

    if not HAS_GROQ:
        return {"text": fallback_text, "source": "rules"}

    try:
        client = Groq(api_key=GROQ_API_KEY)
        prompt = (
            "You are a facility operations assistant covering occupancy and security. "
            "Given this structured data, write a 2-3 sentence actionable summary for a "
            "facility operator. Be specific and concrete, no fluff.\n\n"
            f"Facility: {facility_id}\n"
            f"Occupancy: {occupancy_results}\n"
            f"Security: {security_summary}"
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
        logger.warning("Groq occupancy recommendation failed: %s", exc)
        return {"text": fallback_text, "source": "rules_fallback_after_groq_error"}
