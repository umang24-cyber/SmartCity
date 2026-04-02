"""
inference.py
============
Production inference module for the Women's Safety LSTM Predictor.

Responsibilities:
  - Load trained model (.keras) and scaler (.pkl) once at startup
  - Engineer features from raw input rows
  - Run MC Dropout × 10 passes for Bayesian uncertainty
  - Return 24-hour safety score forecast with 95% confidence intervals

No training code, no notebook dependencies.
"""

import os
import pickle
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

import tensorflow as tf
from tensorflow.keras import layers

@tf.keras.utils.register_keras_serializable()
class ReverseLayer(layers.Layer):
    def call(self, inputs):
        return tf.reverse(inputs, axis=[1])

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["TF_CUDNN_DETERMINISTIC"] = "1"   # keep even in prod — defensive

import tensorflow as tf
from tensorflow import keras

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Constants (must match training configuration exactly)
# ─────────────────────────────────────────────────────────────────────────────
SEQUENCE_LENGTH   = 24   # hours of history required as input
FORECAST_HORIZON  = 24   # hours to predict
MC_DROPOUT_PASSES = 10   # MC Dropout inference passes

FEATURE_COLS = [
    "safety_score",
    "crowd_density",
    "hour_sin", "hour_cos",
    "day_sin",  "day_cos",
    "is_night", "is_rush_hour",
    "is_weekend",
    "safety_score_ma_6h", "safety_score_std_6h", "safety_score_ma_24h",
    "crowd_density_change", "safety_score_momentum",
    "safety_score_lag_1h", "safety_score_lag_3h", "safety_score_lag_6h",
    "weather_numeric",
    "lights_functional", "cctv_functional",
    "night_crowd_density",
    "incident_count_last_6h",
]

WEATHER_MAP = {
    "clear": 0.0,
    "cloudy": 0.3,
    "rain": 1.0,
    "fog": 2.0,
    "storm": 3.0,
}

# ─────────────────────────────────────────────────────────────────────────────
# Model registry — loaded once, reused for every request
# ─────────────────────────────────────────────────────────────────────────────
_models:  Dict[str, tf.keras.Model] = {}
_scalers: Dict[str, MinMaxScaler]   = {}


def load_model_and_scaler(
    intersection_id: str,
    model_dir: str = "models",
) -> None:
    """
    Load a trained model and its scaler into memory.
    Call once per intersection_id at application startup.

    Expected files:
      {model_dir}/lstm_{intersection_id}.keras
      {model_dir}/scaler_{intersection_id}.pkl

    Args:
        intersection_id : e.g. "INT007"
        model_dir       : directory containing saved artefacts
    """
    if intersection_id in _models and intersection_id in _scalers:
        logger.debug("Model %s already loaded — skipping.", intersection_id)
        return

    model_path  = os.path.join(model_dir, f"lstm_{intersection_id}.keras")
    scaler_path = os.path.join(model_dir, f"scaler_{intersection_id}.pkl")

    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model file not found: {model_path}\n"
            f"Train the model first and save it to '{model_dir}/'."
        )
    if not os.path.exists(scaler_path):
        raise FileNotFoundError(
            f"Scaler file not found: {scaler_path}\n"
            f"Scaler is saved automatically during training."
        )

    logger.info("Loading model: %s", model_path)
    _models[intersection_id] = keras.models.load_model(model_path, compile=False)

    logger.info("Loading scaler: %s", scaler_path)
    with open(scaler_path, "rb") as f:
        _scalers[intersection_id] = pickle.load(f)

    logger.info("✓ %s loaded successfully.", intersection_id)


# ─────────────────────────────────────────────────────────────────────────────
# Feature engineering
# ─────────────────────────────────────────────────────────────────────────────

