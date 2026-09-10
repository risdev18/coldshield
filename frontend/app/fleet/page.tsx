"use client";
import { useEffect, useState } from "react";
import { Map, Truck, Navigation, Route } from "lucide-react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/store/appStore";

const LiveMap = dynamic(() => import("@/components/map/LiveMap"), { ssr: false });

export default function FleetPage() {
  const { shipments } = useAppStore();
  const [mapHeight, setMapHeight] = useState<number>(600);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setMapHeight(window.innerHeight - 120);
      const handleResize = () => setMapHeight(window.innerHeight - 120);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);
  
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-4 bg-white border-b border-border flex items-center justify-between z-10 flex-shrink-0">
        <div>
          <h1 className="text-lg font-800 text-text flex items-center gap-2" style={{ fontWeight: 800 }}>
            <Map className="text-primary" /> Demo Fleet Tracking
          </h1>
          <p className="text-xs text-text-muted mt-1">Real-time GPS positioning of all active shipments.</p>
        </div>
        <div className="flex gap-2">
           <div className="px-3 py-1.5 bg-surface-raised border border-border rounded text-xs font-500 flex items-center gap-2">
             <Truck size={14} className="text-text-muted" />
             {shipments.filter(s => s.status !== "DELIVERED").length} Active Vehicles
           </div>
        </div>
      </div>
      <div className="flex-1 relative">
        <LiveMap shipments={shipments} height={mapHeight} />
      </div>
    </div>
  );
}
