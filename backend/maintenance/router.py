from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.maintenance.analyzer import analyze_asset, summarize_facility
from backend.maintenance.model_loader import get_maintenance_models
from backend.maintenance.reasoner import generate_work_order
from backend.models import Asset, Facility, MaintenanceLog

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


def _latest_log(db: Session, asset_id: str):
    return (
        db.query(MaintenanceLog)
        .filter(MaintenanceLog.asset_id == asset_id)
        .order_by(MaintenanceLog.reading_date.desc())
        .first()
    )


@router.get("/{facility_id}/assets")
def list_facility_assets(facility_id: str, db: Session = Depends(get_db)):
    facility = db.query(Facility).filter(Facility.facility_id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail=f"Unknown facility_id: {facility_id}")

    models = get_maintenance_models()
    if models is None:
        assets = db.query(Asset).filter(Asset.facility_id == facility_id).all()
        return {
            "facility_id": facility_id,
            "degraded": True,
            "degradation_reason": "maintenance_models_unavailable",
            "assets": [
                {
                    "asset_id": asset.asset_id,
                    "asset_type": asset.asset_type,
                    "status": "MODEL UNAVAILABLE",
                }
                for asset in assets
            ],
            "summary": {
                "facility_health_score": None,
                "high_risk_count": 0,
                "asset_count": len(assets),
            },
        }
    failure_model, fault_model, feature_columns = models

    assets = db.query(Asset).filter(Asset.facility_id == facility_id).all()
    analyses = []
    for asset in assets:
        log = _latest_log(db, asset.asset_id)
        analyses.append(analyze_asset(failure_model, fault_model, feature_columns, asset, log))

    return {
        "facility_id": facility_id,
        "degraded": False,
        "summary": summarize_facility(analyses),
        "assets": analyses,
    }


@router.get("/asset/{asset_id}/analyze")
def analyze_single_asset(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Unknown asset_id: {asset_id}")

    models = get_maintenance_models()
    if models is None:
        return {"asset_id": asset_id, "degraded": True, "degradation_reason": "maintenance_models_not_found"}
    failure_model, fault_model, feature_columns = models

    log = _latest_log(db, asset_id)
    analysis = analyze_asset(failure_model, fault_model, feature_columns, asset, log)
    work_order = generate_work_order(analysis) if analysis["status"] == "success" else None

    return {
        "asset_id": asset_id,
        "degraded": analysis["status"] != "success",
        "provenance": {"source": "AI4I-trained failure + fault classifiers (reused from reference repo)"},
        "analysis": analysis,
        "work_order": work_order,
    }
