"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Download,
  ArrowUpDown,
  Eye,
  FlaskConical,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Zap,
  Layers,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  Activity,
  Sparkles,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import AddShipmentModal from "@/components/shipments/AddShipmentModal";
import { useAppStore } from "@/store/appStore";
import {
  cn,
  formatETA,
  formatMinutes,
  getRiskBand,
  getRiskColor,
  getRiskBgColor,
  getRiskTextColor,
  getRiskBorderColor,
  getCargoLabel,
  getStatusColor,
  getStatusLabel
} from "@/lib/utils";
import type { Shipment, RiskBand, CargoType, ShipmentStatus } from "@/lib/types";

type SortKey = "id" | "temperature" | "risk" | "safeWindow" | "eta";
type SortDir = "asc" | "desc";
type ViewMode = "table" | "focus";
type AttentionFilter = "ALL" | "ATTENTION" | "CRITICAL" | "SAFE";

export default function ShipmentsPage() {
  const router = useRouter();
  const { shipments, alerts, acknowledgeAlert } = useAppStore();

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("ALL");
  const [filterRisk, setFilterRisk] = useState<RiskBand | "ALL">("ALL");
  const [filterCargo, setFilterCargo] = useState<CargoType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<ShipmentStatus | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedShipmentIds, setExpandedShipmentIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedShipmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Risk Counts Breakdown
  const riskCounts = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 };
    shipments.forEach((s) => {
      const r = s.prediction?.risk_score ?? (s.status === "CRITICAL" ? 85 : s.status === "AT_RISK" ? 65 : 30);
      const band = getRiskBand(r);
      counts[band] = (counts[band] || 0) + 1;
    });
    return counts;
  }, [shipments]);

  // Main Filtering Logic
  const filtered = useMemo(() => {
    let list = [...shipments];

    // Focus mode filter override
    if (viewMode === "focus") {
      list = list.filter((s) => {
        const risk = s.prediction?.risk_score ?? (s.status === "CRITICAL" ? 85 : s.status === "AT_RISK" ? 65 : 30);
        const band = getRiskBand(risk);
        return band === "CRITICAL" || band === "HIGH" || s.status === "CRITICAL" || s.status === "AT_RISK";
      });
    }

    // Quick Attention Filter
    if (attentionFilter === "ATTENTION") {
      list = list.filter((s) => {
        const risk = s.prediction?.risk_score ?? (s.status === "CRITICAL" ? 85 : s.status === "AT_RISK" ? 65 : 30);
        const band = getRiskBand(risk);
        return band === "CRITICAL" || band === "HIGH" || band === "MODERATE" || s.status === "CRITICAL" || s.status === "AT_RISK";
      });
    } else if (attentionFilter === "CRITICAL") {
      list = list.filter((s) => {
        const risk = s.prediction?.risk_score ?? (s.status === "CRITICAL" ? 85 : s.status === "AT_RISK" ? 65 : 30);
        return getRiskBand(risk) === "CRITICAL";
      });
    } else if (attentionFilter === "SAFE") {
      list = list.filter((s) => {
        const risk = s.prediction?.risk_score ?? (s.status === "CRITICAL" ? 85 : s.status === "AT_RISK" ? 65 : 30);
        return getRiskBand(risk) === "LOW";
      });
    }

    // Search query
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

    // Specific Risk filter (from dropdown or chip)
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

    // Sorting
    list.sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case "risk":
          va = a.prediction?.risk_score ?? (a.status === "CRITICAL" ? 85 : 40);
          vb = b.prediction?.risk_score ?? (b.status === "CRITICAL" ? 85 : 40);
          break;
        case "temperature":
          va = a.temperature;
          vb = b.temperature;
          break;
        case "safeWindow":
          va = a.prediction?.safe_window_minutes ?? a.remainingTransitMin;
          vb = b.prediction?.safe_window_minutes ?? b.remainingTransitMin;
          break;
        case "eta":
          va = new Date(a.eta).getTime();
          vb = new Date(b.eta).getTime();
          break;
        default:
          va = a.id.localeCompare(b.id);
          vb = 0;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });

    return list;
  }, [shipments, viewMode, attentionFilter, search, filterRisk, filterCargo, filterStatus, sortKey, sortDir]);

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
    sortKey === k ? (
      sortDir === "asc" ? (
        <ChevronUp size={12} className="inline ml-1 text-primary" />
      ) : (
        <ChevronDown size={12} className="inline ml-1 text-primary" />
      )
    ) : (
      <ArrowUpDown size={11} className="inline ml-1 opacity-30" />
    );

  return (
    <div className="p-5 space-y-4 max-w-[1600px] mx-auto">
      {/* Top Bar / Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-800 text-text tracking-tight" style={{ fontWeight: 800 }}>
              Shipments
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface border border-border text-text-muted font-600">
              {filtered.length} of {shipments.length} active
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Progressive-disclosure operations control console · High-precision telemetry & AI risk engine
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg border border-border bg-surface text-xs font-500 shadow-sm">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                viewMode === "table" ? "bg-[#1C1C1A] text-white font-600 shadow-xs" : "text-text-muted hover:text-text"
              )}
            >
              <Layers size={13} />
              ☷ All shipments
            </button>
            <button
              onClick={() => setViewMode("focus")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                viewMode === "focus"
                  ? "bg-critical text-white font-600 shadow-xs"
                  : "text-critical hover:bg-critical/10"
              )}
            >
              <Zap size={13} className={viewMode === "focus" ? "animate-pulse" : ""} />
              ⚡ Focus mode
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-contrast text-xs font-600 hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={14} />
            New Shipment
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-text hover:bg-surface transition-colors"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Risk Prioritization Chips Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <button
          onClick={() => {
            setFilterRisk("ALL");
            setAttentionFilter("ALL");
          }}
          className={cn(
            "p-2.5 rounded-lg border text-left transition-all flex items-center justify-between",
            filterRisk === "ALL" && attentionFilter === "ALL"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border bg-card hover:bg-surface"
          )}
        >
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-muted font-600">Total Shipments</div>
            <div className="text-lg font-800 text-text">{shipments.length}</div>
          </div>
          <Layers size={18} className="text-text-muted opacity-60" />
        </button>

        <button
          onClick={() => {
            setFilterRisk(filterRisk === "CRITICAL" ? "ALL" : "CRITICAL");
            setAttentionFilter("ALL");
          }}
          className={cn(
            "p-2.5 rounded-lg border text-left transition-all flex items-center justify-between",
            filterRisk === "CRITICAL"
              ? "border-critical bg-critical/10 shadow-xs"
              : "border-critical/30 bg-critical/5 hover:bg-critical/10"
          )}
        >
          <div>
            <div className="text-[11px] uppercase tracking-wider text-critical font-700">Critical</div>
            <div className="text-lg font-800 text-critical">{riskCounts.CRITICAL}</div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-critical animate-pulse" />
        </button>

        <button
          onClick={() => {
            setFilterRisk(filterRisk === "HIGH" ? "ALL" : "HIGH");
            setAttentionFilter("ALL");
          }}
          className={cn(
            "p-2.5 rounded-lg border text-left transition-all flex items-center justify-between",
            filterRisk === "HIGH"
              ? "border-amber-500 bg-amber-500/10 shadow-xs"
              : "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
          )}
        >
          <div>
            <div className="text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-700">High Risk</div>
            <div className="text-lg font-800 text-amber-600 dark:text-amber-400">{riskCounts.HIGH}</div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
        </button>

        <button
          onClick={() => {
            setFilterRisk(filterRisk === "MODERATE" ? "ALL" : "MODERATE");
            setAttentionFilter("ALL");
          }}
          className={cn(
            "p-2.5 rounded-lg border text-left transition-all flex items-center justify-between",
            filterRisk === "MODERATE"
              ? "border-yellow-500 bg-yellow-500/10 shadow-xs"
              : "border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10"
          )}
        >
          <div>
            <div className="text-[11px] uppercase tracking-wider text-yellow-600 dark:text-yellow-400 font-700">Moderate</div>
            <div className="text-lg font-800 text-yellow-600 dark:text-yellow-400">{riskCounts.MODERATE}</div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
        </button>

        <button
          onClick={() => {
            setFilterRisk(filterRisk === "LOW" ? "ALL" : "LOW");
            setAttentionFilter("ALL");
          }}
          className={cn(
            "p-2.5 rounded-lg border text-left transition-all flex items-center justify-between col-span-2 sm:col-span-1",
            filterRisk === "LOW"
              ? "border-safe bg-safe/10 shadow-xs"
              : "border-safe/30 bg-safe/5 hover:bg-safe/10"
          )}
        >
          <div>
            <div className="text-[11px] uppercase tracking-wider text-safe font-700">Safe / Low</div>
            <div className="text-lg font-800 text-safe">{riskCounts.LOW}</div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-safe" />
        </button>
      </div>

      {/* Filter and Quick Action Toolbar */}
      <div className="card p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search size={14} className="text-text-muted flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, cargo, route, vehicle..."
            className="bg-transparent text-xs text-text placeholder:text-text-muted outline-none flex-1"
            aria-label="Search shipments"
          />
        </div>

        {/* Quick Toggles: All | Needs Attention | Critical | Safe */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-md border border-border text-xs">
          <button
            onClick={() => setAttentionFilter("ALL")}
            className={cn(
              "px-2.5 py-1 rounded font-500 transition-colors",
              attentionFilter === "ALL" ? "bg-card text-text shadow-xs font-600" : "text-text-muted hover:text-text"
            )}
          >
            All
          </button>
          <button
            onClick={() => setAttentionFilter("ATTENTION")}
            className={cn(
              "px-2.5 py-1 rounded font-500 transition-colors flex items-center gap-1",
              attentionFilter === "ATTENTION"
                ? "bg-critical/15 text-critical font-600"
                : "text-text-muted hover:text-critical"
            )}
          >
            <ShieldAlert size={12} />
            Needs attention
          </button>
          <button
            onClick={() => setAttentionFilter("CRITICAL")}
            className={cn(
              "px-2.5 py-1 rounded font-500 transition-colors",
              attentionFilter === "CRITICAL" ? "bg-critical text-white font-600" : "text-text-muted hover:text-text"
            )}
          >
            Critical
          </button>
          <button
            onClick={() => setAttentionFilter("SAFE")}
            className={cn(
              "px-2.5 py-1 rounded font-500 transition-colors",
              attentionFilter === "SAFE" ? "bg-safe/20 text-safe font-600" : "text-text-muted hover:text-text"
            )}
          >
            Safe
          </button>
        </div>

        {/* Cargo Dropdown & Clear Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={12} className="text-text-muted" />
          <select
            value={filterCargo}
            onChange={(e) => setFilterCargo(e.target.value as CargoType | "ALL")}
            className="text-xs border border-border rounded px-2 py-1 bg-surface text-text outline-none hover:border-primary/50 transition-colors"
            aria-label="Filter by cargo"
          >
            <option value="ALL">All Cargo</option>
            <option value="biologics">Biologics</option>
            <option value="vaccines">Vaccines</option>
            <option value="dairy">Dairy</option>
            <option value="fresh_produce">Fresh Produce</option>
            <option value="frozen_food">Frozen Food</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ShipmentStatus | "ALL")}
            className="text-xs border border-border rounded px-2 py-1 bg-surface text-text outline-none hover:border-primary/50 transition-colors"
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="ON_TIME">On Time</option>
            <option value="DELAYED">Delayed</option>
            <option value="AT_RISK">At Risk</option>
            <option value="CRITICAL">Critical</option>
          </select>

          {(filterRisk !== "ALL" || filterCargo !== "ALL" || filterStatus !== "ALL" || attentionFilter !== "ALL" || search) && (
            <button
              onClick={() => {
                setFilterRisk("ALL");
                setFilterCargo("ALL");
                setFilterStatus("ALL");
                setAttentionFilter("ALL");
                setSearch("");
              }}
              className="text-xs text-critical hover:underline flex items-center gap-1"
            >
              <RefreshCw size={10} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* FOCUS MODE VIEW */}
      {viewMode === "focus" && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-lg border border-critical/40 bg-critical/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-critical/20 text-critical animate-pulse">
                <Zap size={18} />
              </div>
              <div>
                <h2 className="text-sm font-700 text-critical flex items-center gap-2">
                  ⚡ ATTENTION REQUIRED
                </h2>
                <p className="text-xs text-text-muted">
                  {filtered.length} shipment{filtered.length === 1 ? "" : "s"} require operational intervention right now.
                </p>
              </div>
            </div>
            <button
              onClick={() => setViewMode("table")}
              className="text-xs text-text-muted hover:text-text underline"
            >
              Exit Focus Mode
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="card p-8 text-center text-text-muted space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-safe opacity-80" />
              <p className="text-sm font-600 text-text">All quiet on the cold chain!</p>
              <p className="text-xs">No shipments currently meet critical or high attention criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((s) => {
                const risk = s.prediction?.risk_score ?? (s.status === "CRITICAL" ? 85 : 65);
                const band = s.prediction?.risk_band ?? getRiskBand(risk);
                const safeWin = s.prediction?.safe_window_minutes ?? s.remainingTransitMin;
                const tempOk = s.temperature >= s.safeRangeMin && s.temperature <= s.safeRangeMax;
                const hasActiveAlert = alerts.some((a) => a.shipmentId === s.id && a.status === "active");

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "card p-4 space-y-3 relative border-l-4 transition-all hover:shadow-md",
                      band === "CRITICAL" ? "border-l-critical bg-critical/5" : "border-l-amber-500 bg-amber-500/5"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-800 text-sm text-text" style={{ fontWeight: 800 }}>{s.id}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-600 bg-surface border border-border text-text-muted">
                            {getCargoLabel(s.cargoType)}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">{s.origin} → {s.destination}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className="text-xs font-700 px-2 py-0.5 rounded uppercase tracking-wide"
                          style={{ color: getRiskTextColor(band), background: getRiskBgColor(band) }}
                        >
                          {band} · {risk}%
                        </span>
                      </div>
                    </div>

                    {/* Urgent Safe Window Countdown */}
                    <div className="p-2.5 rounded-md bg-surface/80 border border-border flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <Clock size={14} className="text-critical animate-pulse" />
                        <span className="text-text-muted font-500">Safe Window:</span>
                      </div>
                      <span className="text-sm font-800 text-critical" style={{ fontWeight: 800 }}>
                        {formatMinutes(safeWin)} remaining
                      </span>
                    </div>

                    {/* Condition details */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-surface border border-border">
                        <div className="text-[10px] text-text-muted">Temperature</div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className={cn("font-700 text-sm", tempOk ? "text-safe" : "text-critical")}>
                            {s.temperature}°C
                          </span>
                          {!tempOk && <span className="text-[10px] text-critical font-600">⚠ excursion</span>}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-surface border border-border">
                        <div className="text-[10px] text-text-muted">Humidity / ETA</div>
                        <div className="font-600 text-text mt-0.5">
                          {s.humidity}% · {formatETA(s.eta)}
                        </div>
                      </div>
                    </div>

                    {/* AI Prediction summary */}
                    <div className="text-xs text-text-muted space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-600 text-primary">
                        <Sparkles size={12} /> AI Prediction & Risk Driver
                      </div>
                      <p className="line-clamp-2 italic text-[11px]">
                        {s.prediction?.recommendation || `Critical temperature elevation predicted within ${Math.min(safeWin, 30)} min.`}
                      </p>
                    </div>

                    {/* Quick actions */}
                    <div className="pt-2 border-t border-border flex items-center gap-2">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="flex-1 py-1.5 px-2 rounded text-center text-xs font-600 bg-surface hover:bg-surface/80 border border-border transition-colors flex items-center justify-center gap-1"
                      >
                        <Eye size={12} /> View Shipment
                      </Link>
                      <Link
                        href={`/simulator?shipment=${s.id}`}
                        className="flex-1 py-1.5 px-2 rounded text-center text-xs font-600 bg-primary text-primary-contrast hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                      >
                        <FlaskConical size={12} /> Take Action
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TABLE VIEW (PROGRESSIVE DISCLOSURE) */}
      {viewMode === "table" && (
        <div className="card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface border-b border-border text-text-muted font-600 uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => handleSort("id")} className="flex items-center hover:text-text transition-colors">
                      Shipment & Cargo <SortIcon k="id" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => handleSort("temperature")} className="flex items-center hover:text-text transition-colors">
                      Condition <SortIcon k="temperature" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => handleSort("risk")} className="flex items-center hover:text-text transition-colors">
                      Risk Band <SortIcon k="risk" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => handleSort("safeWindow")} className="flex items-center hover:text-text transition-colors">
                      Safe Window <SortIcon k="safeWindow" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-text-muted">
                      <Search size={32} className="mx-auto text-text-muted/50 mb-2" />
                      <p className="text-sm font-600 text-text">No shipments match your criteria</p>
                      <p className="text-xs">Try clearing search filters or selecting all risk levels.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const isExpanded = expandedShipmentIds.has(s.id);
                    const risk = s.prediction?.risk_score ?? (s.status === "CRITICAL" ? 85 : s.status === "AT_RISK" ? 65 : 30);
                    const band = s.prediction?.risk_band ?? getRiskBand(risk);
                    const safeWin = s.prediction?.safe_window_minutes ?? s.remainingTransitMin;
                    const tempOk = s.temperature >= s.safeRangeMin && s.temperature <= s.safeRangeMax;
                    const hasActiveAlert = alerts.some((a) => a.shipmentId === s.id && a.status === "active");

                    // Trend direction calculation
                    const history = s.tempHistory || [];
                    const lastTemp = history.length >= 2 ? history[history.length - 2].temperature : s.temperature;
                    const tempTrend = s.temperature > lastTemp ? "up" : s.temperature < lastTemp ? "down" : "flat";

                    return (
                      <>
                        {/* LEVEL 1: STREAMLINED SCAN ROW */}
                        <tr
                          key={s.id}
                          onClick={() => toggleExpand(s.id)}
                          className={cn(
                            "cursor-pointer hover:bg-surface/60 transition-colors group select-none",
                            isExpanded ? "bg-surface/80" : "",
                            hasActiveAlert && band === "CRITICAL" ? "bg-critical/5" : ""
                          )}
                        >
                          {/* Chevron expand toggle */}
                          <td className="px-4 py-3 align-middle text-text-muted">
                            <button
                              onClick={(e) => toggleExpand(s.id, e)}
                              className="p-1 rounded hover:bg-surface text-text-muted group-hover:text-text transition-colors"
                              aria-label="Expand row"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </td>

                          {/* Shipment ID & Cargo */}
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-2">
                              {hasActiveAlert && (
                                <span className="w-2 h-2 rounded-full bg-critical flex-shrink-0 animate-pulse" title="Active alert" />
                              )}
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-700 text-text group-hover:text-primary transition-colors" style={{ fontWeight: 700 }}>
                                    {s.id}
                                  </span>
                                </div>
                                <div className="text-[11px] text-text-muted mt-0.5">
                                  {getCargoLabel(s.cargoType)}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Route */}
                          <td className="px-4 py-3 align-middle text-text">
                            <div className="font-500 whitespace-nowrap">{s.origin} → {s.destination}</div>
                            <div className="text-[10px] text-text-muted mt-0.5">{s.vehicleId}</div>
                          </td>

                          {/* Condition (Temp + Trend + Excursion indicator) */}
                          <td className="px-4 py-3 align-middle whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-700 text-sm", tempOk ? "text-safe" : "text-critical font-800")}>
                                {s.temperature.toFixed(1)}°C
                              </span>
                              {tempTrend === "up" && <TrendingUp size={13} className={tempOk ? "text-text-muted" : "text-critical"} />}
                              {tempTrend === "down" && <TrendingDown size={13} className="text-safe" />}
                              {tempTrend === "flat" && <Minus size={12} className="text-text-muted opacity-40" />}

                              {!tempOk && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-critical/15 text-critical font-700 animate-pulse">
                                  ↑ excursion
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-text-muted mt-0.5">
                              Target: {s.safeRangeMin}°C to {s.safeRangeMax}°C
                            </div>
                          </td>

                          {/* Risk (Visual Progress Indicator + Score) */}
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-2 min-w-[140px]">
                              {/* Visual compact signal bar */}
                              <div className="w-12 h-2 rounded-full bg-surface overflow-hidden border border-border/40">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${risk}%`, background: getRiskColor(band) }}
                                />
                              </div>
                              <span
                                className="text-[11px] font-700 px-2 py-0.5 rounded whitespace-nowrap"
                                style={{ color: getRiskTextColor(band), background: getRiskBgColor(band) }}
                              >
                                {band} · {risk}%
                              </span>
                            </div>
                          </td>

                          {/* Safe Window */}
                          <td className="px-4 py-3 align-middle whitespace-nowrap">
                            <div className={cn("font-700 text-xs flex items-center gap-1", safeWin <= 60 ? "text-critical" : "text-text")}>
                              <Clock size={12} className={safeWin <= 60 ? "text-critical animate-pulse" : "text-text-muted"} />
                              {formatMinutes(safeWin)}
                            </div>
                            <div className="text-[10px] text-text-muted mt-0.5">
                              ETA: {formatETA(s.eta)}
                            </div>
                          </td>

                          {/* Action Button */}
                          <td className="px-4 py-3 align-middle text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/shipments/${s.id}`}
                                className="px-2.5 py-1 rounded border border-border bg-surface text-text hover:border-primary/50 hover:text-primary transition-colors font-500 inline-flex items-center gap-1"
                              >
                                View <ChevronRight size={12} />
                              </Link>
                              <button
                                onClick={(e) => toggleExpand(s.id, e)}
                                className={cn(
                                  "p-1 rounded border transition-colors",
                                  isExpanded ? "bg-primary/10 border-primary text-primary" : "border-border text-text-muted hover:text-text"
                                )}
                                title={isExpanded ? "Collapse inline view" : "Expand inline view"}
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* LEVEL 2: EXPANDABLE INLINE PANEL */}
                        {isExpanded && (
                          <tr className="bg-surface/90 border-b-2 border-border/80">
                            <td colSpan={7} className="px-6 py-4">
                              <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.2 }}
                                className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"
                              >
                                {/* Box 1: Condition & Environmental Telemetry */}
                                <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                                    <span className="font-700 text-text flex items-center gap-1.5">
                                      <Activity size={13} className="text-primary" /> Live Environmental Telemetry
                                    </span>
                                    <span className={cn("text-[10px] font-700 px-1.5 py-0.5 rounded", tempOk ? "bg-safe/20 text-safe" : "bg-critical/20 text-critical")}>
                                      {tempOk ? "SAFE RANGE" : "EXCURSION"}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                                    <div>
                                      <span className="text-text-muted">Temperature:</span>
                                      <div className="font-700 text-text">{s.temperature}°C (Target: {s.safeRangeMin}–{s.safeRangeMax}°C)</div>
                                    </div>
                                    <div>
                                      <span className="text-text-muted">Humidity:</span>
                                      <div className="font-700 text-text">{s.humidity}%</div>
                                    </div>
                                    <div>
                                      <span className="text-text-muted">Safe Window:</span>
                                      <div className="font-700 text-critical">{formatMinutes(safeWin)} remaining</div>
                                    </div>
                                    <div>
                                      <span className="text-text-muted">ETA & Delay:</span>
                                      <div className="font-700 text-text">{formatETA(s.eta)} ({s.delayMinutes > 0 ? `+${s.delayMinutes}m delay` : "On schedule"})</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Box 2: AI Risk Prediction & Factors */}
                                <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                                    <span className="font-700 text-text flex items-center gap-1.5">
                                      <Sparkles size={13} className="text-primary" /> AI Predictive Risk Model
                                    </span>
                                    <span className="text-[10px] text-text-muted font-500">v2.4 XGBoost</span>
                                  </div>
                                  <p className="text-[11px] text-text-muted leading-relaxed">
                                    {s.prediction?.recommendation || `AI predicts ${band.toLowerCase()} spoilage probability based on current refrigeration slope & traffic patterns.`}
                                  </p>
                                  {s.prediction?.risk_factors && s.prediction.risk_factors.length > 0 && (
                                    <div className="text-[10px] bg-surface p-1.5 rounded border border-border/50 text-text-muted">
                                      <span className="font-600 text-text">Primary Risk Factor:</span> {s.prediction.risk_factors[0].description}
                                    </div>
                                  )}
                                </div>

                                {/* Box 3: Quick Action Console */}
                                <div className="p-3 rounded-lg border border-border bg-card space-y-2 flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                                      <span className="font-700 text-text flex items-center gap-1.5">
                                        <Zap size={13} className="text-primary" /> Action Console
                                      </span>
                                      <span className="text-[10px] text-text-muted">{s.vehicleId}</span>
                                    </div>
                                    <p className="text-[11px] text-text-muted mt-1.5">
                                      Simulate interventions or open full telemetry dashboard for detailed route historical charts.
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2 pt-2">
                                    <Link
                                      href={`/shipments/${s.id}`}
                                      className="flex-1 py-1.5 px-3 rounded text-center text-xs font-600 border border-border bg-surface hover:bg-surface/80 transition-colors flex items-center justify-center gap-1"
                                    >
                                      <Eye size={13} /> Full Telemetry
                                    </Link>
                                    <Link
                                      href={`/simulator?shipment=${s.id}`}
                                      className="flex-1 py-1.5 px-3 rounded text-center text-xs font-600 bg-primary text-primary-contrast hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                                    >
                                      <FlaskConical size={13} /> Simulate Action
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
                                        className="py-1.5 px-2.5 rounded text-xs font-600 border border-safe/40 bg-safe/10 text-safe hover:bg-safe/20 transition-colors"
                                        title="Acknowledge active alert"
                                      >
                                        <CheckCircle2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 border-t border-border bg-surface text-xs text-text-muted flex items-center justify-between flex-wrap gap-2">
            <span>Showing {filtered.length} of {shipments.length} shipments</span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" /> Click any row to toggle inline progressive disclosure details
            </span>
          </div>
        </div>
      )}

      {isModalOpen && <AddShipmentModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

