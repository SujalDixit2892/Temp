from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.database import Base


class Facility(Base):
    """The one canonical facility catalog. Every other module (Energy,
    Maintenance, Occupancy, Security, Cost) references facility_id from
    here - no module invents its own facility IDs.
    """

    __tablename__ = "facilities"

    facility_id = Column(String, primary_key=True)  # e.g. "F-0000"
    facility_type = Column(String, nullable=False)
    total_area_sqft = Column(Integer, nullable=False)
    total_floors = Column(Integer, nullable=False)

    energy_records = relationship("EnergyRecord", back_populates="facility")
    assets = relationship("Asset", back_populates="facility")


class EnergyRecord(Base):
    """One row per facility per day. Real data, from
    data/processed_energy_daily.csv."""

    __tablename__ = "energy_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    facility_id = Column(String, ForeignKey("facilities.facility_id"), nullable=False, index=True)
    timestamp = Column(String, nullable=False)  # ISO date string, e.g. "2016-01-01"
    electricity_kwh = Column(Float, nullable=False)

    facility = relationship("Facility", back_populates="energy_records")

class Asset(Base):
    """An equipment asset belonging to a facility (HVAC unit, elevator,
    chiller, etc). Synthetic - assigned per facility, no real per-building
    asset dataset exists."""

    __tablename__ = "assets"

    asset_id = Column(String, primary_key=True)  # e.g. "AST-000001"
    facility_id = Column(String, ForeignKey("facilities.facility_id"), nullable=False, index=True)
    asset_type = Column(String, nullable=False)  # e.g. "HVAC Unit", "Elevator"
    ai4i_type = Column(String, nullable=False)  # "L" / "M" / "H" - AI4I duty-class mapping
    installation_date = Column(String, nullable=False)  # ISO date

    facility = relationship("Facility", back_populates="assets")
    logs = relationship("MaintenanceLog", back_populates="asset")


class MaintenanceLog(Base):
    """A telemetry/maintenance reading for one asset. Uses the real AI4I
    2020 Predictive Maintenance Dataset's 6-feature schema so the existing
    trained models apply directly: air_temp, process_temp, speed, torque,
    wear (+ the asset's ai4i_type)."""

    __tablename__ = "maintenance_logs"

    log_id = Column(String, primary_key=True)  # e.g. "LOG-0000001"
    asset_id = Column(String, ForeignKey("assets.asset_id"), nullable=False, index=True)
    reading_date = Column(String, nullable=False)  # ISO date

    air_temp = Column(Float, nullable=False)      # Kelvin
    process_temp = Column(Float, nullable=False)  # Kelvin
    speed = Column(Float, nullable=False)          # rpm
    torque = Column(Float, nullable=False)          # Nm
    wear = Column(Float, nullable=False)             # minutes

    asset = relationship("Asset", back_populates="logs")


class Zone(Base):
    """A room/area within a facility. Synthetic - no real per-building
    zone dataset exists."""

    __tablename__ = "zones"

    zone_id = Column(String, primary_key=True)  # e.g. "ZN-000001"
    facility_id = Column(String, ForeignKey("facilities.facility_id"), nullable=False, index=True)
    zone_type = Column(String, nullable=False)  # "Office Floor" / "Meeting Room" / etc
    capacity = Column(Integer, nullable=False)
    security_level = Column(Integer, nullable=False)  # 1 (public) - 3 (restricted)

    facility = relationship("Facility")
    readings = relationship("OccupancyReading", back_populates="zone")


class OccupancyReading(Base):
    """One hourly occupancy count for a zone. Synthetic, generated from
    backend/occupancy/patterns.py - the same pattern the model was
    trained on."""

    __tablename__ = "occupancy_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(String, ForeignKey("zones.zone_id"), nullable=False, index=True)
    timestamp = Column(String, nullable=False)  # ISO datetime
    occupancy_count = Column(Integer, nullable=False)

    zone = relationship("Zone", back_populates="readings")


class SecurityEvent(Base):
    """An access-control/security event tied to a zone. Synthetic, with
    deliberately varying zone_level/recent_failed_attempts (the old
    repo's seeder never varied these, which is why its anomaly model was
    dead on arrival - see docs/DECISION_LOG.md in the reference repo)."""

    __tablename__ = "security_events"

    event_id = Column(String, primary_key=True)  # e.g. "SEC-0000001"
    facility_id = Column(String, ForeignKey("facilities.facility_id"), nullable=False, index=True)
    zone_id = Column(String, ForeignKey("zones.zone_id"), nullable=False, index=True)
    timestamp = Column(String, nullable=False)  # ISO datetime
    event_type = Column(String, nullable=False)  # "Badge Access Granted" / "Badge Access Denied" / etc
    severity = Column(String, nullable=False)  # "Low" / "Medium" / "High"
    zone_level = Column(Integer, nullable=False)
    recent_failed_attempts = Column(Integer, nullable=False)

    facility = relationship("Facility")
    zone = relationship("Zone")
