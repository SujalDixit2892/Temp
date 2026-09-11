"""Explicit, standalone seed command. Never run automatically at app
startup - run this by hand whenever you want to (re)create the DB.

Usage:
    python -m backend.seed
"""

import csv
import datetime
import hashlib

import numpy as np
import pandas as pd

from backend.database import Base, SessionLocal, engine
from backend.models import (
    Asset,
    EnergyRecord,
    Facility,
    MaintenanceLog,
    OccupancyReading,
    SecurityEvent,
    Zone,
)
from backend.occupancy.patterns import (
    DEFAULT_ZONES,
    FACILITY_TYPE_ZONES,
    ROUTINE_SECURITY_EVENTS,
    SUSPICIOUS_SECURITY_EVENTS,
    ZONE_SECURITY_LEVEL,
    expected_occupancy_rate,
)

FACILITIES_CSV = "data/processed_facilities.csv"
ENERGY_CSV = "data/processed_energy_daily.csv"

# --- Maintenance synthetic-data config -------------------------------
# No real per-building asset/telemetry dataset exists (only Facilities and
# Energy are real). These assets + readings are synthetic, but generated
# with deliberate variation so the real AI4I-trained ML models actually
# see a realistic spread of conditions - not the "seeder never varies"
# bug from the old repo's Security module.

ASSET_TYPE_POOL = [
    ("HVAC Unit", "M"),
    ("Elevator", "H"),
    ("Chiller", "H"),
    ("Boiler", "M"),
    ("Water Pump", "M"),
    ("Backup Generator", "H"),
    ("Electrical Panel", "L"),
    ("Fire Suppression Pump", "L"),
]

# air_temp, process_temp, speed, torque, wear ranges per health trajectory.
# process_temp runs ~10K above air_temp, matching the real AI4I dataset's
# relationship between the two.
TRAJECTORIES = {
    "healthy": {
        "weight": 0.70,
        "air_temp": (296, 300),
        "speed": (1400, 1650),
        "torque": (30, 45),
        "wear_range": (0, 70),
    },
    "degrading": {
        "weight": 0.20,
        "air_temp": (300, 304),
        "speed": (1300, 1550),
        "torque": (45, 62),
        "wear_range": (120, 220),
    },
    "critical": {
        "weight": 0.10,
        "air_temp": (303, 307),
        "speed": (1250, 1450),
        "torque": (58, 76),
        "wear_range": (205, 250),
    },
}

READINGS_PER_ASSET = 8
DAYS_BETWEEN_READINGS = 12
SEED_REFERENCE_DATE = datetime.date(2026, 9, 1)

# --- Occupancy + Security synthetic-data config -----------------------
# Zone/expected-occupancy definitions live in backend/occupancy/patterns.py
# (shared with the model training script - don't redefine them here).

OCCUPANCY_READING_HOURS = [9, 12, 15, 18]
OCCUPANCY_DAYS = 14
OVERCROWDING_SPIKE_CHANCE = 0.1  # fraction of zones that get one demo spike

SECURITY_EVENT_WINDOW_DAYS = 30
SUSPICIOUS_FACILITY_CHANCE = 0.15  # fraction of facilities with an injected breach cluster


def _rng_for(facility_id: str, salt: str) -> np.random.Generator:
    """Deterministic per-entity RNG - reruns of the seed script produce
    the same data, but every asset/facility gets its own varied stream."""
    seed_bytes = hashlib.sha256(f"{facility_id}:{salt}".encode()).digest()[:8]
    return np.random.default_rng(int.from_bytes(seed_bytes, "big"))


def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Schema reset.")


