import { BarChart3, LineChart, PieChart } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="p-5 max-w-[1200px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text flex items-center gap-2" style={{ fontWeight: 800 }}>
          <BarChart3 className="text-primary" /> Network Analytics
        </h1>
        <p className="text-sm text-text-muted mt-1">Reporting and historical performance metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6 h-64 flex flex-col items-center justify-center text-center">
           <LineChart size={48} className="text-text-light mb-4" />
           <h3 className="font-700 text-text mb-2">Carrier Performance</h3>
           <p className="text-sm text-text-muted">Module currently in beta. Expected in v2.0.</p>
        </div>
        <div className="card p-6 h-64 flex flex-col items-center justify-center text-center">
           <PieChart size={48} className="text-text-light mb-4" />
           <h3 className="font-700 text-text mb-2">Spoilage Cost Analysis</h3>
           <p className="text-sm text-text-muted">Module currently in beta. Expected in v2.0.</p>
        </div>
      </div>
    </div>
  );
}
