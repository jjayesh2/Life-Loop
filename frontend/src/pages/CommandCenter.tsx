import React from 'react';
import {
  Boxes,
  ShieldAlert,
  Clock,
  Truck,
  CheckCircle2,
  Cpu,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  MapPin,
  QrCode
} from 'lucide-react';
import { DashboardSummary, Facility, Transfer } from '../types';
import { NetworkMapView } from '../components/NetworkMapView';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface CommandCenterProps {
  data: DashboardSummary | null;
  facilities: Facility[];
  transfers: Transfer[];
  onNavigate: (tab: string, filter?: string) => void;
  onSelectFacility: (fac: Facility) => void;
  selectedFacility: Facility | null;
}

const COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#475569'];

export const CommandCenter: React.FC<CommandCenterProps> = ({
  data,
  facilities,
  transfers,
  onNavigate,
  onSelectFacility,
  selectedFacility
}) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  // Format inventory charts
  const groupChartData = Object.entries(data.inventory_by_group || {}).map(([group, count]) => ({
    group,
    units: count
  }));

  const componentChartData = Object.entries(data.inventory_by_component || {}).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-850 rounded-2xl p-6 text-white shadow-lg border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[11px] font-bold tracking-wider uppercase border border-teal-500/30">
              Live Operations Command Center
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-slate-300 text-xs">Metropolitan Blood Supply Network</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">Metropolitan Blood Logistics Dashboard</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Real-time surveillance of component inventories, pending patient shortages, expiring units, and active MILP distribution routes.
          </p>
        </div>
        <div className="flex items-center space-x-3 flex-shrink-0">
          <button
            onClick={() => onNavigate('optimizer')}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow-md transition"
          >
            <Cpu className="w-4 h-4" />
            <span>Run MILP Optimization</span>
          </button>
          <button
            onClick={() => onNavigate('simulator')}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-slate-200 border border-navy-700 font-semibold text-xs transition"
          >
            <span>Emergency Simulator</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Available */}
        <div
          onClick={() => onNavigate('inventory')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Available Units</span>
            <Boxes className="w-4 h-4 text-teal-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{data.total_available_units}</div>
          <span className="text-[10px] text-teal-700 font-medium mt-1 flex items-center">
            <span>Click to view inventory</span>
            <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>

        {/* Reserved Stock */}
        <div
          onClick={() => onNavigate('inventory', 'reserved')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Reserved Units</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2">{data.total_reserved_units}</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Committed to approved transfers</span>
        </div>

        {/* Shortage Risk Facilities */}
        <div
          onClick={() => onNavigate('forecasts')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-red-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">Shortage Risk</span>
            <ShieldAlert className="w-4 h-4 text-red-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-black text-red-600 mt-2">{data.facilities_at_shortage_risk}</div>
          <span className="text-[10px] text-red-700 font-medium mt-1 flex items-center">
            <span>Facilities under reserve</span>
            <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>

        {/* Units Approaching Expiry */}
        <div
          onClick={() => onNavigate('alerts')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-amber-600 tracking-wider">Near Expiry (&lt;72h)</span>
            <Clock className="w-4 h-4 text-amber-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{data.units_approaching_expiry}</div>
          <span className="text-[10px] text-amber-700 font-medium mt-1 flex items-center">
            <span>Target for redistribution</span>
            <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>

        {/* Active Proposed Transfers */}
        <div
          onClick={() => onNavigate('transfers')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-teal-600 tracking-wider">Active Transfers</span>
            <Truck className="w-4 h-4 text-teal-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-black text-teal-700 mt-2">{data.active_proposed_transfers}</div>
          <span className="text-[10px] text-teal-700 font-medium mt-1 flex items-center">
            <span>In pipeline or transit</span>
            <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>

        {/* Solver State */}
        <div
          onClick={() => onNavigate('optimizer')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">MILP Solver</span>
            <Cpu className="w-4 h-4 text-blue-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-sm font-black text-slate-900 mt-3 truncate">{data.latest_optimization_status}</div>
          <span className="text-[10px] text-blue-600 font-medium mt-1 flex items-center">
            <span>HiGHS solver engine</span>
            <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>
      </div>

      {/* Main Grid: Interactive Map & Live Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Network Map */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Metropolitan Facility Network Map</h3>
              <p className="text-xs text-slate-500">Live geographic distribution of blood banks, hospitals, and transit routes.</p>
            </div>
            <button
              onClick={() => onNavigate('map')}
              className="text-xs text-teal-600 hover:underline font-semibold flex items-center space-x-1"
            >
              <span>Expand Map</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <NetworkMapView
            facilities={facilities}
            transfers={transfers}
            selectedFacility={selectedFacility}
            onSelectFacility={onSelectFacility}
          />
        </div>

        {/* Right 1 Col: Urgent Shortages & Expiries */}
        <div className="space-y-6">
          {/* Facilities at Shortage Risk */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Facilities With Shortage Deficits</h3>
              </div>
              <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">
                {data.shortage_facilities?.length || 0}
              </span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {data.shortage_facilities && data.shortage_facilities.length > 0 ? (
                data.shortage_facilities.map((fac) => (
                  <div
                    key={fac.facility_id}
                    className="p-2.5 rounded-lg border border-red-100 bg-red-50/40 hover:bg-red-50 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block truncate max-w-[170px]">{fac.name}</span>
                      <span className="text-[10px] text-slate-500">
                        Stock: {fac.available_stock} | Reserve: {fac.safety_reserve}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-red-600">-{fac.deficit} Units</span>
                      <span className="block text-[9px] text-red-500 uppercase font-bold">Deficit</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">All facilities meet safety reserves!</div>
              )}
            </div>
          </div>

          {/* Near-Expiry Items */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Approaching Expiry (&lt;72h)</h3>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                {data.approaching_expiry_items?.length || 0}
              </span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {data.approaching_expiry_items && data.approaching_expiry_items.length > 0 ? (
                data.approaching_expiry_items.map((it) => (
                  <div
                    key={it.id}
                    className="p-2.5 rounded-lg border border-amber-100 bg-amber-50/40 hover:bg-amber-50 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono font-bold text-slate-800">{it.tracking_id}</span>
                        <span className="font-black text-red-600 text-[11px]">{it.blood_group}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate max-w-[170px]">{it.facility_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-amber-700">{it.hours_remaining}h left</span>
                      <span className="block text-[9px] text-slate-400">{it.quantity} unit(s)</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">No units expiring within 72h.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Breakdown Charts & Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* By Blood Group */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Inventory by Blood Group</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="units" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Component Type */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Inventory by Component</h3>
          <div className="h-52 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={componentChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {componentChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-slate-600 justify-center">
            {componentChartData.map((c, i) => (
              <span key={i} className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                <span>{c.name}: {c.value}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Recent Transfer Activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Recent Transfers</h3>
            <button
              onClick={() => onNavigate('transfers')}
              className="text-xs text-teal-600 hover:underline font-semibold"
            >
              All Transfers
            </button>
          </div>

          <div className="space-y-2.5 max-h-52 overflow-y-auto">
            {data.recent_transfers && data.recent_transfers.length > 0 ? (
              data.recent_transfers.map((tx: any) => (
                <div key={tx.id} className="p-2.5 border border-slate-100 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-teal-800">{tx.transfer_id}</span>
                    <span className="font-bold uppercase text-[9px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {tx.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    {tx.origin} → {tx.destination}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {tx.quantity} units {tx.blood_group} {tx.component_type}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">No transfers recorded yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
