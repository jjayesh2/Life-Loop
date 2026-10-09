import React, { useState } from 'react';
import {
  Search,
  Bell,
  Building2,
  Sparkles,
  User,
  Radio,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Facility, Alert } from '../types';

interface NavbarProps {
  facilities: Facility[];
  selectedFacility: number | null;
  setSelectedFacility: (id: number | null) => void;
  onOpenCopilot: () => void;
  onNavigateToAlerts: () => void;
  alerts: Alert[];
  onSearch: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  facilities,
  selectedFacility,
  setSelectedFacility,
  onOpenCopilot,
  onNavigateToAlerts,
  alerts,
  onSearch
}) => {
  const [searchVal, setSearchVal] = useState('');
  const [showAlertMenu, setShowAlertMenu] = useState(false);

  const activeAlerts = alerts.filter(a => a.status === 'active');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      onSearch(searchVal.trim());
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      {/* Left: Global Search & Facility Filter */}
      <div className="flex items-center space-x-4 flex-1 max-w-2xl">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tracking ID (e.g. LL-OPOS), batch ref, facility, blood group..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
          />
        </form>

        {/* Facility Selector */}
        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <Building2 className="w-4 h-4 text-slate-500" />
          <select
            value={selectedFacility ?? ''}
            onChange={(e) => setSelectedFacility(e.target.value ? Number(e.target.value) : null)}
            className="bg-transparent text-sm text-slate-750 font-medium focus:outline-none cursor-pointer"
          >
            <option value="">All Facilities (Network)</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.facility_type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Action Icons & Status */}
      <div className="flex items-center space-x-4">
        {/* Simulation Mode Indicator */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
          <Radio className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
          <span>MILP Active</span>
        </div>

        {/* AI Operations Copilot Button */}
        <button
          onClick={onOpenCopilot}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-navy-900 text-teal-300 hover:bg-navy-850 hover:text-white border border-navy-700 shadow-sm text-xs font-semibold transition"
          title="Open AI Operations Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span>AI Copilot</span>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlertMenu(!showAlertMenu)}
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            title="Expiry & Shortage Alerts"
          >
            <Bell className="w-5 h-5" />
            {activeAlerts.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {/* Quick Alerts Dropdown */}
          {showAlertMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-30 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-750 uppercase tracking-wider">
                  Active Alerts ({activeAlerts.length})
                </span>
                <button
                  onClick={() => {
                    setShowAlertMenu(false);
                    onNavigateToAlerts();
                  }}
                  className="text-xs text-teal-600 hover:underline font-semibold"
                >
                  View All
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {activeAlerts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No active expiry or shortage alerts</div>
                ) : (
                  activeAlerts.slice(0, 4).map((al) => (
                    <div key={al.id} className="p-3 hover:bg-slate-50 transition text-xs">
                      <div className="flex items-start space-x-2">
                        {al.severity === 'critical' || al.severity === 'urgent' ? (
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-slate-800 line-clamp-2">{al.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(al.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User / Role Badge */}
        <div className="flex items-center space-x-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 leading-tight">Logistics Officer</span>
            <span className="text-[10px] text-slate-400 leading-tight">Metro Network Lead</span>
          </div>
        </div>
      </div>
    </header>
  );
};
