import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Truck,
  ArrowUpRight,
  Download,
  Printer
} from 'lucide-react';
import { fetchImpactAnalytics } from '../services/api';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchImpactAnalytics()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <div className="p-12 text-center text-slate-400">Loading computed impact metrics...</div>;
  }

  const { baseline, life_loop_optimized, improvement, total_demand_units } = data;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Supply Chain Impact & Baseline Comparison</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Empirical comparative analysis between local uncoordinated stock vs. Life-Loop MILP coordinated redistribution.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center space-x-1 px-3.5 py-2 bg-navy-900 hover:bg-navy-850 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Executive Report</span>
        </button>
      </div>

      {/* Primary Impact Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Service Level Gain */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Service Level Fulfillment</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-teal-600">
              {life_loop_optimized.service_level_pct}%
            </span>
            <span className="text-xs font-semibold text-slate-400">
              vs {baseline.service_level_pct}% baseline
            </span>
          </div>
          <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded inline-block">
            +{improvement.service_level_gain_pct}% Absolute Network Gain
          </span>
        </div>

        {/* Unmet Demand Reduction */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Deficit Demand Mitigation</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-red-600">
              -{improvement.unmet_demand_reduction_pct}%
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {baseline.unmet_demand_units} &rarr; {life_loop_optimized.unmet_demand_units} units
            </span>
          </div>
          <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded inline-block">
            {baseline.unmet_demand_units - life_loop_optimized.unmet_demand_units} Critical Emergencies Covered
          </span>
        </div>

        {/* Waste Prevention */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Expiry Spoilage Reduction</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-amber-600">
              -{improvement.waste_reduction_pct}%
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {baseline.projected_expired_waste_units} &rarr; {life_loop_optimized.projected_expired_waste_units} units
            </span>
          </div>
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded inline-block">
            Proactively Allocated Before Shelf-Life Expiry
          </span>
        </div>
      </div>

      {/* Side-by-Side Comparison Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Deterministic Strategy Comparison Matrix</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Logistics KPI Metric</th>
                <th className="p-3.5 text-slate-500">Baseline (Local Isolation)</th>
                <th className="p-3.5 text-teal-800 bg-teal-50/50">Life-Loop (MILP Coordinated)</th>
                <th className="p-3.5 text-right">Computed Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-3.5 font-bold text-slate-800">Total Clinical Demand</td>
                <td className="p-3.5 text-slate-600">{total_demand_units} Units</td>
                <td className="p-3.5 font-semibold text-teal-800 bg-teal-50/20">{total_demand_units} Units</td>
                <td className="p-3.5 text-right text-slate-400">Identical Denominator</td>
              </tr>

              <tr>
                <td className="p-3.5 font-bold text-slate-800">Unmet Patient Shortage</td>
                <td className="p-3.5 text-red-600 font-bold">{baseline.unmet_demand_units} Units</td>
                <td className="p-3.5 font-bold text-teal-700 bg-teal-50/20">{life_loop_optimized.unmet_demand_units} Units</td>
                <td className="p-3.5 text-right font-black text-teal-600">
                  -{improvement.unmet_demand_reduction_pct}% Shortage
                </td>
              </tr>

              <tr>
                <td className="p-3.5 font-bold text-slate-800">Service Level Delivery</td>
                <td className="p-3.5 text-slate-600">{baseline.service_level_pct}%</td>
                <td className="p-3.5 font-bold text-teal-800 bg-teal-50/20">{life_loop_optimized.service_level_pct}%</td>
                <td className="p-3.5 text-right font-bold text-teal-600">
                  +{improvement.service_level_gain_pct}%
                </td>
              </tr>

              <tr>
                <td className="p-3.5 font-bold text-slate-800">Projected Expiry Spoilage</td>
                <td className="p-3.5 text-amber-600 font-bold">{baseline.projected_expired_waste_units} Units</td>
                <td className="p-3.5 font-bold text-teal-700 bg-teal-50/20">{life_loop_optimized.projected_expired_waste_units} Units</td>
                <td className="p-3.5 text-right font-bold text-teal-600">
                  -{improvement.waste_reduction_pct}% Spoilage
                </td>
              </tr>

              <tr>
                <td className="p-3.5 font-bold text-slate-800">Units Transported</td>
                <td className="p-3.5 text-slate-600">0 Units (Zero Movement)</td>
                <td className="p-3.5 font-bold text-slate-900 bg-teal-50/20">{life_loop_optimized.units_moved} Units</td>
                <td className="p-3.5 text-right text-slate-600">+{life_loop_optimized.units_moved} Moved</td>
              </tr>

              <tr>
                <td className="p-3.5 font-bold text-slate-800">Cumulative Courier Time</td>
                <td className="p-3.5 text-slate-600">0 Minutes</td>
                <td className="p-3.5 font-mono text-slate-800 bg-teal-50/20">{Math.round(life_loop_optimized.transport_time_minutes)} Minutes</td>
                <td className="p-3.5 text-right text-slate-500">Validated Transit Margin</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
