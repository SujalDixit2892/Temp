import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.energy.analyzer import analyze_history
from backend.energy.model_loader import get_energy_model_artifact
from backend.energy.reasoner import generate_recommendation
from backend.models import EnergyRecord, Facility

router = APIRouter(prefix="/api/energy", tags=["energy"])


@router.get("/{facility_id}/analyze")
def analyze_facility_energy(
    facility_id: str,
    days: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    facility = db.query(Facility).filter(Facility.facility_id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail=f"Unknown facility_id: {facility_id}")

    artifact = get_energy_model_artifact()
    if artifact is None:
        return {
            "facility_id": facility_id,
            "degraded": True,
            "degradation_reason": "energy_model_not_found",
            "analysis": None,
            "recommendation": None,
        }

    records = (
        db.query(EnergyRecord)
        .filter(EnergyRecord.facility_id == facility_id)
        .order_by(EnergyRecord.timestamp.asc())
        .all()
    )
    if not records:
        return {
            "facility_id": facility_id,
            "degraded": True,
            "degradation_reason": "no_energy_telemetry",
            "analysis": None,
            "recommendation": None,
        }

    if days is not None:
        records = records[-days:]

    history_df = pd.DataFrame(
        [{"timestamp": pd.to_datetime(r.timestamp), "electricity_kwh": r.electricity_kwh} for r in records]
    )
    analysis = analyze_history(
        artifact, history_df, facility.facility_type, facility.total_area_sqft, facility.total_floors
    )
    recommendation = generate_recommendation(analysis, facility_id)

    return {
        "facility_id": facility_id,
        "degraded": analysis.get("status") != "success",
        "provenance": {"source": "RandomForestRegressor v1", "model_mae": artifact.get("mae")},
        "analysis": analysis,
        "recommendation": recommendation,
    }
