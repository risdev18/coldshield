// ============================================================
// ChillShield AI — Core Type Definitions
// ============================================================

export type RiskBand = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type ShipmentStatus = "ON_TIME" | "DELAYED" | "AT_RISK" | "CRITICAL" | "DELIVERED";
export type CargoType = "biologics" | "vaccines" | "dairy" | "fresh_produce" | "frozen_food";
export type TrafficLevel = "low" | "medium" | "high";
export type RefrigerationCondition = "good" | "degraded" | "failed";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved";

// ── Feature vector sent to prediction API ─────────────────────────────────
export interface ModelFeatures {
  W60_T_mean: number;
  W60_T_std: number;
  W60_T_range: number;
  W60_delta: number;
  W60_slope: number;
  W60_hot_ratio_mean: number;
  W60_over_auc_mean: number;
  W60_over_dur_mean: number;
  W60_spatial_range_mean: number;
  W60_spatial_std_mean: number;
  W60_active_ratio_mean: number;
}

export interface PredictRequest {
  shipment_id: string;
  features: ModelFeatures;
}

// ── API prediction response ────────────────────────────────────────────────
export interface RiskFactor {
  feature: string;
  importance: number;
  description: string;
}

export interface PredictionResult {
  shipment_id: string;
  risk_score: number;
  risk_band: RiskBand;
  safe_window_minutes: number;
  risk_factors: RiskFactor[];
  recommendation: string;
  model_version: string;
  timestamp: string;
  disclaimer: string;
}

// ── Simulation response ────────────────────────────────────────────────────
export interface SimulationResult {
  original: PredictionResult;
  simulated: PredictionResult;
  risk_change: number;
  safe_window_change: number;
  recommendation_summary: string;
}

// ── Intervention scenario ──────────────────────────────────────────────────
export interface InterventionScenario {
  id: string;
  label: string;
  description: string;
  modifiedFeatures: Partial<any>; // Operational features to modify, will map to ModelFeatures
  result?: PredictionResult;
  isLoading?: boolean;
}

// ── Intervention history entry ─────────────────────────────────────────────
export interface InterventionEntry {
  id: string;
  shipmentId: string;
  timestamp: string;
  type: string;
  description: string;
  riskBefore: number;
  riskAfter: number;
  safeWindowBefore: number;
  safeWindowAfter: number;
  appliedBy: string;
}

// ── Alert ─────────────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  shipmentId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  predictedOutcome: string;
  recommendation: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

// ── Notification ───────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  type: "risk_increase" | "alert_created" | "intervention_applied" | "temperature_excursion" | "delay_detected";
  title: string;
  message: string;
  shipmentId?: string;
  timestamp: string;
  read: boolean;
}

// ── Operator note ──────────────────────────────────────────────────────────
export interface OperatorNote {
  id: string;
  shipmentId: string;
  text: string;
  authorName: string;
  createdAt: string;
}

// ── Geo coordinates ────────────────────────────────────────────────────────
export interface LatLng {
  lat: number;
  lng: number;
}

// ── Route ─────────────────────────────────────────────────────────────────
export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  originCoords: LatLng;
  destinationCoords: LatLng;
  distanceKm: number;
  baseRouteRisk: number;
}

// ── Temperature reading ────────────────────────────────────────────────────
export interface TempReading {
  timestamp: string;
  temperature: number;
  humidity: number;
  risk_score: number;
}

// ── Shipment ───────────────────────────────────────────────────────────────
export interface Shipment {
  id: string;
  cargoType: CargoType;
  cargoName: string;
  origin: string;
  destination: string;
  originCoords: LatLng;
  destinationCoords: LatLng;
  currentPosition: LatLng;
  vehicleId: string;
  driverId: string;
  status: ShipmentStatus;
  distanceKm: number;

  // Live features
  temperature: number;
  humidity: number;
  delayMinutes: number;
  remainingTransitMin: number;
  routeRisk: number;
  trafficLevel: TrafficLevel;
  handlingEvents: number;
  refrigerationCondition: RefrigerationCondition;
  excursionDurationMin: number;

  // ETA
  eta: string; // ISO string

  // Prediction (from model)
  prediction?: PredictionResult;

  // History
  tempHistory: TempReading[];
  interventionHistory: InterventionEntry[];

  // Cargo profile
  safeRangeMin: number;
  safeRangeMax: number;
  estimatedValue: number; // INR

  createdAt: string;
  updatedAt: string;
}

// ── Dashboard metrics ──────────────────────────────────────────────────────
export interface DashboardMetrics {
  activeShipments: number;
  atRisk: number;
  critical: number;
  avgNetworkRisk: number;
  potentialLossPrevented: number;
  temperatureExcursions: number;
  interventionsToday: number;
  avgResponseTimeMin: number;
}

// ── Simulation state ───────────────────────────────────────────────────────
export interface SimulationState {
  shipmentId: string | null;
  scenarios: InterventionScenario[];
  selectedScenarioId: string | null;
  isRunning: boolean;
  lastResult: SimulationResult | null;
}

// ── Demo mode ─────────────────────────────────────────────────────────────
export type DemoSpeed = 1 | 2 | 5;

export interface DemoModeState {
  enabled: boolean;
  running: boolean;
  speed: DemoSpeed;
  tickCount: number;
}

// ── App state ─────────────────────────────────────────────────────────────
export interface AppState {
  shipments: Shipment[];
  alerts: Alert[];
  notifications: Notification[];
  operatorNotes: OperatorNote[];
  selectedShipmentId: string | null;
  simulation: SimulationState;
  demoMode: DemoModeState;
  dashboardMetrics: DashboardMetrics;
  backendAvailable: boolean;

  // Actions
  updateShipment: (id: string, updates: Partial<Shipment>) => void;
  addShipment: (shipment: Shipment) => void;
  setSelectedShipment: (id: string | null) => void;
  setPrediction: (shipmentId: string, prediction: PredictionResult) => void;
  createAlert: (alert: Omit<Alert, "id" | "createdAt">) => void;
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  addNotification: (n: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markNotificationsRead: () => void;
  addNote: (note: Omit<OperatorNote, "id" | "createdAt">) => void;
  applyIntervention: (shipmentId: string, entry: Omit<InterventionEntry, "id">, newFeatures: Partial<Shipment>) => void;
  setSimulationState: (s: Partial<SimulationState>) => void;
  setDemoMode: (d: Partial<DemoModeState>) => void;
  recomputeMetrics: () => void;
  setBackendAvailable: (v: boolean) => void;
}

// ── Model metadata ─────────────────────────────────────────────────────────
export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface ModelMetadata {
  model_name: string;
  model_version: string;
  model_type: string;
  data_type: string;
  disclaimer: string;
  training_timestamp: string;
  training_samples: number;
  test_samples: number;
  total_samples: number;
  spoilage_rate: number;
  feature_names: string[];
  feature_count: number;
  feature_importance: FeatureImportance[];
  hyperparameters: Record<string, number>;
  risk_thresholds: Record<string, { min: number; max: number }>;
  evaluation_metrics: ModelMetrics;
  preprocessing: string;
  cargo_types: Record<string, string>;
  safe_temperature_ranges: Record<string, { min: number; max: number }>;
}

export interface ModelMetrics {
  disclaimer: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
  cv_roc_auc_mean: number;
  cv_roc_auc_std: number;
  test_samples: number;
  train_samples: number;
}
