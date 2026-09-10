"""
ChillShield AI — FastAPI Prediction Service
============================================
Serves ML model predictions for the frontend application.

Endpoints:
    GET  /health    — Health + model status
    POST /predict   — Single shipment risk prediction
    POST /simulate  — Simulate an intervention scenario

DISCLAIMER:
    Prototype model — not production validated.
    Trained on synthetic cold-chain data for hackathon demonstration.
"""

import json
import pickle
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── App setup ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="ChillShield AI — Prediction API",
    description="Prototype ML prediction service for cold-chain risk assessment.",
    version="1.0-prototype",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load model artifacts ───────────────────────────────────────────────────
ML_DIR = Path(__file__).parent
MODEL_PATH = ML_DIR / "model.pkl"
METADATA_PATH = ML_DIR / "model_metadata.json"
METRICS_PATH = ML_DIR / "metrics.json"

_pipeline = None
_metadata = {}
_metrics = {}

def load_model():
    global _pipeline, _metadata, _metrics
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            _pipeline = pickle.load(f)
        print(f"✓ Model loaded: {MODEL_PATH}")
    else:
        print("⚠ model.pkl not found — run ml/train.py first")

    if METADATA_PATH.exists():
        with open(METADATA_PATH) as f:
            _metadata = json.load(f)

    if METRICS_PATH.exists():
        with open(METRICS_PATH) as f:
            _metrics = json.load(f)


load_model()

# ── Feature names (must match training order) ─────────────────────────────
FEATURE_NAMES = [
    "temperature",
    "temp_excursion_magnitude",
    "excursion_duration_min",
    "humidity",
    "delay_minutes",
    "remaining_transit_min",
    "cargo_sensitivity",
    "route_risk",
    "traffic_level",
    "handling_events",
    "refrigeration_condition",
    "distance_km",
    "cargo_type_encoded",
]

CARGO_TYPE_MAP = {
    "frozen_food":   0,
    "biologics":     1,
    "vaccines":      2,
    "dairy":         3,
    "fresh_produce": 4,
}

CARGO_SAFE_RANGE = {
    0: (-20, -15),  # frozen_food
    1: (2, 8),      # biologics
    2: (2, 8),      # vaccines
    3: (1, 4),      # dairy
    4: (0, 10),     # fresh_produce
}

CARGO_SENSITIVITY = {
    0: 3,  # frozen_food — high
    1: 3,  # biologics — high
    2: 3,  # vaccines — high
    3: 2,  # dairy — medium
    4: 2,  # fresh_produce — medium
}

TRAFFIC_MAP = {"low": 1, "medium": 2, "high": 3}
REFRIGERATION_MAP = {"good": 1, "degraded": 2, "failed": 3}


# ── Pydantic models ───────────────────────────────────────────────────────

class ShipmentFeatures(BaseModel):
    shipment_id: str = Field(default="UNKNOWN")
    temperature: float = Field(..., description="Current cargo compartment temperature (°C)")
    humidity: float = Field(..., ge=0, le=100, description="Relative humidity (%)")
    delay_minutes: float = Field(..., ge=0, description="Current transit delay (minutes)")
    remaining_transit_min: float = Field(..., ge=0, description="Minutes remaining to destination")
    cargo_type: str = Field(..., description="Cargo type: biologics, vaccines, dairy, fresh_produce, frozen_food")
    route_risk: float = Field(..., ge=0.0, le=1.0, description="Normalized route risk score (0–1)")
    traffic_level: str = Field(..., description="Traffic: low | medium | high")
    handling_events: int = Field(default=0, ge=0, description="Count of abnormal handling events")
    refrigeration_condition: str = Field(default="good", description="Refrigeration: good | degraded | failed")
    distance_km: float = Field(default=200.0, description="Total route distance (km)")
    excursion_duration_min: Optional[float] = Field(default=None, description="Minutes outside safe range (auto-calculated if None)")


class RiskFactor(BaseModel):
    name: str
    impact: float
    description: str


class PredictionResponse(BaseModel):
    shipment_id: str
    risk_score: int
    risk_band: str
    safe_window_minutes: int
    risk_factors: List[RiskFactor]
    recommendation: str
    model_version: str
    timestamp: str
    disclaimer: str


class SimulationRequest(BaseModel):
    original: ShipmentFeatures
    intervention: ShipmentFeatures


class SimulationResponse(BaseModel):
    original: PredictionResponse
    simulated: PredictionResponse
    risk_change: int
    safe_window_change: int
    recommendation_summary: str


# ── Core prediction logic ─────────────────────────────────────────────────

