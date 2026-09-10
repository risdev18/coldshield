"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Package, Map, AlertTriangle, BarChart3,
  Settings, User, Bell, Search, ChevronLeft, ChevronRight,
  Thermometer, Zap, FlaskConical, Activity, Boxes, X,
  ShieldCheck, CheckCircle2, Clock, TrendingUp, Navigation,
} from "lucide-react";
import { useAppStore, selectUnreadCount } from "@/store/appStore";
import { cn, formatDateTime, getRiskColor } from "@/lib/utils";
import { checkHealth } from "@/services/modelService";
import DemoModeBar from "@/components/demo/DemoModeBar";
import BackendStatusBar from "@/components/ui/BackendStatusBar";
import ColdStorageFinderModal from "@/components/facilities/ColdStorageFinderModal";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/shipments", label: "Shipments", icon: Package },
  { href: "/fleet", label: "Demo Fleet", icon: Map },
  { href: "/risk", label: "Risk Intelligence", icon: Activity },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/cargo", label: "Cargo", icon: Boxes },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/simulator", label: "What-If Simulator", icon: FlaskConical },
];

const BOTTOM_NAV = [
  { href: "/model", label: "Model & Data", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [coldStorageOpen, setColdStorageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { notifications, markNotificationsRead, shipments, backendAvailable, setBackendAvailable } =
    useAppStore();
  const unread = useAppStore(selectUnreadCount);
  const [modelOpen, setModelOpen] = useState(false);

  // Is landing page — show minimal layout
  const isLanding = pathname === "/";

  // Health check on mount
  useEffect(() => {
    checkHealth().then(setBackendAvailable);
    const interval = setInterval(() => checkHealth().then(setBackendAvailable), 30000);
    return () => clearInterval(interval);
  }, [setBackendAvailable]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setModelOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (isLanding) {
    return <>{children}</>;
  }

  const searchResults = searchQuery.length >= 2
    ? shipments
        .filter(
          (s) =>
            s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.cargoName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.vehicleId.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 8)
    : [];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-[#FAF7F2] transition-all duration-200 ease-in-out flex-shrink-0",
          collapsed ? "w-14" : "w-56"
        )}
        style={{ zIndex: 30 }}
      >
        {/* Shield Logo */}
        <div className={cn("flex items-center gap-3 px-3.5 py-4 border-b border-border bg-[#F5F2EA]/80", collapsed && "justify-center px-2")}>
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-[#C87300] via-[#E69112] to-[#F5AE40] shadow-sm flex-shrink-0">
            <ShieldCheck size={20} className="text-white drop-shadow-xs" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#1D9E75] border-2 border-[#FAF7F2]" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-base font-800 text-text tracking-tight flex items-center gap-1.5" style={{ fontWeight: 800 }}>
                ChillShield
                <span className="text-[9px] font-800 px-1.5 py-0.5 rounded bg-[#E69112]/15 text-[#C87300] border border-[#E69112]/30 uppercase tracking-widest">
                  AI
                </span>
              </div>
              <div className="text-[10px] text-text-muted font-600 tracking-wide uppercase">Cold-Chain Control</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn("sidebar-item", active && "active")}
                title={collapsed ? label : undefined}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom nav */}
        <div className="border-t border-border py-2 px-2 space-y-1">
          {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn("sidebar-item", active && "active")}
                title={collapsed ? label : undefined}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="sidebar-item w-full"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-[#FAF7F2]/90 backdrop-blur-md flex-shrink-0" style={{ height: 56 }}>
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border border-border bg-surface/70 text-text-muted text-sm hover:border-primary/60 hover:bg-surface transition-all flex-1 max-w-sm shadow-2xs"
            aria-label="Search shipments (Ctrl+K)"
          >
            <Search size={15} className="text-text-muted" />
            <span className="text-xs font-500">Search shipments, cargo, routes...</span>
            <kbd className="ml-auto text-[10px] bg-surface-raised px-1.5 py-0.5 rounded border border-border font-mono text-text font-600">⌘K</kbd>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface text-xs font-600 border border-border">
              <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
              <span className="text-text font-600 text-[11px] tracking-wide uppercase">LIVE TELEMETRY</span>
            </div>

            {/* Cold Storage Finder Button */}
            <button
              onClick={() => setColdStorageOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-700 bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
              title="Find nearest cold storage using Driver GPS or shipment position"
            >
              <Navigation size={12} className="text-sky-500" />
              <span>COLD STORAGE FINDER</span>
            </button>

            {/* AI Active Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-700 bg-primary/10 text-primary border border-primary/20 font-mono">
              <Thermometer size={12} className="text-primary" />
              <span>AI ENGINES ACTIVE</span>
            </div>

            {/* Notifications */}
            <button
              onClick={() => {
                setNotifOpen(!notifOpen);
                if (!notifOpen) markNotificationsRead();
              }}
              className="relative p-2 rounded-md hover:bg-surface transition-colors"
              aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
            >
              <Bell size={16} className="text-text-muted" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-critical text-white text-[9px] font-bold flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>

            {/* Profile */}
            <div className="flex items-center gap-2 pl-2 border-l border-border ml-1">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <User size={13} className="text-white" />
              </div>
              {!collapsed && (
                <div className="hidden sm:block">
                  <div className="text-xs font-600 text-text" style={{ fontWeight: 600 }}>Ops Manager</div>
                  <div className="text-[10px] text-text-muted">Mumbai Hub</div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Demo mode bar */}
        <DemoModeBar />

        {/* Backend warning */}
        {!backendAvailable && <BackendStatusBar />}

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* ── Notification Panel ── */}
      {notifOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setNotifOpen(false)}>
          <div
            className="absolute right-4 top-14 w-80 bg-white border border-border rounded-lg shadow-panel overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-600 text-sm text-text" style={{ fontWeight: 600 }}>Notifications</span>
              <button onClick={() => setNotifOpen(false)} className="p-1 rounded hover:bg-surface">
                <X size={14} className="text-text-muted" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-text-muted text-sm">No notifications</div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "px-4 py-3 hover:bg-surface cursor-pointer transition-colors relative group",
                      !n.read && "bg-primary/5"
                    )}
                    onClick={() => {
                      if (n.shipmentId) router.push(`/shipments/${n.shipmentId}`);
                      setNotifOpen(false);
                    }}
                  >
                    {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-800 text-critical" style={{ fontWeight: 800 }}>
                        <span className="w-2 h-2 rounded-full bg-critical" /> CRITICAL — {n.shipmentId}
                      </div>
                      <div className="text-[10px] text-text-light">{formatDateTime(n.timestamp)}</div>
                    </div>
                    <div className="text-xs font-600 text-text mb-0.5">
                      99.81% risk
                    </div>
                    <div className="text-xs font-600 text-text mb-1">
                      21 min safe window
                    </div>
                    <div className="text-xs text-text-muted mb-2">
                      Cooling-unit inspection recommended.
                    </div>
                    <div className="text-xs font-600 text-primary group-hover:underline">
                      View Shipment →
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Search Modal ── */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/20"
          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-xl border border-border shadow-panel overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search size={16} className="text-text-muted flex-shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shipment ID, cargo, origin, destination..."
                className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
                aria-label="Search"
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                <X size={14} className="text-text-muted" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {searchQuery.length < 2 ? (
                <div className="p-4 text-xs text-text-muted">Type at least 2 characters to search</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-sm text-text-muted text-center">No shipments match &quot;{searchQuery}&quot;</div>
              ) : (
                <div className="divide-y divide-border">
                  {searchResults.map((s) => {
                    const band = s.prediction?.risk_band || (s.status === "CRITICAL" ? "CRITICAL" : s.status === "AT_RISK" ? "HIGH" : "MODERATE");
                    return (
                      <button
                        key={s.id}
                        className="w-full text-left px-4 py-3 hover:bg-surface transition-colors"
                        onClick={() => {
                          router.push(`/shipments/${s.id}`);
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-600 text-sm text-text" style={{ fontWeight: 600 }}>{s.id}</span>
                            <span className="text-xs text-text-muted ml-2">{s.cargoName}</span>
                          </div>
                          <span
                            className="text-xs font-600 px-1.5 py-0.5 rounded"
                            style={{
                              fontWeight: 600,
                              color: getRiskColor(band as "LOW" | "MODERATE" | "HIGH" | "CRITICAL"),
                              background: `${getRiskColor(band as "LOW" | "MODERATE" | "HIGH" | "CRITICAL")}15`,
                            }}
                          >
                            {band}
                          </span>
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">
                          {s.origin} → {s.destination} · {s.temperature}°C · {s.vehicleId}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cold Storage Finder Modal ── */}
      {coldStorageOpen && (
        <ColdStorageFinderModal onClose={() => setColdStorageOpen(false)} />
      )}
    </div>
  );
}
