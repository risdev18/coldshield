// ============================================================
// ChillShield AI — Zustand Central Application State
// Single source of truth. All views read from and write to here.
// ============================================================

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  AppState,
  Shipment,
  Alert,
  Notification,
  OperatorNote,
  PredictionResult,
  InterventionEntry,
  DashboardMetrics,
  SimulationState,
  DemoModeState,
} from "@/lib/types";
import { getRiskBand } from "@/lib/utils";
import SEED_SHIPMENTS from "@/data/shipments";

// ── Compute dashboard metrics from current shipment state ──────────────────
function computeMetrics(shipments: Shipment[]): DashboardMetrics {
  const active = shipments.filter((s) => s.status !== "DELIVERED");
  const risks = active
    .map((s) => s.prediction?.risk_score ?? 0)
    .filter((r) => r > 0);
  const avgRisk = risks.length > 0 ? Math.round(risks.reduce((a, b) => a + b, 0) / risks.length) : 23;

  const atRisk = active.filter((s) => {
    const band = s.prediction?.risk_band;
    return band === "HIGH" || band === "CRITICAL";
  }).length;

  const critical = active.filter((s) => s.prediction?.risk_band === "CRITICAL").length;

  // Illustrative loss prevention calculation — clearly labeled as demo assumption
  const prevented = active
    .filter((s) => s.interventionHistory.length > 0)
    .reduce((acc, s) => {
      const last = s.interventionHistory[s.interventionHistory.length - 1];
      const improvement = last ? Math.max(0, last.riskBefore - last.riskAfter) : 0;
      return acc + s.estimatedValue * (improvement / 100) * 0.4;
    }, 0);

  return {
    activeShipments: active.length,
    atRisk,
    critical,
    avgNetworkRisk: avgRisk,
    potentialLossPrevented: Math.round(prevented),
    temperatureExcursions: active.filter((s) => s.excursionDurationMin > 0).length,
    interventionsToday: active.reduce((a, s) => a + s.interventionHistory.length, 0),
    avgResponseTimeMin: 12,
  };
}

// ── Alert deduplication ────────────────────────────────────────────────────
function shouldCreateAlert(alerts: Alert[], shipmentId: string): boolean {
  const recent = alerts.find(
    (a) => a.shipmentId === shipmentId && a.status === "active" && a.severity === "critical"
  );
  return !recent;
}

