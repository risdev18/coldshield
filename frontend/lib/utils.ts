// ============================================================
// ChillShield AI — Utility Functions
// ============================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RiskBand, CargoType, ShipmentStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Risk helpers
export function getRiskBand(score: number): RiskBand {
  if (score < 30) return "LOW";
  if (score < 60) return "MODERATE";
  if (score < 80) return "HIGH";
  return "CRITICAL";
}

export function getRiskColor(band: RiskBand): string {
  switch (band) {
    case "LOW": return "#639922";
    case "MODERATE": return "#F59E0B";
    case "HIGH": return "#F97316";
    case "CRITICAL": return "#E24B4A";
  }
}

export function getRiskBgColor(band: RiskBand): string {
  switch (band) {
    case "LOW": return "#EEF5E1";
    case "MODERATE": return "#FEF8E7";
    case "HIGH": return "#FFF3E7";
    case "CRITICAL": return "#FDEEEE";
  }
}

export function getRiskTextColor(band: RiskBand): string {
  switch (band) {
    case "LOW": return "#4A7018";
    case "MODERATE": return "#A05C00";
    case "HIGH": return "#C04A00";
    case "CRITICAL": return "#C01A1A";
  }
}

export function getRiskBorderColor(band: RiskBand): string {
  switch (band) {
    case "LOW": return "#C2DB8D";
    case "MODERATE": return "#FBD98A";
    case "HIGH": return "#FFBE8A";
    case "CRITICAL": return "#F5AAAA";
  }
}

export function getRiskIcon(band: RiskBand): string {
  switch (band) {
    case "LOW": return "●";
    case "MODERATE": return "▲";
    case "HIGH": return "⚠";
    case "CRITICAL": return "🔴";
  }
}

// Status helpers
export function getStatusColor(status: ShipmentStatus): string {
  switch (status) {
    case "ON_TIME": return "#639922";
    case "DELAYED": return "#F59E0B";
    case "AT_RISK": return "#F97316";
    case "CRITICAL": return "#E24B4A";
    case "DELIVERED": return "#1D9E75";
  }
}

export function getStatusLabel(status: ShipmentStatus): string {
  switch (status) {
    case "ON_TIME": return "On Time";
    case "DELAYED": return "Delayed";
    case "AT_RISK": return "At Risk";
    case "CRITICAL": return "Critical";
    case "DELIVERED": return "Delivered";
  }
}

// Cargo helpers
export function getCargoLabel(cargoType: CargoType): string {
  const labels: Record<CargoType, string> = {
    biologics: "Biologics",
    vaccines: "Vaccines",
    dairy: "Dairy",
    fresh_produce: "Fresh Produce",
    frozen_food: "Frozen Food",
  };
  return labels[cargoType] || cargoType;
}

export function getCargoSafeRange(cargoType: CargoType): { min: number; max: number } {
  const ranges: Record<CargoType, { min: number; max: number }> = {
    biologics: { min: 2, max: 8 },
    vaccines: { min: 2, max: 8 },
    dairy: { min: 1, max: 4 },
    fresh_produce: { min: 0, max: 10 },
    frozen_food: { min: -20, max: -15 },
  };
  return ranges[cargoType] || { min: 2, max: 8 };
}

export function getCargoValue(cargoType: CargoType): number {
  // Demo assumed values in INR — clearly labeled as illustrative
  const values: Record<CargoType, number> = {
    biologics: 250000,
    vaccines: 300000,
    dairy: 45000,
    fresh_produce: 35000,
    frozen_food: 60000,
  };
  return values[cargoType] || 100000;
}

export function getCargoIcon(cargoType: CargoType): string {
  const icons: Record<CargoType, string> = {
    biologics: "🧬",
    vaccines: "💉",
    dairy: "🥛",
    fresh_produce: "🥦",
    frozen_food: "🧊",
  };
  return icons[cargoType] || "📦";
}

// Number formatting
export function formatRupees(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(0)}K`;
  }
  return `₹${amount.toFixed(0)}`;
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatETA(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin <= 0) return "Due now";
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Temperature zone
export function getTempZone(temp: number, cargoType: CargoType): "safe" | "warning" | "critical" {
  const { min, max } = getCargoSafeRange(cargoType);
  if (temp >= min && temp <= max) return "safe";
  const excursion = temp > max ? temp - max : min - temp;
  return excursion > 2 ? "critical" : "warning";
}

// Unique ID
export function generateId(prefix = "ID"): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// Debounce
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// Interpolate lat/lng along route
export function interpolatePosition(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  progress: number // 0–1
): { lat: number; lng: number } {
  return {
    lat: origin.lat + (destination.lat - origin.lat) * progress,
    lng: origin.lng + (destination.lng - origin.lng) * progress,
  };
}
