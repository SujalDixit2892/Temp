"""Feature engineering here MUST mirror the Colab training notebook
exactly (same lag/rolling window definitions, same shift-by-1 to avoid
leakage) or predictions will be silently wrong. If you change the
training notebook, change this file to match.
"""

import pandas as pd


def _engineer_features(history_df: pd.DataFrame, facility_type: str, total_area_sqft: int,
                        total_floors: int, facility_type_categories: list[str]) -> pd.DataFrame:
    """history_df: columns [timestamp (datetime), electricity_kwh], sorted ascending."""
    df = history_df.copy()
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["month"] = df["timestamp"].dt.month
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["lag_1"] = df["electricity_kwh"].shift(1)
    df["rolling_mean_7"] = df["electricity_kwh"].shift(1).rolling(7).mean()
    df["rolling_mean_30"] = df["electricity_kwh"].shift(1).rolling(30).mean()
    df["total_area_sqft"] = total_area_sqft
    df["total_floors"] = total_floors
    for cat in facility_type_categories:
        df[f"ftype_{cat}"] = 1 if facility_type == cat else 0
    return df


def _predict(artifact: dict, feature_df: pd.DataFrame) -> pd.Series:
    model = artifact["model"]
    feature_columns = artifact["feature_columns"]
    # any facility_type category the model has never seen just gets all-zero
    # dummy columns, which is a legitimate "unknown category" representation
    for col in feature_columns:
        if col not in feature_df.columns:
            feature_df[col] = 0
    return pd.Series(model.predict(feature_df[feature_columns]), index=feature_df.index)


def analyze_history(artifact: dict, history_df: pd.DataFrame, facility_type: str,
                     total_area_sqft: int, total_floors: int) -> dict:
    """Runs the model against every historical day we have data for
    (retrospective wastage detection) and forecasts the day after the
    last known record (real forecast).

    Wastage rule is RELATIVE to what the model expected for that facility
    on that day, not a fixed kWh number - facility sizes vary too much
    (parking structure vs. hospital campus) for one global threshold to
    mean anything. Flag = actual exceeds predicted by the greater of a
    small absolute floor (avoids flagging noise on tiny consumers) or 25%
    of the predicted value.
    """
    categories = artifact["facility_type_categories"]
    feat = _engineer_features(history_df, facility_type, total_area_sqft, total_floors, categories)
    feat = feat.dropna(subset=["lag_1", "rolling_mean_7", "rolling_mean_30"]).reset_index(drop=True)

    if feat.empty:
        return {
            "status": "insufficient_history",
            "anomalies": [],
            "forecast_next_day_kwh": None,
        }

    predicted = _predict(artifact, feat)
    feat["predicted_kwh"] = predicted
    feat["residual"] = feat["electricity_kwh"] - feat["predicted_kwh"]
    feat["threshold"] = feat["predicted_kwh"].apply(lambda p: max(200.0, 0.25 * p))
    feat["is_wastage"] = feat["residual"] > feat["threshold"]

    anomalies = feat[feat["is_wastage"]].tail(10)
    anomaly_list = [
        {
            "date": row["timestamp"].strftime("%Y-%m-%d"),
            "actual_kwh": round(row["electricity_kwh"], 1),
            "predicted_kwh": round(row["predicted_kwh"], 1),
            "excess_pct": round(100 * row["residual"] / row["predicted_kwh"], 1) if row["predicted_kwh"] else None,
        }
        for _, row in anomalies.iterrows()
    ]

    # forecast the day after the last known record
    last_row = history_df.sort_values("timestamp").iloc[-1]
    next_day = last_row["timestamp"] + pd.Timedelta(days=1)
    recent = history_df.sort_values("timestamp").tail(30)
    forecast_row = pd.DataFrame([{
        "timestamp": next_day,
        "electricity_kwh": None,
        "day_of_week": next_day.dayofweek,
        "month": next_day.month,
        "is_weekend": int(next_day.dayofweek >= 5),
        "lag_1": last_row["electricity_kwh"],
        "rolling_mean_7": recent["electricity_kwh"].tail(7).mean(),
        "rolling_mean_30": recent["electricity_kwh"].tail(30).mean(),
        "total_area_sqft": total_area_sqft,
        "total_floors": total_floors,
    }])
    for cat in categories:
        forecast_row[f"ftype_{cat}"] = 1 if facility_type == cat else 0
    forecast_kwh = float(_predict(artifact, forecast_row).iloc[0])

    return {
        "status": "success",
        "days_evaluated": len(feat),
        "anomalies": anomaly_list,
        "wastage_days_count": int(feat["is_wastage"].sum()),
        "forecast_next_day": next_day.strftime("%Y-%m-%d"),
        "forecast_next_day_kwh": round(forecast_kwh, 1),
        "model_mae": artifact.get("mae"),
    }
