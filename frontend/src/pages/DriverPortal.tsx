import React, { useState, useEffect } from 'react';
import {
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Thermometer,
  ShieldCheck,
  Navigation,
  Smartphone,
  RefreshCw,
  Package,
  Check
} from 'lucide-react';
import { Transfer, Driver } from '../types';
import {
  fetchTransfers,
  fetchDrivers,
  submitDriverAction,
  assignDriverToTransfer,
  subscribeToRealtimeEvents
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { soundService } from '../services/soundService';

export const DriverPortal: React.FC = () => {
  const { currentUser } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeDriver, setActiveDriver] = useState<Driver | null>(null);
  const [activeTab, setActiveTab] = useState<'assigned' | 'available_jobs'>('assigned');
  const [isClaiming, setIsClaiming] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [txs, drvs] = await Promise.all([
        fetchTransfers(),
        fetchDrivers()
      ]);
      setTransfers(txs);
      setDrivers(drvs);

      if (currentUser?.role === 'driver') {
        const found = drvs.find(d => d.user_id === currentUser.id || d.name === currentUser.name);
        setActiveDriver(found || drvs[0]);
      } else {
        setActiveDriver(drvs[0] || null);
      }
    } catch (err) {
      console.error("Failed to load driver data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = subscribeToRealtimeEvents((event) => {
      if (
        event.type === 'TRANSFER_APPROVED' ||
        event.type === 'TRANSFER_REJECTED' ||
        event.type === 'EMERGENCY_REQUEST_UPDATED' ||
        event.type === 'STATUS_CHANGE'
      ) {
        loadData();
      }
    });

    const interval = setInterval(loadData, 6000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser]);

  const handleAction = async (transferId: string, action: 'accept' | 'pickup' | 'deliver') => {
    try {
      if (action === 'accept') {
        soundService.playAlertPing();
        soundService.speak("Mission accepted. Route to supplying blood bank plotted.");
      } else if (action === 'pickup') {
        soundService.playSuccessChime();
        soundService.speak("Cold box collected. Cold chain active at 4 degrees Celsius. Proceeding to destination hospital.");
      } else if (action === 'deliver') {
        soundService.playSuccessChime();
        soundService.speak("Consignment delivered safely. Hospital staff notified for bedside verification.");
      }

      await submitDriverAction(transferId, action);
      await loadData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleClaimJob = async (transferId: string) => {
    if (!activeDriver) return;
    try {
      setIsClaiming(transferId);
      soundService.playAlertPing();
      await assignDriverToTransfer(transferId, activeDriver.id);
      soundService.speak(`Assignment locked. Transport mission assigned to ${activeDriver.name}.`);
      await loadData();
    } catch (err: any) {
      alert(`Claim failed: ${err.message}`);
    } finally {
      setIsClaiming(null);
    }
  };

  // 1. My Assigned Deliveries: assigned to this active driver
  const myAssignedMissions = transfers.filter(
    t => t.driver_id === activeDriver?.id
  );

  // 2. Available Authorized Transport Jobs: ready for driver pickup but unassigned
  const availableUnassignedJobs = transfers.filter(
    t => (t.driver_id === null || t.driver_status === 'unassigned') &&
         ['ready_for_driver', 'approved', 'reserved'].includes(t.status)
  );

  return (
    <div className="space-y-6">
      {/* Driver Console Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-navy-900 to-slate-800 text-white p-6 rounded-2xl shadow-lg border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-400 flex items-center justify-center">
              <Truck className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight">Authorized Courier Mobile Console</h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>GPS Telemetry Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Active Courier: <strong className="text-white">{activeDriver?.name || 'Suresh Shinde'}</strong> ({activeDriver?.vehicle_type} - {activeDriver?.vehicle_number})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={activeDriver?.id || ''}
              onChange={(e) => {
                const d = drivers.find(drv => drv.id === Number(e.target.value));
                if (d) setActiveDriver(d);
              }}
              className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none"
            >
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.vehicle_number})</option>
              ))}
            </select>
            <button
              onClick={loadData}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
              title="Refresh Assignments"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs: My Assigned Missions vs Available Unassigned Jobs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('assigned')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === 'assigned'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          My Assigned Deliveries ({myAssignedMissions.length})
        </button>
        <button
          onClick={() => setActiveTab('available_jobs')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
            activeTab === 'available_jobs'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Available Authorized Jobs ({availableUnassignedJobs.length})</span>
        </button>
      </div>

      {/* Content for Assigned Missions */}
      {activeTab === 'assigned' && (
        <div className="space-y-4">
          {myAssignedMissions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              <Truck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-sm">No active delivery assignments assigned to you.</p>
              <p className="text-xs mt-1">Check "Available Authorized Jobs" tab to accept an approved consignment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {myAssignedMissions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    tx.driver_status === 'delivered' || tx.status === 'received'
                      ? 'bg-emerald-500'
                      : (tx.driver_status === 'in_transit' ? 'bg-blue-500' : 'bg-amber-500')
                  }`} />

                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-black text-teal-700 block">{tx.transfer_id}</span>
                      <h3 className="font-bold text-slate-900 text-sm mt-0.5">
                        {tx.quantity} units of {tx.blood_group} {tx.component_type}
                      </h3>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      tx.driver_status === 'delivered' || tx.status === 'received'
                        ? 'bg-emerald-100 text-emerald-800'
                        : (tx.driver_status === 'in_transit' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800')
                    }`}>
                      {tx.driver_status || tx.status}
                    </span>
                  </div>

                  {/* Pickup and Destination Details */}
                  <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Pickup (Supplying Blood Bank)</span>
                        <span className="font-bold text-slate-800">{tx.origin_name || 'Supplying Facility'}</span>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex items-start space-x-2">
                      <Navigation className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Delivery (Destination Hospital)</span>
                        <span className="font-bold text-slate-800">{tx.destination_name || 'Destination Center'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Strip */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Distance</span>
                      <span className="font-bold text-slate-800">{tx.distance_km || 6.2} km</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Est. Transit</span>
                      <span className="font-bold text-slate-800">{Math.round(tx.travel_time_minutes)} min</span>
                    </div>
                    <div className={`p-2 rounded-lg border ${
                      tx.temperature_status === 'critical_excursion'
                        ? 'bg-red-50 border-red-200 text-red-700 animate-pulse'
                        : 'bg-teal-50 border-teal-100 text-teal-800'
                    }`}>
                      <span className="text-[10px] block font-semibold flex items-center justify-center space-x-1">
                        <Thermometer className="w-3 h-3" />
                        <span>Cold Box Temp</span>
                      </span>
                      <span className="font-black">{tx.temperature_current_c ?? 4.0}°C</span>
                    </div>
                  </div>

                  {/* Smartphone Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                    {(!tx.driver_status || tx.driver_status === 'unassigned' || tx.driver_status === 'assigned') && (
                      <button
                        onClick={() => handleAction(tx.transfer_id, 'accept')}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Acknowledge Mission</span>
                      </button>
                    )}

                    {tx.driver_status === 'accepted' && (
                      <button
                        onClick={() => handleAction(tx.transfer_id, 'pickup')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Confirm Pickup from Blood Bank</span>
                      </button>
                    )}

                    {tx.driver_status === 'in_transit' && (
                      <button
                        onClick={() => handleAction(tx.transfer_id, 'deliver')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Confirm Delivery at Hospital</span>
                      </button>
                    )}

                    {tx.driver_status === 'delivered' && tx.status !== 'received' && (
                      <span className="text-xs font-bold text-blue-700 flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span>Delivered — Awaiting Hospital Nurse Confirmation</span>
                      </span>
                    )}

                    {tx.status === 'received' && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Delivery Verified &amp; Inventory Reconciled</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content for Available Unassigned Jobs */}
      {activeTab === 'available_jobs' && (
        <div className="space-y-4">
          {availableUnassignedJobs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-sm">No unassigned consignments currently waiting.</p>
              <p className="text-xs mt-1">When a blood bank accepts an emergency request, a ready job will appear here for pickup.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {availableUnassignedJobs.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-black text-teal-700 block">{tx.transfer_id}</span>
                      <h3 className="font-bold text-slate-900 text-sm mt-0.5">
                        {tx.quantity} units of {tx.blood_group} {tx.component_type}
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                      Ready for Driver
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Pickup</span>
                        <span className="font-bold text-slate-800">{tx.origin_name || 'Blood Bank'}</span>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex items-start space-x-2">
                      <Navigation className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Deliver To</span>
                        <span className="font-bold text-slate-800">{tx.destination_name || 'Hospital'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Est. Road Distance: <strong>{tx.distance_km || 5.0} km</strong> ({Math.round(tx.travel_time_minutes)} min)
                    </span>
                    <button
                      onClick={() => handleClaimJob(tx.transfer_id)}
                      disabled={isClaiming === tx.transfer_id}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isClaiming === tx.transfer_id ? 'Claiming...' : 'Claim This Assignment'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