def compute_derived_features(req: ShipmentFeatures) -> Dict[str, float]:
    """Compute derived features from ShipmentFeatures."""
    cargo_code = CARGO_TYPE_MAP.get(req.cargo_type, 1)
    safe_min, safe_max = CARGO_SAFE_RANGE.get(cargo_code, (2, 8))
    sensitivity = CARGO_SENSITIVITY.get(cargo_code, 2)

    excursion_mag = max(0.0, req.temperature - safe_max)
    excursion_mag = max(excursion_mag, max(0.0, safe_min - req.temperature) * 0.6)

    exc_dur = req.excursion_duration_min
    if exc_dur is None:
        exc_dur = excursion_mag * 8.0 if excursion_mag > 0 else 0.0

    traffic_val = TRAFFIC_MAP.get(req.traffic_level.lower(), 2)
    refrig_val = REFRIGERATION_MAP.get(req.refrigeration_condition.lower(), 1)

    return {
        "temperature": req.temperature,
        "temp_excursion_magnitude": excursion_mag,
        "excursion_duration_min": exc_dur,
        "humidity": req.humidity,
        "delay_minutes": req.delay_minutes,
        "remaining_transit_min": req.remaining_transit_min,
        "cargo_sensitivity": float(sensitivity),
        "route_risk": req.route_risk,
        "traffic_level": float(traffic_val),
        "handling_events": float(req.handling_events),
        "refrigeration_condition": float(refrig_val),
        "distance_km": req.distance_km,
        "cargo_type_encoded": float(cargo_code),
        # extras for UI use
        "_cargo_code": cargo_code,
        "_safe_min": safe_min,
        "_safe_max": safe_max,
        "_excursion_mag": excursion_mag,
        "_exc_dur": exc_dur,
        "_traffic_val": traffic_val,
        "_refrig_val": refrig_val,
    }


def risk_band(score: int) -> str:
    if score < 30:   return "LOW"
    if score < 60:   return "MODERATE"
    if score < 80:   return "HIGH"
    return "CRITICAL"


def compute_safe_window(risk_score: int, delay_minutes: float, remaining_transit_min: float) -> int:
    """
    Estimate safe window: projected time before risk crosses CRITICAL (80).
    Strategy: if risk < 80, estimate by how long until risk trajectory hits 80
    at current rate of degradation. This is a transparent heuristic, NOT
    a direct model output — clearly labeled as 'Estimated'.
    """
    if risk_score >= 80:
        # Already critical — safe window is the remaining time before things worsen
        return max(0, int(remaining_transit_min * 0.3))

    margin_to_critical = 80 - risk_score
    # Degradation rate is faster when delay and excursion are high
    degradation_rate = 0.8 + (delay_minutes / 200.0)  # risk pts / minute
    estimated_minutes = int(margin_to_critical / degradation_rate)
    return min(estimated_minutes, int(remaining_transit_min))


def build_risk_factors(features: Dict, importances: List[Dict]) -> List[RiskFactor]:
    """Build human-readable risk factor contributions from feature importances
    and the actual feature values to make them context-sensitive."""
    factor_map = {
        "temp_excursion_magnitude":  ("Temperature Excursion", "°C above safe range"),
        "excursion_duration_min":    ("Excursion Duration", "min outside safe range"),
        "refrigeration_condition":   ("Refrigeration Condition", "fridge status"),
        "delay_minutes":             ("Transit Delay", "min delayed"),
        "remaining_transit_min":     ("Remaining Transit", "min to destination"),
        "cargo_sensitivity":         ("Cargo Sensitivity", "sensitivity level"),
        "route_risk":                ("Route Risk", "normalized route risk"),
        "handling_events":           ("Handling Events", "events count"),
        "traffic_level":             ("Traffic Level", "traffic condition"),
        "humidity":                  ("Humidity", "% relative humidity"),
        "distance_km":               ("Distance", "km remaining"),
        "temperature":               ("Temperature", "°C current"),
        "cargo_type_encoded":        ("Cargo Type", "cargo category"),
    }

    results = []
    for entry in importances[:6]:  # top 6 factors
        feat = entry["feature"]
        raw_imp = entry["importance"]
        label, unit = factor_map.get(feat, (feat, ""))
        val = features.get(feat, 0)

        # Build contextual description
        if feat == "temp_excursion_magnitude":
            desc = f"{val:.1f}°C above safe range" if val > 0 else "Within safe range"
        elif feat == "excursion_duration_min":
            desc = f"{int(val)} min outside safe range" if val > 0 else "No excursion"
        elif feat == "refrigeration_condition":
            cond = {1: "Good", 2: "Degraded", 3: "Failed"}.get(int(val), "Unknown")
            desc = f"Refrigeration: {cond}"
        elif feat == "delay_minutes":
            desc = f"{int(val)} min delay" if val > 0 else "No delay"
        elif feat == "remaining_transit_min":
            desc = f"{int(val)} min remaining"
        elif feat == "route_risk":
            lvl = "Low" if val < 0.35 else "Medium" if val < 0.65 else "High"
            desc = f"Route risk: {lvl} ({val:.2f})"
        elif feat == "traffic_level":
            lvl = {1: "Low", 2: "Medium", 3: "High"}.get(int(val), "Medium")
            desc = f"Traffic: {lvl}"
        elif feat == "handling_events":
            desc = f"{int(val)} handling event(s)" if val > 0 else "No handling issues"
        elif feat == "humidity":
            desc = f"{val:.0f}% relative humidity"
        else:
            desc = f"{val:.2f} {unit}".strip()

        results.append(RiskFactor(name=label, impact=round(raw_imp, 2), description=desc))
    return results


