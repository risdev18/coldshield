import { Settings, User, Bell, Shield, PaintBucket } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-5 max-w-[1200px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text flex items-center gap-2" style={{ fontWeight: 800 }}>
          <Settings className="text-primary" /> Application Settings
        </h1>
        <p className="text-sm text-text-muted mt-1">Manage user preferences and system configuration.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-3 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-2.5 bg-primary/10 text-primary font-600 text-sm rounded-md transition-colors" style={{ fontWeight: 600 }}>
            <User size={16} /> Profile
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-text-muted hover:bg-surface hover:text-text text-sm rounded-md transition-colors">
            <Bell size={16} /> Notifications
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-text-muted hover:bg-surface hover:text-text text-sm rounded-md transition-colors">
            <Shield size={16} /> Security
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-text-muted hover:bg-surface hover:text-text text-sm rounded-md transition-colors">
            <PaintBucket size={16} /> Appearance
          </button>
        </div>
        
        <div className="md:col-span-9 space-y-4">
          <div className="card p-6">
            <h3 className="text-lg font-700 text-text mb-4" style={{ fontWeight: 700 }}>Profile Information</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-600 text-text mb-1" style={{ fontWeight: 600 }}>Full Name</label>
                <input type="text" defaultValue="Ops Manager" className="w-full p-2 border border-border rounded-md text-sm outline-none" disabled />
              </div>
              <div>
                <label className="block text-xs font-600 text-text mb-1" style={{ fontWeight: 600 }}>Role</label>
                <input type="text" defaultValue="System Administrator" className="w-full p-2 border border-border rounded-md text-sm outline-none bg-surface" disabled />
              </div>
              <div>
                <label className="block text-xs font-600 text-text mb-1" style={{ fontWeight: 600 }}>Hub Location</label>
                <input type="text" defaultValue="Mumbai Hub" className="w-full p-2 border border-border rounded-md text-sm outline-none bg-surface" disabled />
              </div>
            </div>
          </div>
          
          <div className="card p-6 border-l-4 border-warning">
            <h3 className="text-lg font-700 text-text mb-2" style={{ fontWeight: 700 }}>Demo Mode Configuration</h3>
            <p className="text-sm text-text-muted mb-4">
              Demo parameters are configured globally in the Control Tower. No adjustments needed here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
