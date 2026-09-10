"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Shipment } from "@/lib/types";
import { getRiskBand, getRiskColor } from "@/lib/utils";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

interface Props {
  shipments: Shipment[];
  selectedId?: string;
  height?: number;
}

// Marker colors
function getMarkerColor(shipment: Shipment): string {
  const band = shipment.prediction?.risk_band ?? getRiskBand(
    shipment.status === "CRITICAL" ? 85 : shipment.status === "AT_RISK" ? 65 : 30
  );
  return getRiskColor(band);
}

export default function LiveMap({ shipments, selectedId, height = 380 }: Props) {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);

  useEffect(() => {
    // Only run client-side
    if (typeof window === "undefined" || !mapRef.current) return;

    const L = require("leaflet");

    // Fix default icon path issue in Next.js
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    if (!leafletMapRef.current) {
      // India-centered
      leafletMapRef.current = L.map(mapRef.current, {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(leafletMapRef.current as ReturnType<typeof L.map>);
    }

    const map = leafletMapRef.current as ReturnType<typeof L.map>;

    // Clear old markers
    markersRef.current.forEach((m) => (m as ReturnType<typeof L.marker>).remove());
    markersRef.current = [];

    // Add shipment markers
    shipments
      .filter((s) => s.status !== "DELIVERED")
      .forEach((shipment) => {
        const color = getMarkerColor(shipment);
        const risk = shipment.prediction?.risk_score ??
          (shipment.status === "CRITICAL" ? 85 : shipment.status === "AT_RISK" ? 65 : 35);
        const band = shipment.prediction?.risk_band ??
          getRiskBand(risk);
        const safeWin = shipment.prediction?.safe_window_minutes ?? shipment.remainingTransitMin;

        // Custom SVG marker
        const svgIcon = L.divIcon({
          className: "",
          html: `<div style="
            width:28px;height:28px;border-radius:50%;
            background:${color};
            border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;
            cursor:pointer;
            ${selectedId === shipment.id ? "outline:3px solid " + color + ";outline-offset:2px;" : ""}
          ">
            <span style="color:white;font-size:10px;font-weight:700">${risk}</span>
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker(
          [shipment.currentPosition.lat, shipment.currentPosition.lng],
          { icon: svgIcon }
        );

        // Draw route line
        const routeLine = L.polyline(
          [
            [shipment.originCoords.lat, shipment.originCoords.lng],
            [shipment.currentPosition.lat, shipment.currentPosition.lng],
            [shipment.destinationCoords.lat, shipment.destinationCoords.lng],
          ],
          { color, weight: 2, opacity: 0.4, dashArray: "4 4" }
        ).addTo(map);

        const popupContent = `
          <div style="font-family:Inter,sans-serif;min-width:220px;font-size:13px;">
            <div style="font-weight:700;color:#1C1C1A;margin-bottom:6px;">${shipment.id}</div>
            <div style="color:#6B6B65;font-size:12px;margin-bottom:8px;">${shipment.cargoName}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
              <div>
                <div style="font-size:10px;color:#9B9B95;text-transform:uppercase;letter-spacing:0.05em;">Risk</div>
                <div style="font-weight:700;color:${color};font-size:15px;">${risk}%</div>
                <div style="font-size:10px;color:${color};">${band}</div>
              </div>
              <div>
                <div style="font-size:10px;color:#9B9B95;text-transform:uppercase;letter-spacing:0.05em;">Safe Window</div>
                <div style="font-weight:600;color:#1C1C1A;font-size:14px;">${Math.round(safeWin)} min</div>
              </div>
              <div>
                <div style="font-size:10px;color:#9B9B95;">Temperature</div>
                <div style="font-weight:600;color:${shipment.temperature > shipment.safeRangeMax ? '#E24B4A' : '#639922'}">${shipment.temperature}°C</div>
              </div>
              <div>
                <div style="font-size:10px;color:#9B9B95;">Route</div>
                <div style="font-size:12px;color:#1C1C1A;">${shipment.origin} → ${shipment.destination}</div>
              </div>
            </div>
            <a href="/shipments/${shipment.id}" style="display:block;text-align:center;padding:6px 12px;background:#EF9F27;color:white;border-radius:6px;font-weight:600;font-size:12px;text-decoration:none;">Open Shipment</a>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 260 });
        marker.addTo(map);
        markersRef.current.push(marker, routeLine);
      });

    return () => {
      // Don't destroy map, just cleanup markers on re-render
    };
  }, [shipments, selectedId, router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        (leafletMapRef.current as ReturnType<typeof import("leaflet").map>).remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", height }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      {/* Legend */}
      <div style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        background: "white",
        border: "1px solid #E0E0DB",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 11,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}>
        <div style={{ fontWeight: 700, color: "#1C1C1A", marginBottom: 2 }}>Risk Level</div>
        {[
          { label: "Low (0–29)", color: "#639922" },
          { label: "Moderate (30–59)", color: "#F59E0B" },
          { label: "High (60–79)", color: "#F97316" },
          { label: "Critical (80–100)", color: "#E24B4A" },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, color: "#6B6B65" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />
            {label}
          </div>
        ))}
        <div style={{ color: "#9B9B95", marginTop: 4, fontStyle: "italic" }}>Simulated positions — DEMO</div>
      </div>
    </div>
  );
}
