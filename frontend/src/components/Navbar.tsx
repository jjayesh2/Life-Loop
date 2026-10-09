import React, { useState } from 'react';
import {
  Search,
  Bell,
  Building2,
  Sparkles,
  User as UserIcon,
  Radio,
  CheckCircle2,
  AlertCircle,
  Flame,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ChevronDown
} from 'lucide-react';
import { Facility, Alert } from '../types';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  facilities: Facility[];
  selectedFacility: number | null;
  setSelectedFacility: (id: number | null) => void;
  onOpenCopilot: () => void;
  onNavigateToAlerts: () => void;
  onOpenEmergencyModal: () => void;
  alerts: Alert[];
  onSearch: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  facilities,
  selectedFacility,
  setSelectedFacility,
  onOpenCopilot,
  onNavigateToAlerts,
  onOpenEmergencyModal,
  alerts,
  onSearch
}) => {
  const {
    currentUser,
    demoUsers,
    switchUser,
    soundSettings,
    toggleSound,
    toggleVoice,
    toggleMute
  } = useAuth();

  const [searchVal, setSearchVal] = useState('');
  const [showAlertMenu, setShowAlertMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const { currentUser, demoUsers, switchUser, soundEnabled, toggleSound, voiceEnabled, toggleVoice } = useAuth();
  const activeAlerts = alerts.filter(a => a.status === 'active');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      onSearch(searchVal.trim());
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'hospital_staff':
        return { text: 'Hospital Staff', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'blood_bank_staff':
        return { text: 'Blood Bank', bg: 'bg-teal-100 text-teal-800 border-teal-200' };
      case 'driver':
        return { text: 'Courier Driver', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
      default:
        return { text: 'Network Admin', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
    }
  };

  const roleBadge = getRoleBadge(currentUser?.role);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Left: Global Search & Facility Filter */}
      <div className="flex items-center space-x-3 flex-1 max-w-2xl">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tracking ID (e.g. LL-NSK-), batch ref, facility, blood group..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
          />
        </form>

        {/* Facility Selector - Admin only */}
        {currentUser?.role === 'admin' ? (
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <Building2 className="w-4 h-4 text-slate-500" />
            <select
              value={selectedFacility ?? ''}
              onChange={(e) => setSelectedFacility(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="">All Nashik Facilities</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.is_connected ? '🟢' : '⚪ (Public)'}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="hidden sm:flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <Building2 className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-semibold text-slate-700 truncate max-w-[180px]">
              {currentUser?.facility_name || 'Assigned Logistics Fleet'}
            </span>
          </div>
        )}
      </div>

      {/* Right Action Icons & Status */}
      <div className="flex items-center space-x-3">
        {/* STAT Emergency Request Action Button - Hospital Staff and Admin only */}
        {currentUser?.role && ['hospital_staff', 'admin'].includes(currentUser.role) && (
          <button
            onClick={onOpenEmergencyModal}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm text-xs font-bold transition animate-pulse"
            title="Create STAT Emergency Blood Requisition"
          >
            <Flame className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">STAT Request</span>
          </button>
        )}

        {/* Sound & Voice Audio Toggles */}
        <div className="flex items-center space-x-1 border-r border-slate-200 pr-2">
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              soundEnabled ? 'text-teal-700 bg-teal-50 hover:bg-teal-100' : 'text-slate-400 hover:bg-slate-100'
            }`}
            title={soundEnabled ? 'Web Audio Sirens & Chimes: ON' : 'Web Audio Sirens & Chimes: OFF'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleVoice}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              voiceEnabled ? 'text-teal-700 bg-teal-50 hover:bg-teal-100' : 'text-slate-400 hover:bg-slate-100'
            }`}
            title={voiceEnabled ? 'Voice Announcements (Indian English): ON' : 'Voice Announcements: OFF'}
          >
            {voiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
        </div>

        {/* AI Operations Copilot Button */}
        <button
          onClick={onOpenCopilot}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-navy-900 text-teal-300 hover:bg-navy-850 hover:text-white border border-navy-700 shadow-sm text-xs font-semibold transition"
          title="Open AI Operations Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden md:inline">AI Copilot</span>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlertMenu(!showAlertMenu)}
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            title="Expiry & Shortage Alerts"
          >
            <Bell className="w-4 h-4" />
            {activeAlerts.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {/* Quick Alerts Dropdown */}
          {showAlertMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-40 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
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
                  <div className="p-4 text-center text-xs text-slate-400">No active alerts</div>
                ) : (
                  activeAlerts.slice(0, 4).map((al) => (
                    <div key={al.id} className="p-3 hover:bg-slate-50 transition text-xs">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${al.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
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

        {/* Demo Persona Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition text-left"
          >
            <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
              {currentUser?.role === 'admin' ? 'AD' : (currentUser?.role === 'driver' ? 'DR' : 'MD')}
            </div>
            <div className="hidden lg:flex flex-col">
              <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[140px]">
                {currentUser?.name || 'Dr. Deshmukh'}
              </span>
              <span className="text-[10px] text-teal-600 font-medium uppercase tracking-tight">
                {currentUser?.role?.replace('_', ' ') || 'Admin'}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-40 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                1-Click Demo Persona Switcher
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {demoUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      switchUser(u);
                      setShowUserMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                      currentUser?.id === u.id ? 'bg-teal-50 font-bold text-teal-900' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-semibold block">{u.name}</span>
                      <span className="text-[10px] text-slate-400 block">{u.facility_name || 'Logistics Fleet'}</span>
                    </div>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-600">
                      {u.role.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