def seed_facilities(csv_path: str = FACILITIES_CSV):
    db = SessionLocal()
    count = 0
    try:
        with open(csv_path, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                db.merge(
                    Facility(
                        facility_id=row["facility_id"],
                        facility_type=row["facility_type"],
                        total_area_sqft=int(float(row["total_area_sqft"])),
                        total_floors=int(row["total_floors"]),
                    )
                )
                count += 1
        db.commit()
        print(f"Seeded {count} facilities from {csv_path}.")
    finally:
        db.close()


def seed_energy(csv_path: str = ENERGY_CSV):
    """Bulk load - one big insert, not one-row-at-a-time (that's what made
    the old repo's seeding take minutes)."""
    df = pd.read_csv(csv_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.strftime("%Y-%m-%d")
    df.to_sql(EnergyRecord.__tablename__, con=engine, if_exists="append", index=False)
    print(f"Seeded {len(df)} energy records from {csv_path}.")


def seed_maintenance(csv_path: str = FACILITIES_CSV):
    facilities_df = pd.read_csv(csv_path)
    trajectory_names = list(TRAJECTORIES.keys())
    trajectory_weights = [TRAJECTORIES[t]["weight"] for t in trajectory_names]

    assets_rows = []
    logs_rows = []
    asset_counter = 0
    log_counter = 0

    for _, frow in facilities_df.iterrows():
        facility_id = frow["facility_id"]
        rng = _rng_for(facility_id, "assets")

        n_assets = int(np.clip(frow["total_floors"], 2, 6))
        chosen_types = rng.choice(len(ASSET_TYPE_POOL), size=n_assets, replace=n_assets > len(ASSET_TYPE_POOL))

        for type_idx in chosen_types:
            asset_type, ai4i_type = ASSET_TYPE_POOL[int(type_idx)]
            asset_counter += 1
            asset_id = f"AST-{asset_counter:06d}"

            install_days_ago = int(rng.integers(365, 15 * 365))
            install_date = SEED_REFERENCE_DATE - datetime.timedelta(days=install_days_ago)

            assets_rows.append({
                "asset_id": asset_id,
                "facility_id": facility_id,
                "asset_type": asset_type,
                "ai4i_type": ai4i_type,
                "installation_date": install_date.isoformat(),
            })

            asset_rng = _rng_for(asset_id, "logs")
            trajectory_name = asset_rng.choice(trajectory_names, p=trajectory_weights)
            traj = TRAJECTORIES[trajectory_name]

            wear_start, wear_end = traj["wear_range"]
            wear_progression = np.linspace(
                max(0, wear_start - 20), wear_end, READINGS_PER_ASSET
            ) + asset_rng.normal(0, 4, READINGS_PER_ASSET)
            wear_progression = np.clip(wear_progression, 0, 253)

            for i in range(READINGS_PER_ASSET):
                log_counter += 1
                reading_date = SEED_REFERENCE_DATE - datetime.timedelta(
                    days=(READINGS_PER_ASSET - i) * DAYS_BETWEEN_READINGS
                )
                air_temp = float(asset_rng.uniform(*traj["air_temp"]))
                logs_rows.append({
                    "log_id": f"LOG-{log_counter:07d}",
                    "asset_id": asset_id,
                    "reading_date": reading_date.isoformat(),
                    "air_temp": round(air_temp, 1),
                    "process_temp": round(air_temp + asset_rng.uniform(9, 11), 1),
                    "speed": round(float(asset_rng.uniform(*traj["speed"])), 1),
                    "torque": round(float(asset_rng.uniform(*traj["torque"])), 1),
                    "wear": round(float(wear_progression[i]), 1),
                })

    pd.DataFrame(assets_rows).to_sql(Asset.__tablename__, con=engine, if_exists="append", index=False)
    pd.DataFrame(logs_rows).to_sql(MaintenanceLog.__tablename__, con=engine, if_exists="append", index=False)
    print(f"Seeded {len(assets_rows)} assets and {len(logs_rows)} maintenance logs.")


def _build_occupancy_and_security_rows(facilities_df: pd.DataFrame):
    """Pure data generation, no DB access - kept separate so it can be
    tested/validated on its own."""
    zone_counter = 0
    sec_counter = 0
    zones_rows = []
    occ_rows = []
    sec_rows = []

    for _, frow in facilities_df.iterrows():
        facility_id = frow["facility_id"]
        zone_types = FACILITY_TYPE_ZONES.get(frow["facility_type"], DEFAULT_ZONES)

        facility_zones = []  # (zone_id, zone_type, capacity)
        for zt in zone_types:
            zone_counter += 1
            zone_id = f"ZN-{zone_counter:06d}"
            capacity = int(np.clip(frow["total_area_sqft"] / (len(zone_types) * 100), 10, 400))
            zones_rows.append({
                "zone_id": zone_id, "facility_id": facility_id,
                "zone_type": zt, "capacity": capacity,
                "security_level": ZONE_SECURITY_LEVEL[zt],
            })
            facility_zones.append((zone_id, zt, capacity))

        # --- occupancy readings ---
        for zone_id, zt, capacity in facility_zones:
            zone_rng = _rng_for(zone_id, "occupancy")
            spike_day = int(zone_rng.integers(0, OCCUPANCY_DAYS)) if zone_rng.random() < OVERCROWDING_SPIKE_CHANCE else None
            spike_hour = OCCUPANCY_READING_HOURS[len(OCCUPANCY_READING_HOURS) // 2]

            for day_offset in range(OCCUPANCY_DAYS):
                reading_date = SEED_REFERENCE_DATE - datetime.timedelta(days=(OCCUPANCY_DAYS - day_offset))
                dow = reading_date.weekday()
                for hour in OCCUPANCY_READING_HOURS:
                    rate = expected_occupancy_rate(zt, hour, dow)
                    noise = max(0.0, zone_rng.normal(1.0, 0.15))
                    count = rate * capacity * noise
                    if spike_day == day_offset and hour == spike_hour:
                        count = capacity * zone_rng.uniform(1.1, 1.4)  # deliberate overcrowding event
                    occ_rows.append({
                        "zone_id": zone_id,
                        "timestamp": datetime.datetime.combine(reading_date, datetime.time(hour=hour)).isoformat(),
                        "occupancy_count": int(round(count)),
                    })

        # --- security events ---
        sec_rng = _rng_for(facility_id, "security")
        events = []  # working list of dicts with a real datetime, sorted+consumed below

        for zone_id, zt, capacity in facility_zones:
            n_routine = int(sec_rng.integers(2, 6))
            for _ in range(n_routine):
                day_offset = int(sec_rng.integers(0, SECURITY_EVENT_WINDOW_DAYS))
                hour = int(sec_rng.integers(6, 22))
                minute = int(sec_rng.integers(0, 60))
                event_type, severity = ROUTINE_SECURITY_EVENTS[int(sec_rng.integers(0, len(ROUTINE_SECURITY_EVENTS)))]
                event_dt = datetime.datetime.combine(
                    SEED_REFERENCE_DATE - datetime.timedelta(days=day_offset),
                    datetime.time(hour=hour, minute=minute),
                )
                events.append({
                    "timestamp": event_dt, "event_type": event_type, "severity": severity,
                    "zone_id": zone_id, "zone_level": ZONE_SECURITY_LEVEL[zt], "status": "Closed",
                })

        if facility_zones and sec_rng.random() < SUSPICIOUS_FACILITY_CHANCE:
            zone_id, zt, capacity = max(facility_zones, key=lambda z: ZONE_SECURITY_LEVEL[z[1]])
            cluster_day = int(sec_rng.integers(1, SECURITY_EVENT_WINDOW_DAYS - 1))
            base_hour = int(sec_rng.integers(1, 4))  # off-hours
            base_date = SEED_REFERENCE_DATE - datetime.timedelta(days=cluster_day)
            n_failed = int(sec_rng.integers(3, 7))

            for i in range(n_failed):
                event_dt = datetime.datetime.combine(base_date, datetime.time(hour=base_hour)) + datetime.timedelta(minutes=i * 3)
                events.append({
                    "timestamp": event_dt, "event_type": "Failed Badge Attempt", "severity": "Medium",
                    "zone_id": zone_id, "zone_level": ZONE_SECURITY_LEVEL[zt], "status": "Investigating",
                })

            culmination_type = "Door Forced Open" if sec_rng.random() < 0.5 else "Unauthorized Access Attempt"
            event_dt = datetime.datetime.combine(base_date, datetime.time(hour=base_hour)) + datetime.timedelta(minutes=n_failed * 3 + 2)
            events.append({
                "timestamp": event_dt, "event_type": culmination_type, "severity": "High",
                "zone_id": zone_id, "zone_level": ZONE_SECURITY_LEVEL[zt], "status": "Open",
            })

        # chronological pass: recent_failed_attempts is a REAL rolling count,
        # not a constant - this is the exact field the reference repo left
        # static, which is why its anomaly model never saw any variation.
        events.sort(key=lambda e: e["timestamp"])
        failed_attempt_times = []
        for e in events:
            window_start = e["timestamp"] - datetime.timedelta(hours=24)
            recent_count = sum(1 for t in failed_attempt_times if window_start <= t < e["timestamp"])
            sec_counter += 1
            sec_rows.append({
                "event_id": f"SEC-{sec_counter:07d}",
                "facility_id": facility_id,
                "zone_id": e["zone_id"],
                "event_type": e["event_type"],
                "severity": e["severity"],
                "timestamp": e["timestamp"].isoformat(),
                "zone_level": e["zone_level"],
                "recent_failed_attempts": recent_count,
            })
            if e["event_type"] == "Failed Badge Attempt":
                failed_attempt_times.append(e["timestamp"])

    return zones_rows, occ_rows, sec_rows


def seed_occupancy_and_security(csv_path: str = FACILITIES_CSV):
    facilities_df = pd.read_csv(csv_path)
    zones_rows, occ_rows, sec_rows = _build_occupancy_and_security_rows(facilities_df)

    pd.DataFrame(zones_rows).to_sql(Zone.__tablename__, con=engine, if_exists="append", index=False)
    pd.DataFrame(occ_rows).to_sql(OccupancyReading.__tablename__, con=engine, if_exists="append", index=False)
    pd.DataFrame(sec_rows).to_sql(SecurityEvent.__tablename__, con=engine, if_exists="append", index=False)
    print(f"Seeded {len(zones_rows)} zones, {len(occ_rows)} occupancy records, {len(sec_rows)} security events.")


if __name__ == "__main__":
    reset_db()
    seed_facilities()
    seed_energy()
    seed_maintenance()
    seed_occupancy_and_security()