def _engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transform raw hourly rows into the 22-feature matrix the model expects.

    Input columns required:
        timestamp, safety_score, crowd_density, hour, day_of_week,
        is_weekend, weather_condition, incident_count_last_6h,
        lights_functional, cctv_functional

    Returns:
        DataFrame with FEATURE_COLS columns in the correct order.
    """
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # ── Time flags ───────────────────────────────────────────────────────────
    df["is_night"]     = ((df["hour"] >= 20) | (df["hour"] <= 6)).astype(int)
    df["is_rush_hour"] = (
        ((df["hour"] >= 7)  & (df["hour"] <= 9)) |
        ((df["hour"] >= 17) & (df["hour"] <= 19))
    ).astype(int)

    # ── Cyclical time encoding ───────────────────────────────────────────────
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["day_sin"]  = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["day_cos"]  = np.cos(2 * np.pi * df["day_of_week"] / 7)

    # ── Rolling window statistics ────────────────────────────────────────────
    df["safety_score_ma_6h"]    = df["safety_score"].rolling(6,  min_periods=1).mean()
    df["safety_score_std_6h"]   = df["safety_score"].rolling(6,  min_periods=1).std().fillna(0)
    df["safety_score_ma_24h"]   = df["safety_score"].rolling(24, min_periods=1).mean()
    df["crowd_density_change"]  = df["crowd_density"].diff().fillna(0)
    df["safety_score_momentum"] = df["safety_score"].diff(3).fillna(0)

    # ── Lag features ─────────────────────────────────────────────────────────
    df["safety_score_lag_1h"] = df["safety_score"].shift(1).bfill()
    df["safety_score_lag_3h"] = df["safety_score"].shift(3).bfill()
    df["safety_score_lag_6h"] = df["safety_score"].shift(6).bfill()

    # ── Weather encoding ─────────────────────────────────────────────────────
    df["weather_numeric"] = (
        df["weather_condition"].str.lower().map(WEATHER_MAP).fillna(0.0)
    )

    # ── Interaction term ─────────────────────────────────────────────────────
    df["night_crowd_density"] = df["is_night"] * df["crowd_density"]

    df = df.dropna().reset_index(drop=True)

    # Return only the columns the model was trained on, in order
    available = [c for c in FEATURE_COLS if c in df.columns]
    return df[available]


# ─────────────────────────────────────────────────────────────────────────────
# Core predict function
# ─────────────────────────────────────────────────────────────────────────────

def predict(input_data: dict) -> dict:
    """
    Generate a 24-hour safety score forecast for one intersection.

    Args:
        input_data: {
            "intersection_id": "INT007",
            "current_time":    "2025-01-16T14:00:00",   # optional ISO string
            "history": [                                  # exactly 24 rows
                {
                    "timestamp":              "2025-01-15T14:00:00",
                    "safety_score":           72.5,
                    "crowd_density":          0.45,
                    "hour":                   14,
                    "day_of_week":            2,
                    "is_weekend":             0,
                    "weather_condition":      "clear",
                    "incident_count_last_6h": 0,
                    "lights_functional":      6,
                    "cctv_functional":        3
                },
                ... (24 rows total)
            ]
        }

    Returns: {
        "intersection_id": "INT007",
        "forecast_generated_at": "2025-01-16T14:00:00",
        "model_info": {...},
        "predictions": [
            {
                "hour_offset":         1,
                "predicted_time":      "2025-01-16T15:00:00",
                "predicted_score":     67.5,
                "confidence_interval": [62.3, 72.7],
                "confidence":          0.895,
                "uncertainty_sigma":   2.6,
                "severity":            "Safe"
            },
            ...  (24 items)
        ],
        "danger_hours": [...],
        "alert_recommended": false,
        "alert_time": null
    }

    Raises:
        ValueError: if input validation fails
        RuntimeError: if model is not loaded
    """
    # ── Validate input ────────────────────────────────────────────────────────
    iid = input_data.get("intersection_id")
    if not iid:
        raise ValueError("'intersection_id' is required.")

    history_raw = input_data.get("history", [])
    if len(history_raw) < SEQUENCE_LENGTH:
        raise ValueError(
            f"'history' must contain exactly {SEQUENCE_LENGTH} hourly rows. "
            f"Got {len(history_raw)}."
        )
    # Use the last SEQUENCE_LENGTH rows if more were provided
    history_raw = history_raw[-SEQUENCE_LENGTH:]

    # ── Ensure model is loaded ────────────────────────────────────────────────
    if iid not in _models or iid not in _scalers:
        raise RuntimeError(
            f"Model for '{iid}' is not loaded. "
            f"Call load_model_and_scaler('{iid}') at startup."
        )

    model  = _models[iid]
    scaler = _scalers[iid]
    n_feat = scaler.n_features_in_

    # ── Parse current_time ────────────────────────────────────────────────────
    ct_str = input_data.get("current_time")
    if ct_str:
        current_time = datetime.fromisoformat(ct_str).replace(minute=0, second=0, microsecond=0)
    else:
        current_time = datetime.now().replace(minute=0, second=0, microsecond=0)

    # ── Feature engineering ───────────────────────────────────────────────────
    df = pd.DataFrame(history_raw)
    df = _engineer_features(df)

    # Align with the scaler's feature count
    available_cols = [c for c in FEATURE_COLS if c in df.columns][:n_feat]
    if len(available_cols) < n_feat:
        raise ValueError(
            f"After feature engineering, got {len(available_cols)} features "
            f"but scaler expects {n_feat}. "
            f"Missing columns: {set(FEATURE_COLS[:n_feat]) - set(available_cols)}"
        )

    recent        = df.tail(SEQUENCE_LENGTH)[available_cols].values  # (24, n_feat)
    recent_scaled = scaler.transform(recent)                          # normalise to [0,1]
    input_tensor  = tf.constant(
        recent_scaled[np.newaxis, :, :].astype(np.float32)           # (1, 24, n_feat)
    )

    # ── Monte Carlo Dropout inference ─────────────────────────────────────────
    # training=True keeps Dropout layers active → stochastic forward passes
    # Spread across N passes ≈ model uncertainty (Gal & Ghahramani 2016)
    mc_preds = np.array([
        model(input_tensor, training=True).numpy()[0]
        for _ in range(MC_DROPOUT_PASSES)
    ])  # shape: (10, 24)

    mean_scaled = mc_preds.mean(axis=0)   # (24,)
    std_scaled  = mc_preds.std(axis=0)    # (24,)

    # ── Inverse-transform back to original score scale ────────────────────────
    dummy_mean = np.zeros((FORECAST_HORIZON, n_feat))
    dummy_std  = np.zeros((FORECAST_HORIZON, n_feat))
    dummy_mean[:, 0] = mean_scaled
    dummy_std[:, 0]  = std_scaled

    mean_scores = scaler.inverse_transform(dummy_mean)[:, 0]
    std_scores  = np.abs(
        scaler.inverse_transform(dummy_std)[:, 0]
        - scaler.inverse_transform(np.zeros_like(dummy_std))[:, 0]
    )

    # ── Assemble per-hour predictions ─────────────────────────────────────────
    predictions = []
    danger_hours = []

    for i in range(FORECAST_HORIZON):
        score  = float(np.clip(mean_scores[i], 0.0, 100.0))
        sigma  = float(max(std_scores[i], 0.5))        # min sigma 0.5 points
        ci_low  = round(max(0.0,   score - 1.96 * sigma), 2)
        ci_high = round(min(100.0, score + 1.96 * sigma), 2)
        conf    = round(float(np.clip(1.0 - (ci_high - ci_low) / 100.0, 0.0, 1.0)), 4)

        severity = (
            "Critical"      if score < 35 else
            "High Risk"     if score < 45 else
            "Moderate Risk" if score < 50 else
            "Caution"       if score < 70 else
            "Safe"
        )

        entry = {
            "hour_offset"         : i + 1,
            "predicted_time"      : (current_time + timedelta(hours=i + 1))
                                    .strftime("%Y-%m-%dT%H:%M:%S"),
            "predicted_score"     : round(score, 2),
            "confidence_interval" : [ci_low, ci_high],
            "confidence"          : conf,
            "uncertainty_sigma"   : round(sigma, 4),
            "severity"            : severity,
        }
        predictions.append(entry)

        if score < 50:
            danger_hours.append(entry)

    # ── Alert recommendation ──────────────────────────────────────────────────
    alert_recommended = len(danger_hours) > 0
    alert_time = None
    if danger_hours:
        first_danger_dt = datetime.fromisoformat(danger_hours[0]["predicted_time"])
        alert_dt        = first_danger_dt - timedelta(hours=2)
        alert_time      = alert_dt.strftime("%Y-%m-%dT%H:%M:%S")

    return {
        "intersection_id"      : iid,
        "forecast_generated_at": current_time.strftime("%Y-%m-%dT%H:%M:%S"),
        "model_info": {
            "architecture"    : "BiLSTMCell(128) + LSTMCell(64) + Dense(24)",
            "sequence_length" : SEQUENCE_LENGTH,
            "forecast_horizon": FORECAST_HORIZON,
            "mc_passes"       : MC_DROPOUT_PASSES,
            "n_features"      : n_feat,
        },
        "predictions"      : predictions,
        "danger_hours"     : danger_hours,
        "alert_recommended": alert_recommended,
        "alert_time"       : alert_time,
    }
