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
  ArrowRight
} from 'lucide-react';
import { Facility } from '../types';
import { triggerSimulationEvent, resetScenario } from '../services/api';

interface EmergencySimulatorProps {
  facilities: Facility[];
  onNavigateToOptimizer: () => void;
}

export const EmergencySimulatorPage: React.FC<EmergencySimulatorProps> = ({
  facilities,
  onNavigateToOptimizer
}) => {
  const [loading, setLoading] = useState(false);
  const [eventHistory, setEventHistory] = useState<Array<any>>([]);
  const [latestReopt, setLatestReopt] = useState<any>(null);
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  // Trauma surge state
  const [surgeFacility, setSurgeFacility] = useState<number>(1);
  const [surgeGroup, setSurgeGroup] = useState<string>('O-');
  const [surgeQty, setSurgeQty] = useState<number>(8);

  // Route disruption state
  const [routeOrigin, setRouteOrigin] = useState<number>(2);
  const [routeDest, setRouteDest] = useState<number>(1);
  const [delayMultiplier, setDelayMultiplier] = useState<number>(3.0);

  // Setup WebSocket connection
  useEffect(() => {
    let ws: WebSocket;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/scenarios/live`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => setWsStatus('connected');
      ws.onclose = () => setWsStatus('disconnected');
      ws.onerror = () => setWsStatus('disconnected');
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'EMERGENCY_EVENT_PROCESSED') {
            setEventHistory(prev => [msg.event, ...prev]);
            setLatestReopt(msg.optimization);
          }
        } catch (e) {
          console.error(e);
        }
      };
    } catch (e) {
      console.error(e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleTriggerEvent = async (type: string, payload: any) => {
    setLoading(true);
    try {
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
    if (!window.confirm("Reset all scenario events and restore initial baseline dataset?")) return;
    try {
      await resetScenario();
      setEventHistory([]);
      setLatestReopt(null);
      alert("Demo scenario successfully restored to initial deterministic state.");
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded border border-red-200 uppercase tracking-wider flex items-center space-x-1">
              <Flame className="w-3 h-3 text-red-600" />
              <span>Live Scenario Simulator</span>
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="flex items-center space-x-1 text-xs">
              <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-teal-500 animate-ping' : 'bg-slate-400'}`}></span>
              <span className="text-slate-500 font-medium">WebSocket: {wsStatus}</span>
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">Emergency Demand Surges & Disruptions</h1>
          <p className="text-xs text-slate-500">
            Inject synthetic mass-casualty incidents, road network closures, and supply changes to verify automated re-optimization.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Scenario State</span>
        </button>
      </div>

      {/* Simulator Event Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Event 1: Trauma Surge */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Mass Casualty Trauma Surge</h3>
              <p className="text-[11px] text-slate-400">Injects urgent deficit at selected facility</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-600 font-medium block mb-1">Target Facility</label>
              <select
                value={surgeFacility}
                onChange={(e) => setSurgeFacility(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border rounded-lg"
              >
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Blood Group</label>
                <select
                  value={surgeGroup}
                  onChange={(e) => setSurgeGroup(e.target.value)}
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                >
                  {['O-', 'O+', 'A-', 'A+', 'B+', 'AB+'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-600 font-medium block mb-1">Units Needed</label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  value={surgeQty}
                  onChange={(e) => setSurgeQty(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={() => handleTriggerEvent('trauma_surge', {
                facility_id: surgeFacility,
                blood_group: surgeGroup,
                quantity: surgeQty
              })}
              disabled={loading}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              Trigger Trauma Surge
            </button>
          </div>
        </div>

        {/* Event 2: Route Disruption */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Highway Closure / Severe Delay</h3>
              <p className="text-[11px] text-slate-400">Multiplies transit time between 2 facilities</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Origin Node</label>
                <select
                  value={routeOrigin}
                  onChange={(e) => setRouteOrigin(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                >
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-600 font-medium block mb-1">Destination Node</label>
                <select
                  value={routeDest}
                  onChange={(e) => setRouteDest(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                >
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.code}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-600 font-medium block mb-1">Traffic Delay Factor</label>
              <select
                value={delayMultiplier}
                onChange={(e) => setDelayMultiplier(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border rounded-lg"
              >
                <option value={2.0}>2x Delay (Heavy Traffic)</option>
                <option value={3.5}>3.5x Delay (Severe Closure)</option>
                <option value={5.0}>5x Delay (Tunnel Lockdown)</option>
              </select>
            </div>

            <button
              onClick={() => handleTriggerEvent('route_disruption', {
                route_origin_id: routeOrigin,
                route_dest_id: routeDest,
                delay_multiplier: delayMultiplier
              })}
              disabled={loading}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              Simulate Road Closure
            </button>
          </div>
        </div>

        {/* Event 3: New Mobile Supply Drive */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Mobile Drive Supply Influx</h3>
              <p className="text-[11px] text-slate-400">Injects fresh surplus stock into network</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Simulates arrival of emergency mobile blood collection drive arriving at Apollo Hospitals Nashik (+12 units of O+ RBC from Panchavati camp).
            </p>

            <button
              onClick={() => handleTriggerEvent('new_supply', {
                facility_id: 4,
                blood_group: 'O+',
                component_type: 'Red Blood Cells',
                quantity: 12
              })}
              disabled={loading}
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              Deliver Mobile Donation Supply
            </button>
          </div>
        </div>
      </div>

      {/* Revised Optimization Plan After Event */}
      {latestReopt && (
        <div className="bg-white rounded-xl border border-teal-300 p-6 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded border border-teal-200 uppercase">
                  Automated Re-Optimization
                </span>
                <span className="text-xs text-slate-500">HiGHS MILP Converged in {latestReopt.runtime_seconds}s</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">Revised Dispatch Recommendations Following Event</h3>
            </div>
            <button
              onClick={onNavigateToOptimizer}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center space-x-1"
            >
              <span>Inspect Full Solution</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {latestReopt.proposed_transfers?.map((t: any, i: number) => (
              <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
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
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Simulated Emergency Event Stream</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {eventHistory.length > 0 ? (
            eventHistory.map((ev, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="font-bold text-red-600 uppercase tracking-wider">[SIMULATED EVENT] {ev.event_type}</span>
                  <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="font-semibold text-slate-800">{ev.details}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              No simulated events triggered yet. Click one of the buttons above to test dynamic re-optimization.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