// ── Main store ─────────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    shipments: SEED_SHIPMENTS,
    alerts: [
      {
        id: "AL-001",
        shipmentId: "CG-8821",
        severity: "critical",
        status: "active",
        title: "Critical Temperature Excursion",
        message: "CG-8821 (Biologics) has exceeded safe temperature range. Current: 10.8°C, Safe max: 8°C",
        predictedOutcome: "If no intervention, cargo may be compromised within 38 minutes.",
        recommendation: "Inspect cooling unit and expedite delivery to destination.",
        createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
      },
      {
        id: "AL-002",
        shipmentId: "CG-8890",
        severity: "critical",
        status: "active",
        title: "Multiple Risk Factors Detected",
        message: "CG-8890 (Fresh Produce) shows high delay, degraded refrigeration, and rising temperature.",
        predictedOutcome: "Risk trajectory increasing rapidly. Safe window under 30 minutes.",
        recommendation: "Reroute through alternative highway to reduce ETA.",
        createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
      },
      {
        id: "AL-003",
        shipmentId: "CG-4490",
        severity: "critical",
        status: "acknowledged",
        title: "Temperature Rising — Strawberries",
        message: "CG-4490 temperature at 11.5°C, exceeding safe range of 0–10°C.",
        predictedOutcome: "Quality degradation expected if delay continues.",
        recommendation: "Confirm refrigeration unit is functioning correctly.",
        createdAt: new Date(Date.now() - 75 * 60000).toISOString(),
        acknowledgedAt: new Date(Date.now() - 60 * 60000).toISOString(),
      },
      {
        id: "AL-004",
        shipmentId: "CG-6540",
        severity: "warning",
        status: "active",
        title: "Delay + Refrigeration Degraded",
        message: "CG-6540 has 40-min delay and degraded refrigeration. Blood plasma requires strict 2–8°C.",
        predictedOutcome: "Risk expected to increase if delay is not resolved.",
        recommendation: "Monitor closely and prepare priority lane clearance.",
        createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
      },
      {
        id: "AL-005",
        shipmentId: "CG-3301",
        severity: "warning",
        status: "active",
        title: "Temperature at Upper Bound",
        message: "CG-3301 temperature 8.7°C approaching safe max of 10°C. High traffic adds risk.",
        predictedOutcome: "Continued traffic delay may push temperature out of range.",
        recommendation: "Redirect to alternate route to reduce ETA by estimated 20 minutes.",
        createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
      },
    ],
    notifications: [
      {
        id: "NOT-001",
        type: "alert_created",
        title: "🔴 Critical Alert — CG-8821",
        message: "Temperature excursion detected on Biologics shipment. Immediate action required.",
        shipmentId: "CG-8821",
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        read: false,
      },
      {
        id: "NOT-002",
        type: "risk_increase",
        title: "⚠ Risk Increasing — CG-8890",
        message: "Risk for CG-8890 has increased to CRITICAL level.",
        shipmentId: "CG-8890",
        timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
        read: false,
      },
      {
        id: "NOT-003",
        type: "temperature_excursion",
        title: "Temperature Alert — CG-4490",
        message: "CG-4490 Strawberries temperature exceeded safe range.",
        shipmentId: "CG-4490",
        timestamp: new Date(Date.now() - 75 * 60000).toISOString(),
        read: true,
      },
    ],
    operatorNotes: [],
    selectedShipmentId: null,
    simulation: {
      shipmentId: null,
      scenarios: [],
      selectedScenarioId: null,
      isRunning: false,
      lastResult: null,
    },
    demoMode: {
      enabled: false,
      running: false,
      speed: 1,
      tickCount: 0,
    },
    dashboardMetrics: computeMetrics(SEED_SHIPMENTS),
    backendAvailable: false,

    // ── Actions ─────────────────────────────────────────────────────────────

    updateShipment: (id, updates) =>
      set((state) => ({
        shipments: state.shipments.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
        ),
      })),

    addShipment: (shipment) => {
      set((state) => ({ shipments: [shipment, ...state.shipments] }));
      get().recomputeMetrics();
    },

    setSelectedShipment: (id) => set({ selectedShipmentId: id }),

    setPrediction: (shipmentId, prediction) => {
      const state = get();
      const shipment = state.shipments.find((s) => s.id === shipmentId);
      if (!shipment) return;

      // Update status based on risk band
      let newStatus = shipment.status;
      if (prediction.risk_band === "CRITICAL") newStatus = "CRITICAL";
      else if (prediction.risk_band === "HIGH") newStatus = "AT_RISK";
      else if (prediction.risk_band === "MODERATE" && newStatus === "CRITICAL") newStatus = "AT_RISK";

      set((state) => ({
        shipments: state.shipments.map((s) =>
          s.id === shipmentId
            ? { ...s, prediction, status: newStatus, updatedAt: new Date().toISOString() }
            : s
        ),
      }));

      // Auto-create alert if CRITICAL and no existing active alert
      if (prediction.risk_band === "CRITICAL" && shouldCreateAlert(get().alerts, shipmentId)) {
        get().createAlert({
          shipmentId,
          severity: "critical",
          status: "active",
          title: `Critical Risk — ${shipmentId}`,
          message: `${shipmentId} risk reached ${prediction.risk_score}% (${prediction.risk_band}). ${prediction.recommendation}`,
          predictedOutcome: `Safe window estimated at ${prediction.safe_window_minutes} minutes under current conditions.`,
          recommendation: prediction.recommendation,
        });

        get().addNotification({
          type: "alert_created",
          title: `🔴 Critical Alert — ${shipmentId}`,
          message: `Risk reached ${prediction.risk_score}%. ${prediction.safe_window_minutes} min safe window.`,
          shipmentId,
        });
      }

      // Recompute dashboard
      get().recomputeMetrics();
    },

    createAlert: (alertData) => {
      const alert: Alert = {
        ...alertData,
        id: `AL-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ alerts: [alert, ...state.alerts] }));
    },

    acknowledgeAlert: (alertId) =>
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === alertId
            ? { ...a, status: "acknowledged" as const, acknowledgedAt: new Date().toISOString() }
            : a
        ),
      })),

    resolveAlert: (alertId) =>
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === alertId
            ? { ...a, status: "resolved" as const, resolvedAt: new Date().toISOString() }
            : a
        ),
      })),

    addNotification: (n) => {
      const notification: Notification = {
        ...n,
        id: `NOT-${Date.now()}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      set((state) => ({
        notifications: [notification, ...state.notifications].slice(0, 50),
      }));
    },

    markNotificationsRead: () =>
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      })),

    addNote: (note) => {
      const newNote: OperatorNote = {
        ...note,
        id: `NOTE-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ operatorNotes: [newNote, ...state.operatorNotes] }));
    },

    applyIntervention: (shipmentId, entry, newFeatures) => {
      const fullEntry: InterventionEntry = {
        ...entry,
        id: `INT-${Date.now()}`,
      };
      set((state) => ({
        shipments: state.shipments.map((s) =>
          s.id === shipmentId
            ? {
                ...s,
                ...newFeatures,
                interventionHistory: [...s.interventionHistory, fullEntry],
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      }));
      get().recomputeMetrics();
    },

    setSimulationState: (s) =>
      set((state) => ({ simulation: { ...state.simulation, ...s } })),

    setDemoMode: (d) =>
      set((state) => ({ demoMode: { ...state.demoMode, ...d } })),

    recomputeMetrics: () => {
      const { shipments } = get();
      set({ dashboardMetrics: computeMetrics(shipments) });
    },

    setBackendAvailable: (v) => set({ backendAvailable: v }),
  }))
);

// ── Selectors (derived) ────────────────────────────────────────────────────
export const selectShipment = (id: string) => (state: AppState) =>
  state.shipments.find((s) => s.id === id);

export const selectActiveAlerts = (state: AppState) =>
  state.alerts.filter((a) => a.status === "active");

export const selectCriticalShipments = (state: AppState) =>
  state.shipments.filter((s) => s.prediction?.risk_band === "CRITICAL" || s.status === "CRITICAL");

export const selectUnreadCount = (state: AppState) =>
  state.notifications.filter((n) => !n.read).length;
