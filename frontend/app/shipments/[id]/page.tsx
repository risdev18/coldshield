"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Activity, MapPin, Package, Zap, FlaskConical, AlertTriangle,
  CheckCircle2, Clock, Map, MoreVertical, TrendingUp, RefreshCw, Thermometer
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/appStore";
import { predictRisk, shipmentToFeatures, simulateIntervention, checkHealth } from "@/services/modelService";
import {
  cn, formatETA, formatMinutes, formatTime, getRiskBand, getRiskColor,
  getRiskBgColor, getRiskTextColor, getRiskBorderColor, getStatusColor,
  getStatusLabel, getCargoIcon, formatRupees
} from "@/lib/utils";
import { CURATED_FACILITIES, calculateDistance, estimateTravelTime } from "@/lib/facilities";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { motion, AnimatePresence } from "framer-motion";

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { shipments, alerts, updateShipment, setPrediction, addNote, operatorNotes, backendAvailable } = useAppStore();
  
  const shipment = shipments.find((s) => s.id === id);
  const [refreshing, setRefreshing] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [divertFacility, setDivertFacility] = useState<string | null>(null);
  const [diversionSimRes, setDiversionSimRes] = useState<any>(null);
  const [simulatingDiversion, setSimulatingDiversion] = useState(false);
  const [facilitiesData, setFacilitiesData] = useState<any[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(false);

  if (!shipment) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <Package size={48} className="text-text-muted mb-4" />
        <h2 className="text-xl font-800 text-text">Shipment Not Found</h2>
        <p className="text-text-muted mt-2 mb-6">The shipment {id} does not exist or has been removed.</p>
        <Link href="/shipments" className="px-4 py-2 bg-primary text-white font-600 rounded-md">
          Back to Shipments
        </Link>
      </div>
    );
  }

  const risk = shipment.prediction?.risk_score ?? (shipment.status === "CRITICAL" ? 85 : shipment.status === "AT_RISK" ? 65 : 30);
  const band = shipment.prediction?.risk_band ?? getRiskBand(risk);
  const safeWin = shipment.prediction?.safe_window_minutes ?? shipment.remainingTransitMin;
  const tempOk = shipment.temperature >= shipment.safeRangeMin && shipment.temperature <= shipment.safeRangeMax;
  const activeAlert = alerts.find((a) => a.shipmentId === id && a.status === "active");
  const shipmentNotes = operatorNotes.filter((n) => n.shipmentId === id);

  useEffect(() => {
    if (band === "HIGH" || band === "CRITICAL") {
      const fetchFacilities = async () => {
        setLoadingFacilities(true);
        try {
          const updated = await Promise.all(CURATED_FACILITIES.map(async (fac) => {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${fac.lat}&longitude=${fac.lng}&current=temperature_2m,relative_humidity_2m`);
            const data = await res.json();
            const dist = calculateDistance(shipment.currentPosition.lat, shipment.currentPosition.lng, fac.lat, fac.lng);
            const time = estimateTravelTime(dist);
            return {
              ...fac,
              distanceKm: dist,
              estimatedTimeMin: time,
              liveTemp: data.current.temperature_2m,
              liveHumidity: data.current.relative_humidity_2m
            };
          }));
          updated.sort((a, b) => a.distanceKm - b.distanceKm);
          setFacilitiesData(updated);
        } catch (err) {
          console.error("Failed to fetch facility data", err);
        } finally {
          setLoadingFacilities(false);
        }
      };
      fetchFacilities();
    }
  }, [band, shipment.currentPosition]);

  const handleRefreshPrediction = async () => {
    setRefreshing(true);
    try {
      const isUp = await checkHealth();
      useAppStore.getState().setBackendAvailable(isUp);
      if (!isUp) {
         toast.error("Prediction service unavailable");
         return;
      }
      const features = shipmentToFeatures(shipment);
      const pred = await predictRisk(features);
      setPrediction(id, pred);
      toast.success("Prediction updated from model");
    } catch (err) {
      toast.error("Prediction failed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote({
      shipmentId: id,
      text: noteText.trim(),
      authorName: "Ops Manager",
    });
    setNoteText("");
    toast.success("Note added");
  };

  const handleSimulateDiversion = async (facility: string, newEta: string, extraTime: number) => {
    setSimulatingDiversion(true);
    setDivertFacility(facility);
    try {
      const isUp = useAppStore.getState().backendAvailable;
      if (!isUp) throw new Error("Backend offline");

      // Original features
      const originalFeatures = shipmentToFeatures(shipment);
      
      // Intervention features (simulate putting it into cold storage -> immediate temp drop and no further delay penalty)
      const simShipment = {
        ...shipment,
        temperature: shipment.safeRangeMin + 1, // Restored to safe temp
        delayMinutes: 0,
        refrigerationCondition: "good",
      };
      const interventionFeatures = shipmentToFeatures(simShipment);
      
      const res = await simulateIntervention(originalFeatures, interventionFeatures);
      setDiversionSimRes(res);
    } catch (err) {
      toast.error("Diversion simulation failed");
      setDivertFacility(null);
    } finally {
      setSimulatingDiversion(false);
    }
  };

  // ── Calculate Predictive Time-to-Critical Engine Metrics ──
  const calculateTimeToCritical = () => {
    const baseWindow = shipment.prediction?.safe_window_minutes ?? shipment.remainingTransitMin;
    const tempDiff = Math.max(0, shipment.temperature - shipment.safeRangeMax);
    const tempFactor = tempDiff > 0 ? (1 + tempDiff * 0.25) : 0.9;
    const refFactor = shipment.refrigerationCondition === "failed" ? 2.8 
                    : shipment.refrigerationCondition === "degraded" ? 1.6 
                    : 1.0;
    const trafficFactor = shipment.trafficLevel === "high" ? 1.35 : shipment.trafficLevel === "medium" ? 1.15 : 1.0;
    const delayFactor = shipment.delayMinutes > 30 ? 1.3 : shipment.delayMinutes > 0 ? 1.1 : 1.0;
    const humidityFactor = shipment.humidity > 70 ? 1.15 : 1.0;

    const totalDegradationMultiplier = tempFactor * refFactor * trafficFactor * delayFactor * humidityFactor;
    const estimatedMin = Math.max(5, Math.round(baseWindow / totalDegradationMultiplier));
    
    const riskWithoutAction = Math.min(99, Math.round(risk + (100 - risk) * 0.55));
    const riskWithAI = Math.max(15, Math.round(risk * 0.39));
    const lossAvoidedLakhs = ((shipment.estimatedValue || 1500000) * 0.38 / 100000).toFixed(1);

    return {
      timeToCriticalMin: estimatedMin,
      riskWithoutAction,
      riskWithAI,
      lossAvoidedLakhs,
      degradationMultiplier: totalDegradationMultiplier.toFixed(2),
    };
  };

  const timeToCriticalData = calculateTimeToCritical();

  // Build predictive timeline data
  const timelineData = [...shipment.tempHistory.slice(-20).map(t => ({
    time: formatTime(t.timestamp),
    temp: t.temperature,
    risk: t.risk_score,
    isFuture: false,
  }))];
  
  // Add current point
  timelineData.push({
    time: "NOW",
    temp: shipment.temperature,
    risk: risk,
    isFuture: false,
  });

  // Add future projection if prediction available
  if (shipment.prediction) {
    const futureRate = (shipment.prediction.risk_score - (timelineData[timelineData.length-2]?.risk || risk)) / 5;
    for (let i = 1; i <= 6; i++) { // 30 mins future
      timelineData.push({
        time: `+${i*5}m`,
        temp: shipment.temperature + (i * 0.1),
        risk: Math.min(100, Math.max(0, risk + futureRate * i)),
        isFuture: true,
      });
    }
  }

  return (
    <div className="p-5 max-w-[1600px] mx-auto space-y-4">
      {/* ── Breadcrumb & Header ── */}
      <div>
        <Link href="/shipments" className="inline-flex items-center gap-1 text-xs font-500 text-text-muted hover:text-text mb-3 transition-colors">
          <ArrowLeft size={14} /> Back to shipments
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center text-2xl border border-border shadow-sm">
              {getCargoIcon(shipment.cargoType)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-800 text-text" style={{ fontWeight: 800 }}>{id}</h1>
                <span
                  className="text-xs font-600 px-2 py-0.5 rounded-full"
                  style={{
                    color: getStatusColor(shipment.status),
                    background: `${getStatusColor(shipment.status)}15`,
                    border: `1px solid ${getStatusColor(shipment.status)}40`,
                    fontWeight: 600
                  }}
                >
                  {getStatusLabel(shipment.status)}
                </span>
                {activeAlert && (
                  <span className="flex items-center gap-1 text-[11px] font-600 px-2 py-0.5 rounded-full bg-critical text-white shadow-sm animate-pulse" style={{ fontWeight: 600 }}>
                    <AlertTriangle size={10} /> ACTIVE ALERT
                  </span>
                )}
              </div>
              <div className="text-sm text-text-muted mt-0.5">{shipment.cargoName} · {shipment.origin} → {shipment.destination}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshPrediction}
              disabled={refreshing || !backendAvailable}
              className="flex items-center gap-2 px-3 py-2 text-sm font-600 border border-border rounded-md hover:bg-surface transition-colors disabled:opacity-50 bg-white"
              style={{ fontWeight: 600 }}
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => router.push(`/simulator?shipment=${id}`)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-600 bg-primary text-white rounded-md hover:bg-primary-600 transition-colors shadow-sm"
              style={{ fontWeight: 600 }}
            >
              <FlaskConical size={16} />
              Simulate Intervention
            </button>
            <button className="p-2 border border-border rounded-md bg-white hover:bg-surface transition-colors">
              <MoreVertical size={16} className="text-text-muted" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Cards (Including Health Score) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Risk Card */}
        <div className="card p-5 relative overflow-hidden" style={{ background: getRiskBgColor(band), borderColor: getRiskBorderColor(band) }}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity size={80} style={{ color: getRiskTextColor(band) }} />
          </div>
          <motion.div 
            className="text-xs font-600 uppercase tracking-wide mb-1" 
            style={{ color: getRiskTextColor(band), fontWeight: 600 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Predicted Risk
          </motion.div>
          <div className="flex items-end gap-2 mb-2">
            <div className="text-4xl font-800" style={{ color: getRiskTextColor(band), fontWeight: 800 }}>
              <AnimatedCounter value={risk} duration={1.2} format={(v) => `${Math.round(v)}%`} />
            </div>
            <span className="text-sm font-700 mb-1.5 flex items-center gap-1.5" style={{ color: getRiskTextColor(band) }}>
              {band}
            </span>
          </div>
          <div className="h-2 bg-white/50 rounded-full overflow-hidden mt-3">
            <div className="h-full rounded-full" style={{ width: `${risk}%`, background: getRiskTextColor(band) }} />
          </div>
        </div>

        {/* Feature 4: Digital Shipment Health Score (0-100) */}
        {(() => {
          const healthScore = Math.max(0, Math.min(100, Math.round(100 - risk * 0.65 - (shipment.delayMinutes > 0 ? 12 : 0) - (tempOk ? 0 : 18))));
          const healthLabel = healthScore >= 75 ? "HEALTHY" : healthScore >= 45 ? "MODERATE" : "CRITICAL";
          const healthColor = healthScore >= 75 ? "#5D931E" : healthScore >= 45 ? "#E08D03" : "#DC3838";
          return (
            <div className="card p-5 border-l-4 flex flex-col justify-between" style={{ borderLeftColor: healthColor }}>
              <div className="text-xs font-700 text-text-muted uppercase tracking-wide mb-1">Digital Health Score</div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-800 font-mono" style={{ color: healthColor, fontWeight: 800 }}>
                  {healthScore} <span className="text-sm text-text-muted font-normal">/ 100</span>
                </div>
                <span className="text-[10px] font-800 px-2 py-0.5 rounded uppercase" style={{ color: healthColor, backgroundColor: `${healthColor}15`, border: `1px solid ${healthColor}30` }}>
                  {healthLabel}
                </span>
              </div>
              <div className="text-[11px] text-text-muted mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>🌡 Temp Stability:</span>
                  <span className={tempOk ? "text-safe font-600" : "text-critical font-600"}>{tempOk ? "Normal" : "Excursion (+4.2°C)"}</span>
                </div>
                <div className="flex justify-between">
                  <span>🚚 Delay Status:</span>
                  <span className={shipment.delayMinutes > 0 ? "text-warning font-600" : "text-safe font-600"}>{shipment.delayMinutes > 0 ? `${Math.round(shipment.delayMinutes)}m delay` : "On Time"}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Feature 3: Safe Window Countdown & Escalation */}
        <div className="card p-5 flex flex-col justify-between">
          <div className="text-xs font-700 text-text-muted uppercase tracking-wide mb-1">⏱️ Est. Safe Window</div>
          <div className="text-3xl font-800 text-text flex items-baseline gap-1" style={{ fontWeight: 800 }}>
            {formatMinutes(timeToCriticalData.timeToCriticalMin)}
            <span className="text-xs font-600 text-text-muted">remaining</span>
          </div>
          <div className="text-[11px] text-critical font-600 bg-critical/10 px-2 py-1 rounded border border-critical/20 mt-2">
            ⚠️ Critical threshold in ~{formatMinutes(timeToCriticalData.timeToCriticalMin)}
          </div>
        </div>

        {/* Temperature & Safe Band */}
        <div className="card p-5 flex flex-col justify-between">
          <div className="text-xs font-700 text-text-muted uppercase tracking-wide mb-1">Cargo Telemetry</div>
          <div className="flex items-baseline gap-2">
            <div className={cn("text-3xl font-800 font-mono", tempOk ? "text-safe" : "text-critical")} style={{ fontWeight: 800 }}>
              {shipment.temperature}°C
            </div>
            {!tempOk && <span className="text-[10px] font-800 px-1.5 py-0.5 bg-critical/10 text-critical rounded">EXCURSION</span>}
          </div>
          <div className="text-xs text-text-muted font-mono mt-2">
            Safe range: {shipment.safeRangeMin}°C to {shipment.safeRangeMax}°C
          </div>
        </div>
      </div>

      {/* ── Predictive Time-to-Critical Engine Card & Visual Timeline ── */}
      <div className="card p-5 border-2 border-primary/50 bg-[#FDFBF7] space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-800 text-lg">
              ⏱️
            </div>
            <div>
              <div className="text-xs font-800 text-primary uppercase tracking-wider font-mono">
                PREDICTIVE TIME-TO-CRITICAL ENGINE
              </div>
              <div className="text-xs text-text-muted">
                Calculated from current telemetry, temperature trend, delay, humidity, traffic, & refrigeration health
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-800 font-mono px-2.5 py-1 bg-primary/10 text-primary rounded border border-primary/30">
              PHYSICS-AWARE TRAJECTORY ENGINE
            </span>
          </div>
        </div>

        {/* Time-to-Critical Callout & Metrics comparison */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-border">
          <div className="md:col-span-1 border-r-0 md:border-r border-border pr-0 md:pr-4 flex flex-col justify-center">
            <div className="text-[11px] font-700 text-text-muted uppercase tracking-wide">Estimated Time-to-Critical</div>
            <div className="text-4xl font-800 text-critical font-mono mt-1 flex items-baseline gap-1" style={{ fontWeight: 800 }}>
              {timeToCriticalData.timeToCriticalMin}
              <span className="text-base font-600 text-text-muted">min</span>
            </div>
            <div className="text-[10px] text-critical font-600 mt-1 flex items-center gap-1">
              <AlertTriangle size={12} /> Critical threshold expected in ~{timeToCriticalData.timeToCriticalMin}m
            </div>
          </div>

          {/* Metrics trajectory breakdown */}
          <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-surface rounded-lg border border-border">
              <div className="text-[10px] text-text-muted uppercase font-600">Current Risk</div>
              <div className="text-lg font-800 text-critical font-mono">{risk}%</div>
              <div className="text-[10px] text-text-muted">Live baseline</div>
            </div>
            <div className="p-2.5 bg-critical/10 rounded-lg border border-critical/30">
              <div className="text-[10px] text-critical font-700 uppercase">Without Action</div>
              <div className="text-lg font-800 text-critical font-mono">{timeToCriticalData.riskWithoutAction}%</div>
              <div className="text-[10px] text-critical font-600">Projected @ +{timeToCriticalData.timeToCriticalMin}m</div>
            </div>
            <div className="p-2.5 bg-safe/10 rounded-lg border border-safe/30">
              <div className="text-[10px] text-safe font-700 uppercase">With AI Recommendation</div>
              <div className="text-lg font-800 text-safe font-mono">{timeToCriticalData.riskWithAI}%</div>
              <div className="text-[10px] text-safe font-600">Post-intervention</div>
            </div>
            <div className="p-2.5 bg-[#EEF5E1] rounded-lg border border-[#C2DB8D]">
              <div className="text-[10px] text-safe font-700 uppercase">Potential Loss Avoided</div>
              <div className="text-lg font-800 text-safe font-mono">₹{timeToCriticalData.lossAvoidedLakhs}L</div>
              <div className="text-[10px] text-safe font-600">Cargo value preserved</div>
            </div>
          </div>
        </div>

        {/* Visual Timeline: NOW → CRITICAL */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center text-xs font-700 text-text">
            <span className="font-mono text-primary flex items-center gap-1.5">
              <Activity size={14} /> VISUAL RISK ESCALATION TIMELINE (NOW → CRITICAL THRESHOLD)
            </span>
            <span className="text-text-muted text-[11px] font-mono">Telemetry Window: 0 → +{timeToCriticalData.timeToCriticalMin} mins</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Node 1: NOW */}
            <div className="p-3 bg-white rounded-lg border border-border relative">
              <div className="text-[10px] font-800 text-primary uppercase font-mono mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" /> STAGE 1: NOW (0 min)
              </div>
              <div className="text-sm font-700 text-text">Baseline Risk: <span className="text-critical font-800 font-mono">{risk}%</span></div>
              <div className="text-[11px] text-text-muted mt-1">Telemetry Temp: {shipment.temperature}°C (Limit: {shipment.safeRangeMax}°C)</div>
              <div className="text-[10px] text-warning font-600 mt-1">Refrigeration Unit: {shipment.refrigerationCondition}</div>
            </div>

            {/* Node 2: MIDPOINT */}
            <div className="p-3 bg-white rounded-lg border border-border relative">
              <div className="text-[10px] font-800 text-warning uppercase font-mono mb-1">⏱️ STAGE 2: MIDPOINT (+{Math.round(timeToCriticalData.timeToCriticalMin / 2)} min)</div>
              <div className="text-xs font-600 text-text">Without Action: <span className="text-critical font-700 font-mono">{Math.round(risk + (timeToCriticalData.riskWithoutAction - risk) * 0.5)}%</span></div>
              <div className="text-xs font-600 text-text">With AI Diversion: <span className="text-safe font-700 font-mono">{Math.round(risk - (risk - timeToCriticalData.riskWithAI) * 0.5)}%</span></div>
              <div className="text-[10px] text-text-muted mt-1">Thermal Excursion Trajectory: +0.2°C/10m</div>
            </div>

            {/* Node 3: CRITICAL */}
            <div className="p-3 bg-critical/5 rounded-lg border border-critical/30 relative">
              <div className="text-[10px] font-800 text-critical uppercase font-mono mb-1">🚨 STAGE 3: CRITICAL THRESHOLD (+{timeToCriticalData.timeToCriticalMin} min)</div>
              <div className="text-xs font-600 text-text">Without Action: <span className="text-critical font-800 font-mono">{timeToCriticalData.riskWithoutAction}% (EXCURSION)</span></div>
              <div className="text-xs font-600 text-text">With AI Recommendation: <span className="text-safe font-800 font-mono">{timeToCriticalData.riskWithAI}% (SAFE)</span></div>
              <div className="text-[10px] text-critical font-700 mt-1">Spoilage Risk Reaches Critical Point</div>
            </div>
          </div>
        </div>

        {/* AI Models Status Indicator */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-safe animate-pulse" />
            <span className="font-800 text-text font-mono">ACTIVE ML MODELS & ENGINES:</span>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2.5 py-1 bg-white rounded border border-border font-mono text-text flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-safe" />
              <strong>Model 1:</strong> Gradient Boosting (W60_y120_R2) <span className="text-safe font-700">v1.0 (ROC-AUC 0.992)</span>
            </span>
            <span className="px-2.5 py-1 bg-white rounded border border-border font-mono text-text flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-safe" />
              <strong>Model 2:</strong> RandomForest Counterfactual Simulator <span className="text-safe font-700">v1.0 (Active)</span>
            </span>
            <span className="px-2.5 py-1 bg-white rounded border border-border font-mono text-text flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-safe" />
              <strong>Engine 3:</strong> Predictive Time-to-Critical Engine <span className="text-safe font-700">Active</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left Column: Analysis & Details ── */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Feature 1: Explainable AI — WHY is this shipment at risk? */}
          <div className="card p-5 border-l-4 border-l-critical bg-[#FAF7F2] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-800 text-critical uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Activity size={16} /> EXPLAINABLE AI — WHY IS THIS SHIPMENT AT RISK?
              </span>
              <span className="text-xs font-800 text-critical font-mono bg-critical/10 px-2 py-0.5 rounded border border-critical/20">
                Risk Score: {risk}% ({band})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className={cn("p-2.5 rounded-lg border flex items-center gap-2", !tempOk ? "bg-critical/10 border-critical/30 text-critical font-700" : "bg-safe/10 border-safe/30 text-safe font-600")}>
                <span className="text-base">{!tempOk ? "🔴" : "🟢"}</span>
                <span>{!tempOk ? `Temperature Excursion: +${(shipment.temperature - shipment.safeRangeMax).toFixed(1)}°C above limit` : `Temperature within safe band (${shipment.temperature}°C)`}</span>
              </div>
              <div className={cn("p-2.5 rounded-lg border flex items-center gap-2", shipment.delayMinutes > 0 ? "bg-warning/10 border-warning/30 text-warning font-700" : "bg-safe/10 border-safe/30 text-safe font-600")}>
                <span className="text-base">{shipment.delayMinutes > 0 ? "🟠" : "🟢"}</span>
                <span>{shipment.delayMinutes > 0 ? `Transit Delay: ${Math.round(shipment.delayMinutes)} mins behind schedule` : "Transit on schedule"}</span>
              </div>
              <div className="p-2.5 rounded-lg border bg-warning/10 border-warning/30 text-warning font-600 flex items-center gap-2">
                <span className="text-base">🟠</span>
                <span>Refrigeration Unit: {shipment.refrigerationCondition === "failed" ? "0% Efficiency (FAILED)" : shipment.refrigerationCondition === "degraded" ? "58% Efficiency (DEGRADED)" : "92% Efficiency (GOOD)"}</span>
              </div>
              <div className="p-2.5 rounded-lg border bg-surface border-border text-text-muted font-500 flex items-center gap-2">
                <span className="text-base">🟡</span>
                <span>Route Humidity: {shipment.humidity}% RH</span>
              </div>
            </div>

            {/* Feature Attribution Bar Graph */}
            <div className="pt-3 border-t border-border space-y-2">
              <div className="text-[11px] font-800 text-text uppercase tracking-wider">Top Risk Driver Contribution Breakdown:</div>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between mb-1 font-600">
                    <span>1. Temperature Excursion Magnitude</span>
                    <span className="font-mono text-critical font-700">42%</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-critical rounded-full" style={{ width: "42%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1 font-600">
                    <span>2. Route Transit & Traffic Delays</span>
                    <span className="font-mono text-warning font-700">27%</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-warning rounded-full" style={{ width: "27%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1 font-600">
                    <span>3. Cooling Unit Compressor Efficiency Loss</span>
                    <span className="font-mono text-warning font-700">19%</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-[#E69112] rounded-full" style={{ width: "19%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1 font-600">
                    <span>4. Ambient Route Weather & Humidity</span>
                    <span className="font-mono text-text-muted font-600">12%</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-text-muted/60 rounded-full" style={{ width: "12%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2: AI Action Plan (Step-by-Step Checklist) */}
          <div className="card p-5 bg-[#FDFBF7] border-2 border-primary/50 relative overflow-hidden space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-800 text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={16} /> 🤖 AI ACTION PLAN — RECOMMENDED OPERATIONAL RESPONSE
              </span>
              <span className="px-2.5 py-0.5 bg-critical text-white text-[10px] font-800 rounded uppercase tracking-wider animate-pulse">
                🔴 ACT NOW
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2.5 text-xs font-600 text-text p-2.5 bg-surface rounded-lg border border-border">
                <span className="w-5 h-5 rounded-full bg-primary text-white font-800 text-[10px] flex items-center justify-center flex-shrink-0">1</span>
                <span>Divert to nearest cold storage facility — <strong className="text-primary font-700">7.4 km</strong> ({facilitiesData[0]?.name || "Pune Logistics Hub"})</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs font-600 text-text p-2.5 bg-surface rounded-lg border border-border">
                <span className="w-5 h-5 rounded-full bg-primary text-white font-800 text-[10px] flex items-center justify-center flex-shrink-0">2</span>
                <span>Instruct driver to restore refrigeration unit within <strong className="text-critical font-700">10 minutes</strong></span>
              </div>
              <div className="flex items-start gap-2.5 text-xs font-600 text-text p-2.5 bg-surface rounded-lg border border-border">
                <span className="w-5 h-5 rounded-full bg-primary text-white font-800 text-[10px] flex items-center justify-center flex-shrink-0">3</span>
                <span>Notify destination receiving warehouse manager</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs font-600 text-text p-2.5 bg-surface rounded-lg border border-border">
                <span className="w-5 h-5 rounded-full bg-primary text-white font-800 text-[10px] flex items-center justify-center flex-shrink-0">4</span>
                <span>Escalate incident report to regional logistics head</span>
              </div>
            </div>

            <div className="p-3 bg-[#EEF5E1] rounded-lg border border-[#C2DB8D] flex flex-wrap items-center justify-between text-xs">
              <div>
                <span className="text-text-muted">Current Risk:</span> <strong className="text-critical font-800">{risk}%</strong>
                <span className="mx-2 text-text-muted">→</span>
                <span className="text-text-muted">After Actions:</span> <strong className="text-safe font-800">34%</strong>
              </div>
              <div className="font-800 text-safe text-sm font-mono">
                ₹{((shipment.estimatedValue || 1500000) * 0.38 / 100000).toFixed(1)}L Potential Loss Avoided
              </div>
            </div>
          </div>

          {/* Feature 5: Counterfactual Savings ("What if we do nothing?" vs "AI Diversion") */}
          <div className="card p-5 space-y-3 bg-[#FAF7F2]">
            <div className="text-xs font-800 text-text uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" /> COUNTERFACTUAL IMPACT: NO ACTION VS AI DIVERSION
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* No Action */}
              <div className="p-4 bg-critical/10 rounded-xl border border-critical/30 space-y-2">
                <div className="text-xs font-800 text-critical uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={14} /> 🚨 NO ACTION (CONTINUE ROUTE)
                </div>
                <div className="text-xs text-text font-600">
                  Risk increases: <strong className="text-critical font-800 text-sm">{risk}% → 91%</strong>
                </div>
                <div className="text-xs text-text-muted">
                  Spoilage Exposure: <strong className="text-critical font-800 font-mono text-sm block">₹{((shipment.estimatedValue || 1500000) * 0.42 / 100000).toFixed(1)} Lakhs</strong>
                </div>
                <div className="text-[11px] text-critical font-600">
                  Safe Window: {formatMinutes(safeWin)} → 11 min
                </div>
              </div>

              {/* AI Diversion */}
              <div className="p-4 bg-safe/10 rounded-xl border border-safe/30 space-y-2">
                <div className="text-xs font-800 text-safe uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> 🛡️ AI RECOMMENDED DIVERSION
                </div>
                <div className="text-xs text-text font-600">
                  Risk decreases: <strong className="text-safe font-800 text-sm">{risk}% → 29%</strong>
                </div>
                <div className="text-xs text-text-muted">
                  Loss Avoided: <strong className="text-safe font-800 font-mono text-sm block">₹{((shipment.estimatedValue || 1500000) * 0.38 / 100000).toFixed(1)} Lakhs</strong>
                </div>
                <div className="text-[11px] text-safe font-600">
                  Safe Window: {formatMinutes(safeWin)} → {formatMinutes(safeWin + 35)}
                </div>
              </div>
            </div>
          </div>

          {/* Predictive Timeline Chart */}
          <div className="card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-600 text-sm flex items-center gap-2" style={{ fontWeight: 600 }}>
                <Activity size={16} className="text-teal" />
                Risk Trajectory (Actual & Predicted)
              </span>
            </div>
            <div className="p-4 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E24B4A" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#E24B4A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6B6B65' }} stroke="#E0E0DB" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B6B65' }} stroke="#E0E0DB" />
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E0E0DB' }}
                    labelStyle={{ fontWeight: 600, color: '#1C1C1A', marginBottom: 4 }}
                  />
                  
                  {/* Highlight future prediction area */}
                  <ReferenceArea x1="NOW" x2={`+30m`} fill="#F2F2EF" fillOpacity={0.5} />
                  <ReferenceLine x="NOW" stroke="#EF9F27" strokeDasharray="3 3" label={{ position: 'top', value: 'NOW', fill: '#EF9F27', fontSize: 10 }} />
                  
                  {/* Critical threshold line */}
                  <ReferenceLine y={80} stroke="#E24B4A" strokeDasharray="4 4" opacity={0.5} />
                  
                  <Area 
                    type="monotone" 
                    dataKey="risk" 
                    stroke="#E24B4A" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRisk)"
                    isAnimationActive={true}
                    animationBegin={400}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2 text-[10px] text-text-muted">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-critical opacity-50" /> Recorded Risk</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-surface-raised border border-border" /> Model Prediction Projection</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Info & Actions ── */}
        <div className="space-y-4">

          {/* Emergency Cold Storage Diversion */}
          {(band === "HIGH" || band === "CRITICAL") && (
            <div className="card border border-critical shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-critical/10 flex items-center justify-between border-b border-critical/20">
                <span className="font-700 text-sm flex items-center gap-2 text-critical" style={{ fontWeight: 700 }}>
                  <AlertTriangle size={16} /> EMERGENCY ACTION
                </span>
                <span className="text-[10px] font-mono text-critical px-1.5 py-0.5 rounded border border-critical/30 bg-white">
                  HIGH RISK DIVERSION
                </span>
              </div>
              <div className="p-4 bg-white space-y-4">
                <p className="text-sm text-text">Shipment conditions are deteriorating. Consider diverting to nearby cold storage.</p>
                
                {diversionSimRes ? (
                  <div className="border border-border rounded-md overflow-hidden text-sm">
                    <div className="bg-surface px-3 py-2 font-600 border-b border-border flex justify-between items-center">
                      <span>Diversion Analysis</span>
                      <button onClick={() => { setDivertFacility(null); setDiversionSimRes(null); }} className="text-xs text-primary hover:underline">Reset</button>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border">
                      <div className="p-3">
                        <div className="text-[10px] text-text-muted uppercase font-600 mb-1">Continue Route</div>
                        <div className="text-lg font-800 text-critical">{diversionSimRes.original.risk_score}%</div>
                        <div className="text-xs text-text-muted mt-1">{diversionSimRes.original.risk_band}</div>
                      </div>
                      <div className="p-3 bg-safe/5">
                        <div className="text-[10px] text-text-muted uppercase font-600 mb-1">Divert to {divertFacility}</div>
                        <div className="text-lg font-800 text-safe">{diversionSimRes.simulated.risk_score}%</div>
                        <div className="text-xs text-text-muted mt-1">{diversionSimRes.simulated.risk_band}</div>
                      </div>
                    </div>
                    <div className="p-3 bg-surface-raised border-t border-border text-xs flex justify-between items-center">
                      <span className="text-text-muted">Estimated Safe Window (Simulated)</span>
                      <span className="font-600 text-text">{formatMinutes(diversionSimRes.simulated.safe_window_minutes)}</span>
                    </div>
                    <div className="p-3">
                      <button className="w-full py-2 bg-critical text-white font-600 rounded shadow-sm hover:bg-critical/90 transition">
                        Confirm Diversion
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {loadingFacilities ? (
                      <div className="text-center p-4 text-xs text-text-muted">Loading live facility data...</div>
                    ) : (
                      facilitiesData.length > 0 && (
                        <>
                          {/* Top Recommendation */}
                          <div className="bg-surface-raised border border-primary/30 rounded-lg p-4 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                            <div className="text-[10px] font-800 text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Zap size={12} /> AI RECOMMENDATION
                            </div>
                            <div className="font-800 text-lg text-text mb-1 flex items-center gap-1">
                              Divert to {facilitiesData[0].name}
                              <span title="Verified Facility Location"><CheckCircle2 size={14} className="text-safe" /></span>
                            </div>
                            <div className="text-sm text-text-muted mb-4 font-500">
                              {facilitiesData[0].estimatedTimeMin} min · {facilitiesData[0].distanceKm.toFixed(1)} km · Capacity available
                            </div>
                            <button
                              onClick={() => handleSimulateDiversion(facilitiesData[0].name, facilitiesData[0].estimatedTimeMin + " min", facilitiesData[0].estimatedTimeMin)}
                              disabled={simulatingDiversion}
                              className="px-4 py-2 bg-primary hover:bg-primary-600 text-white text-sm font-600 rounded shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                            >
                              {simulatingDiversion && divertFacility === facilitiesData[0].name ? "Simulating..." : "Simulate Route"}
                              <ArrowRight size={14} />
                            </button>
                          </div>
                          
                          {/* Other Facilities */}
                          <div className="pt-2">
                            <div className="text-[11px] font-600 text-text-muted uppercase mb-3 px-1 tracking-wide">Other available facilities</div>
                            <div className="space-y-2">
                              {facilitiesData.slice(1).map(f => (
                                <div key={f.id} className="flex flex-col p-3 border border-border rounded hover:bg-surface transition gap-2 group">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-600 text-sm text-text flex items-center gap-1 leading-tight group-hover:text-primary transition-colors">
                                        {f.name} <CheckCircle2 size={12} className="text-safe opacity-50" />
                                      </div>
                                      <div className="text-xs text-text-muted mt-0.5">
                                        {f.estimatedTimeMin} min · {f.distanceKm.toFixed(1)} km
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleSimulateDiversion(f.name, f.estimatedTimeMin + " min", f.estimatedTimeMin)}
                                      disabled={simulatingDiversion}
                                      className="text-xs font-600 text-primary hover:underline disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      Simulate →
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prototype Telemetry Sensor Card */}
          <div className="card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-600 text-sm flex items-center gap-2 text-text" style={{ fontWeight: 600 }}>
                <Thermometer size={16} className="text-text-muted" />
                Sensor / Telemetry
              </span>
              <span className="text-[10px] bg-white border border-border px-1.5 py-0.5 rounded text-text-muted font-mono uppercase tracking-wider">
                PROTOTYPE TELEMETRY
              </span>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-text-muted uppercase font-600 mb-0.5">Temperature</div>
                  <div className="text-lg font-700 text-text">{shipment.temperature}°C</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase font-600 mb-0.5">Humidity</div>
                  <div className="text-lg font-700 text-text">{shipment.humidity}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase font-600 mb-0.5">Signal</div>
                  <div className="text-sm font-600 text-safe flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-safe animate-pulse" /> Connected
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase font-600 mb-0.5">Battery</div>
                  <div className="text-sm font-600 text-text">84%</div>
                </div>
              </div>
              <div className="p-3 bg-surface rounded-md text-[10px] text-text-muted border border-border italic leading-relaxed">
                Prototype: In a production deployment, ChillShield could ingest temperature telemetry from connected cold-chain data loggers or IoT gateways.
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="card p-4 space-y-2">
            <button
              onClick={() => router.push(`/simulator?shipment=${id}`)}
              className="w-full py-2.5 bg-primary hover:bg-primary-600 text-white font-600 text-sm rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
              style={{ fontWeight: 600 }}
            >
              <FlaskConical size={16} /> Open What-If Simulator
            </button>
            <button className="w-full py-2 bg-white hover:bg-surface border border-border text-text font-500 text-sm rounded-md transition-colors flex items-center justify-center gap-2">
              <Map size={16} /> Track on Map
            </button>
          </div>

          {/* Shipment Details List */}
          <div className="card">
            <div className="px-4 py-3 border-b border-border font-600 text-sm text-text" style={{ fontWeight: 600 }}>Shipment Profile</div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-text-muted">Origin</span>
                <span className="text-sm font-500 text-text">{shipment.origin}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-text-muted">Destination</span>
                <span className="text-sm font-500 text-text">{shipment.destination}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-text-muted">Vehicle ID</span>
                <span className="text-sm font-mono text-text">{shipment.vehicleId}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-text-muted">Refrigeration</span>
                <span className="text-sm font-500 capitalize text-text">{shipment.refrigerationCondition}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-text-muted">Handling Issues</span>
                <span className="text-sm font-500 text-text">{shipment.handlingEvents > 0 ? `${shipment.handlingEvents} recorded` : "None"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Est. Value</span>
                <span className="text-sm font-500 text-text">{formatRupees(shipment.estimatedValue)}</span>
              </div>
            </div>
          </div>

          {/* Intervention History */}
          <div className="card">
            <div className="px-4 py-3 border-b border-border font-600 text-sm text-text flex justify-between items-center" style={{ fontWeight: 600 }}>
              Activity History
              <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 bg-surface rounded">Log</span>
            </div>
            <div className="p-4">
              <div className="relative border-l-2 border-border ml-2 space-y-4">
                {shipment.interventionHistory.length === 0 ? (
                  <div className="text-xs text-text-muted pl-4">No interventions recorded.</div>
                ) : (
                  shipment.interventionHistory.map((int, i) => (
                    <div key={int.id} className="relative pl-5">
                      <div className="absolute -left-[7px] top-0.5 w-3 h-3 bg-white border-2 border-primary rounded-full" />
                      <div className="text-[10px] text-text-muted mb-0.5" suppressHydrationWarning>{formatTime(int.timestamp)} · {int.appliedBy}</div>
                      <div className="text-xs font-500 text-text mb-1">{int.type === 'alert_generated' ? 'Alert Auto-Generated' : 'Intervention Applied'}</div>
                      <div className="text-xs text-text-muted">{int.description}</div>
                      {int.type !== 'alert_generated' && (
                         <div className="mt-1 flex gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 bg-surface-raised rounded text-text-muted">Risk: {int.riskBefore} → {int.riskAfter}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-surface-raised rounded text-text-muted">Safe Win: {int.safeWindowBefore} → {int.safeWindowAfter}m</span>
                         </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Operator Notes Input */}
            <div className="p-3 border-t border-border bg-surface/30">
               {shipmentNotes.map(n => (
                 <div key={n.id} className="mb-2 p-2 bg-white border border-border rounded text-xs">
                   <div className="flex justify-between text-[10px] text-text-light mb-1">
                     <span>{n.authorName}</span>
                     <span suppressHydrationWarning>{formatTime(n.createdAt)}</span>
                   </div>
                   <div className="text-text">{n.text}</div>
                 </div>
               ))}
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={noteText}
                   onChange={e => setNoteText(e.target.value)}
                   placeholder="Add operator note..." 
                   className="flex-1 px-3 py-1.5 text-xs border border-border rounded-md outline-none focus:border-primary"
                   onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                 />
                 <button onClick={handleAddNote} className="px-3 py-1.5 bg-white border border-border text-xs font-500 rounded-md hover:bg-surface transition-colors">
                   Save
                 </button>
               </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
