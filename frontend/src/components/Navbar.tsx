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
  const [showRoleMenu, setShowRoleMenu] = useState(false);

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
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm select-none">
      {/* Left: Global Search & Facility Filter */}
      <div className="flex items-center space-x-3 flex-1 max-w-2xl">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tracking ID (e.g. LL-OPOS), facility, blood group..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
          />
        </form>

        {/* Facility Selector */}
        <div className="hidden md:flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedFacility ?? ''}
            onChange={(e) => setSelectedFacility(e.target.value ? Number(e.target.value) : null)}
            className="bg-transparent text-xs text-slate-800 font-medium focus:outline-none cursor-pointer max-w-[180px] truncate"
          >
            <option value="">All Nashik Facilities</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.is_connected ? 'Live' : 'Public'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2.5">
        {/* STAT Blood Request Button */}
        <button
          onClick={onOpenEmergencyModal}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm shadow-red-500/25 transition"
          title="Broadcast Emergency STAT Blood Request"
        >
          <Flame className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
          <span className="hidden sm:inline">STAT Request</span>
        </button>

        {/* Audio Sound FX Toggle */}
        <button
          onClick={toggleSound}
          className={`p-2 rounded-lg border text-xs transition ${
            soundSettings.soundEnabled && !soundSettings.isMuted
              ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              : 'bg-red-50 text-red-600 border-red-200'
          }`}
          title={soundSettings.soundEnabled && !soundSettings.isMuted ? 'Sound FX Enabled (Click to toggle)' : 'Sound Muted'}
        >
          {soundSettings.soundEnabled && !soundSettings.isMuted ? (
            <Volume2 className="w-4 h-4 text-slate-600" />
          ) : (
            <VolumeX className="w-4 h-4 text-red-500" />
          )}
        </button>

        {/* Browser Speech Announcements Toggle */}
        <button
          onClick={toggleVoice}
          className={`p-2 rounded-lg border text-xs transition ${
            soundSettings.voiceEnabled && !soundSettings.isMuted
              ? 'bg-slate-50 text-teal-700 border-slate-200 hover:bg-slate-100'
              : 'bg-red-50 text-red-600 border-red-200'
          }`}
          title={soundSettings.voiceEnabled && !soundSettings.isMuted ? 'Voice Announcements ON (Indian English)' : 'Voice Announcements OFF'}
        >
          {soundSettings.voiceEnabled && !soundSettings.isMuted ? (
            <Mic className="w-4 h-4 text-teal-600" />
          ) : (
            <MicOff className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* AI Operations Copilot Button */}
        <button
          onClick={onOpenCopilot}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-navy-900 text-teal-300 hover:bg-navy-850 hover:text-white border border-navy-700 shadow-sm text-xs font-semibold transition"
          title="Open AI Operations Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden lg:inline">Copilot</span>
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
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {/* Quick Alerts Dropdown */}
          {showAlertMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-40 animate-in fade-in zoom-in-95">
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
                  <div className="p-4 text-center text-xs text-slate-400">No active alerts</div>
                ) : (
                  activeAlerts.slice(0, 4).map((al) => (
                    <div key={al.id} className="p-3 hover:bg-slate-50 transition text-xs">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
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

        {/* 1-Click Demo Role Switcher Dropdown */}
        <div className="relative pl-1 border-l border-slate-200">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-100 transition border border-transparent hover:border-slate-200 text-left"
            title="Switch Demo Role (Judge Testing)"
          >
            <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <div className="hidden md:flex flex-col">
              <div className="flex items-center space-x-1">
                <span className="text-xs font-bold text-slate-900 leading-none truncate max-w-[110px]">
                  {currentUser?.name || 'Admin'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border mt-0.5 inline-block ${roleBadge.bg}`}>
                {roleBadge.text}
              </span>
            </div>
          </button>

          {/* Role selector dropdown */}
          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Judge Demo Role Switcher
                </p>
                <p className="text-xs text-slate-600">Switch persona instantly to verify multi-role workflows:</p>
              </div>

              <div className="p-1 space-y-1 max-h-72 overflow-y-auto">
                {demoUsers.map((u) => {
                  const isSelected = currentUser?.id === u.id;
                  const badge = getRoleBadge(u.role);
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchUser(u);
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between text-xs ${
                        isSelected
                          ? 'bg-teal-50 border border-teal-200 text-teal-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{u.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {u.facility_name ? u.facility_name : u.vehicle_type ? `${u.vehicle_type} (${u.vehicle_number})` : u.email}
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${badge.bg}`}>
                        {badge.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
