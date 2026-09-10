"use client";

import { useState } from "react";
import { 
  Boxes, ShieldAlert, Thermometer, Layers, Plus, Filter, 
  Sparkles, CheckCircle2, AlertTriangle, Snowflake, ArrowUpRight, Search
} from "lucide-react";
import { motion } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from "recharts";
import { useAppStore } from "@/store/appStore";
import { formatRupees, getRiskColor, getRiskBgColor } from "@/lib/utils";
import type { CargoType } from "@/lib/types";

// Static cargo metadata catalog
const CARGO_PROFILES: Record<CargoType, {
  name: string;
  category: string;
  tempRange: string;
  minTemp: number;
  maxTemp: number;
  humidityRange: string;
  maxExcursionMin: number;
  sensitivity: "HIGH" | "CRITICAL" | "MODERATE";
  description: string;
  avgValuePerTruck: number;
}> = {
  biologics: {
    name: "Biologics & Plasma",
    category: "Pharmaceuticals",
    tempRange: "2.0°C – 8.0°C",
    minTemp: 2.0,
    maxTemp: 8.0,
    humidityRange: "45% – 65%",
    maxExcursionMin: 30,
    sensitivity: "CRITICAL",
    description: "Monoclonal antibodies, blood plasma, and gene therapy vectors requiring strict thermal stability.",
    avgValuePerTruck: 4500000, // ₹45 Lakhs
  },
  vaccines: {
    name: "mRNA & Viral Vaccines",
    category: "Pharmaceuticals",
    tempRange: "2.0°C – 8.0°C",
    minTemp: 2.0,
    maxTemp: 8.0,
    humidityRange: "40% – 60%",
    maxExcursionMin: 45,
    sensitivity: "CRITICAL",
    description: "Cold-chain vaccines requiring continuous temperature validation during inter-state transport.",
    avgValuePerTruck: 6000000, // ₹60 Lakhs
  },
  dairy: {
    name: "Specialty Dairy & Butter",
    category: "Perishable Food",
    tempRange: "1.0°C – 4.0°C",
    minTemp: 1.0,
    maxTemp: 4.0,
    humidityRange: "70% – 85%",
    maxExcursionMin: 90,
    sensitivity: "MODERATE",
    description: "Pasteurized milk, artisan cheese, and butter susceptible to bacterial growth upon warming.",
    avgValuePerTruck: 1200000, // ₹12 Lakhs
  },
  fresh_produce: {
    name: "High-Value Fresh Produce",
    category: "Agriculture",
    tempRange: "4.0°C – 10.0°C",
    minTemp: 4.0,
    maxTemp: 10.0,
    humidityRange: "80% – 95%",
    maxExcursionMin: 120,
    sensitivity: "MODERATE",
    description: "Exotic fruits and organic berries sensitive to chilling injury and rapid respiration degradation.",
    avgValuePerTruck: 850000, // ₹8.5 Lakhs
  },
  frozen_food: {
    name: "Deep Frozen Foods",
    category: "Frozen Logistics",
    tempRange: "-20.0°C – -15.0°C",
    minTemp: -20.0,
    maxTemp: -15.0,
    humidityRange: "N/A",
    maxExcursionMin: 60,
    sensitivity: "HIGH",
    description: "Frozen seafood, meats, and ice creams requiring sub-zero refrigeration.",
    avgValuePerTruck: 1500000, // ₹15 Lakhs
  },
};

const SENSITIVITY_COLORS = {
  CRITICAL: "#DC3838",
  HIGH: "#E08D03",
  MODERATE: "#5D931E",
};

