// ============================================================
// ChillShield AI — Model Service
// Calls FastAPI backend for predictions. Falls back with clear
// error state if backend is unavailable.
// ============================================================

import type {
  ModelFeatures,
  PredictRequest,
  PredictionResult,
  SimulationResult,
  ModelMetadata,
  ModelMetrics,
} from "@/lib/types";
import { getRiskBand } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Health check ───────────────────────────────────────────────────────────
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Predict risk ───────────────────────────────────────────────────────────
export async function predictRisk(request: PredictRequest): Promise<PredictionResult> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Prediction failed" }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

// ── Simulate intervention ──────────────────────────────────────────────────
export async function simulateIntervention(
  original: PredictRequest,
  intervention: PredictRequest
): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ original, intervention }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Simulation failed" }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

// ── Fetch model metadata ───────────────────────────────────────────────────
export async function fetchModelMetadata(): Promise<any> {
  const res = await fetch(`${API_BASE}/metadata`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("Failed to fetch model metadata");
  return res.json();
}

// ── Convert Shipment to ML Model Features ──────────────────────────────────
export function shipmentToFeatures(shipment: any): PredictRequest {
  const currentTemp = shipment.temperature;
  const safeMax = shipment.safeRangeMax;
  
  // ========================================================================
  // MODEL-DATA TRANSPARENCY & INTEGRITY CHECK
  // 
  // During this prototype, certain model features are derived from available
  // shipment telemetry or simulated operational inputs because the
  // demonstration interface does not have a live multi-sensor telemetry feed.
  // 
  // MAPPING:
  // A. REAL values (available from UI state):
  //    - W60_T_mean -> directly mapped to `shipment.temperature`
  //    - W60_active_ratio_mean -> mapped from `shipment.refrigerationCondition`
  // B. DERIVED values (calculated from UI state):
  //    - W60_hot_ratio_mean -> derived from current temp vs safeMax
  //    - W60_over_auc_mean -> derived from magnitude of excursion * duration
  //    - W60_over_dur_mean -> mapped from `shipment.excursionDurationMin`
  //    - W60_delta & W60_slope -> derived from delay status (assuming delayed shipments drift more)
  // C. SIMULATED PROTOTYPE values (synthetic constants to satisfy model shape):
  //    - W60_T_std, W60_T_range, W60_spatial_range_mean, W60_spatial_std_mean
  // ========================================================================

  // A. Real values
  const W60_T_mean = currentTemp; 
  const W60_active_ratio_mean = shipment.refrigerationCondition === "failed" ? 0.0 : (shipment.refrigerationCondition === "degraded" ? 0.5 : 1.0);

  // B. Derived values
  const W60_hot_ratio_mean = currentTemp > safeMax ? 0.8 : 0.0;
  const W60_over_dur_mean = shipment.excursionDurationMin || (currentTemp > safeMax ? 15 : 0);
  const W60_over_auc_mean = currentTemp > safeMax ? (currentTemp - safeMax) * W60_over_dur_mean : 0;
  
  // Assume a slight temperature rise if delayed
  const W60_delta = shipment.delayMinutes > 0 ? 0.8 : 0.1;
  const W60_slope = W60_delta / 60.0;

  // C. Simulated Prototype values (required spatial/variance features the UI doesn't track)
  //
  // "These spatial/dispersion inputs are prototype-derived placeholders
  // because the current demo does not ingest a live multi-sensor feed.
  // They are not claimed to represent physical sensor measurements."
  const W60_T_std = 0.5;
  const W60_T_range = 1.2;
  const W60_spatial_range_mean = 1.5;
  const W60_spatial_std_mean = 0.4;

  return {
    shipment_id: shipment.id,
    features: {
      W60_T_mean,
      W60_T_std,
      W60_T_range,
      W60_delta,
      W60_slope,
      W60_hot_ratio_mean,
      W60_over_auc_mean,
      W60_over_dur_mean,
      W60_spatial_range_mean,
      W60_spatial_std_mean,
      W60_active_ratio_mean
    }
  };
}

// ── Risk band from score ───────────────────────────────────────────────────
export { getRiskBand };
