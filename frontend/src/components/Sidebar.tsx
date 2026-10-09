import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  QrCode,
  BellRing,
  TrendingUp,
  MapPin,
  Cpu,
  Flame,
  Truck,
  BarChart3,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  HeartPulse
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  alertCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  collapsed,
  setCollapsed,
  alertCount
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
    { id: 'inventory', label: 'Blood Inventory', icon: Boxes },
    { id: 'traceability', label: 'QR Traceability', icon: QrCode },
    { id: 'alerts', label: 'Expiry Alerts', icon: BellRing, badge: alertCount },
    { id: 'forecasts', label: 'Demand & Forecasts', icon: TrendingUp },
    { id: 'map', label: 'Network Map', icon: MapPin },
    { id: 'optimizer', label: 'Optimization Engine', icon: Cpu },
    { id: 'simulator', label: 'Emergency Simulator', icon: Flame },
    { id: 'transfers', label: 'Transfer Management', icon: Truck },
    { id: 'analytics', label: 'Analytics & Impact', icon: BarChart3 },
    { id: 'audit', label: 'Audit Trail', icon: History },
    { id: 'settings', label: 'Settings & Controls', icon: Settings },
  ];

  return (
    <aside
      className={`bg-navy-900 border-r border-navy-800 text-slate-300 flex flex-col transition-all duration-300 z-20 select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-navy-800">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-teal-500 p-0.5 flex-shrink-0 flex items-center justify-center shadow-md">
            <div className="w-full h-full bg-navy-900 rounded-[10px] flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-red-500" />
            </div>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-white tracking-wide text-base leading-tight">LIFE-LOOP</span>
              <span className="text-[10px] text-teal-400 font-medium tracking-tighter truncate">
                Every Unit Matters. Every Minute Counts.
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-navy-800 transition"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 py-4 overflow-y-auto px-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal-600/20 text-teal-300 border-l-4 border-teal-500 pl-2'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-850'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
              {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      {!collapsed && (
        <div className="p-4 border-t border-navy-800 bg-navy-950/40 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>Optimization:</span>
            <span className="text-teal-400 font-mono text-[11px] font-semibold">HiGHS MILP</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span>Database:</span>
            <span className="text-slate-300 font-mono text-[11px]">SQLite Sync</span>
          </div>
        </div>
      )}
    </aside>
  );
};
