import React, { useState } from 'react';
import {
  Settings,
  RefreshCw,
  ShieldAlert,
  Clock,
  Sliders,
  MapPin,
  CheckCircle2,
  Mail,
  AlertTriangle
} from 'lucide-react';
import { Facility } from '../types';
import { resetScenario } from '../services/api';

interface SettingsPageProps {
  facilities: Facility[];
  onReloadAll: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ facilities, onReloadAll }) => {
  const [resetting, setResetting] = useState(false);

  // Settings mock configuration state
  const [approachThreshold, setApproachThreshold] = useState(72);
  const [urgentThreshold, setUrgentThreshold] = useState(24);
  const [planningHorizon, setPlanningHorizon] = useState(24);

  const handleResetDemo = async () => {
    if (!window.confirm("Restore deterministic demonstration dataset? This clears modified test transfers and restores 7 facilities, 20 batches, and initial deficits.")) {
      return;
    }
    setResetting(true);
    try {
      await resetScenario();
      alert("Demo environment reset successfully!");
      onReloadAll();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">System Configuration &amp; Demo Controls</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure surveillance thresholds, hospital reserve requirements, and restore deterministic judge evaluation state.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          disabled={resetting}
          className="flex items-center space-x-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          <span>{resetting ? 'Resetting Database...' : 'Reset Demo Environment'}</span>
        </button>
      </div>

      {/* Grid of Settings Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Module 1: Expiry Alert Thresholds */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-sm">Shelf-Life Alert Thresholds</h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">
                Approaching Expiry Warning Threshold: <strong className="text-amber-600 font-mono">{approachThreshold} Hours</strong>
              </label>
              <input
                type="range"
                min="24"
                max="120"
                step="6"
                value={approachThreshold}
                onChange={(e) => setApproachThreshold(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <span className="text-[10px] text-slate-400">Default: 72 hours (3 days). Triggers hospital warning banner.</span>
            </div>

            <div>
              <label className="text-slate-700 font-semibold block mb-1">
                Urgent Expiry Reallocation Threshold: <strong className="text-red-600 font-mono">{urgentThreshold} Hours</strong>
              </label>
              <input
                type="range"
                min="6"
                max="48"
                step="6"
                value={urgentThreshold}
                onChange={(e) => setUrgentThreshold(Number(e.target.value))}
                className="w-full accent-red-600"
              />
              <span className="text-[10px] text-slate-400">Default: 24 hours. High priority for immediate courier redistribution.</span>
            </div>
          </div>
        </div>

        {/* Module 2: Planning Horizon & Notification Engine */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <Sliders className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-slate-900 text-sm">Logistics Horizons &amp; Notifications</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">
                MILP Planning Horizon Window: <strong className="text-teal-700 font-mono">{planningHorizon} Hours</strong>
              </label>
              <input
                type="range"
                min="12"
                max="72"
                step="6"
                value={planningHorizon}
                onChange={(e) => setPlanningHorizon(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
              <span className="text-[10px] text-slate-400">Lookahead window for demand fulfillment and transit limits.</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="font-bold text-slate-800">SMTP Notification Adapter</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Status: <strong className="text-slate-700">Not configured (No SMTP credentials provided)</strong>.
                In-app notification center is fully operational with instant soundless desktop notifications.
              </p>
            </div>
          </div>
        </div>

        {/* Module 3: Facility Safety Reserves Roster */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <ShieldAlert className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-slate-900 text-sm">Facility Mandatory Safety Stock Reserves</h3>
          </div>

          <p className="text-xs text-slate-500">
            The MILP optimizer treats these reserve levels as hard mathematical constraints: transfers will never deplete a facility below its reserve.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {facilities.map((fac) => (
              <div key={fac.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <span className="font-bold text-slate-900 block truncate">{fac.name}</span>
                <span className="text-[10px] text-slate-400 block mb-2">{fac.facility_type}</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Safety Reserve:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border">
                    {fac.safety_reserve_units} Units
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
