"""Loads models/occupancy_model_v1.joblib once per process. This model
was trained fresh (not reused from the reference repo - its zone_type
encoding was undocumented and unsafe to reuse) against the exact zone
scheme in backend/occupancy/patterns.py.
"""

import functools
import os
from pathlib import Path

from backend.model_compat import load_joblib

PROJECT_ROOT = Path(__file__).resolve().parents[2]
configured_model_path = Path(os.getenv("OCCUPANCY_MODEL_PATH", "models/occupancy_model_v1.joblib"))
MODEL_PATH = configured_model_path if configured_model_path.is_absolute() else PROJECT_ROOT / configured_model_path


@functools.lru_cache(maxsize=1)
def get_occupancy_model_artifact():
    """Returns dict: model, feature_columns, zone_types, mae. None if the
    file isn't there - callers must treat this as a degraded state."""
    if not MODEL_PATH.exists():
        return None
    try:
        return load_joblib(MODEL_PATH)
    except (ImportError, ModuleNotFoundError, AttributeError, ValueError):
        return None
