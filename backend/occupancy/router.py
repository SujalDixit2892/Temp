import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.occupancy.analyzer import analyze_occupancy, analyze_security
from backend.occupancy.model_loader import get_occupancy_model_artifact
from backend.occupancy.reasoner import generate_recommendation
from backend.models import Facility, OccupancyReading, SecurityEvent, Zone

router = APIRouter(prefix="/api/occupancy", tags=["occupancy"])


@router.get("/{facility_id}/analyze")
def analyze_facility(
    facility_id: str,
    days: int = Query(1, ge=1, le=90),
    db: Session = Depends(get_db),
):
    facility = db.query(Facility).filter(Facility.facility_id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail=f"Unknown facility_id: {facility_id}")

    zones = db.query(Zone).filter(Zone.facility_id == facility_id).all()

    latest_timestamp = (
        db.query(OccupancyReading.timestamp)
        .join(Zone, OccupancyReading.zone_id == Zone.zone_id)
        .filter(Zone.facility_id == facility_id)
        .order_by(OccupancyReading.timestamp.desc())
        .first()
    )
    window_start = None
    if latest_timestamp:
        latest_dt = datetime.datetime.fromisoformat(latest_timestamp[0])
        window_start = latest_dt - datetime.timedelta(days=days - 1)

    artifact = get_occupancy_model_artifact()
    occupancy_results = []
    zones_with_latest = []
    for zone in zones:
        readings = (
            db.query(OccupancyReading)
            .filter(OccupancyReading.zone_id == zone.zone_id)
            .filter(
                OccupancyReading.timestamp >= window_start.isoformat()
                if window_start else True
            )
            .order_by(OccupancyReading.timestamp.desc())
            .all()
        )
        latest = readings[0] if readings else None
        latest_dt = datetime.datetime.fromisoformat(latest.timestamp) if latest else None
        zones_with_latest.append({
            "zone_id": zone.zone_id,
            "zone_type": zone.zone_type,
            "max_capacity": zone.capacity,
            "latest_count": round(
                sum(reading.occupancy_count for reading in readings) / len(readings), 1
            ) if readings else None,
            "latest_hour": latest_dt.hour if latest_dt else None,
            "latest_dow": latest_dt.weekday() if latest_dt else None,
        })

    if artifact is None:
        occupancy_degraded_reason = "occupancy_model_unavailable"
        occupancy_results = [
            {
                **zone,
                "utilization_pct": round(
                    zone["latest_count"] / zone["max_capacity"] * 100, 1
                ) if zone["latest_count"] is not None and zone["max_capacity"] else None,
                "status": "no_model",
            }
            for zone in zones_with_latest
        ]
    else:
        occupancy_degraded_reason = None
        occupancy_results = analyze_occupancy(artifact, zones_with_latest)

    events = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.facility_id == facility_id)
        .filter(
            SecurityEvent.timestamp >= window_start.isoformat()
            if window_start else True
        )
        .all()
    )
    event_dicts = [
        {
            "event_id": e.event_id,
            "event_type": e.event_type,
            "severity": e.severity,
            "event_time": e.timestamp,
            "status": "Open" if e.severity == "High" else "Closed",
            "zone_id": e.zone_id,
            "zone_level": e.zone_level,
            "recent_failed_attempts": e.recent_failed_attempts,
        }
        for e in events
    ]
    security_summary = analyze_security(event_dicts)

    recommendation = generate_recommendation(occupancy_results, security_summary, facility_id)

    return {
        "facility_id": facility_id,
        "analysis_window_days": days,
        "occupancy": {
            "degraded": occupancy_degraded_reason is not None,
            "degradation_reason": occupancy_degraded_reason,
            "zones": occupancy_results,
        },
        "security": security_summary,
        "recommendation": recommendation,
    }
