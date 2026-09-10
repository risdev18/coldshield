"use client";
import { useState, useEffect } from "react";
import { X, Navigation, MapPin, Phone, Thermometer, Box, ExternalLink, Clock, RefreshCw, AlertCircle } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { getNearestFacilities, type ColdStorageFacility } from "@/lib/facilities";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  initialShipmentId?: string;
}

export default function ColdStorageFinderModal({ onClose, initialShipmentId }: Props) {
  const { shipments } = useAppStore();
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(initialShipmentId || shipments[0]?.id || "");
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSource, setLocationSource] = useState<"shipment" | "gps">("shipment");
  const [loadingGps, setLoadingGps] = useState(false);
  const [facilitiesData, setFacilitiesData] = useState<ColdStorageFacility[]>([]);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Set position based on shipment or GPS
  useEffect(() => {
    if (locationSource === "shipment") {
      const s = shipments.find((item) => item.id === selectedShipmentId);
      if (s) {
        setCurrentCoords(s.currentPosition);
      }
    }
  }, [selectedShipmentId, locationSource, shipments]);

  // Fetch facilities and live weather whenever currentCoords changes
  useEffect(() => {
    if (!currentCoords) return;

    const nearest = getNearestFacilities(currentCoords.lat, currentCoords.lng);
    setFacilitiesData(nearest);

    // Fetch live weather for top 3 facilities
    const fetchWeather = async () => {
      setLoadingWeather(true);
      try {
        const top3 = nearest.slice(0, 3);
        const updated = await Promise.all(
          top3.map(async (fac) => {
            try {
              const res = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${fac.lat}&longitude=${fac.lng}&current=temperature_2m,relative_humidity_2m`
              );
              const data = await res.json();
              return {
                ...fac,
                liveTemp: data.current?.temperature_2m,
                liveHumidity: data.current?.relative_humidity_2m,
              };
            } catch {
              return fac;
            }
          })
        );

        setFacilitiesData((prev) =>
          prev.map((f) => {
            const match = updated.find((u) => u.id === f.id);
            return match || f;
          })
        );
      } catch (err) {
        console.error("Failed to load live weather for facilities", err);
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchWeather();
  }, [currentCoords]);

  // Detect Driver Browser GPS
  const handleDetectGps = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("GPS location is not supported by your browser");
      return;
    }

    setLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentCoords(coords);
        setLocationSource("gps");
        setLoadingGps(false);
        toast.success("Driver location detected via GPS!");
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLoadingGps(false);
        toast.error("Unable to access GPS location. Please check browser permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const activeShipment = shipments.find((s) => s.id === selectedShipmentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="card w-full max-w-2xl overflow-hidden shadow-xl border border-border space-y-0">
        {/* Header */}
        <div className="p-4 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Navigation size={18} />
            </div>
            <div>
              <h2 className="text-base font-800 text-text tracking-tight">Nearest Cold Storage Finder</h2>
              <p className="text-xs text-text-muted">
                Locate emergency refrigeration facilities based on driver GPS or shipment location
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Location Selection Bar */}
        <div className="p-4 bg-card border-b border-border space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLocationSource("shipment")}
                className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors flex items-center gap-1.5 ${
                  locationSource === "shipment"
                    ? "bg-primary text-primary-contrast shadow-xs"
                    : "border border-border text-text-muted hover:text-text"
                }`}
              >
                <Box size={13} /> Active Shipment Location
              </button>

              <button
                onClick={handleDetectGps}
                disabled={loadingGps}
                className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors flex items-center gap-1.5 ${
                  locationSource === "gps"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "border border-teal-500/40 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10"
                }`}
              >
                <MapPin size={13} className={loadingGps ? "animate-bounce" : ""} />
                {loadingGps ? "Acquiring GPS..." : "📍 Detect My Current Location"}
              </button>
            </div>

            {locationSource === "gps" && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 font-600 flex items-center gap-1">
                Using Driver GPS Location ({currentCoords?.lat.toFixed(4)}, {currentCoords?.lng.toFixed(4)})
              </span>
            )}
          </div>

          {locationSource === "shipment" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted font-500">Select Shipment:</span>
              <select
                value={selectedShipmentId}
                onChange={(e) => setSelectedShipmentId(e.target.value)}
                className="px-2.5 py-1 rounded border border-border bg-surface text-text font-600 outline-none hover:border-primary/50"
              >
                {shipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.cargoName} ({s.origin} → {s.destination})
                  </option>
                ))}
              </select>
              {activeShipment && (
                <span className="text-text-muted text-[11px] ml-auto">
                  Position: {activeShipment.currentPosition.lat.toFixed(4)}, {activeShipment.currentPosition.lng.toFixed(4)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nearest Facilities List */}
        <div className="p-4 max-h-[420px] overflow-y-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-600 uppercase tracking-wider text-[11px]">
              Nearest Cold Storage Facilities ({facilitiesData.length} Found)
            </span>
            {loadingWeather && (
              <span className="flex items-center gap-1 text-[11px] text-primary">
                <RefreshCw size={11} className="animate-spin" /> Fetching live weather...
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {facilitiesData.map((fac, idx) => {
              const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${fac.lat},${fac.lng}`;

              return (
                <div
                  key={fac.id}
                  className={`p-3.5 rounded-lg border transition-all space-y-2 ${
                    idx === 0
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border bg-surface/50 hover:bg-surface"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {idx === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-800 bg-primary text-primary-contrast uppercase tracking-wide">
                            RECOMMENDED
                          </span>
                        )}
                        <h3 className="font-700 text-sm text-text">{fac.name}</h3>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                        <MapPin size={12} className="text-text-muted flex-shrink-0" />
                        {fac.address}, {fac.city}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-800 text-primary">{fac.distanceKm} km</div>
                      <div className="text-xs text-text-muted font-500 flex items-center justify-end gap-1">
                        <Clock size={11} /> ~{fac.estimatedTimeMin} min drive
                      </div>
                    </div>
                  </div>

                  {/* Operational Details Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div className="p-2 rounded bg-card border border-border/40">
                      <div className="text-[10px] text-text-muted flex items-center gap-1">
                        <Thermometer size={11} /> Temp Range
                      </div>
                      <div className="font-700 text-text mt-0.5">{fac.tempRange}</div>
                      {fac.liveTemp !== undefined && (
                        <div className="text-[10px] text-safe font-600 mt-0.5">
                          Live Ambient: {fac.liveTemp}°C
                        </div>
                      )}
                    </div>

                    <div className="p-2 rounded bg-card border border-border/40">
                      <div className="text-[10px] text-text-muted flex items-center gap-1">
                        <Box size={11} /> Available Space
                      </div>
                      <div className="font-700 text-text mt-0.5">
                        {fac.availableCapacity} / {fac.capacityPallets} pallets
                      </div>
                      <div className="text-[10px] text-safe font-600 mt-0.5">Ready for intake</div>
                    </div>

                    <div className="p-2 rounded bg-card border border-border/40">
                      <div className="text-[10px] text-text-muted flex items-center gap-1">
                        <Phone size={11} /> Helpline Contact
                      </div>
                      <div className="font-700 text-text mt-0.5">{fac.phone}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded text-xs font-600 border border-border bg-card hover:bg-surface text-text transition-colors flex items-center gap-1.5"
                    >
                      Google Maps Navigation <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-surface border-t border-border text-xs text-text-muted flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px]">
            <AlertCircle size={12} className="text-primary" /> Verified Cold Chain Logistics Network
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#1C1C1A] text-white text-xs font-600 hover:bg-black transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
