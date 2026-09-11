"""Loads models/energy_model_v1.joblib once per process. Everything that
needs the model imports get_model() from here instead of loading the file
itself - avoids reloading the artifact on every request.
"""

import functools
import os
from pathlib import Path

import joblib

PROJECT_ROOT = Path(__file__).resolve().parents[2]
configured_model_path = Path(os.getenv("ENERGY_MODEL_PATH", "models/energy_model_v1.joblib"))
MODEL_PATH = configured_model_path if configured_model_path.is_absolute() else PROJECT_ROOT / configured_model_path


@functools.lru_cache(maxsize=1)
def get_energy_model_artifact():
    """Returns the dict saved from Colab: model, feature_columns,
    facility_type_categories, residual_mean, residual_std, mae.
    Returns None if the file isn't there yet - callers must handle this
    and report a degraded state, never crash.
    """
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)
