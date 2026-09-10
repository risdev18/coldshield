"use client";
import { useEffect, useState } from "react";
import { TrendingUp, Database, Network, Cpu, FileText, AlertTriangle } from "lucide-react";
import { fetchModelMetadata } from "@/services/modelService";

export default function ModelPage() {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchModelMetadata()
      .then((meta) => {
        setMetadata(meta);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-5 max-w-[1200px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text flex items-center gap-2" style={{ fontWeight: 800 }}>
          <TrendingUp className="text-primary" /> Model Performance
        </h1>
        <p className="text-sm text-text-muted mt-1">Information about the underlying ML model powering ChillShield AI.</p>
      </div>

      {loading ? (
        <div className="card p-12 flex justify-center text-text-muted">Loading model telemetry...</div>
      ) : error || !metadata ? (
        <div className="card p-12 text-center">
          <Database size={48} className="text-warning mx-auto mb-4" />
          <h3 className="text-lg font-600 text-text">Backend Disconnected</h3>
          <p className="text-text-muted text-sm mt-2 max-w-md mx-auto">
            Unable to fetch model metadata. Please ensure the FastAPI server is running via `python main.py`.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card bg-warning/10 border-warning/30 p-4">
            <h3 className="flex items-center gap-2 text-warning font-700 mb-2">
              <AlertTriangle size={18} /> Prototype model — not production validated.
            </h3>
            <p className="text-sm text-text">
              Metrics represent shipment-aware cross-validation results and are not production performance.
              The training dataset contains {metadata.unique_shipments} underlying shipment histories.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-5">
              <div className="card p-5">
                <h2 className="text-base font-700 text-text mb-4 flex items-center gap-2" style={{ fontWeight: 700 }}>
                  <Cpu size={18} className="text-primary" /> Model Identity
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-text-muted">Model Type</span>
                    <span className="font-600 text-text">{metadata.model_type}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-text-muted">Dataset</span>
                    <span className="font-mono text-text text-right max-w-[60%]">{metadata.dataset_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-text-muted">Target Variable</span>
                    <span className="text-text">{metadata.target}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-text-muted">Validation Strategy</span>
                    <span className="text-text">{metadata.validation_strategy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Features Used</span>
                    <span className="font-600 text-text">{metadata.feature_names?.length}</span>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <h2 className="text-base font-700 text-text mb-4 flex items-center gap-2" style={{ fontWeight: 700 }}>
                  <FileText size={18} className="text-primary" /> Global Model Feature Importance
                </h2>
                <div className="space-y-3">
                  {metadata.top_features?.map(([feature, importance]: [string, number]) => (
                    <div key={feature}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-500 text-text">{feature}</span>
                        <span className="text-text-muted">{importance.toFixed(4)}</span>
                      </div>
                      <div className="h-3 bg-surface rounded-sm overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-sm transition-all" 
                          style={{ width: `${Math.min(100, Math.abs(importance) * 200)}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="card p-5 border-t-4 border-t-safe">
                <h2 className="text-base font-700 text-text mb-4 flex items-center gap-2" style={{ fontWeight: 700 }}>
                  <Network size={18} className="text-safe" /> Validation Metrics
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-surface rounded-lg">
                    <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Accuracy</div>
                    <div className="text-2xl font-800 text-text" style={{ fontWeight: 800 }}>
                      {(metadata.metrics?.acc * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 bg-surface rounded-lg">
                    <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Precision</div>
                    <div className="text-2xl font-800 text-text" style={{ fontWeight: 800 }}>
                      {(metadata.metrics?.prec * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 bg-surface rounded-lg">
                    <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Recall</div>
                    <div className="text-2xl font-800 text-text" style={{ fontWeight: 800 }}>
                      {(metadata.metrics?.rec * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 bg-surface rounded-lg">
                    <div className="text-xs text-text-muted uppercase tracking-wide mb-1">F1 Score</div>
                    <div className="text-2xl font-800 text-text" style={{ fontWeight: 800 }}>
                      {(metadata.metrics?.f1 * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 bg-surface rounded-lg">
                    <div className="text-xs text-text-muted uppercase tracking-wide mb-1">ROC-AUC</div>
                    <div className="text-2xl font-800 text-text" style={{ fontWeight: 800 }}>
                      {(metadata.metrics?.roc_auc * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 bg-surface rounded-lg">
                    <div className="text-xs text-text-muted uppercase tracking-wide mb-1">PR-AUC</div>
                    <div className="text-2xl font-800 text-text" style={{ fontWeight: 800 }}>
                      {(metadata.metrics?.pr_auc * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="col-span-2 p-3 bg-surface rounded-lg">
                    <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Balanced Accuracy</div>
                    <div className="text-2xl font-800 text-text" style={{ fontWeight: 800 }}>
                      {(metadata.metrics?.bal_acc * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <h2 className="text-base font-700 text-text mb-4 flex items-center gap-2" style={{ fontWeight: 700 }}>
                  <AlertTriangle size={18} className="text-warning" /> Limitations
                </h2>
                <ul className="list-disc pl-5 text-sm text-text space-y-1">
                  {metadata.limitations?.map((lim: string, idx: number) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