export default function CargoPage() {
  const { shipments } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Compute cargo stats from active shipments
  const activeCargoTypes = Array.from(new Set(shipments.map(s => s.cargoType)));
  const totalCargoValue = shipments.reduce((sum, s) => sum + (s.estimatedValue || 1500000), 0);
  const criticalCargoCount = shipments.filter(s => CARGO_PROFILES[s.cargoType]?.sensitivity === "CRITICAL").length;

  // Chart data: Shipments count by cargo profile
  const chartData = Object.entries(CARGO_PROFILES).map(([type, profile]) => {
    const count = shipments.filter(s => s.cargoType === type).length;
    return {
      name: profile.name.split("&")[0].trim(),
      type,
      count,
      value: profile.avgValuePerTruck / 100000, // in Lakhs
    };
  });

  const filteredShipments = shipments.filter(s => {
    const matchCat = selectedCategory === "ALL" || s.cargoType === selectedCategory;
    const matchSearch = s.cargoName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        s.cargoType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 max-w-[1380px] mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-700 text-primary uppercase tracking-wider mb-1">
            <Boxes size={15} /> Cargo Sensitivity & Inventory Rules
          </div>
          <h1 className="text-2xl font-800 text-text tracking-tight flex items-center gap-2" style={{ fontWeight: 800 }}>
            Cargo Catalog & Thermal Thresholds
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Define safe temperature bands, excursion tolerances, and monetary risk profiles across cold-chain inventory.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-600 text-text-muted uppercase tracking-wider">Cargo Profiles</span>
            <div className="w-8 h-8 rounded-lg bg-[#E69112]/10 flex items-center justify-center text-primary">
              <Layers size={18} />
            </div>
          </div>
          <div className="text-2xl font-800 text-text mb-1" style={{ fontWeight: 800 }}>{Object.keys(CARGO_PROFILES).length} Types</div>
          <div className="text-xs text-text-muted">Standard temperature categories configured</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-600 text-text-muted uppercase tracking-wider">Monitored Inventory</span>
            <div className="w-8 h-8 rounded-lg bg-[#1D9E75]/10 flex items-center justify-center text-teal">
              <Boxes size={18} />
            </div>
          </div>
          <div className="text-2xl font-800 text-text mb-1" style={{ fontWeight: 800 }}>{formatRupees(totalCargoValue)}</div>
          <div className="text-xs text-text-muted">Active cargo value under telemetry</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-600 text-text-muted uppercase tracking-wider">Critical Sensitivity</span>
            <div className="w-8 h-8 rounded-lg bg-[#DC3838]/10 flex items-center justify-center text-critical">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="text-2xl font-800 text-text mb-1" style={{ fontWeight: 800 }}>{criticalCargoCount} Shipments</div>
          <div className="text-xs text-critical font-500">Requires &lt;30m excursion response</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-600 text-text-muted uppercase tracking-wider">Active Categories</span>
            <div className="w-8 h-8 rounded-lg bg-[#5D931E]/10 flex items-center justify-center text-safe">
              <Snowflake size={18} />
            </div>
          </div>
          <div className="text-2xl font-800 text-text mb-1" style={{ fontWeight: 800 }}>{activeCargoTypes.length} Active</div>
          <div className="text-xs text-text-muted">Currently deployed across 25 routes</div>
        </motion.div>
      </div>

      {/* Cargo Profiles Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-700 text-text flex items-center gap-2" style={{ fontWeight: 700 }}>
            <Thermometer size={18} className="text-primary" /> Cargo Thermal Specifications
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(Object.entries(CARGO_PROFILES) as [CargoType, typeof CARGO_PROFILES[CargoType]][]).map(([type, profile], idx) => {
            const count = shipments.filter(s => s.cargoType === type).length;
            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="card p-5 relative overflow-hidden flex flex-col justify-between hover:border-primary/60 transition-all shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-700 px-2.5 py-1 rounded-full uppercase tracking-wider border"
                      style={{
                        color: SENSITIVITY_COLORS[profile.sensitivity],
                        backgroundColor: `${SENSITIVITY_COLORS[profile.sensitivity]}12`,
                        borderColor: `${SENSITIVITY_COLORS[profile.sensitivity]}30`,
                      }}
                    >
                      {profile.sensitivity} SENSITIVITY
                    </span>
                    <span className="text-xs font-600 text-text-muted bg-surface px-2.5 py-1 rounded-md border border-border">
                      {count} active trucks
                    </span>
                  </div>

                  <h3 className="font-800 text-lg text-text mb-1" style={{ fontWeight: 800 }}>{profile.name}</h3>
                  <p className="text-xs text-text-muted mb-4 leading-relaxed">{profile.description}</p>

                  <div className="space-y-2 text-xs bg-surface/70 p-3.5 rounded-lg border border-border/80">
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted font-500">Safe Temperature Range</span>
                      <span className="font-700 text-text font-mono">{profile.tempRange}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted font-500">Humidity Requirement</span>
                      <span className="font-600 text-text font-mono">{profile.humidityRange}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted font-500">Max Allowed Excursion Window</span>
                      <span className="font-700 text-critical font-mono">{profile.maxExcursionMin} mins</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-text-muted">Avg Truck Value:</span>
                  <span className="font-700 text-text">{formatRupees(profile.avgValuePerTruck)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Cargo Distribution & Live Inventory Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution Chart */}
        <div className="card p-5 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="font-700 text-text text-base mb-1" style={{ fontWeight: 700 }}>Fleet Cargo Distribution</h3>
            <p className="text-xs text-text-muted mb-4">Breakdown of active telemetry units by cargo profile.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#706B61" }} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: "#706B61" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#FAF7F2", border: "1px solid #D5CDBE", borderRadius: 8, fontSize: 12 }}
                    formatter={(val: any) => [`${val} shipments`, "Active Count"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#E69112" : "#1D9E75"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Live Inventory List */}
        <div className="card p-5 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-700 text-text text-base" style={{ fontWeight: 700 }}>Monitored Shipments by Cargo</h3>
              <p className="text-xs text-text-muted">Real-time temperature and status for active inventory.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Filter cargo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-surface border border-border rounded-lg outline-none focus:border-primary w-40"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] text-text-muted uppercase tracking-wider">
                  <th className="py-2.5 px-3">Shipment</th>
                  <th className="py-2.5 px-3">Cargo Name</th>
                  <th className="py-2.5 px-3">Current Temp</th>
                  <th className="py-2.5 px-3">Allowed Band</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Cargo Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {filteredShipments.slice(0, 8).map((s) => {
                  const isExcursion = s.temperature > s.safeRangeMax || s.temperature < s.safeRangeMin;
                  const profile = CARGO_PROFILES[s.cargoType];
                  return (
                    <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3 px-3 font-700 font-mono text-text">{s.id}</td>
                      <td className="py-3 px-3 font-600 text-text">{s.cargoName}</td>
                      <td className="py-3 px-3">
                        <span className={`font-mono font-700 ${isExcursion ? "text-critical" : "text-safe"}`}>
                          {s.temperature}°C
                        </span>
                        {isExcursion && (
                          <span className="ml-1 text-[10px] text-critical font-500">Excursion</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-text-muted font-mono">{s.safeRangeMin}°C – {s.safeRangeMax}°C</td>
                      <td className="py-3 px-3">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-700 uppercase"
                          style={{
                            color: getRiskColor(s.prediction?.risk_band || "LOW"),
                            backgroundColor: getRiskBgColor(s.prediction?.risk_band || "LOW"),
                          }}
                        >
                          {s.prediction?.risk_band || "LOW"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-600 text-text font-mono">
                        {formatRupees(s.estimatedValue || profile?.avgValuePerTruck || 1500000)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
