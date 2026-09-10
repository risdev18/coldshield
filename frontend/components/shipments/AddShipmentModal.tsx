import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ROUTES, buildShipment } from "@/data/shipments";
import { useAppStore } from "@/store/appStore";
import type { CargoType } from "@/lib/types";

interface AddShipmentModalProps {
  onClose: () => void;
}

export default function AddShipmentModal({ onClose }: AddShipmentModalProps) {
  const { addShipment } = useAppStore();
  
  const [cargoType, setCargoType] = useState<CargoType>("vaccines");
  const [cargoName, setCargoName] = useState("Vaccines — Custom Batch");
  const [routeKey, setRouteKey] = useState<keyof typeof ROUTES>("mumbai_pune");
  const [temp, setTemp] = useState(5.0);
  const [delay, setDelay] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate a random ID for the new shipment
    const randomId = `CG-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const newShipment = buildShipment(
      randomId,
      ROUTES[routeKey],
      cargoType,
      cargoName,
      0.1, // starting progress
      temp,
      65, // default humidity
      delay,
      120, // default remaining transit
      0.4, // default route risk
      "medium", // traffic
      0, // handling events
      "good", // refrigeration
      "ON_TIME", // status
      "MH-00-NEW-1234"
    );

    addShipment(newShipment);
    toast.success(`Shipment ${randomId} added successfully`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border bg-surface">
          <h2 className="font-800 text-lg">Add New Shipment</h2>
          <button onClick={onClose} className="p-1 hover:bg-border rounded transition-colors">
            <X size={18} className="text-text-muted" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-600 mb-1">Route</label>
            <select
              value={routeKey}
              onChange={(e) => setRouteKey(e.target.value as keyof typeof ROUTES)}
              className="w-full border border-border rounded p-2 text-sm outline-none"
            >
              {Object.entries(ROUTES).map(([k, v]) => (
                <option key={k} value={k}>{v.origin} &rarr; {v.destination}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-600 mb-1">Cargo Type</label>
            <select
              value={cargoType}
              onChange={(e) => setCargoType(e.target.value as CargoType)}
              className="w-full border border-border rounded p-2 text-sm outline-none"
            >
              <option value="biologics">Biologics</option>
              <option value="vaccines">Vaccines</option>
              <option value="dairy">Dairy</option>
              <option value="fresh_produce">Fresh Produce</option>
              <option value="frozen_food">Frozen Food</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-600 mb-1">Cargo Description</label>
            <input
              type="text"
              value={cargoName}
              onChange={(e) => setCargoName(e.target.value)}
              className="w-full border border-border rounded p-2 text-sm outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 mb-1">Current Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={temp}
                onChange={(e) => setTemp(parseFloat(e.target.value))}
                className="w-full border border-border rounded p-2 text-sm outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-600 mb-1">Delay (mins)</label>
              <input
                type="number"
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value))}
                className="w-full border border-border rounded p-2 text-sm outline-none"
                required
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded text-sm font-600 hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded text-sm font-600 hover:bg-primary-600 transition-colors"
            >
              Create Shipment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
