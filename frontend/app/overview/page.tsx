"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package, AlertTriangle, TrendingUp, Activity,
  ChevronRight, Eye, FlaskConical, TriangleAlert,
  Zap, Clock, ThermometerSun, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/appStore";
import { predictRisk, shipmentToFeatures } from "@/services/modelService";
import { cn, formatMinutes, formatETA, formatRupees, getRiskBand, getRiskColor, getRiskBgColor, getRiskTextColor, getRiskBorderColor } from "@/lib/utils";
import type { Shipment } from "@/lib/types";
import dynamic from "next/dynamic";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

const LiveMap = dynamic(() => import("@/components/map/LiveMap"), { ssr: false, loading: () => <MapSkeleton /> });

function MapSkeleton() {
  return <div className="skeleton w-full h-full rounded-lg" style={{ minHeight: 380 }} />;
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon: Icon, delay = 0, isCurrency = false, isPercent = false }: {
  label: string; value: number; sub?: string; color: string; icon: React.ElementType; delay?: number; isCurrency?: boolean; isPercent?: boolean;
}) {
  const formatValue = (v: number) => {
    if (isCurrency) return formatRupees(v);
    if (isPercent) return `${Math.round(v)}%`;
    return Math.round(v).toString();
  };

  return (
    <motion.div 
      className="card p-4"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-start justify-between">
        <div>
          <motion.div 
            className="text-xs text-text-muted font-medium uppercase tracking-wide mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: delay + 0.1 }}
          >
            {label}
          </motion.div>
          <div className="text-2xl font-800 text-text" style={{ fontWeight: 800 }}>
            <AnimatedCounter value={value} duration={0.8} format={formatValue} />
          </div>
          {sub && (
            <motion.div 
              className="text-xs text-text-muted mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: delay + 0.9 }} // Show after counter finishes
            >
              {sub}
            </motion.div>
          )}
        </div>
        <motion.div 
          className="p-2 rounded-lg" 
          style={{ background: `${color}15` }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: delay + 0.2 }}
        >
          <Icon size={18} style={{ color }} />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Risk score bar ─────────────────────────────────────────────────────────
function RiskBar({ score }: { score: number }) {
  const band = getRiskBand(score);
  const color = getRiskColor(band);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
        <div className="risk-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-600 tabular-nums w-8 text-right" style={{ color, fontWeight: 600 }}>{score}%</span>
    </div>
  );
}

// ── Priority shipment row ─────────────────────────────────────────────────
function PriorityRow({ shipment, rank }: { shipment: Shipment; rank: number }) {
  const router = useRouter();
  const risk = shipment.prediction?.risk_score ?? (shipment.status === "CRITICAL" ? 85 : shipment.status === "AT_RISK" ? 65 : 40);
  const band = shipment.prediction?.risk_band ?? getRiskBand(risk);
  const safeWindow = shipment.prediction?.safe_window_minutes ?? shipment.remainingTransitMin;

  return (
    <div className="p-3 hover:bg-surface rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <span className={cn(
          "w-5 h-5 rounded text-[10px] font-800 flex items-center justify-center flex-shrink-0",
          band === "CRITICAL" ? "bg-critical/15 text-critical" : "bg-warning/15 text-warning"
        )} style={{ fontWeight: 800 }}>{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-600 text-sm text-text" style={{ fontWeight: 600 }}>{shipment.id}</span>
            <span className="text-xs text-text-muted truncate">{shipment.cargoName.split("—")[0].trim()}</span>
          </div>
          <RiskBar score={risk} />
          <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
            <span>⏱ {formatMinutes(safeWindow)} safe window</span>
            <span>🌡 {shipment.temperature}°C</span>
            <span>{shipment.origin} → {shipment.destination}</span>
          </div>
          {shipment.prediction?.recommendation && (
            <div className="text-xs text-text-muted mt-1 italic truncate">
              {shipment.prediction.recommendation.slice(0, 80)}...
            </div>
          )}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => router.push(`/shipments/${shipment.id}`)}
            className="p-1.5 rounded-md border border-border hover:bg-surface text-text-muted hover:text-text transition-colors"
            aria-label="View shipment"
          >
            <Eye size={13} />
          </button>
          <button
            onClick={() => router.push(`/simulator?shipment=${shipment.id}`)}
            className="p-1.5 rounded-md border border-primary/30 hover:bg-primary/10 text-primary transition-colors"
            aria-label="Simulate intervention"
          >
            <FlaskConical size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Network risk trend data ────────────────────────────────────────────────
