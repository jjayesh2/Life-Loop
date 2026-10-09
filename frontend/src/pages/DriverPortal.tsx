import React, { useState, useEffect } from 'react';
import {
  Truck,
  MapPin,
  Navigation,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Thermometer,
  RotateCcw,
  Phone,
  UserCheck,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { Transfer, Driver } from '../types';
import {
  fetchDrivers,
  fetchDriverAssignments,
  driverRespond,
  confirmDriverPickup,
  confirmDelivery,
  simulateTemperatureSpike
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export const DriverPortal: React.FC = () => {
  const { currentUser, playSuccess, playAlarm, playPing, speak } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<number>(1);
  const [assignments, setAssignments] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const drvList = await fetchDrivers();
      setDrivers(drvList);

      // If currentUser is driver, select their id
      if (currentUser?.role === 'driver') {
        const found = drvList.find(d => d.user_id === currentUser.id);
        if (found) setSelectedDriverId(found.id);
      }

      const activeId = currentUser?.role === 'driver' && drivers.find(d => d.user_id === currentUser.id)
        ? drivers.find(d => d.user_id === currentUser.id)!.id
        : selectedDriverId;

      const txs = await fetchDriverAssignments(activeId);
      setAssignments(txs);
    } catch (err) {
      console.error('Failed to load driver assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 10000);
    return () => clearInterval(timer);
  }, [selectedDriverId, currentUser]);

  const activeDriver = drivers.find(d => d.id === selectedDriverId) || drivers[0];

  const handleAccept = async (transferId: string) => {
    setProcessingId(transferId);
    try {
      playSuccess();
      speak(`Mission accepted. Proceed to pickup facility.`);
      await driverRespond(transferId, {
        driver_id: selectedDriverId,
        action: 'accept'
      });
      await loadData();
    } catch (err: any) {
      alert(`Error accepting mission: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (transferId: string) => {
    const reason = prompt('Reason for declining this mission:', 'Vehicle inspection / Traffic gridlock');
    if (!reason) return;

    setProcessingId(transferId);
    try {
      playPing();
      speak(`Mission declined. Reassigning nearest backup courier.`);
      await driverRespond(transferId, {
        driver_id: selectedDriverId,
        action: 'decline',
        decline_reason: reason
      });
      await loadData();
    } catch (err: any) {
      alert(`Error declining mission: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePickup = async (transferId: string) => {
    setProcessingId(transferId);
    try {
      playSuccess();
      speak(`Pickup confirmed. Cold-chain seal active. En route to receiving hospital.`);
      await confirmDriverPickup(transferId, {
        driver_name: activeDriver?.name || 'Courier Driver'
      });
      await loadData();
    } catch (err: any) {
      alert(`Error confirming pickup: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeliver = async (transferId: string) => {
    setProcessingId(transferId);
    try {
      playSuccess();
      speak(`Delivery confirmed at receiving hospital. Emergency blood supply replenished.`);
      await confirmDelivery(transferId, {
        receiver_name: 'Emergency Department Ward Head'
      });
      await loadData();
    } catch (err: any) {
      alert(`Error confirming delivery: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleTempSpike = async (transferId: string) => {
    setProcessingId(transferId);
    try {
      playAlarm();
      speak(`Warning! Simulated cold chain excursion detected on transfer. Temperature rose to 11.5 degrees Celsius.`, 'urgent');
      await simulateTemperatureSpike(transferId, 11.5);
      await loadData();
    } catch (err: any) {
      alert(`Error simulating temperature spike: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header with Driver Switcher */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <span>Driver Dispatch & Transit Console</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                Live GPS Active
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Nashik Rapid Blood Transit Courier Fleet • Refrigerated Cold-Chain Transport
            </p>
          </div>
        </div>

        {/* Driver selector */}
        <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-xs font-semibold text-slate-600">Select Courier:</span>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(Number(e.target.value))}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {drivers.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} • {d.vehicle_type} ({d.vehicle_number})
              </option>
            ))}
          </select>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
            title="Refresh"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Driver Status Card */}
      {activeDriver && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Active Driver</p>
              <p className="font-bold text-sm text-white">{activeDriver.name}</p>
              <p className="text-[10px] text-teal-400">{activeDriver.phone}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Vehicle</p>
              <p className="font-bold text-sm text-slate-800">{activeDriver.vehicle_type}</p>
              <p className="text-[10px] text-slate-500 font-mono">{activeDriver.vehicle_number}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Current Zone</p>
              <p className="font-bold text-sm text-slate-800">Dwarka Circle / CBS</p>
              <p className="text-[10px] text-emerald-600 font-medium">GPS Signal Strong</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Active Missions</p>
              <p className="font-bold text-sm text-slate-800">
                {assignments.filter(a => ['driver_assigned', 'dispatched'].includes(a.status)).length} Ongoing
              </p>
              <p className="text-[10px] text-slate-500">
                {assignments.filter(a => a.status === 'delivered').length} Completed Today
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Assignment List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
          <span>Assigned Emergency Missions</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {assignments.length} total
          </span>
        </h2>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading missions...</div>
        ) : assignments.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-700 text-sm">No Active Missions for this Driver</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Submit an Emergency Blood Request from Apollo Hospital or trigger an incident in the Emergency Simulator to assign a mission!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {assignments.map(tx => {
              const isPending = tx.status === 'driver_assigned' && tx.driver_status === 'pending';
              const isAccepted = tx.status === 'driver_assigned' && tx.driver_status === 'accepted';
              const isInTransit = tx.status === 'dispatched';
              const isDelivered = tx.status === 'delivered' || tx.status === 'received';

              return (
                <div
                  key={tx.id}
                  className={`bg-white rounded-2xl border transition shadow-sm p-6 space-y-5 ${
                    isInTransit
                      ? 'border-blue-300 ring-2 ring-blue-100'
                      : isPending
                      ? 'border-amber-300 ring-2 ring-amber-100'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top Bar of Transfer Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {tx.transfer_id}
                      </span>
                      {tx.request_id && (
                        <span className="text-xs text-slate-400">
                          (Req: #{tx.request_id})
                        </span>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        isInTransit
                          ? 'bg-blue-100 text-blue-800 animate-pulse'
                          : isPending
                          ? 'bg-amber-100 text-amber-800'
                          : isDelivered
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {isInTransit ? 'In Transit' : isPending ? 'Action Required' : tx.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-slate-500">
                      <span className="flex items-center space-x-1">
                        <Navigation className="w-3.5 h-3.5 text-slate-400" />
                        <span>{tx.distance_km} km</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <strong>ETA: {tx.eta_minutes ?? tx.travel_time_minutes} mins</strong>
                      </span>
                    </div>
                  </div>

                  {/* Route & Cargo details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Origin */}
                    <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-red-500" />
                        <span>Pickup Location</span>
                      </p>
                      <p className="font-bold text-sm text-slate-800">{tx.origin_name || 'Origin Blood Bank'}</p>
                      <p className="text-xs text-slate-500">Facility ID #{tx.origin_facility_id}</p>
                    </div>

                    {/* Destination */}
                    <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        <span>Dropoff Hospital</span>
                      </p>
                      <p className="font-bold text-sm text-slate-800">{tx.destination_name || 'Destination Hospital'}</p>
                      <p className="text-xs text-slate-500">Facility ID #{tx.destination_facility_id}</p>
                    </div>

                    {/* Cargo */}
                    <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                        Biological Cargo
                      </p>
                      <p className="font-bold text-sm text-red-900">
                        {tx.quantity} Units • {tx.blood_group}
                      </p>
                      <p className="text-xs text-red-700">{tx.component_type}</p>
                    </div>
                  </div>

                  {/* Cold-Chain Live Status & Simulator Spike */}
                  <div className="p-4 rounded-xl border bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        tx.temperature_status === 'critical'
                          ? 'bg-red-100 text-red-600 animate-bounce'
                          : tx.temperature_status === 'warning'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        <Thermometer className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-700">Cold Box Temperature:</span>
                          <span className={`text-sm font-extrabold ${
                            tx.temperature_status === 'critical' ? 'text-red-600' : 'text-slate-900'
                          }`}>
                            {tx.temperature_current_c != null ? `${tx.temperature_current_c.toFixed(1)}°C` : '4.0°C'}
                          </span>
                          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase ${
                            tx.temperature_status === 'critical'
                              ? 'bg-red-200 text-red-900'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {tx.temperature_status === 'critical' ? 'EXCURSION SPIKE' : 'Optimal (2-6°C)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          IoT Vaccine/Blood Carrier BLE Sensor #SN-8849 • Logging every 30s
                        </p>
                      </div>
                    </div>

                    {/* Judge Demonstration Temperature Trigger */}
                    {isInTransit && (
                      <button
                        onClick={() => handleTempSpike(tx.transfer_id)}
                        disabled={processingId === tx.transfer_id}
                        className="px-3 py-2 bg-rose-50 border border-rose-300 hover:bg-rose-100 text-rose-800 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition flex-shrink-0"
                        title="Simulate a cold box lid breach or ice pack failure"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Simulate Temp Spike (+11.5°C)</span>
                      </button>
                    )}
                  </div>

                  {/* Action Buttons based on status */}
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleDecline(tx.transfer_id)}
                          disabled={processingId === tx.transfer_id}
                          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition"
                        >
                          Decline Mission
                        </button>
                        <button
                          onClick={() => handleAccept(tx.transfer_id)}
                          disabled={processingId === tx.transfer_id}
                          className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/20 flex items-center space-x-1.5 transition"
                        >
                          <span>Accept Assignment</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isAccepted && (
                      <button
                        onClick={() => handlePickup(tx.transfer_id)}
                        disabled={processingId === tx.transfer_id}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center space-x-1.5 transition"
                      >
                        <Truck className="w-4 h-4" />
                        <span>Confirm Pickup & Seal Box</span>
                      </button>
                    )}

                    {isInTransit && (
                      <button
                        onClick={() => handleDeliver(tx.transfer_id)}
                        disabled={processingId === tx.transfer_id}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Delivery at Hospital</span>
                      </button>
                    )}

                    {isDelivered && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Delivery Verified & Stock Reconciled</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
