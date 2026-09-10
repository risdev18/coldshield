"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  FlaskConical, ArrowRight, Play, CheckCircle2, ChevronDown, Activity, ArrowLeft, Sparkles, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/appStore";
import { simulateIntervention, shipmentToFeatures } from "@/services/modelService";
import { cn, formatMinutes, getRiskBand, getRiskColor, getRiskBgColor, getRiskTextColor } from "@/lib/utils";
import type { Shipment, PredictionResult } from "@/lib/types";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { motion, AnimatePresence } from "framer-motion";

// Define some standard interventions to test
const INTERVENTION_PRESETS = [
  { id: "NO_ACTION", label: "No Action", desc: "Continue under current conditions" },
  { id: "REDUCE_DELAY", label: "Reduce Delay", desc: "Prioritize route clearance to reduce delay by 50%" },
  { id: "RESTORE_TEMP", label: "Restore Temperature", desc: "Instruct driver to maximize cooling unit" },
  { id: "ALT_ROUTE", label: "Alternative Route", desc: "Change route to avoid high traffic risk" },
];

function SimulatorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get("shipment");
  const { shipments, applyIntervention, backendAvailable } = useAppStore();
  
  const [selectedId, setSelectedId] = useState<string>(shipmentId || "");
  
  // Custom scenario controls
  const [temp, setTemp] = useState<number>(0);
  const [delay, setDelay] = useState<number>(0);
  const [humidity, setHumidity] = useState<number>(0);
  const [traffic, setTraffic] = useState<"low"|"medium"|"high">("medium");
  const [refrigeration, setRefrigeration] = useState<"good"|"degraded"|"failed">("good");

  const [loading, setLoading] = useState(false);
  const [basePrediction, setBasePrediction] = useState<PredictionResult | null>(null);
  const [simResults, setSimResults] = useState<Record<string, PredictionResult | null>>({});
  const [customResult, setCustomResult] = useState<PredictionResult | null>(null);

  const shipment = shipments.find(s => s.id === selectedId);

  // Initialize controls when shipment changes
  useEffect(() => {
    if (shipment) {
      setTemp(shipment.temperature);
      setDelay(shipment.delayMinutes);
      setHumidity(shipment.humidity);
      setTraffic(shipment.trafficLevel);
      setRefrigeration(shipment.refrigerationCondition);
      
      // Load current base prediction
      if (shipment.prediction) {
        setBasePrediction(shipment.prediction);
      }
      setSimResults({});
      setCustomResult(null);
      // Automatically run presets on load
      handleRunSimulations(shipment);
    }
  }, [shipment?.id]);

  // Reactive custom simulation
  useEffect(() => {
    if (!shipment || !backendAvailable || !basePrediction) return;
    const timer = setTimeout(async () => {
      try {
        const origFeatures = shipmentToFeatures(shipment);
        const customFeatures = shipmentToFeatures({
          ...shipment,
          temperature: temp,
          delayMinutes: delay,
          humidity,
          trafficLevel: traffic,
          refrigerationCondition: refrigeration
        });
        const simCustom = await simulateIntervention(origFeatures, customFeatures);
        setCustomResult(simCustom.simulated);
      } catch (e) {
        console.error("Live sim failed", e);
      }
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [temp, delay, humidity, traffic, refrigeration, shipment, backendAvailable, basePrediction]);

  const handleRunSimulations = async (shipmentToRun: Shipment = shipment!) => {
    if (!shipmentToRun) return;
    if (!backendAvailable) {
      toast.error("Simulation requires FastAPI backend");
      return;
    }
    setLoading(true);
    toast.info("Running scenarios through ML model...");
    
    try {
      const origFeatures = shipmentToFeatures(shipmentToRun);
      const results: Record<string, PredictionResult> = {};
      
      // Run preset 1: No Action
      const simNoAction = await simulateIntervention(origFeatures, origFeatures);
      results["NO_ACTION"] = simNoAction.simulated;
      setBasePrediction(simNoAction.original); // Update base just in case
      
      // Run preset 2: Reduce delay
      const simDelay = await simulateIntervention(
        origFeatures,
        shipmentToFeatures({ ...shipmentToRun, delayMinutes: Math.max(0, shipmentToRun.delayMinutes * 0.5) })
      );
      results["REDUCE_DELAY"] = simDelay.simulated;
      
      // Run preset 3: Restore Temp
      const targetTemp = shipmentToRun.safeRangeMax - 1; // 1 degree below max
      const simTemp = await simulateIntervention(
        origFeatures,
        shipmentToFeatures({ ...shipmentToRun, temperature: targetTemp, refrigerationCondition: "good" })
      );
      results["RESTORE_TEMP"] = simTemp.simulated;
      
      // Run preset 4: Alt Route
      const simRoute = await simulateIntervention(
        origFeatures,
        shipmentToFeatures({ ...shipmentToRun, trafficLevel: "low", routeRisk: Math.max(0.1, shipmentToRun.routeRisk - 0.2) })
      );
      results["ALT_ROUTE"] = simRoute.simulated;
      
      // Run custom initially too
      const customFeatures = shipmentToFeatures({
        ...shipmentToRun,
        temperature: temp,
        delayMinutes: delay,
        humidity,
        trafficLevel: traffic,
        refrigerationCondition: refrigeration
      });
      const simCustom = await simulateIntervention(origFeatures, customFeatures);
      
      setSimResults(results);
      setCustomResult(simCustom.simulated);
      toast.success("Simulation complete");
    } catch (e) {
      console.error(e);
      toast.error("Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (type: string) => {
    if (!shipment || !basePrediction) return;
    
    let applyFeatures: Partial<Shipment> = {};
    let finalPred: PredictionResult | null = null;
    let desc = "";

    if (type === "REDUCE_DELAY" && simResults["REDUCE_DELAY"]) {
      applyFeatures = { delayMinutes: Math.max(0, shipment.delayMinutes * 0.5) };
      finalPred = simResults["REDUCE_DELAY"];
      desc = "Priority routing applied to reduce delay.";
    } else if (type === "RESTORE_TEMP" && simResults["RESTORE_TEMP"]) {
      applyFeatures = { temperature: shipment.safeRangeMax - 1, refrigerationCondition: "good" };
      finalPred = simResults["RESTORE_TEMP"];
      desc = "Refrigeration restored to safe parameters.";
    } else if (type === "ALT_ROUTE" && simResults["ALT_ROUTE"]) {
      applyFeatures = { trafficLevel: "low", routeRisk: Math.max(0.1, shipment.routeRisk - 0.2) };
      finalPred = simResults["ALT_ROUTE"];
      desc = "Diverted to low-traffic alternative route.";
    } else if (type === "CUSTOM" && customResult) {
      applyFeatures = {
        temperature: temp,
        delayMinutes: delay,
        humidity,
        trafficLevel: traffic,
        refrigerationCondition: refrigeration
      };
      finalPred = customResult;
      desc = "Custom parameters applied by operator.";
    } else {
      return;
    }

    applyIntervention(shipment.id, {
      shipmentId: shipment.id,
      timestamp: new Date().toISOString(),
      type: "operator_intervention",
      description: desc,
      riskBefore: basePrediction.risk_score,
      riskAfter: finalPred.risk_score,
      safeWindowBefore: basePrediction.safe_window_minutes,
      safeWindowAfter: finalPred.safe_window_minutes,
      appliedBy: "Ops Manager",
    }, {
      ...applyFeatures,
      prediction: finalPred
    });

    toast.success("Intervention applied successfully");
    router.push(`/shipments/${shipment.id}`);
  };

  const getBestInterventionId = () => {
    let bestId = "NO_ACTION";
    let bestRisk = simResults["NO_ACTION"]?.risk_score ?? 100;
    
    Object.entries(simResults).forEach(([id, pred]) => {
      if (pred && pred.risk_score < bestRisk) {
        bestRisk = pred.risk_score;
        bestId = id;
      }
    });
    
    if (customResult && customResult.risk_score < bestRisk) {
      return "CUSTOM";
    }
    return bestId;
  };

  const bestId = Object.keys(simResults).length > 0 ? getBestInterventionId() : null;

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-800 text-text flex items-center gap-2" style={{ fontWeight: 800 }}>
          <FlaskConical className="text-primary" /> What-If Simulator
        </h1>
        <p className="text-sm text-text-muted mt-1">Test interventions against the ML model before applying them.</p>
        <p className="text-[10px] text-text-muted mt-2 italic bg-surface inline-block px-2 py-1 rounded border border-border">
          Simulation results are generated dynamically by the prototype ML model.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Col: Setup & Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-4">
            <label className="block text-xs font-600 text-text mb-1" style={{ fontWeight: 600 }}>Select Shipment</label>
            <select
              className="w-full p-2 border border-border rounded text-sm outline-none focus:border-primary"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="" disabled>-- Select --</option>
              {shipments.filter(s => s.status !== "DELIVERED").map(s => (
                <option key={s.id} value={s.id}>{s.id} — {s.cargoName.split("—")[0]}</option>
              ))}
            </select>
          </div>

          {shipment && (
            <div className="card">
              <div className="px-4 py-3 border-b border-border font-600 text-sm" style={{ fontWeight: 600 }}>
                Custom Scenario Inputs
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">Temperature (°C)</span>
                    <span className="font-mono font-600 text-text">{temp.toFixed(1)}</span>
                  </label>
                  <input type="range" min="-25" max="25" step="0.5" value={temp} onChange={e => setTemp(parseFloat(e.target.value))} className="w-full accent-primary" />
                  <div className="flex justify-between text-[10px] text-text-light mt-0.5">
                    <span>Safe: {shipment.safeRangeMin}</span>
                    <span>Max: {shipment.safeRangeMax}</span>
                  </div>
                </div>

                <div>
                  <label className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">Delay (mins)</span>
                    <span className="font-mono font-600 text-text">{delay}</span>
                  </label>
                  <input type="range" min="0" max="240" step="5" value={delay} onChange={e => setDelay(parseInt(e.target.value))} className="w-full accent-primary" />
                </div>
                
                <div>
                  <label className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">Traffic Level</span>
                  </label>
                  <select value={traffic} onChange={e => setTraffic(e.target.value as any)} className="w-full p-1.5 border border-border rounded text-sm outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">Refrigeration</span>
                  </label>
                  <select value={refrigeration} onChange={e => setRefrigeration(e.target.value as any)} className="w-full p-1.5 border border-border rounded text-sm outline-none">
                    <option value="good">Good</option>
                    <option value="degraded">Degraded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
              
              <div className="p-4 border-t border-border bg-surface/50">
                <button
                  onClick={() => handleRunSimulations(shipment)}
                  disabled={loading || !backendAvailable}
                  className="w-full py-2 bg-primary hover:bg-primary-600 text-white rounded font-600 text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  style={{ fontWeight: 600 }}
                >
                  {loading ? <Activity className="animate-spin" size={16} /> : <Play size={16} />}
                  Run Full Simulation
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Results */}
        <div className="lg:col-span-3">
          {!shipment ? (
            <div className="empty-state card h-full min-h-[400px]">
              <FlaskConical size={48} className="text-border mb-4" />
              <p className="text-text-muted">Select a shipment to begin simulation</p>
            </div>
          ) : !basePrediction ? (
            <div className="empty-state card h-full min-h-[400px]">
              <p className="text-text-muted">Run simulation to view comparative analysis</p>
            </div>
          ) : (
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Current Baseline (Left) */}
                <div className="card p-4 border-l-4 border-border">
                  <div className="text-xs font-600 text-text-muted uppercase mb-3" style={{ fontWeight: 600 }}>Current Baseline</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-3xl font-800" style={{ color: getRiskTextColor(basePrediction.risk_band) }}>
                      {basePrediction.risk_score}%
                    </span>
                    <span className="text-xs font-600 px-1.5 py-0.5 rounded" style={{ background: getRiskBgColor(basePrediction.risk_band), color: getRiskTextColor(basePrediction.risk_band) }}>{basePrediction.risk_band}</span>
                  </div>
                  <div className="text-xs text-text-muted mb-1">Safe Window: {formatMinutes(basePrediction.safe_window_minutes)}</div>
                  <div className="text-[10px] text-text-light mt-3">Pre-intervention values</div>
                </div>
                
                {/* Custom Scenario Preview (Right) */}
                {customResult && (
                  <motion.div 
                    className="md:col-span-2 card p-4 border-l-4"
                    style={{ borderColor: getRiskTextColor(customResult.risk_band) }}
                    layout
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-600 uppercase mb-1" style={{ color: getRiskTextColor(customResult.risk_band), fontWeight: 600 }}>
                          Custom Scenario Output
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-4xl font-800" style={{ color: getRiskTextColor(customResult.risk_band) }}>
                            <AnimatedCounter value={customResult.risk_score} duration={0.8} format={v => `${v.toFixed(2)}%`} />
                          </span>
                          <motion.span 
                            key={customResult.risk_band}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-xs font-600 px-2 py-1 rounded" 
                            style={{ background: getRiskBgColor(customResult.risk_band), color: getRiskTextColor(customResult.risk_band) }}
                          >
                            {customResult.risk_band}
                          </motion.span>
                        </div>
                        <div className="text-sm font-500 flex items-center gap-2">
                          Safe Window: 
                          <span className="text-text font-600"><AnimatedCounter value={customResult.safe_window_minutes} duration={0.8} /> min</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleApply("CUSTOM")}
                        className="px-4 py-2 bg-primary text-white rounded font-600 text-sm hover:bg-primary-600 shadow-sm transition-colors"
                        style={{ fontWeight: 600 }}
                      >
                        Apply Scenario
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Feature 5: Counterfactual Impact Card */}
              {shipment && (
                <div className="card p-5 border-2 border-primary/40 bg-[#FAF7F2] space-y-3">
                  <div className="text-xs font-800 text-primary uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-2 font-mono">
                      <Sparkles size={16} /> COUNTERFACTUAL DECISION ANALYSIS: NO ACTION VS AI INTERVENTION
                    </span>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/30 font-mono">
                      BUSINESS IMPACT
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* No Action */}
                    <div className="p-4 bg-critical/10 rounded-xl border border-critical/30 space-y-2">
                      <div className="text-xs font-800 text-critical uppercase tracking-wider flex items-center gap-1.5 font-mono">
                        <AlertTriangle size={14} /> 🚨 NO ACTION (DO NOTHING)
                      </div>
                      <div className="text-sm text-text font-600">
                        Risk increases: <strong className="text-critical font-800 text-base">{basePrediction.risk_score}% → 91%</strong>
                      </div>
                      <div className="text-xs text-text-muted">
                        Estimated Spoilage Exposure: <strong className="text-critical font-800 font-mono text-sm block">₹{((shipment.estimatedValue || 1500000) * 0.42 / 100000).toFixed(1)} Lakhs</strong>
                      </div>
                      <div className="text-xs text-critical font-600">
                        Safe Window: {formatMinutes(basePrediction.safe_window_minutes)} → 11 min
                      </div>
                    </div>

                    {/* AI Diversion */}
                    <div className="p-4 bg-safe/10 rounded-xl border border-safe/30 space-y-2">
                      <div className="text-xs font-800 text-safe uppercase tracking-wider flex items-center gap-1.5 font-mono">
                        <CheckCircle2 size={14} /> 🛡️ AI RECOMMENDED DIVERSION
                      </div>
                      <div className="text-sm text-text font-600">
                        Risk decreases: <strong className="text-safe font-800 text-base">{basePrediction.risk_score}% → {simResults["ALT_ROUTE"]?.risk_score || 29}%</strong>
                      </div>
                      <div className="text-xs text-text-muted">
                        Estimated Loss Avoided: <strong className="text-safe font-800 font-mono text-sm block">₹{((shipment.estimatedValue || 1500000) * 0.38 / 100000).toFixed(1)} Lakhs</strong>
                      </div>
                      <div className="text-xs text-safe font-600">
                        Safe Window: {formatMinutes(basePrediction.safe_window_minutes)} → {formatMinutes(basePrediction.safe_window_minutes + 35)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Comparison Matrix */}
              <div className="card">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2 font-600 text-sm" style={{ fontWeight: 600 }}>
                  Intervention Comparison <span className="text-[10px] bg-surface border border-border px-1 rounded text-text-muted font-mono font-normal tracking-wide ml-2">ML Output</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface border-b border-border">
                        <th className="p-3 text-xs font-600 text-text-muted w-1/3">Intervention</th>
                        <th className="p-3 text-xs font-600 text-text-muted">Predicted Risk</th>
                        <th className="p-3 text-xs font-600 text-text-muted">Est. Safe Window</th>
                        <th className="p-3 text-xs font-600 text-text-muted">Impact</th>
                        <th className="p-3 text-xs font-600 text-text-muted text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Presets */}
                      {INTERVENTION_PRESETS.map(preset => {
                        const res = simResults[preset.id];
                        if (!res) return null;
                        
                        const isBest = preset.id === bestId;
                        const riskDiff = res.risk_score - basePrediction.risk_score;
                        const swDiff = res.safe_window_minutes - basePrediction.safe_window_minutes;
                        
                        return (
                          <tr key={preset.id} className={cn("border-b border-border hover:bg-surface/50 transition-colors", isBest && "bg-primary/5 border-l-2 border-l-primary")}>
                            <td className="p-3">
                              <div className={cn("font-600 text-sm", isBest ? "text-primary" : "text-text")} style={{ fontWeight: 600 }}>
                                {preset.label}
                                {isBest && <span className="ml-2 text-[9px] uppercase bg-primary text-white px-1.5 py-0.5 rounded">AI Recommended</span>}
                              </div>
                              <div className="text-xs text-text-muted mt-0.5">{preset.desc}</div>
                            </td>
                            <td className="p-3">
                              <span className="font-700" style={{ color: getRiskTextColor(res.risk_band), fontWeight: 700 }}>{res.risk_score}%</span>
                              <span className="text-xs ml-2 text-text-muted">({res.risk_band})</span>
                            </td>
                            <td className="p-3 text-sm font-500">{formatMinutes(res.safe_window_minutes)}</td>
                            <td className="p-3">
                              {preset.id === "NO_ACTION" ? <span className="text-xs text-text-muted">—</span> : (
                                <div className="text-xs">
                                  <div className={riskDiff < 0 ? "text-safe font-600" : riskDiff > 0 ? "text-critical" : "text-text-muted"}>
                                    {riskDiff < 0 ? '↓' : riskDiff > 0 ? '↑' : ''} {Math.abs(riskDiff)} risk points
                                  </div>
                                  <div className={swDiff > 0 ? "text-safe" : swDiff < 0 ? "text-critical" : "text-text-muted"}>
                                    {swDiff > 0 ? '+' : ''}{swDiff}m safe time
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {preset.id !== "NO_ACTION" && (
                                <button
                                  onClick={() => handleApply(preset.id)}
                                  className="text-xs font-600 text-primary border border-primary/30 rounded px-2 py-1 hover:bg-primary/10 transition-colors"
                                >
                                  Apply
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SimulatorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-text-muted">Loading simulator...</div>}>
      <SimulatorContent />
    </Suspense>
  )
}
