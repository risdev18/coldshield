"use client";

import { useState } from "react";
import { 
  BarChart3, TrendingUp, ShieldCheck, Clock, AlertTriangle, 
  DollarSign, Download, Calendar, Filter, Sparkles, Truck, CheckCircle2
} from "lucide-react";
import { motion } from "framer-motion";
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, 
  YAxis, Tooltip, PieChart, Pie, Cell, Legend 
} from "recharts";
import { useAppStore } from "@/store/appStore";
import { formatRupees, getRiskColor } from "@/lib/utils";

const RISK_TREND_DATA = [
  { time: "06:00", avgRisk: 18, excursions: 1, lossPrevented: 120000 },
  { time: "08:00", avgRisk: 24, excursions: 2, lossPrevented: 350000 },
  { time: "10:00", avgRisk: 31, excursions: 3, lossPrevented: 680000 },
  { time: "12:00", avgRisk: 42, excursions: 5, lossPrevented: 1250000 },
  { time: "14:00", avgRisk: 38, excursions: 4, lossPrevented: 1680000 },
  { time: "16:00", avgRisk: 29, excursions: 2, lossPrevented: 2100000 },
  { time: "18:00", avgRisk: 23, excursions: 1, lossPrevented: 2450000 },
];

const CARGO_LOSS_DATA = [
  { cargo: "Vaccines", prevented: 1850000, color: "#DC3838" },
  { cargo: "Biologics", prevented: 1420000, color: "#E08D03" },
  { cargo: "Dairy", prevented: 650000, color: "#1D9E75" },
  { cargo: "Fresh Produce", prevented: 480000, color: "#5D931E" },
  { cargo: "Frozen Food", prevented: 890000, color: "#2563EB" },
];

const CARRIER_SCORECARDS = [
  { vehicleId: "MH-12-VT-9921", driver: "Rajesh Kumar", route: "Mumbai → Pune", trips: 42, excursions: 1, compliance: "98.4%", rating: "A+" },
  { vehicleId: "DL-01-AX-4410", driver: "Suresh Sharma", route: "Delhi → Jaipur", trips: 38, excursions: 3, compliance: "94.2%", rating: "A" },
  { vehicleId: "KA-04-MB-8812", driver: "Anand Verma", route: "Bengaluru → Chennai", trips: 51, excursions: 0, compliance: "100.0%", rating: "A+" },
  { vehicleId: "MH-04-GP-3319", driver: "Pravin Patil", route: "Mumbai → Nashik", trips: 29, excursions: 4, compliance: "88.6%", rating: "B" },
  { vehicleId: "GJ-06-KL-1102", driver: "Vikram Singh", route: "Ahmedabad → Surat", trips: 47, excursions: 2, compliance: "96.1%", rating: "A" },
];

