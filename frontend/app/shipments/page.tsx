"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Filter, Download, ArrowUpDown, Eye, FlaskConical, CheckCircle2, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import AddShipmentModal from "@/components/shipments/AddShipmentModal";
import { useAppStore } from "@/store/appStore";
import { cn, formatETA, formatMinutes, getRiskBand, getRiskColor, getRiskBgColor, getRiskTextColor, getRiskBorderColor, getCargoLabel, getStatusColor, getStatusLabel } from "@/lib/utils";
import type { Shipment, RiskBand, CargoType, ShipmentStatus } from "@/lib/types";
type SortKey = "id" | "temperature" | "risk" | "eta" | "delay";
type SortDir = "asc" | "desc";

export default function ShipmentsPage() {
  const router = useRouter();
  const { shipments, alerts, acknowledgeAlert } = useAppStore();

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterRisk, setFilterRisk] = useState<RiskBand | "ALL">("ALL");
  const [filterCargo, setFilterCargo] = useState<CargoType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<ShipmentStatus | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let list = [...shipments];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.cargoName.toLowerCase().includes(q) ||
          s.origin.toLowerCase().includes(q) ||
          s.destination.toLowerCase().includes(q) ||
          s.vehicleId.toLowerCase().includes(q)
      );
    }

    // Filter risk
    if (filterRisk !== "ALL") {
      list = list.filter((s) => {
        const risk = s.prediction?.risk_score ?? (s.status === "CRITICAL" ? 85 : s.status === "AT_RISK" ? 65 : 30);
        return getRiskBand(risk) === filterRisk;
      });
    }

    // Filter cargo
    if (filterCargo !== "ALL") list = list.filter((s) => s.cargoType === filterCargo);

    // Filter status
    if (filterStatus !== "ALL") list = list.filter((s) => s.status === filterStatus);

    // Sort
    list.sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case "risk":
          va = a.prediction?.risk_score ?? (a.status === "CRITICAL" ? 85 : 40);
          vb = b.prediction?.risk_score ?? (b.status === "CRITICAL" ? 85 : 40);
          break;
        case "temperature":
          va = a.temperature; vb = b.temperature;
          break;
        case "eta":
          va = new Date(a.eta).getTime(); vb = new Date(b.eta).getTime();
          break;
        case "delay":
          va = a.delayMinutes; vb = b.delayMinutes;
          break;
        default:
          va = a.id.localeCompare(b.id); vb = 0;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });

    return list;
  }, [shipments, search, filterRisk, filterCargo, filterStatus, sortKey, sortDir]);

  // CSV Export
  const handleExport = () => {
    const headers = ["ID", "Cargo", "Origin", "Destination", "Temp(°C)", "Humidity(%)", "Risk%", "RiskBand", "SafeWindow(min)", "ETA", "Status", "Delay(min)", "Vehicle"];
    const rows = filtered.map((s) => {
      const risk = s.prediction?.risk_score ?? "--";
      const band = s.prediction?.risk_band ?? "--";
      const sw = s.prediction?.safe_window_minutes ?? "--";
      return [s.id, s.cargoName, s.origin, s.destination, s.temperature, s.humidity, risk, band, sw, new Date(s.eta).toLocaleString(), s.status, s.delayMinutes, s.vehicleId];
    });
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chillshield-shipments-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported successfully");
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? sortDir === "asc"
        ? <ChevronUp size={12} className="inline ml-1" />
        : <ChevronDown size={12} className="inline ml-1" />
      : <ArrowUpDown size={11} className="inline ml-1 opacity-30" />;

  return (
    <div className="p-5 space-y-4 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text" style={{ fontWeight: 800 }}>Shipments</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {filtered.length} of {shipments.length} shipments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#1C1C1A] text-white text-sm font-600 hover:bg-black transition-colors shadow-sm"
          >
            <Plus size={14} />
            New Shipment
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-surface transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search size={14} className="text-text-muted flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, cargo, origin, destination..."
            className="bg-transparent text-sm text-text placeholder:text-text-muted outline-none flex-1"
            aria-label="Search shipments"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-text-muted" />
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value as RiskBand | "ALL")}
            className="text-xs border border-border rounded-md px-2.5 py-1.5 bg-surface text-text outline-none font-500 hover:border-primary/50 transition-colors"
            aria-label="Filter by risk"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">Low</option>
            <option value="MODERATE">Moderate</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <select
            value={filterCargo}
            onChange={(e) => setFilterCargo(e.target.value as CargoType | "ALL")}
            className="text-xs border border-border rounded-md px-2.5 py-1.5 bg-surface text-text outline-none font-500 hover:border-primary/50 transition-colors"
            aria-label="Filter by cargo"
          >
            <option value="ALL">All Cargo Types</option>
            <option value="biologics">Biologics</option>
            <option value="vaccines">Vaccines</option>
            <option value="dairy">Dairy</option>
            <option value="fresh_produce">Fresh Produce</option>
            <option value="frozen_food">Frozen Food</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ShipmentStatus | "ALL")}
            className="text-xs border border-border rounded-md px-2.5 py-1.5 bg-surface text-text outline-none font-500 hover:border-primary/50 transition-colors"
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="ON_TIME">On Time</option>
            <option value="DELAYED">Delayed</option>
            <option value="AT_RISK">At Risk</option>
            <option value="CRITICAL">Critical</option>
          </select>
          {(filterRisk !== "ALL" || filterCargo !== "ALL" || filterStatus !== "ALL" || search) && (
            <button
              onClick={() => { setFilterRisk("ALL"); setFilterCargo("ALL"); setFilterStatus("ALL"); setSearch(""); }}
              className="text-xs text-critical hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr className="bg-surface">
                <th className="px-4 py-2.5 text-left">
                  <button onClick={() => handleSort("id")} className="flex items-center hover:text-text transition-colors">
                    Shipment <SortIcon k="id" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left">Cargo</th>
                <th className="px-4 py-2.5 text-left">Route</th>
                <th className="px-4 py-2.5 text-left">
                  <button onClick={() => handleSort("temperature")} className="flex items-center hover:text-text transition-colors">
                    Temp <SortIcon k="temperature" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left">Humidity</th>
                <th className="px-4 py-2.5 text-left">
                  <button onClick={() => handleSort("eta")} className="flex items-center hover:text-text transition-colors">
                    ETA <SortIcon k="eta" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left">
                  <button onClick={() => handleSort("risk")} className="flex items-center hover:text-text transition-colors">
                    Current Risk <SortIcon k="risk" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left">Safe Window</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <Search size={32} className="text-text-light mb-2" />
                      <p>No shipments match your search</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const risk = s.prediction?.risk_score ?? (s.status === "CRITICAL" ? 85 : s.status === "AT_RISK" ? 65 : 30);
                  const band = s.prediction?.risk_band ?? getRiskBand(risk);
                  const safeWin = s.prediction?.safe_window_minutes ?? s.remainingTransitMin;
                  const tempOk = s.temperature >= s.safeRangeMin && s.temperature <= s.safeRangeMax;
                  const hasActiveAlert = alerts.some((a) => a.shipmentId === s.id && a.status === "active");
                  
                  // Generate Sparkline
                  const sparkPts = s.tempHistory.slice(-10).map(t => t.temperature);
                  const spMax = Math.max(...sparkPts, s.safeRangeMax + 2);
                  const spMin = Math.min(...sparkPts, s.safeRangeMin - 2);
                  const spRange = spMax - spMin || 1;
                  const sparklinePath = sparkPts.map((pt, i) => `${i * (40 / (sparkPts.length - 1 || 1))},${16 - ((pt - spMin) / spRange) * 16}`).join(" L ");

                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min((filtered.indexOf(s) % 15) * 0.05, 0.5) }}
                      className={cn("cursor-pointer border-b border-border hover:bg-surface/50 transition-colors group", hasActiveAlert && s.status === "CRITICAL" ? "bg-critical/5 relative" : "")}
                      onClick={() => router.push(`/shipments/${s.id}`)}
                    >
                      <td className="px-4 py-2.5 align-top pt-3">
                        <div className="flex items-center gap-2">
                          {hasActiveAlert && (
                            <span className="w-1.5 h-1.5 rounded-full bg-critical flex-shrink-0 animate-pulse" aria-label="Active alert" />
                          )}
                          <span className="font-600 text-text group-hover:text-primary transition-colors" style={{ fontWeight: 600 }}>{s.id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted text-xs align-top pt-3">{s.cargoName.split("—")[0].trim()}</td>
                      <td className="px-4 py-2.5 text-text-muted text-xs whitespace-nowrap align-top pt-3">{s.origin} → {s.destination}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-600 text-sm", tempOk ? "text-safe" : "text-critical")} style={{ fontWeight: 600 }}>
                            {s.temperature}°C
                          </span>
                          {!tempOk && <span className="text-[10px] text-critical flex-shrink-0 animate-pulse">⚠ excursion</span>}
                        </div>
                        {/* SVG Sparkline */}
                        <div className="mt-1 w-[40px] h-[16px] opacity-60">
                          <svg viewBox="0 0 40 16" className="w-full h-full overflow-visible">
                            <path d={`M 0,${16 - ((s.safeRangeMax - spMin) / spRange) * 16} L 40,${16 - ((s.safeRangeMax - spMin) / spRange) * 16}`} stroke="currentColor" strokeWidth="0.5" strokeDasharray="1,1" className="text-critical opacity-50" fill="none" />
                            <path d={`M 0,${16 - ((s.safeRangeMin - spMin) / spRange) * 16} L 40,${16 - ((s.safeRangeMin - spMin) / spRange) * 16}`} stroke="currentColor" strokeWidth="0.5" strokeDasharray="1,1" className="text-safe opacity-50" fill="none" />
                            <path d={`M ${sparklinePath}`} fill="none" stroke={tempOk ? "currentColor" : "red"} strokeWidth="1.5" className={tempOk ? "text-primary" : ""} />
                          </svg>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted text-sm align-top pt-3">{s.humidity}%</td>
                      <td className="px-4 py-2.5 text-text-muted text-sm align-top pt-3" suppressHydrationWarning>{formatETA(s.eta)}</td>
                      <td className="px-4 py-2.5 align-top pt-3" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/shipments/${s.id}`}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden w-16">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${risk}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                style={{ background: getRiskColor(band), height: "100%" }} 
                                className="rounded-full" 
                              />
                            </div>
                            <span
                              className="text-xs font-600 px-1.5 py-0.5 rounded whitespace-nowrap"
                              style={{ fontWeight: 600, color: getRiskTextColor(band), background: getRiskBgColor(band) }}
                            >
                              {band} · {risk}%
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted text-sm align-top pt-3">{formatMinutes(safeWin)}</td>
                      <td className="px-4 py-2.5 align-top pt-3">
                        <span
                          className="text-xs font-500 px-2 py-0.5 rounded-full border"
                          style={{
                            color: getStatusColor(s.status),
                            borderColor: `${getStatusColor(s.status)}40`,
                            background: `${getStatusColor(s.status)}10`,
                          }}
                        >
                          {getStatusLabel(s.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-top pt-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Link
                            href={`/shipments/${s.id}`}
                            className="p-1.5 rounded border border-border hover:bg-surface transition-colors"
                            title="View shipment"
                          >
                            <Eye size={12} />
                          </Link>
                          <Link
                            href={`/simulator?shipment=${s.id}`}
                            className="p-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                            title="Simulate intervention"
                          >
                            <FlaskConical size={12} />
                          </Link>
                          {hasActiveAlert && (
                            <button
                              onClick={() => {
                                const alert = alerts.find((a) => a.shipmentId === s.id && a.status === "active");
                                if (alert) {
                                  acknowledgeAlert(alert.id);
                                  toast.success(`Alert acknowledged for ${s.id}`);
                                }
                              }}
                              className="p-1.5 rounded border border-teal/30 text-teal hover:bg-teal/10 transition-colors"
                              title="Acknowledge alert"
                            >
                              <CheckCircle2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-border bg-surface text-xs text-text-muted flex items-center justify-between">
          <span>Showing {filtered.length} shipments · All values are DEMO DATA</span>
          <span>Click any row to open shipment detail</span>
        </div>
      </div>
      
      {isModalOpen && <AddShipmentModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
