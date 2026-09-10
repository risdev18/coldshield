// ============================================================
// ChillShield AI — Demo Shipment Seed Data (25 shipments)
// ALL VALUES ARE DEMO DATA — not real GPS tracking
// ============================================================

import type { Shipment, TempReading } from "@/lib/types";
import { getCargoSafeRange, getCargoValue, interpolatePosition } from "@/lib/utils";

const NOW = new Date();

function minsFromNow(minutes: number): string {
  return new Date(NOW.getTime() + minutes * 60000).toISOString();
}

function minsAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60000).toISOString();
}

/** Generate temperature history for a shipment */
function genTempHistory(
  baseTemp: number,
  safeMax: number,
  excursionAt: number | null,  // minute offset when excursion started
  count = 24
): TempReading[] {
  const readings: TempReading[] = [];
  for (let i = count; i >= 0; i--) {
    const minOffset = i * 5;
    let temp = baseTemp;
    if (excursionAt !== null && minOffset > excursionAt) {
      temp = baseTemp + (minOffset - excursionAt) * 0.08;
    }
    temp += (Math.random() - 0.5) * 0.4;
    const humidity = 65 + (Math.random() - 0.5) * 10;
    const excursion = Math.max(0, temp - safeMax);
    const riskBase = Math.min(100, excursion * 18 + (minOffset > (excursionAt ?? 9999) ? minOffset * 0.2 : 0));
    readings.push({
      timestamp: minsAgo(minOffset),
      temperature: parseFloat(temp.toFixed(2)),
      humidity: parseFloat(humidity.toFixed(1)),
      risk_score: Math.min(100, Math.round(riskBase + Math.random() * 5)),
    });
  }
  return readings.reverse();
}

// ── Route coordinates ───────────────────────────────────────────────────────
export const ROUTES = {
  mumbai_pune: {
    origin: "Mumbai", destination: "Pune",
    oc: { lat: 19.076, lng: 72.877 }, dc: { lat: 18.52, lng: 73.856 }, dist: 148,
  },
  mumbai_nashik: {
    origin: "Mumbai", destination: "Nashik",
    oc: { lat: 19.076, lng: 72.877 }, dc: { lat: 19.997, lng: 73.79 }, dist: 167,
  },
  delhi_jaipur: {
    origin: "Delhi", destination: "Jaipur",
    oc: { lat: 28.631, lng: 77.219 }, dc: { lat: 26.912, lng: 75.787 }, dist: 281,
  },
  bengaluru_chennai: {
    origin: "Bengaluru", destination: "Chennai",
    oc: { lat: 12.972, lng: 77.594 }, dc: { lat: 13.083, lng: 80.27 }, dist: 346,
  },
  hyderabad_bengaluru: {
    origin: "Hyderabad", destination: "Bengaluru",
    oc: { lat: 17.385, lng: 78.487 }, dc: { lat: 12.972, lng: 77.594 }, dist: 569,
  },
  ahmedabad_mumbai: {
    origin: "Ahmedabad", destination: "Mumbai",
    oc: { lat: 23.023, lng: 72.572 }, dc: { lat: 19.076, lng: 72.877 }, dist: 524,
  },
};

export function buildShipment(
  id: string,
  route: typeof ROUTES[keyof typeof ROUTES],
  cargo: Shipment["cargoType"],
  cargoName: string,
  progress: number, // 0–1 how far along route
  temp: number,
  humidity: number,
  delay: number,
  remaining: number,
  routeRisk: number,
  traffic: Shipment["trafficLevel"],
  handling: number,
  refrig: Shipment["refrigerationCondition"],
  status: Shipment["status"],
  vehicle: string
): Shipment {
  const { min: safeMin, max: safeMax } = getCargoSafeRange(cargo);
  const excursionAt = temp > safeMax ? 60 : null;
  return {
    id,
    cargoType: cargo,
    cargoName,
    origin: route.origin,
    destination: route.destination,
    originCoords: route.oc,
    destinationCoords: route.dc,
    currentPosition: interpolatePosition(route.oc, route.dc, progress),
    vehicleId: vehicle,
    driverId: `DRV-${id.split("-")[1]}`,
    status,
    distanceKm: route.dist,
    temperature: temp,
    humidity,
    delayMinutes: delay,
    remainingTransitMin: remaining,
    routeRisk,
    trafficLevel: traffic,
    handlingEvents: handling,
    refrigerationCondition: refrig,
    excursionDurationMin: Math.max(0, excursionAt ? (remaining * 0.3) : 0),
    eta: minsFromNow(remaining + delay),
    prediction: undefined,
    tempHistory: genTempHistory(temp, safeMax, excursionAt),
    interventionHistory: [],
    safeRangeMin: safeMin,
    safeRangeMax: safeMax,
    estimatedValue: getCargoValue(cargo),
    createdAt: minsAgo(route.dist / 2),
    updatedAt: minsAgo(2),
  };
}

