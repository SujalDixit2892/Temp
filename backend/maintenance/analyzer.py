"""AI4I feature mapping and prediction logic. Column order/names here MUST
match maintenance_model_features.joblib exactly - the model was trained
on the real AI4I dataset's exact column names.
"""

import pandas as pd

TYPE_MAP = {"L": 0, "M": 1, "H": 2}

HIGH_RISK_THRESHOLD = 0.5


def _feature_row(log, ai4i_type: str, feature_columns: list[str]) -> pd.DataFrame:
    values = {
        "Type": TYPE_MAP.get(ai4i_type, 1),
        "Air temperature [K]": log.air_temp,
        "Process temperature [K]": log.process_temp,
        "Rotational speed [rpm]": log.speed,
        "Torque [Nm]": log.torque,
        "Tool wear [min]": log.wear,
    }
    return pd.DataFrame([{col: values[col] for col in feature_columns}])


def analyze_asset(failure_model, fault_model, feature_columns, asset, latest_log) -> dict:
    if latest_log is None:
        return {"status": "insufficient_data", "reason": "no_maintenance_logs"}

    row = _feature_row(latest_log, asset.ai4i_type, feature_columns)
    failure_prob = float(failure_model.predict_proba(row)[0][1])
    health_score = round(max(0.0, min(100.0, (1.0 - failure_prob) * 100)), 1)

    predicted_issue = "Normal Operation"
    if failure_prob >= HIGH_RISK_THRESHOLD:
        predicted_issue = str(fault_model.predict(row)[0])

    return {
        "status": "success",
        "asset_id": asset.asset_id,
        "asset_type": asset.asset_type,
        "as_of": latest_log.reading_date,
        "failure_probability": round(failure_prob, 4),
        "health_score": health_score,
        "predicted_issue": predicted_issue,
        "high_risk": failure_prob >= HIGH_RISK_THRESHOLD,
        "telemetry": {
            "air_temp_k": latest_log.air_temp,
            "process_temp_k": latest_log.process_temp,
            "speed_rpm": latest_log.speed,
            "torque_nm": latest_log.torque,
            "wear_min": latest_log.wear,
        },
    }


def summarize_facility(asset_analyses: list[dict]) -> dict:
    successful = [a for a in asset_analyses if a["status"] == "success"]
    if not successful:
        return {"facility_health_score": None, "high_risk_count": 0, "asset_count": len(asset_analyses)}

    avg_health = round(sum(a["health_score"] for a in successful) / len(successful), 1)
    high_risk = [a for a in successful if a["high_risk"]]
    return {
        "facility_health_score": avg_health,
        "high_risk_count": len(high_risk),
        "asset_count": len(asset_analyses),
    }
