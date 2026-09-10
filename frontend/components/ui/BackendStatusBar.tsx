"use client";
import { AlertCircle } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useEffect } from "react";
import { checkHealth } from "@/services/modelService";

export default function BackendStatusBar() {
  const { backendAvailable, setBackendAvailable } = useAppStore();

  useEffect(() => {
    // Initial health check
    checkHealth().then((isUp) => setBackendAvailable(isUp));
  }, [setBackendAvailable]);

  if (backendAvailable) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-warning/10 border-b border-warning/20 flex-shrink-0">
      <AlertCircle size={13} className="text-warning flex-shrink-0" />
      <span className="text-xs text-warning font-500">
        ML model backend unavailable. Start FastAPI: <code className="font-mono bg-warning/10 px-1 rounded">cd backend && uvicorn main:app --reload</code>
      </span>
      <span className="ml-auto text-[11px] text-warning/70">Predictions require backend connection</span>
    </div>
  );
}