export const SEED_SHIPMENTS: Shipment[] = [
  // ── CG-8821 — PRIMARY DEMO SHIPMENT ─────────────────────────
  {
    id: "CG-8821",
    cargoType: "biologics",
    cargoName: "Biologics — Insulin",
    origin: "Mumbai",
    destination: "Pune",
    originCoords: { lat: 19.076, lng: 72.877 },
    destinationCoords: { lat: 18.52, lng: 73.856 },
    currentPosition: { lat: 18.9, lng: 73.2 },
    vehicleId: "MH-01-TF-4421",
    driverId: "DRV-8821",
    status: "CRITICAL",
    distanceKm: 148,
    temperature: 10.8,
    humidity: 78,
    delayMinutes: 24,
    remainingTransitMin: 42,
    routeRisk: 0.72,
    trafficLevel: "high",
    handlingEvents: 2,
    refrigerationCondition: "degraded",
    excursionDurationMin: 38,
    eta: minsFromNow(66),
    prediction: undefined,
    tempHistory: genTempHistory(10.8, 8, 90),
    interventionHistory: [
      {
        id: "INT-001",
        shipmentId: "CG-8821",
        timestamp: minsAgo(45),
        type: "alert_generated",
        description: "Temperature excursion detected — alert auto-generated",
        riskBefore: 55,
        riskAfter: 55,
        safeWindowBefore: 70,
        safeWindowAfter: 70,
        appliedBy: "System",
      },
    ],
    safeRangeMin: 2,
    safeRangeMax: 8,
    estimatedValue: 250000,
    createdAt: minsAgo(120),
    updatedAt: minsAgo(3),
  },

  // ── Remaining 24 shipments ────────────────────────────────────
  buildShipment("CG-4412", ROUTES.mumbai_nashik, "vaccines", "Vaccines — BCG Batch", 0.35, 6.2, 62, 0, 85, 0.45, "medium", 0, "good", "ON_TIME", "MH-04-VX-9912"),
  buildShipment("CG-7750", ROUTES.delhi_jaipur, "dairy", "Dairy — Pasteurised Milk", 0.6, 5.1, 72, 15, 55, 0.38, "medium", 1, "good", "DELAYED", "DL-05-CX-1123"),
  buildShipment("CG-3301", ROUTES.bengaluru_chennai, "fresh_produce", "Fresh Produce — Tomatoes", 0.5, 8.7, 68, 30, 110, 0.55, "high", 1, "good", "AT_RISK", "KA-03-FP-2281"),
  buildShipment("CG-9102", ROUTES.hyderabad_bengaluru, "frozen_food", "Frozen Food — Paneer", 0.25, -17.2, 55, 10, 200, 0.3, "low", 0, "good", "ON_TIME", "TS-02-FF-6612"),
  buildShipment("CG-6540", ROUTES.ahmedabad_mumbai, "biologics", "Biologics — Blood Plasma", 0.7, 9.4, 74, 40, 45, 0.65, "high", 2, "degraded", "AT_RISK", "GJ-08-BL-3398"),
  buildShipment("CG-2210", ROUTES.mumbai_pune, "vaccines", "Vaccines — COVID Booster", 0.15, 3.8, 58, 0, 110, 0.2, "low", 0, "good", "ON_TIME", "MH-07-VC-5544"),
  buildShipment("CG-8890", ROUTES.delhi_jaipur, "fresh_produce", "Fresh Produce — Leafy Greens", 0.8, 12.3, 82, 60, 30, 0.75, "high", 3, "degraded", "CRITICAL", "DL-12-FP-8821"),
  buildShipment("CG-1155", ROUTES.bengaluru_chennai, "dairy", "Dairy — Paneer", 0.4, 3.5, 70, 0, 130, 0.28, "low", 0, "good", "ON_TIME", "KA-06-DA-4417"),
  buildShipment("CG-5503", ROUTES.hyderabad_bengaluru, "biologics", "Biologics — Antibiotics", 0.55, 7.8, 73, 20, 145, 0.52, "medium", 1, "good", "AT_RISK", "TS-09-BL-9921"),
  buildShipment("CG-7720", ROUTES.ahmedabad_mumbai, "frozen_food", "Frozen Food — Ice Cream", 0.3, -18.5, 52, 5, 240, 0.22, "low", 0, "good", "ON_TIME", "GJ-03-FF-1198"),
  buildShipment("CG-4490", ROUTES.mumbai_nashik, "fresh_produce", "Fresh Produce — Strawberries", 0.65, 11.5, 80, 45, 60, 0.68, "high", 2, "degraded", "CRITICAL", "MH-11-FP-6634"),
  buildShipment("CG-3355", ROUTES.delhi_jaipur, "vaccines", "Vaccines — Rabies", 0.45, 5.6, 65, 10, 90, 0.4, "medium", 0, "good", "ON_TIME", "DL-04-VC-2277"),
  buildShipment("CG-9870", ROUTES.bengaluru_chennai, "dairy", "Dairy — Cheese", 0.7, 6.1, 69, 25, 75, 0.48, "medium", 1, "good", "AT_RISK", "KA-08-DA-5512"),
  buildShipment("CG-2244", ROUTES.mumbai_pune, "frozen_food", "Frozen Food — Prawns", 0.5, -16.8, 54, 0, 65, 0.32, "low", 0, "good", "ON_TIME", "MH-02-FF-8812"),
  buildShipment("CG-6612", ROUTES.hyderabad_bengaluru, "biologics", "Biologics — Dialysis Supplies", 0.4, 8.2, 76, 35, 180, 0.6, "high", 2, "degraded", "AT_RISK", "TS-07-BL-4427"),
  buildShipment("CG-1190", ROUTES.ahmedabad_mumbai, "vaccines", "Vaccines — Hepatitis B", 0.2, 4.4, 61, 0, 280, 0.25, "low", 0, "good", "ON_TIME", "GJ-05-VC-7734"),
  buildShipment("CG-8800", ROUTES.mumbai_nashik, "dairy", "Dairy — Curd", 0.75, 7.2, 77, 20, 35, 0.58, "high", 1, "good", "AT_RISK", "MH-09-DA-3312"),
  buildShipment("CG-5544", ROUTES.delhi_jaipur, "fresh_produce", "Fresh Produce — Grapes", 0.55, 10.1, 79, 30, 95, 0.52, "medium", 1, "good", "AT_RISK", "DL-06-FP-4456"),
  buildShipment("CG-3388", ROUTES.bengaluru_chennai, "frozen_food", "Frozen Food — Fish Fillets", 0.35, -14.5, 57, 0, 165, 0.35, "low", 0, "good", "ON_TIME", "KA-01-FF-6623"),
  buildShipment("CG-7788", ROUTES.mumbai_pune, "biologics", "Biologics — Chemotherapy", 0.6, 6.9, 71, 15, 55, 0.48, "medium", 0, "good", "ON_TIME", "MH-06-BL-9934"),
  buildShipment("CG-4466", ROUTES.hyderabad_bengaluru, "fresh_produce", "Fresh Produce — Mangoes", 0.45, 9.8, 75, 45, 195, 0.55, "medium", 2, "good", "AT_RISK", "TS-04-FP-2241"),
  buildShipment("CG-2200", ROUTES.ahmedabad_mumbai, "vaccines", "Vaccines — Typhoid", 0.65, 7.1, 64, 10, 95, 0.38, "medium", 0, "good", "ON_TIME", "GJ-06-VC-5578"),
  buildShipment("CG-9944", ROUTES.delhi_jaipur, "dairy", "Dairy — Buttermilk", 0.8, 4.8, 73, 0, 40, 0.3, "low", 0, "good", "ON_TIME", "DL-09-DA-1189"),
  buildShipment("CG-6688", ROUTES.mumbai_nashik, "frozen_food", "Frozen Food — Beef Patties", 0.4, -13.2, 60, 20, 110, 0.42, "medium", 1, "good", "DELAYED", "MH-10-FF-4451"),
];

export default SEED_SHIPMENTS;