def build_recommendation(risk_score: int, features: Dict) -> str:
    exc_mag = features.get("_excursion_mag", 0)
    delay = features.get("delay_minutes", 0)
    refrig = features.get("_refrig_val", 1)
    traffic = features.get("_traffic_val", 2)

    if risk_score >= 80:
        if refrig >= 2:
            return "CRITICAL: Refrigeration unit degraded — inspect cooling immediately and consider emergency cargo transfer."
        if exc_mag > 3:
            return "CRITICAL: Significant temperature excursion detected — prioritize delivery and alert receiving facility."
        return "CRITICAL: Multiple risk factors elevated — expedite delivery, increase monitoring frequency, and prepare contingency."
    elif risk_score >= 60:
        if delay > 45:
            return "HIGH: Extended delay increasing spoilage risk — reduce waiting time and prioritize route clearance."
        if exc_mag > 1:
            return "HIGH: Temperature excursion in progress — restore cooling to safe range and reduce transit time."
        return "HIGH: Multiple factors elevating risk — inspect cargo conditions and consider alternative route."
    elif risk_score >= 30:
        if exc_mag > 0.5:
            return "MODERATE: Minor temperature excursion detected — monitor closely and be prepared to escalate."
        return "MODERATE: Conditions require monitoring — check delay status and ensure refrigeration is functioning correctly."
    else:
        return "LOW: Shipment conditions within acceptable parameters — continue standard monitoring."


def run_prediction(req: ShipmentFeatures) -> PredictionResponse:
    if _pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run ml/train.py to generate model.pkl."
        )

    features = compute_derived_features(req)
    feature_vector = np.array([[features[f] for f in FEATURE_NAMES]])

    prob = _pipeline.predict_proba(feature_vector)[0][1]
    risk_score = int(round(prob * 100))
    band = risk_band(risk_score)

    importances = _metadata.get("feature_importance", [])
    risk_factors = build_risk_factors(features, importances)
    recommendation = build_recommendation(risk_score, features)
    safe_window = compute_safe_window(
        risk_score, req.delay_minutes, req.remaining_transit_min
    )

    return PredictionResponse(
        shipment_id=req.shipment_id,
        risk_score=risk_score,
        risk_band=band,
        safe_window_minutes=safe_window,
        risk_factors=risk_factors,
        recommendation=recommendation,
        model_version=_metadata.get("model_version", "1.0-prototype"),
        timestamp=datetime.utcnow().isoformat() + "Z",
        disclaimer="Prototype model — not production validated.",
    )


# ── Routes ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": _pipeline is not None,
        "model_version": _metadata.get("model_version", "unknown"),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "disclaimer": "Prototype model — not production validated.",
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(req: ShipmentFeatures):
    """
    Predict spoilage risk for a cold-chain shipment.
    Returns risk_score (0–100), risk_band, safe_window_minutes, and explanation.
    """
    try:
        return run_prediction(req)
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/simulate", response_model=SimulationResponse)
def simulate(req: SimulationRequest):
    """
    Compare original vs. simulated (post-intervention) prediction.
    Both use the actual trained model — no fixed calculations.
    """
    try:
        original_result = run_prediction(req.original)
        simulated_result = run_prediction(req.intervention)

        risk_change = simulated_result.risk_score - original_result.risk_score
        sw_change = simulated_result.safe_window_minutes - original_result.safe_window_minutes

        if risk_change < -20:
            summary = f"Intervention significantly reduces risk by {abs(risk_change)} points and extends safe window by {sw_change} minutes."
        elif risk_change < 0:
            summary = f"Intervention modestly reduces risk by {abs(risk_change)} points."
        elif risk_change == 0:
            summary = "Intervention shows minimal impact on predicted risk."
        else:
            summary = f"Intervention increases risk by {risk_change} points — consider alternative action."

        return SimulationResponse(
            original=original_result,
            simulated=simulated_result,
            risk_change=risk_change,
            safe_window_change=sw_change,
            recommendation_summary=summary,
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metadata")
def get_metadata():
    """Returns full model metadata for the /model transparency page."""
    return _metadata


@app.get("/metrics")
def get_metrics():
    """Returns demo model evaluation metrics."""
    return _metrics


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
