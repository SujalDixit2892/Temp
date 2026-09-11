"""Loads the maintenance models once per process. These are the ORIGINAL
models from the reference repo, trained on the real public AI4I 2020
Predictive Maintenance Dataset - reused as-is (verified locally: sane
failure probabilities on both normal and stressed synthetic inputs), not
retrained, since they aren't facility-specific.
"""

import functools
import os
from pathlib import Path

from backend.model_compat import load_joblib

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _project_path(environment_variable: str, default: str) -> Path:
    configured_path = Path(os.getenv(environment_variable, default))
    return configured_path if configured_path.is_absolute() else PROJECT_ROOT / configured_path


FAILURE_MODEL_PATH = _project_path("MAINTENANCE_FAILURE_MODEL_PATH", "models/maintenance_failure_model_v1.joblib")
FAULT_MODEL_PATH = _project_path("MAINTENANCE_FAULT_MODEL_PATH", "models/maintenance_fault_model_v1.joblib")
FEATURES_PATH = _project_path("MAINTENANCE_FEATURES_PATH", "models/maintenance_model_features.joblib")


@functools.lru_cache(maxsize=1)
def get_maintenance_models():
    """Returns (failure_model, fault_model, feature_columns) or None if
    any file is missing - callers must handle this as a degraded state,
    never crash."""
    if not (FAILURE_MODEL_PATH.exists() and FAULT_MODEL_PATH.exists() and FEATURES_PATH.exists()):
        return None
    try:
        failure_model = load_joblib(FAILURE_MODEL_PATH)
        fault_model = load_joblib(FAULT_MODEL_PATH)
        feature_columns = load_joblib(FEATURES_PATH)
    except (ImportError, ModuleNotFoundError, AttributeError, ValueError):
        return None
    return failure_model, fault_model, feature_columns
