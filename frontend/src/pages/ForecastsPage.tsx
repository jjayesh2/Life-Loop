import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  BarChart2,
  Info
} from 'lucide-react';
import { Facility } from '../types';
import { fetchForecasts } from '../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';

interface ForecastsPageProps {
  facilities: Facility[];
}

export const ForecastsPage: React.FC<ForecastsPageProps> = ({ facilities }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<number | ''>('');
  const [selectedComponent, setSelectedComponent] = useState<string>('');

  const loadForecasts = async () => {
    setLoading(true);
    try {
      const res = await fetchForecasts(selectedFacility || undefined, selectedComponent || undefined);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecasts();
  }, [selectedFacility, selectedComponent]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Demand Forecasting & Coverage Horizons</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent Exponential Weighted Moving Average (EWMA) consumption projections and facility hours of coverage.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2">
          <select
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value ? Number(e.target.value) : '')}
            className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
          >
            <option value="">All Facilities (Consolidated)</option>
            {facilities.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          <select
            value={selectedComponent}
            onChange={(e) => setSelectedComponent(e.target.value)}
            className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
          >
            <option value="">All Components</option>
            <option value="Red Blood Cells">Red Blood Cells</option>
            <option value="Platelets">Platelets</option>
            <option value="Fresh Frozen Plasma">Fresh Frozen Plasma</option>
            <option value="Cryoprecipitate">Cryoprecipitate</option>
          </select>
        </div>
      </div>

      {loading || !data ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border">Calculating demand projections...</div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Network Total Stock</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{data.summary.total_available_stock} Units</span>
              <span className="text-xs text-slate-500 mt-1 block">Active on-shelf available units</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Current Unmet Demand</span>
              <span className="text-2xl font-black text-red-600 mt-1 block">{data.summary.total_current_demand} Units</span>
              <span className="text-xs text-red-500 mt-1 block">Across critical & urgent orders</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Average Network Coverage</span>
              <span className="text-2xl font-black text-teal-600 mt-1 block">{data.summary.average_network_coverage_hours} Hours</span>
              <span className="text-xs text-slate-500 mt-1 block">~{Math.round(data.summary.average_network_coverage_hours / 24)} days before stock exhaustion</span>
            </div>
          </div>

          {/* Forecast Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Historical Actuals vs 7-Day Forecast Demand</h3>
                <p className="text-xs text-slate-500">Includes 95% confidence intervals based on surgical schedule variance.</p>
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-0.5 bg-slate-700"></span>
                  <span className="text-slate-600">Historical Actual</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-0.5 bg-teal-600 border-b border-dashed"></span>
                  <span className="text-teal-700 font-semibold">Forecast</span>
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.timeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="upper_bound_95ci" stroke="none" fill="#ccfbf1" fillOpacity={0.6} />
                  <Line type="monotone" dataKey="actual_demand" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="forecast_demand" stroke="#0d9488" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start space-x-2">
              <Info className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Methodology:</strong> {data.summary.model_type}. Projections are calibrated with local hospital trauma admissions.
                Confidence interval: {data.summary.data_quality_label}.
              </p>
            </div>
          </div>

          {/* Facility Coverage Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Facility Projected Coverage & Stockout Vulnerability</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Facility</th>
                    <th className="p-3">Current Stock</th>
                    <th className="p-3">Safety Reserve</th>
                    <th className="p-3">Pending Demand</th>
                    <th className="p-3">Projected Coverage</th>
                    <th className="p-3 text-right">Risk Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.facility_coverage.map((fac: any) => (
                    <tr key={fac.facility_id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{fac.facility_name}</td>
                      <td className="p-3 text-slate-700">{fac.available_stock} Units</td>
                      <td className="p-3 text-slate-500">{fac.safety_reserve} Units</td>
                      <td className="p-3 font-semibold text-red-600">{fac.current_demand} Units</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800">{fac.estimated_hours_coverage} Hours</span>
                        <span className="text-[10px] text-slate-400 block">({Math.round(fac.estimated_hours_coverage / 24)} days)</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          fac.shortage_risk_level === 'High'
                            ? 'bg-red-100 text-red-800'
                            : fac.shortage_risk_level === 'Moderate'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}>
                          {fac.shortage_risk_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
