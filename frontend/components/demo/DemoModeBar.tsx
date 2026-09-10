"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/store/appStore";
import { predictRisk, shipmentToFeatures } from "@/services/modelService";

// ── Demo Mode Bar ──────────────────────────────────────────────────────────
// Shows Start/Pause/Reset controls when demo mode is enabled from Overview.
// During demo, periodically updates shipment temperatures and re-runs predictions.

export default function DemoModeBar() {
  const { demoMode, setDemoMode, shipments, updateShipment, setPrediction, backendAvailable } =
    useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!demoMode.running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const ms = Math.round(5000 / demoMode.speed);
    intervalRef.current = setInterval(async () => {
      const { shipments: current, demoMode: dm } = useAppStore.getState();
      if (!dm.running) return;

      // Pick 2-3 random at-risk shipments and update their conditions slightly
      const targets = current
        .filter((s) => s.status !== "DELIVERED" && s.remainingTransitMin > 5)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      for (const s of targets) {
        // Small realistic temperature drift
        const tempDrift = (Math.random() - 0.3) * 0.15; // slight upward bias
        const newTemp = parseFloat((s.temperature + tempDrift).toFixed(2));
        const humDrift = (Math.random() - 0.5) * 0.8;
        const newHum = Math.min(98, Math.max(30, s.humidity + humDrift));
        const newExcDur = Math.max(0, s.excursionDurationMin + (newTemp > s.safeRangeMax ? 0.1 : -0.05));
        const newRemaining = Math.max(0, s.remainingTransitMin - ms / 60000);

        updateShipment(s.id, {
          temperature: newTemp,
          humidity: parseFloat(newHum.toFixed(1)),
          excursionDurationMin: parseFloat(newExcDur.toFixed(1)),
          remainingTransitMin: parseFloat(newRemaining.toFixed(1)),
        });

        // Re-run prediction
        if (backendAvailable) {
          const features = shipmentToFeatures({
            ...s,
            temperature: newTemp,
            humidity: newHum,
            excursionDurationMin: newExcDur,
            remainingTransitMin: newRemaining,
          });
          try {
            const pred = await predictRisk(features);
            setPrediction(s.id, pred);
          } catch {
            // silent fail during demo
          }
        }
      }

      setDemoMode({ tickCount: (useAppStore.getState().demoMode.tickCount || 0) + 1 });
    }, ms);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [demoMode.running, demoMode.speed, backendAvailable, updateShipment, setPrediction, setDemoMode]);

  if (!demoMode.enabled) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b border-primary/20 flex-shrink-0">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-600 text-primary" style={{ fontWeight: 600 }}>DEMO MODE</span>
      </div>

      <div className="flex items-center gap-1.5 ml-2">
        {!demoMode.running ? (
          <button
            onClick={() => {
              setDemoMode({ running: true });
              toast.success("Demo mode started");
            }}
            className="px-3 py-1 text-xs font-600 bg-primary text-white rounded-md hover:bg-primary-600 transition-colors"
            style={{ fontWeight: 600 }}
          >
            ▶ Start
          </button>
        ) : (
          <button
            onClick={() => {
              setDemoMode({ running: false });
              toast.info("Demo mode paused");
            }}
            className="px-3 py-1 text-xs font-600 bg-text text-white rounded-md hover:bg-text/80 transition-colors"
            style={{ fontWeight: 600 }}
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={() => {
            setDemoMode({ running: false, tickCount: 0 });
            toast.info("Demo mode reset");
          }}
          className="px-3 py-1 text-xs border border-border rounded-md hover:bg-surface transition-colors text-text-muted"
        >
          ↺ Reset
        </button>
      </div>

      <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden ml-1">
        {([1, 2, 5] as const).map((s) => (
          <button
            key={s}
            onClick={() => setDemoMode({ speed: s })}
            className={`px-2.5 py-1 text-xs font-500 transition-colors ${
              demoMode.speed === s ? "bg-primary text-white" : "bg-white text-text-muted hover:bg-surface"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <span className="text-xs text-text-muted ml-auto">
        Tick #{demoMode.tickCount} · Conditions update live
      </span>

      <button
        onClick={() => setDemoMode({ enabled: false, running: false })}
        className="text-xs text-text-muted hover:text-critical transition-colors"
      >
        × Exit
      </button>
    </div>
  );
}
