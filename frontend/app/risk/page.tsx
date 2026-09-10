import { Activity, ShieldAlert, Zap } from "lucide-react";

export default function RiskIntelligencePage() {
  return (
    <div className="p-5 max-w-[1200px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text flex items-center gap-2" style={{ fontWeight: 800 }}>
          <Activity className="text-primary" /> Risk Intelligence
        </h1>
        <p className="text-sm text-text-muted mt-1">Network-wide risk analytics and historical threat patterns.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-0 overflow-hidden relative group">
           <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-6 transition-all group-hover:backdrop-blur-[1px]">
             <div className="px-2 py-1 bg-primary text-white text-[10px] font-800 uppercase tracking-wider rounded mb-3">V2.0 Preview</div>
             <h3 className="font-800 text-lg text-text mb-1 flex items-center gap-2"><ShieldAlert size={18} /> Threat Vector Analysis</h3>
             <p className="text-sm text-text-muted font-500 max-w-sm">Coming in v2.0: Deep analysis of localized risk patterns based on historical telematics and external climate data.</p>
           </div>
           
           <div className="p-6 opacity-30 pointer-events-none select-none filter grayscale">
             <div className="h-4 bg-surface rounded w-1/3 mb-6" />
             <div className="space-y-3">
               {[85, 60, 45, 30, 15].map((w, i) => (
                 <div key={i} className="flex items-center gap-3">
                   <div className="w-16 h-3 bg-surface rounded" />
                   <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                     <div className="h-full bg-border" style={{ width: `${w}%` }} />
                   </div>
                 </div>
               ))}
             </div>
           </div>
        </div>

        <div className="card p-0 overflow-hidden relative group">
           <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-6 transition-all group-hover:backdrop-blur-[1px]">
             <div className="px-2 py-1 bg-primary text-white text-[10px] font-800 uppercase tracking-wider rounded mb-3">V2.0 Preview</div>
             <h3 className="font-800 text-lg text-text mb-1 flex items-center gap-2"><Zap size={18} /> Automated Policy Enforcement</h3>
             <p className="text-sm text-text-muted font-500 max-w-sm">Coming in v2.0: Let ChillShield automatically dispatch driver interventions and routing changes when risk crosses thresholds.</p>
           </div>
           
           <div className="p-6 opacity-30 pointer-events-none select-none filter grayscale">
             <div className="h-4 bg-surface rounded w-1/3 mb-6" />
             <div className="grid grid-cols-2 gap-3">
                <div className="h-24 border border-border rounded-lg bg-surface" />
                <div className="h-24 border border-border rounded-lg bg-surface" />
                <div className="h-24 border border-border rounded-lg bg-surface" />
                <div className="h-24 border border-border rounded-lg bg-surface" />
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
