"""Compatibility loading for models serialized by older scikit-learn builds."""

import sys

import joblib


def load_joblib(path):
    # Older HistGradientBoosting pickles reference a top-level _loss module.
    from sklearn._loss import _loss

    sys.modules.setdefault("_loss", _loss)
    return joblib.load(path)
