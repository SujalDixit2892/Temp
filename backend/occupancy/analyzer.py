"""Occupancy: compares each zone's latest reading against what the
trained model expects for that hour/day/zone type/capacity.

Security: rule-based immediate detection for high-severity events, plus
an IsolationForest fit LIVE on the facility's own recent events (not a
saved model - there's nothing to pretrain here, each facility's baseline
is different). This is the reference repo's original design; its bug was
that zone_level/recent_failed_attempts never varied in the seeded data,
not the approach itself.
"""

import pandas as pd
from sklearn.ensemble import IsolationForest

OVERCROWDING_THRESHOLD = 0.9
MIN_EVENTS_FOR_ISOLATION_FOREST = 6
SEVERITY_WEIGHT = {"Low": 1, "Medium": 2, "High": 3}
HIGH_SEVERITY_ACTIVE_STATUSES = {"open", "investigating"}


def analyze_occupancy(artifact: dict, zones_with_latest: list[dict]) -> list[dict]:
    """zones_with_latest: [{zone_id, zone_type, max_capacity, latest_count,
    latest_hour, latest_dow}, ...]"""
    model = artifact["model"]
    feature_columns = artifact["feature_columns"]
    zone_types = artifact["zone_types"]

    results = []
    for z in zones_with_latest:
        if z["latest_count"] is None:
            results.append({**z, "status": "no_data", "expected_count": None, "utilization_pct": None})
            continue

        row = {"hour": z["latest_hour"], "day_of_week": z["latest_dow"], "capacity": z["max_capacity"]}
        for zt in zone_types:
            row[f"zt_{zt}"] = 1 if zt == z["zone_type"] else 0
        feature_df = pd.DataFrame([row])[feature_columns]
        expected = float(model.predict(feature_df)[0])

        utilization = z["latest_count"] / z["max_capacity"] if z["max_capacity"] else 0
        status = "overcrowded" if utilization >= OVERCROWDING_THRESHOLD else "normal"

        results.append({
            **z,
            "expected_count": round(expected, 1),
            "utilization_pct": round(utilization * 100, 1),
            "status": status,
        })
    return results


def analyze_security(events: list[dict]) -> dict:
    """events: [{event_id, event_type, severity, event_time (datetime),
    status, zone_id, zone_level, recent_failed_attempts}, ...]"""
    if not events:
        return {"active_threats": [], "anomalies": [], "total_events": 0, "threat_level": "Low"}

    df = pd.DataFrame(events)
    df["severity_num"] = df["severity"].map(SEVERITY_WEIGHT).fillna(1)
    df["status_norm"] = df["status"].str.lower()

    active_threats = df[
        (df["severity"] == "High") & (df["status_norm"].isin(HIGH_SEVERITY_ACTIVE_STATUSES))
    ]
    threat_level = "High" if len(active_threats) > 0 else "Low"

    flagged_ids = set(active_threats["event_id"])
    anomalies = []
    if len(df) >= MIN_EVENTS_FOR_ISOLATION_FOREST:
        df["hour"] = pd.to_datetime(df["event_time"]).dt.hour
        feat = df[["hour", "severity_num", "zone_level", "recent_failed_attempts"]].fillna(0)
        preds = IsolationForest(contamination=0.1, random_state=42).fit_predict(feat)
        for i, is_outlier in enumerate(preds):
            if is_outlier == -1 and df.iloc[i]["event_id"] not in flagged_ids:
                anomalies.append(df.iloc[i]["event_id"])

    return {
        "active_threats": active_threats["event_id"].tolist(),
        "anomalies": anomalies,
        "total_events": len(df),
        "threat_level": threat_level,
    }
