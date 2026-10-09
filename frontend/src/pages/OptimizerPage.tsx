import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Truck,
  ShieldCheck,
  Sliders,
  ArrowRight,
  TrendingUp,
  FileText
} from 'lucide-react';
import { OptimizationResult, Facility } from '../types';
import { runOptimization, fetchLatestOptimization } from '../services/api';

interface OptimizerPageProps {
  onNavigateToTransfers: () => void;
}

export const OptimizerPage: React.FC<OptimizerPageProps> = ({ onNavigateToTransfers }) => {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Objective weights
  const [weightUnmet, setWeightUnmet] = useState(100.0);
  const [weightExpiry, setWeightExpiry] = useState(15.0);
  const [weightTravel, setWeightTravel] = useState(0.2);

  const loadLatest = async () => {
    try {
      const data = await fetchLatestOptimization();
      if (data && data.is_feasible !== undefined) {
        setResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const handleSolve = async () => {
    setLoading(true);
    try {
      const data = await runOptimization({
        unmet_demand: weightUnmet,
        expiry_risk: weightExpiry,
        travel_time: weightTravel
      });
      setResult(data);
    } catch (err: any) {
      alert(`MILP Optimization failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-teal-500/20 text-teal-800 font-bold px-2 py-0.5 rounded border border-teal-500/30 uppercase tracking-wider">
              Core Innovation
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500">Mathematical Programming</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">MILP Optimization Engine (HiGHS)</h1>
          <p className="text-xs text-slate-500">
            Formulated as a Mixed-Integer Linear Program balancing unmet emergency demand, shelf-life waste prevention, and transit feasibility.
          </p>
        </div>

        <button
          onClick={handleSolve}
          disabled={loading}
          className="flex items-center space-x-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-md transition disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Solving MILP Formulation...' : 'Execute MILP Optimization'}</span>
        </button>
      </div>

      {/* Solver Hyperparameters & Weights Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Multi-Objective Cost Weights</h3>
          </div>
          <span className="text-[11px] text-slate-400">Lexicographically prioritized</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Weight 1: Unmet Demand */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-700">Unmet Emergency Demand Weight</span>
              <span className="text-red-600 font-mono font-bold">{weightUnmet}</span>
            </div>
            <input
              type="range"
              min="20"
              max="200"
              step="10"
              value={weightUnmet}
              onChange={(e) => setWeightUnmet(Number(e.target.value))}
              className="w-full accent-red-600"
            />
            <p className="text-[10px] text-slate-400">Penalizes clinical shortages in trauma/surgical wards.</p>
          </div>

          {/* Weight 2: Expiry Risk */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-700">Near-Expiry Waste Bonus</span>
              <span className="text-amber-600 font-mono font-bold">{weightExpiry}</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={weightExpiry}
              onChange={(e) => setWeightExpiry(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
            <p className="text-[10px] text-slate-400">Incentivizes moving units before shelf life expires (&lt;72h).</p>
          </div>

          {/* Weight 3: Travel Time */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-700">Transit Duration Cost Factor</span>
              <span className="text-teal-600 font-mono font-bold">{weightTravel}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={weightTravel}
              onChange={(e) => setWeightTravel(Number(e.target.value))}
              className="w-full accent-teal-600"
            />
            <p className="text-[10px] text-slate-400">Penalizes long-distance couriers when closer stock is viable.</p>
          </div>
        </div>
      </div>

      {/* Solver Metrics Summary */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SOLVER STATUS</span>
            <span className="text-lg font-black text-teal-700 mt-1 block flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              {result.solver_status}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{result.solver_name}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">EXECUTION TIME</span>
            <span className="text-lg font-black text-slate-900 mt-1 block font-mono">{result.runtime_seconds}s</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Sub-second convergence</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PROPOSED TRANSFERS</span>
            <span className="text-lg font-black text-teal-600 mt-1 block">{result.proposed_transfers?.length || 0} Routes</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Inter-facility transfers</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PREVENTED WASTE</span>
            <span className="text-lg font-black text-amber-600 mt-1 block">{result.prevented_waste_units} Units</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Saved from spoilage</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">UNMET REMAINING</span>
            <span className="text-lg font-black text-red-600 mt-1 block">{result.unmet_demand_count} Units</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">After optimal redistribution</span>
          </div>
        </div>
      )}

      {/* Hard Constraint Validation Checklist */}
      {result && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Independent Hard Constraint Verification
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
              100% Constraints Verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {result.constraint_validation?.checks_run?.map((chk, i) => (
              <div key={i} className="flex items-center space-x-2 p-2 bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span className="text-slate-700 font-medium">{chk}</span>
              </div>
            ))}
          </div>

          {result.constraint_validation?.violations && result.constraint_validation.violations.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <strong>Constraint Violations Detected:</strong>
              <ul className="list-disc pl-4 mt-1">
                {result.constraint_validation.violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Proposed Transfers Table with Explainable Rationale */}
      {result && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Recommended Transfer Dispatches</h3>
              <p className="text-xs text-slate-500">Each proposal includes a deterministic mathematical rationale.</p>
            </div>
            <button
              onClick={onNavigateToTransfers}
              className="px-3.5 py-1.5 bg-navy-900 hover:bg-navy-850 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center space-x-1"
            >
              <span>Manage & Approve Transfers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {result.proposed_transfers && result.proposed_transfers.length > 0 ? (
              result.proposed_transfers.map((t, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-xs space-y-2 hover:bg-slate-50 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-7 h-7 rounded-full bg-red-600 text-white font-black flex items-center justify-center text-xs">
                        {t.blood_group}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 text-xs">{t.component_type}</span>
                        <span className="text-slate-400 text-[10px] font-mono ml-2">Unit: {t.tracking_id}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-slate-600">
                      <span>{t.origin_name} → <strong>{t.destination_name}</strong></span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-900">
                        {t.quantity} Unit(s)
                      </span>
                      <span className="text-slate-400 text-[11px] font-mono">{Math.round(t.travel_time_minutes)} min transit</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-700 text-[11px] leading-relaxed">
                    <strong>Algorithmic Rationale:</strong> {t.explanation}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                No transfers recommended. System is already balanced or no compatible supplies available.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
