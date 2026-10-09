import React, { useState, useEffect } from 'react';
import {
  Flame,
  AlertTriangle,
  Radio,
  RefreshCw,
  Truck,
  Building2,
  PackagePlus,
  ThermometerSnowflake,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Car,
  Activity
} from 'lucide-react';
import { Facility } from '../types';
import { triggerSimulationEvent, resetScenario } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface EmergencySimulatorProps {
  facilities: Facility[];
  onNavigateToOptimizer: () => void;
}

export const EmergencySimulatorPage: React.FC<EmergencySimulatorProps> = ({
  facilities,
  onNavigateToOptimizer
}) => {
  const { playAlarm, playSuccess, speak } = useAuth();
  const [loading, setLoading] = useState(false);
  const [eventHistory, setEventHistory] = useState<Array<any>>([]);
  const [latestReopt, setLatestReopt] = useState<any>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const handleTriggerEvent = async (type: string, payload: any, announcement: string, scenarioId: string) => {
    setLoading(true);
    setActiveScenarioId(scenarioId);
    try {
      playAlarm();
      speak(announcement, 'urgent');

      const res = await triggerSimulationEvent({
        event_type: type,
        ...payload
      });
      setEventHistory(prev => [res.event, ...prev]);
      setLatestReopt(res.reoptimization_result);
    } catch (err: any) {
      alert(`Simulation event failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset all scenario events and restore Nashik initial baseline dataset?")) return;
    try {
      await resetScenario();
      setEventHistory([]);
      setLatestReopt(null);
      setActiveScenarioId(null);
      playSuccess();
      speak("Nashik baseline supply chain successfully reset.");
      alert("Demo scenario successfully restored to initial deterministic state.");
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full border border-red-200 uppercase tracking-wider flex items-center space-x-1">
              <Flame className="w-3 h-3 text-red-600 animate-pulse" />
              <span>Nashik Emergency Simulator</span>
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">Deterministic Demonstration Sandbox</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
            Nashik Multi-Incident Simulation Engine
          </h1>
          <p className="text-xs text-slate-500">
            Trigger real emergency events across Nashik highways, blood banks, and junctions to demonstrate real-time MILP redistribution.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset to Nashik Baseline</span>
        </button>
      </div>

      {/* 4 Dedicated Nashik Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Scenario 1: Mumbai-Nashik Highway Collision */}
        <div className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 transition ${
          activeScenarioId === 'nh3_collision' ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Scenario 1 • Trauma Surge</span>
                <h3 className="font-bold text-slate-900 text-sm">Mumbai-Nashik Highway (NH-3) Pileup</h3>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold rounded-full">Vilholi Ghat</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Multi-vehicle collision on NH-3 near Vilholi. Six critical patients rushed to Apollo Hospitals and District Civil Hospital with active hemorrhages.
          </p>

          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Urgent Demand Injected:</span>
              <strong className="text-red-700">6 Units O- Negative & 4 Units B+</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Target Trauma Center:</span>
              <strong className="text-slate-800">Apollo Hospitals Nashik</strong>
            </div>
          </div>

          <button
            onClick={() => handleTriggerEvent(
              'trauma_surge',
              {
                facility_id: 4, // Apollo Hospitals
                blood_group: 'O-',
                quantity: 6
              },
              'Emergency! Highway collision on Mumbai-Nashik highway near Vilholi. Mass transfusion protocol activated at Apollo Hospitals for 6 units of O negative.',
              'nh3_collision'
            )}
            disabled={loading}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Flame className="w-4 h-4 text-amber-300" />
            <span>Simulate Highway Crash (Surge Demand)</span>
          </button>
        </div>

        {/* Scenario 2: Dwarka Circle Gridlock */}
        <div className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 transition ${
          activeScenarioId === 'dwarka_gridlock' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Scenario 2 • Route Disruption</span>
                <h3 className="font-bold text-slate-900 text-sm">Dwarka Circle Peak Traffic Gridlock</h3>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full">NH-50 Junction</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Severe flyover congestion and vehicle breakdown at Dwarka Circle causing 3.5x delays on corridor connecting Old Agra Road blood banks to Nashik Road.
          </p>

          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Corridor Affected:</span>
              <strong className="text-amber-800">Arpan Blood Bank ↔ Bytco Hospital</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Delay Multiplier:</span>
              <strong className="text-slate-800">3.5x (Transit jumps to 45+ mins)</strong>
            </div>
          </div>

          <button
            onClick={() => handleTriggerEvent(
              'route_disruption',
              {
                route_origin_id: 2, // Arpan
                route_dest_id: 7, // Bytco
                delay_multiplier: 3.5
              },
              'Traffic alert! Severe bottleneck at Dwarka Circle. Automated routing algorithm shifting dispatches to Jankalyan Raktpedhi via Gangapur corridor.',
              'dwarka_gridlock'
            )}
            disabled={loading}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Clock className="w-4 h-4" />
            <span>Simulate Dwarka Gridlock (Re-route)</span>
          </button>
        </div>

        {/* Scenario 3: Arpan Blood Bank Chiller Malfunction */}
        <div className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 transition ${
          activeScenarioId === 'arpan_cooler' ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
                <ThermometerSnowflake className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Scenario 3 • Cold-Chain Failure</span>
                <h3 className="font-bold text-slate-900 text-sm">Arpan Blood Bank Chiller Failure</h3>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-full">Old Agra Road</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Main refrigeration compressor tripping at Arpan Blood Bank. 14 units of Packed Red Blood Cells require emergency evacuation before temperature exceeds 6°C.
          </p>

          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Risk Units:</span>
              <strong className="text-rose-700">14 Units PRBC approaching expiry window</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Target Redistribution:</span>
              <strong className="text-slate-800">District Civil Hospital & Jankalyan</strong>
            </div>
          </div>

          <button
            onClick={() => handleTriggerEvent(
              'trauma_surge',
              {
                facility_id: 1, // Civil Hospital absorbs
                blood_group: 'A+',
                quantity: 8
              },
              'Warning! Refrigeration compressor tripped at Arpan Blood Bank. Initiating rapid stock evacuation to prevent inventory spoilage.',
              'arpan_cooler'
            )}
            disabled={loading}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Simulate Compressor Failure (Evacuate Stock)</span>
          </button>
        </div>

        {/* Scenario 4: Bytco Hospital Mega Voluntary Blood Drive */}
        <div className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 transition ${
          activeScenarioId === 'bytco_drive' ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-teal-100 text-teal-600 rounded-xl">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Scenario 4 • Supply Influx</span>
                <h3 className="font-bold text-slate-900 text-sm">Bytco Hospital Voluntary Mega Drive</h3>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-bold rounded-full">Nashik Road</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Community voluntary blood donation camp concluded at Bytco Hospital (NMC). Influx of 20 fresh units replenishes district safety reserves.
          </p>

          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Fresh Units Injected:</span>
              <strong className="text-teal-700">+20 Units O+ Whole Blood & PRBC</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Recipient Hub:</span>
              <strong className="text-slate-800">NMC Bytco Hospital (Nashik Road)</strong>
            </div>
          </div>

          <button
            onClick={() => handleTriggerEvent(
              'new_supply',
              {
                facility_id: 7, // Bytco
                blood_group: 'O+',
                component_type: 'Packed Red Blood Cells',
                quantity: 20
              },
              'Supply update. 20 fresh units collected at Bytco Hospital voluntary blood camp. Safety stock levels restored.',
              'bytco_drive'
            )}
            disabled={loading}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Simulate Mega Blood Drive (+20 Units)</span>
          </button>
        </div>
      </div>

      {/* Revised Optimization Plan After Event */}
      {latestReopt && (
        <div className="bg-white rounded-2xl border border-teal-300 p-6 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full uppercase">
                  Automated Re-Optimization
                </span>
                <span className="text-xs text-slate-500">HiGHS MILP Converged in {latestReopt.runtime_seconds}s</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                Revised Nashik Dispatch Recommendations
              </h3>
            </div>
            <button
              onClick={onNavigateToOptimizer}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center space-x-1"
            >
              <span>Inspect Full Solution</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {latestReopt.proposed_transfers?.map((t: any, i: number) => (
              <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{t.origin_name} → {t.destination_name}</span>
                  <span className="font-mono text-teal-700 font-bold">{t.quantity} unit(s)</span>
                </div>
                <p className="text-[11px] text-slate-600">{t.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Event Stream / Audit Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Simulated Emergency Event Stream</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {eventHistory.length > 0 ? (
            eventHistory.map((ev, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="font-bold text-red-600 uppercase tracking-wider">[INCIDENT LOG] {ev.event_type}</span>
                  <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="font-semibold text-slate-800">{ev.details}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              No simulated events triggered yet. Click one of the buttons above to test dynamic Nashik re-optimization.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
