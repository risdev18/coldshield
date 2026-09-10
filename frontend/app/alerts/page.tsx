"use client";
import { useState } from "react";
import Link from "next/link";
import { 
  AlertTriangle, CheckCircle2, ShieldCheck, Clock, Search, Filter 
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/appStore";
import { cn, formatDateTime } from "@/lib/utils";

export default function AlertsPage() {
  const { alerts, acknowledgeAlert, resolveAlert } = useAppStore();
  const [filter, setFilter] = useState<"all" | "active" | "acknowledged" | "resolved">("all");
  const [search, setSearch] = useState("");

  const filteredAlerts = alerts.filter(a => {
    if (filter !== "all" && a.status !== filter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.shipmentId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-5 max-w-[1200px] mx-auto space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-800 text-text" style={{ fontWeight: 800 }}>Alert Center</h1>
          <p className="text-sm text-text-muted mt-0.5">Manage and respond to automated risk alerts.</p>
        </div>
      </div>

      <div className="card p-3 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 border border-border rounded-md">
          <Search size={14} className="text-text-muted" />
          <input 
            type="text" 
            placeholder="Search alerts..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm w-full outline-none bg-transparent"
          />
        </div>
        <div className="flex border border-border rounded-md overflow-hidden">
          {(["all", "active", "acknowledged", "resolved"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 text-xs font-500 capitalize transition-colors border-r border-border last:border-0",
                filter === f ? "bg-primary/10 text-primary" : "bg-white text-text-muted hover:bg-surface"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="card p-12 text-center text-text-muted">
            <ShieldCheck size={48} className="mx-auto mb-3 opacity-50" />
            <p>No alerts found for the current filters.</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div 
              key={alert.id} 
              className={cn(
                "card p-4 border-l-4 transition-all",
                alert.status === "active" ? (alert.severity === "critical" ? "border-l-critical bg-critical/5" : "border-l-warning bg-warning/5") : 
                alert.status === "acknowledged" ? "border-l-primary bg-surface/50" : "border-l-safe opacity-60"
              )}
            >
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-sm font-800" style={{ fontWeight: 800, color: alert.severity === "critical" ? "#E24B4A" : "#F59E0B" }}>
                      <span className={cn("w-2 h-2 rounded-full", alert.severity === "critical" ? "bg-critical" : "bg-warning")} />
                      {alert.severity.toUpperCase()} — {alert.shipmentId}
                    </div>
                    <span className="text-[10px] text-text-light">{formatDateTime(alert.createdAt)}</span>
                  </div>
                  
                  {(() => {
                    const shipment = useAppStore.getState().shipments.find(s => s.id === alert.shipmentId);
                    const risk = shipment?.prediction?.risk_score ?? "High";
                    const safeWin = shipment?.prediction?.safe_window_minutes ?? "Unknown";
                    
                    return (
                      <div className="space-y-1 mt-3">
                        <div className="text-sm font-600 text-text">
                          {risk}{typeof risk === "number" ? "% risk" : " risk"}
                        </div>
                        <div className="text-sm font-600 text-text">
                          {safeWin} min safe window
                        </div>
                        <div className="text-sm text-text-muted mt-2">
                          {alert.recommendation || alert.message}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                <div className="flex flex-col gap-2 min-w-[140px]">
                  <Link 
                    href={`/shipments/${alert.shipmentId}`}
                    className="w-full py-2 bg-white border border-border text-center text-sm font-600 rounded-md hover:bg-surface transition-colors"
                  >
                    View Shipment
                  </Link>
                  {alert.status === "active" && (
                    <button
                      onClick={() => { acknowledgeAlert(alert.id); toast.success("Alert acknowledged"); }}
                      className="w-full py-2 bg-primary text-white text-center text-sm font-600 rounded-md hover:bg-primary-600 transition-colors"
                    >
                      Acknowledge
                    </button>
                  )}
                  {alert.status === "acknowledged" && (
                    <button
                      onClick={() => { resolveAlert(alert.id); toast.success("Alert resolved"); }}
                      className="w-full py-2 bg-safe text-white text-center text-sm font-600 rounded-md hover:bg-safe/80 transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={16} /> Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
