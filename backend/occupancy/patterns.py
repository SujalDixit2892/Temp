"""Defines the 'true' expected occupancy pattern per zone type/hour/day.
No real occupancy dataset exists, so this function is the single source
of truth for BOTH generating synthetic training data (see
train_occupancy_model.py) and seeding the live app's recent readings
(see backend/seed.py) - if you change this function, retrain the model,
since the two will otherwise drift apart.
"""

import numpy as np

ZONE_TYPES = ["Office Floor", "Meeting Room", "Common Area", "Parking Area", "Restricted Access"]

# Public-facing/low-security = 1, standard interior = 2, secure/restricted = 3.
ZONE_SECURITY_LEVEL = {
    "Office Floor": 2,
    "Meeting Room": 2,
    "Common Area": 1,
    "Parking Area": 1,
    "Restricted Access": 3,
}


FACILITY_TYPE_ZONES = {
    "Education": ["Office Floor", "Common Area", "Parking Area", "Restricted Access"],
    "Office": ["Office Floor", "Meeting Room", "Common Area", "Parking Area", "Restricted Access"],
    "Entertainment/public assembly": ["Common Area", "Parking Area"],
    "Public services": ["Office Floor", "Common Area", "Parking Area"],
    "Lodging/residential": ["Common Area", "Parking Area"],
    "Other": ["Common Area", "Parking Area"],
    "Healthcare": ["Office Floor", "Common Area", "Parking Area", "Restricted Access"],
    "Parking": ["Parking Area"],
    "Warehouse/storage": ["Common Area", "Parking Area", "Restricted Access"],
    "Manufacturing/industrial": ["Office Floor", "Common Area", "Parking Area", "Restricted Access"],
    "Retail": ["Common Area", "Parking Area"],
    "Services": ["Office Floor", "Common Area", "Parking Area"],
    "Technology/science": ["Office Floor", "Meeting Room", "Restricted Access", "Common Area"],
    "Food sales and service": ["Common Area", "Parking Area"],
    "Utility": ["Restricted Access", "Parking Area"],
    "Religious worship": ["Common Area", "Parking Area"],
}
DEFAULT_ZONES = ["Common Area", "Parking Area"]  # fallback for any unmapped facility_type

# (event_type, severity) - routine events are drawn far more often than
# the last two, which only appear as part of an injected suspicious
# cluster (see backend/seed.py) so the data isn't uniformly random noise.
ROUTINE_SECURITY_EVENTS = [
    ("Badge Access", "Low"),
    ("Visitor Check-in", "Low"),
    ("CCTV Motion Alert", "Low"),
]
SUSPICIOUS_SECURITY_EVENTS = [
    ("Failed Badge Attempt", "Medium"),
    ("Door Forced Open", "High"),
    ("Unauthorized Access Attempt", "High"),
]
SEVERITY_WEIGHT = {"Low": 1, "Medium": 2, "High": 3}


def expected_occupancy_rate(zone_type: str, hour: int, day_of_week: int) -> float:
    """Returns expected occupancy as a fraction of zone capacity (can
    exceed 1.0 isn't returned here - surge/overcrowding is layered on
    top by the caller, this is just the 'normal' baseline rate)."""
    is_weekend = day_of_week >= 5

    if zone_type == "Office Floor":
        if is_weekend:
            return 0.05
        if hour < 7 or hour > 19:
            return 0.02
        bell = 0.75 * np.exp(-((hour - 13) ** 2) / (2 * 5 ** 2))
        return max(bell, 0.1 if 8 <= hour <= 17 else 0.02)

    if zone_type == "Meeting Room":
        return 0.35 if (not is_weekend and 8 <= hour <= 18) else 0.02

    if zone_type == "Common Area":
        if is_weekend:
            return 0.05
        if hour in (8, 9, 12, 13, 17, 18):
            return 0.55
        return 0.25 if 8 <= hour <= 18 else 0.03

    if zone_type == "Parking Area":
        if is_weekend:
            return 0.1
        if 8 <= hour <= 17:
            return 0.7
        return 0.4 if hour in (7, 18) else 0.05

    if zone_type == "Restricted Access":
        if is_weekend:
            return 0.02
        return 0.15 if 9 <= hour <= 17 else 0.01

    return 0.1
