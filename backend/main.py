from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import json
import pandas as pd
import numpy as np
import os

app = FastAPI(title="ChillShield API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
model = None
metadata = None
feature_names = []

@app.on_event("startup")
async def load_model():
    global model, metadata, feature_names
    
    # Path relative to backend directory
    model_path = os.path.join("..", "ml", "model.pkl")
    metadata_path = os.path.join("..", "ml", "model_metadata.json")
    
    try:
        model = joblib.load(model_path)
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        feature_names = metadata.get("feature_names", [])
        print(f"Loaded model successfully. Features: {len(feature_names)}")
    except Exception as e:
        print(f"Error loading model: {e}")

class Features(BaseModel):
    W60_T_mean: float
    W60_T_std: float
    W60_T_range: float
    W60_delta: float
    W60_slope: float
    W60_hot_ratio_mean: float
    W60_over_auc_mean: float
    W60_over_dur_mean: float
    W60_spatial_range_mean: float
    W60_spatial_std_mean: float
    W60_active_ratio_mean: float

class PredictRequest(BaseModel):
    shipment_id: str
    features: Features

class PredictResponse(BaseModel):
    shipment_id: str
    risk_score: float
    risk_band: str
    risk_factors: list
    safe_window_minutes: int | None = None
    recommendation: str
    model_version: str

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "model_version": "1.0-prototype"
    }

@app.get("/metadata")
async def get_metadata():
    if metadata is None:
        raise HTTPException(status_code=503, detail="Metadata is not loaded")
    return metadata

def get_risk_band(score: float) -> str:
    if score < 30:
        return "LOW"
    elif score < 60:
        return "MODERATE"
    elif score < 80:
        return "HIGH"
    else:
        return "CRITICAL"

def get_recommendation(risk_band: str) -> str:
    if risk_band == "LOW":
        return "Continue standard monitoring. Conditions are stable."
    elif risk_band == "MODERATE":
        return "Monitor closely. Review temperature logs for potential upcoming deviations."
    elif risk_band == "HIGH":
        return "Warning: High risk of entering severe-risk state. Expedite delivery if possible or inspect cooling equipment."
    else:
        return "CRITICAL: Immediate action required. Inspect shipment and cooling unit immediately."

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")
    
    # Create DataFrame from features
    feature_dict = request.features.model_dump()
    df = pd.DataFrame([feature_dict])
    
    # Ensure column order matches training
    if feature_names:
        for f in feature_names:
            if f not in df.columns:
                raise HTTPException(status_code=400, detail=f"Missing feature: {f}")
        df = df[feature_names]
    
    # Predict probability
    try:
        # Prob of class 1
        proba = model.predict_proba(df)[0][1]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {e}")
        
    risk_score = round(proba * 100, 2)
    risk_band = get_risk_band(risk_score)
    recommendation = get_recommendation(risk_band)
    
    # Extract feature importance (global)
    risk_factors = []
    try:
        classifier = model.named_steps['classifier']
        importances = classifier.feature_importances_
        # Get top 3
        top_indices = np.argsort(importances)[::-1][:3]
        for idx in top_indices:
            feat_name = feature_names[idx]
            imp_val = round(float(importances[idx]), 4)
            risk_factors.append({
                "feature": feat_name,
                "importance": imp_val,
                "description": "Prototype model explanation"
            })
    except:
        pass
        
    safe_window = 120 - int(risk_score)
    if safe_window < 0:
        safe_window = 0
        
    return PredictResponse(
        shipment_id=request.shipment_id,
        risk_score=risk_score,
        risk_band=risk_band,
        risk_factors=risk_factors,
        safe_window_minutes=safe_window,
        recommendation=recommendation,
        model_version="1.0-prototype"
    )

class SimulateRequest(BaseModel):
    original: PredictRequest
    intervention: PredictRequest

class SimulationResult(BaseModel):
    original: PredictResponse
    simulated: PredictResponse
    risk_change: float
    safe_window_change: int
    recommendation_summary: str

@app.post("/simulate", response_model=SimulationResult)
async def simulate(request: SimulateRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")
    
    # We can reuse the predict function logic by calling it directly
    # But since it's an async route, we can await it
    orig_res = await predict(request.original)
    sim_res = await predict(request.intervention)
    
    risk_change = round(sim_res.risk_score - orig_res.risk_score, 2)
    # Fake safe window computation for now since we don't have it
    orig_sw = 120 - int(orig_res.risk_score)
    sim_sw = 120 - int(sim_res.risk_score)
    
    orig_res.safe_window_minutes = orig_sw
    sim_res.safe_window_minutes = sim_sw
    
    sw_change = sim_sw - orig_sw
    
    if risk_change < 0:
        rec_sum = "Intervention reduces risk."
    elif risk_change == 0:
        rec_sum = "Intervention has no effect."
    else:
        rec_sum = "Intervention increases risk."
        
    return SimulationResult(
        original=orig_res,
        simulated=sim_res,
        risk_change=risk_change,
        safe_window_change=sw_change,
        recommendation_summary=rec_sum
    )
