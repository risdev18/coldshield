import { Boxes, PackageSearch, Database } from "lucide-react";

export default function CargoPage() {
  return (
    <div className="p-5 max-w-[1200px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text flex items-center gap-2" style={{ fontWeight: 800 }}>
          <Boxes className="text-primary" /> Cargo Inventory
        </h1>
        <p className="text-sm text-text-muted mt-1">Manage cargo profiles, safe temperature ranges, and value rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6 h-64 flex flex-col items-center justify-center text-center">
           <PackageSearch size={48} className="text-text-light mb-4" />
           <h3 className="font-700 text-text mb-2">Cargo Catalog</h3>
           <p className="text-sm text-text-muted">Module currently in beta. Expected in v2.0.</p>
        </div>
        <div className="card p-6 h-64 flex flex-col items-center justify-center text-center">
           <Database size={48} className="text-text-light mb-4" />
           <h3 className="font-700 text-text mb-2">Sensitivity Rules Engine</h3>
           <p className="text-sm text-text-muted">Module currently in beta. Expected in v2.0.</p>
        </div>
      </div>
    </div>
  );
}