function buildRiskTrend(shipments: Shipment[]) {
  return Array.from({ length: 12 }, (_, i) => {
    const label = `${String(new Date().getHours() - 11 + i).padStart(2, "0")}:00`;
    const base = 20 + Math.sin(i * 0.5) * 8;
    const critical = shipments.filter((s) => s.status === "CRITICAL").length;
    return { label, risk: Math.round(base + critical * 1.5 + Math.random() * 4) };
  });
}

export default function OverviewPage() {
  const { shipments, alerts, dashboardMetrics, backendAvailable, setPrediction, setDemoMode, demoMode } =
    useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const bootstrapped = useRef(false);

  const priorityShipments = shipments
    .filter((s) => s.status !== "DELIVERED")
    .sort((a, b) => {
      const ra = a.prediction?.risk_score ?? (a.status === "CRITICAL" ? 85 : 40);
      const rb = b.prediction?.risk_score ?? (b.status === "CRITICAL" ? 85 : 40);
      return rb - ra;
    })
    .slice(0, 5);

  const m = dashboardMetrics;

  // Bootstrap: run predictions for all critical shipments on mount
  useEffect(() => {
    if (bootstrapped.current || !backendAvailable) {
      setLoading(false);
      return;
    }
    bootstrapped.current = true;

    const criticals = shipments
      .filter((s) => s.status === "CRITICAL" || s.status === "AT_RISK")
      .slice(0, 6);

    Promise.allSettled(
      criticals.map(async (s) => {
        const features = shipmentToFeatures(s);
        const pred = await predictRisk(features);
        setPrediction(s.id, pred);
      })
    ).finally(() => setLoading(false));
  }, [backendAvailable, shipments, setPrediction]);

  const handleRefresh = async () => {
    if (!backendAvailable) return toast.error("Backend unavailable");
    setRefreshing(true);
    const targets = shipments.filter((s) => s.status !== "DELIVERED").slice(0, 8);
    await Promise.allSettled(
      targets.map(async (s) => {
        const features = shipmentToFeatures(s);
        const pred = await predictRisk(features);
        setPrediction(s.id, pred);
      })
    );
    setRefreshing(false);
    toast.success("Network predictions refreshed");
  };

  const riskTrend = buildRiskTrend(shipments);
  const activeAlerts = alerts.filter((a) => a.status === "active");

  return (
    <div className="p-5 space-y-5 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text" style={{ fontWeight: 800 }}>Control Tower</h1>
          <p className="text-sm text-text-muted mt-0.5">Real-time visibility across your cold-chain network.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDemoMode({ enabled: true, running: false })}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-600 border transition-colors",
              demoMode.enabled ? "bg-primary/10 text-primary border-primary/30" : "border-border text-text-muted hover:bg-surface"
            )}
            style={{ fontWeight: 600 }}
          >
            <Zap size={13} />
            {demoMode.enabled ? "Demo Active" : "Enable Demo"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing || !backendAvailable}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-600 border border-border hover:bg-surface transition-colors disabled:opacity-50"
            style={{ fontWeight: 600 }}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Refresh Predictions
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Active Shipments" value={m.activeShipments} sub="DEMO DATA" color="#EF9F27" icon={Package} delay={0.1} />
        <KpiCard label="At Risk" value={m.atRisk} sub={`${m.critical} critical`} color="#F59E0B" icon={AlertTriangle} delay={0.2} />
        <KpiCard label="Avg Network Risk" value={m.avgNetworkRisk} isPercent sub="Across active fleet" color="#E24B4A" icon={Activity} delay={0.3} />
        <KpiCard
          label="Loss Prevented (Demo)"
          value={m.potentialLossPrevented}
          isCurrency
          sub="Illustrative estimate"
          color="#1D9E75"
          icon={TrendingUp}
          delay={0.4}
        />
      </div>

      {/* Main grid: Map + Priority Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map — 2/3 width */}
        <div className="lg:col-span-2 card overflow-hidden" style={{ minHeight: 420 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-600 text-sm text-text" style={{ fontWeight: 600 }}>Demo Network Map</span>
            <span className="text-xs text-text-muted">Simulated positions — DEMO DATA</span>
          </div>
          <div style={{ height: 380 }}>
            <LiveMap shipments={shipments} />
          </div>
        </div>

        {/* Priority Actions */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div>
              <div className="font-600 text-sm text-text" style={{ fontWeight: 600 }}>Priority Actions</div>
              <div className="text-xs text-text-muted">Highest risk shipments requiring attention</div>
            </div>
            <span
              className="text-xs font-600 px-2 py-0.5 rounded-full"
              style={{
                fontWeight: 600,
                background: "#FDEEEE",
                color: "#C01A1A",
                border: "1px solid #F5AAAA",
              }}
            >
              {m.critical} CRITICAL
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border px-2 py-1">
            {priorityShipments.length === 0 ? (
              <div className="empty-state">
                <Package size={32} className="text-text-light mb-2" />
                <p className="text-sm">No critical shipments detected</p>
              </div>
            ) : (
              priorityShipments.map((s, i) => (
                <PriorityRow key={s.id} shipment={s} rank={i + 1} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Network Risk Trend */}
        <div className="card p-4">
          <div className="font-600 text-sm text-text mb-3" style={{ fontWeight: 600 }}>Network Risk Trend (12h)</div>
          <div className="text-xs text-text-muted mb-3">Avg risk score across active fleet — DEMO DATA</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={riskTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF9F27" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EF9F27" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9B9B95" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9B9B95" }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: "1px solid #E0E0DB", borderRadius: 6 }}
                formatter={(v: number) => [`${v}%`, "Avg Risk"]}
              />
              <Area type="monotone" dataKey="risk" stroke="#EF9F27" strokeWidth={2} fill="url(#riskGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Active Alerts */}
        <div className="card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-600 text-sm text-text" style={{ fontWeight: 600 }}>Active Alerts</span>
            <Link href="/alerts" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-border max-h-52 overflow-y-auto">
            {activeAlerts.length === 0 ? (
              <div className="empty-state py-8 text-sm text-text-muted">All alerts resolved ✓</div>
            ) : (
              activeAlerts.slice(0, 5).map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-start gap-3 hover:bg-surface transition-colors">
                  <TriangleAlert
                    size={14}
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: a.severity === "critical" ? "#E24B4A" : "#F59E0B" }}
                  />
                  <div className="min-w-0">
                    <div className="font-500 text-xs text-text">{a.title}</div>
                    <div className="text-xs text-text-muted mt-0.5 line-clamp-1">{a.message}</div>
                    <div className="text-[10px] text-text-light mt-1">{a.shipmentId}</div>
                  </div>
                  <Link href="/alerts" className="text-xs text-primary hover:underline flex-shrink-0">View</Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upcoming critical row */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-600 text-sm text-text" style={{ fontWeight: 600 }}>Upcoming Critical Shipments</span>
          <Link href="/shipments" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all shipments <ChevronRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left">Shipment</th>
                <th className="px-4 py-2 text-left">Cargo</th>
                <th className="px-4 py-2 text-left">Route</th>
                <th className="px-4 py-2 text-left">Temp</th>
                <th className="px-4 py-2 text-left">Current Risk</th>
                <th className="px-4 py-2 text-left">Safe Window</th>
                <th className="px-4 py-2 text-left">ETA</th>
                <th className="px-4 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {shipments
                .filter((s) => s.status === "CRITICAL" || s.status === "AT_RISK")
                .slice(0, 6)
                .map((s) => {
                  const risk = s.prediction?.risk_score ?? (s.status === "CRITICAL" ? 85 : 65);
                  const band = s.prediction?.risk_band ?? getRiskBand(risk);
                  const safeWin = s.prediction?.safe_window_minutes ?? s.remainingTransitMin;
                  return (
                    <tr key={s.id} className="cursor-pointer">
                      <td className="px-4 py-2.5">
                        <Link href={`/shipments/${s.id}`} className="font-600 text-text hover:text-primary" style={{ fontWeight: 600 }}>
                          {s.id}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted">{s.cargoName.split("—")[0].trim()}</td>
                      <td className="px-4 py-2.5 text-text-muted">{s.origin} → {s.destination}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          "font-600 text-sm",
                          s.temperature > s.safeRangeMax ? "text-critical" : "text-safe"
                        )} style={{ fontWeight: 600 }}>
                          {s.temperature}°C
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="text-xs font-600 px-2 py-0.5 rounded-full"
                          style={{
                            fontWeight: 600,
                            color: getRiskTextColor(band),
                            background: getRiskBgColor(band),
                            border: `1px solid ${getRiskBorderColor(band)}`,
                          }}
                        >
                          {band} · {risk}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted text-sm">{formatMinutes(safeWin)}</td>
                      <td className="px-4 py-2.5 text-text-muted text-sm">{formatETA(s.eta)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          <Link href={`/shipments/${s.id}`} className="text-xs px-2 py-1 rounded border border-border hover:bg-surface transition-colors">
                            View
                          </Link>
                          <Link href={`/simulator?shipment=${s.id}`} className="text-xs px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                            Simulate
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