export default function AnalyticsPage() {
  const { shipments, dashboardMetrics } = useAppStore();
  const [timeRange, setTimeRange] = useState<string>("7d");

  // Calculate dynamic stats
  const totalPrevented = dashboardMetrics.potentialLossPrevented || 2450000;
  const criticalCount = shipments.filter(s => s.status === "CRITICAL" || s.prediction?.risk_band === "CRITICAL").length;
  const highRiskCount = shipments.filter(s => s.status === "AT_RISK" || s.prediction?.risk_band === "HIGH").length;
  const compliantCount = shipments.filter(s => s.temperature >= s.safeRangeMin && s.temperature <= s.safeRangeMax).length;
  const complianceRate = ((compliantCount / (shipments.length || 1)) * 100).toFixed(1);

  return (
    <div className="p-6 max-w-[1380px] mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-700 text-primary uppercase tracking-wider mb-1">
            <BarChart3 size={15} /> Cold-Chain Telematics & Risk Analytics
          </div>
          <h1 className="text-2xl font-800 text-text tracking-tight flex items-center gap-2" style={{ fontWeight: 800 }}>
            Network Analytics & Spoilage Prevention
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Historical thermal compliance trends, carrier reliability scorecards, and financial risk mitigation reporting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-surface p-1 rounded-lg border border-border flex items-center gap-1 text-xs font-600">
            {["24h", "7d", "30d", "90d"].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  timeRange === range
                    ? "bg-[#FAF7F2] text-primary shadow-xs font-700 border border-border"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-600 text-text-muted uppercase tracking-wider">Potential Loss Prevented</span>
            <div className="w-8 h-8 rounded-lg bg-[#5D931E]/10 flex items-center justify-center text-safe">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-800 text-text mb-1" style={{ fontWeight: 800 }}>{formatRupees(totalPrevented)}</div>
          <div className="text-xs text-safe font-600 flex items-center gap-1">
            <TrendingUp size={12} /> +18.4% vs last period
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-600 text-text-muted uppercase tracking-wider">Fleet Compliance Rate</span>
            <div className="w-8 h-8 rounded-lg bg-[#1D9E75]/10 flex items-center justify-center text-teal">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="text-2xl font-800 text-text mb-1" style={{ fontWeight: 800 }}>{complianceRate}%</div>
          <div className="text-xs text-text-muted">{compliantCount} of {shipments.length} trucks in safe temperature range</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-600 text-text-muted uppercase tracking-wider">Avg Intervention Time</span>
            <div className="w-8 h-8 rounded-lg bg-[#E69112]/10 flex items-center justify-center text-primary">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl font-800 text-text mb-1" style={{ fontWeight: 800 }}>14.2 mins</div>
          <div className="text-xs text-text-muted">From anomaly detection to driver notification</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-600 text-text-muted uppercase tracking-wider">Logged Excursions</span>
            <div className="w-8 h-8 rounded-lg bg-[#DC3838]/10 flex items-center justify-center text-critical">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="text-2xl font-800 text-text mb-1" style={{ fontWeight: 800 }}>{criticalCount + highRiskCount} Active</div>
          <div className="text-xs text-critical font-600">{criticalCount} critical, {highRiskCount} high risk</div>
        </motion.div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Trend Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-800 text-base text-text" style={{ fontWeight: 800 }}>Network Risk & Loss Prevention Trend</h3>
              <p className="text-xs text-text-muted">Average network risk index plotted against cumulative saved cargo value.</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={RISK_TREND_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskColorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E69112" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E69112" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#706B61" }} />
                <YAxis tick={{ fontSize: 11, fill: "#706B61" }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#FAF7F2", border: "1px solid #D5CDBE", borderRadius: 8, fontSize: 12 }}
                  formatter={(val: any) => [`${val}%`, "Network Risk Score"]}
                />
                <Area type="monotone" dataKey="avgRisk" stroke="#E69112" strokeWidth={2.5} fill="url(#riskColorGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spoilage Loss Prevention by Cargo */}
        <div className="card p-5 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="font-800 text-base text-text mb-1" style={{ fontWeight: 800 }}>Loss Prevented by Cargo</h3>
            <p className="text-xs text-text-muted mb-4">Rupees saved via AI intervention alerts.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={CARGO_LOSS_DATA} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="cargo" tick={{ fontSize: 10, fill: "#706B61" }} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#FAF7F2", border: "1px solid #D5CDBE", borderRadius: 8, fontSize: 12 }}
                    formatter={(val: any) => [formatRupees(Number(val)), "Prevented Loss"]}
                  />
                  <Bar dataKey="prevented" radius={[0, 6, 6, 0]}>
                    {CARGO_LOSS_DATA.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Carrier Performance Scorecard */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-800 text-base text-text flex items-center gap-2" style={{ fontWeight: 800 }}>
              <Truck size={18} className="text-primary" /> Carrier Compliance Scorecards
            </h3>
            <p className="text-xs text-text-muted">Driver and vehicle thermal reliability ratings based on historical telematics log.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] text-text-muted uppercase tracking-wider">
                <th className="py-2.5 px-3">Vehicle ID</th>
                <th className="py-2.5 px-3">Driver Name</th>
                <th className="py-2.5 px-3">Primary Route</th>
                <th className="py-2.5 px-3">Trips Completed</th>
                <th className="py-2.5 px-3">Thermal Excursions</th>
                <th className="py-2.5 px-3">Compliance Rate</th>
                <th className="py-2.5 px-3 text-right">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {CARRIER_SCORECARDS.map((c) => (
                <tr key={c.vehicleId} className="hover:bg-surface/50 transition-colors">
                  <td className="py-3 px-3 font-700 font-mono text-text">{c.vehicleId}</td>
                  <td className="py-3 px-3 font-600 text-text">{c.driver}</td>
                  <td className="py-3 px-3 text-text-muted">{c.route}</td>
                  <td className="py-3 px-3 font-mono text-text">{c.trips}</td>
                  <td className="py-3 px-3 font-mono">
                    <span className={c.excursions > 2 ? "text-critical font-700" : "text-text font-600"}>
                      {c.excursions}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-700 text-safe">{c.compliance}</td>
                  <td className="py-3 px-3 text-right font-800 font-mono text-primary">{c.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
