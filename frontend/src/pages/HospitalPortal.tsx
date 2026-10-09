import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Flame,
  Clock,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Thermometer,
  RotateCcw,
  Building2,
  ArrowRight,
  Plus
} from 'lucide-react';
import { Facility, EmergencyBloodRequest, Transfer } from '../types';
import {
  fetchEmergencyRequests,
  fetchTransfers,
  confirmDelivery,
  simulateTemperatureSpike
} from '../services/api';
import { EmergencyRequestModal } from '../components/EmergencyRequestModal';
import { useAuth } from '../context/AuthContext';

interface HospitalPortalProps {
  facilities: Facility[];
}

export const HospitalPortal: React.FC<HospitalPortalProps> = ({ facilities }) => {
  const { currentUser, playSuccess, playAlarm, speak } = useAuth();
  const [requests, setRequests] = useState<EmergencyBloodRequest[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<number>(
    currentUser?.facility_id || (facilities.find(f => f.facility_type.toLowerCase().includes('hospital'))?.id || 1)
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqs, txs] = await Promise.all([
        fetchEmergencyRequests({ hospital_id: selectedHospitalId }),
        fetchTransfers()
      ]);
      setRequests(reqs);
      // Filter transfers inbound to this hospital
      const inbound = txs.filter(t => t.destination_facility_id === selectedHospitalId);
      setTransfers(inbound);
    } catch (err) {
      console.error('Failed to load hospital portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 10000);
    return () => clearInterval(timer);
  }, [selectedHospitalId, currentUser]);

  const activeHospital = facilities.find(f => f.id === selectedHospitalId) || facilities[0];

  const handleConfirmDelivery = async (transferId: string) => {
    setProcessingId(transferId);
    try {
      playSuccess();
      speak(`Delivery accepted by hospital staff. Inventory stock incremented.`);
      await confirmDelivery(transferId, {
        receiver_name: currentUser?.name || 'Emergency Head Nurse'
      });
      await loadData();
    } catch (err: any) {
      alert(`Error accepting delivery: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSimulateSpike = async (transferId: string) => {
    setProcessingId(transferId);
    try {
      playAlarm();
      speak(`Warning: Temperature spike simulated. Immediate supervisor alert dispatched.`, 'urgent');
      await simulateTemperatureSpike(transferId, 12.0);
      await loadData();
    } catch (err: any) {
      alert(`Error simulating spike: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <span>Hospital Blood Requisition Portal</span>
              <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-semibold">
                STAT Priority Active
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct emergency dispatch channel to licensed Nashik blood banks & verified couriers
            </p>
          </div>
        </div>

        {/* Hospital Selector & Request CTA */}
        <div className="flex items-center space-x-3">
          <select
            value={selectedHospitalId}
            onChange={(e) => setSelectedHospitalId(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {facilities
              .filter(f => f.facility_type.toLowerCase().includes('hospital') || f.is_connected)
              .map(h => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.district || 'Nashik'})
                </option>
              ))}
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/25 flex items-center space-x-2 transition"
          >
            <Flame className="w-4 h-4 text-amber-300" />
            <span>Create STAT Request</span>
          </button>
        </div>
      </div>

      {/* Hospital Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">Selected Facility</p>
          <p className="font-bold text-sm text-slate-800 truncate">{activeHospital?.name}</p>
          <p className="text-[10px] text-emerald-600 font-medium">
            {activeHospital?.is_connected ? '• Connected to Life-Loop Network' : '• Directory Listing'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">Active Inbound Transfers</p>
          <p className="font-bold text-base text-slate-800">
            {transfers.filter(t => ['driver_assigned', 'dispatched'].includes(t.status)).length}
          </p>
          <p className="text-[10px] text-slate-500">Couriers currently en route</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">Safety Reserve Units</p>
          <p className="font-bold text-base text-slate-800">
            {activeHospital?.safety_reserve_units || 30} Units
          </p>
          <p className="text-[10px] text-teal-600">Threshold for critical alerts</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">Completed Deliveries</p>
          <p className="font-bold text-base text-emerald-700">
            {transfers.filter(t => ['delivered', 'received'].includes(t.status)).length}
          </p>
          <p className="text-[10px] text-slate-500">Atomic inventory reconciliations</p>
        </div>
      </div>

      {/* Inbound Transfers Tracker */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <Truck className="w-5 h-5 text-teal-600" />
            <span>Active Inbound Blood Shipments</span>
          </h2>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {transfers.filter(t => ['driver_assigned', 'dispatched'].includes(t.status)).length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-teal-500 mx-auto" />
            <h3 className="font-bold text-slate-700 text-sm">No Active Shipments in Transit</h3>
            <p className="text-xs text-slate-500">
              Click "Create STAT Request" above to source and dispatch blood units immediately.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {transfers
              .filter(t => ['driver_assigned', 'dispatched'].includes(t.status))
              .map(tx => (
                <div
                  key={tx.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono font-bold text-sm text-slate-900">{tx.transfer_id}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800 animate-pulse">
                        {tx.status === 'dispatched' ? 'In Transit' : 'Courier Assigned'}
                      </span>
                      <span className="text-xs text-slate-500">
                        From: <strong>{tx.origin_name}</strong>
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 text-xs">
                      <span className="text-slate-500">Distance: {tx.distance_km} km</span>
                      <span className="font-bold text-slate-800">
                        ETA: {tx.eta_minutes ?? tx.travel_time_minutes} mins
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-red-50/60 rounded-xl border border-red-100">
                      <p className="text-[10px] font-bold text-red-600 uppercase">Cargo</p>
                      <p className="font-bold text-sm text-red-900">{tx.quantity} Units • {tx.blood_group}</p>
                      <p className="text-xs text-red-700">{tx.component_type}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Assigned Courier</p>
                      <p className="font-bold text-sm text-slate-800">{tx.driver_name || 'Assigned Courier'}</p>
                      <p className="text-xs text-slate-500">{tx.driver_vehicle || 'Refrigerated Carrier'}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Cold-Box Temperature</p>
                        <p className={`font-bold text-sm ${tx.temperature_status === 'critical' ? 'text-red-600' : 'text-emerald-700'}`}>
                          {tx.temperature_current_c != null ? `${tx.temperature_current_c.toFixed(1)}°C` : '4.1°C'}
                        </p>
                        <p className="text-[10px] text-slate-500">Safe Range: 2°C - 6°C</p>
                      </div>

                      {tx.status === 'dispatched' && (
                        <button
                          onClick={() => handleSimulateSpike(tx.transfer_id)}
                          disabled={processingId === tx.transfer_id}
                          className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded text-[11px] font-semibold transition"
                          title="Simulate excursion for demonstration"
                        >
                          Trigger Spike
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-2">
                    {tx.status === 'dispatched' && (
                      <button
                        onClick={() => handleConfirmDelivery(tx.transfer_id)}
                        disabled={processingId === tx.transfer_id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Receipt & Handover</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Emergency Requests History */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-slate-600" />
          <span>Recent Requisition Log</span>
        </h2>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Request ID</th>
                  <th className="px-4 py-3">Blood Group</th>
                  <th className="px-4 py-3">Component</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Urgency</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                      No emergency requests logged yet.
                    </td>
                  </tr>
                ) : (
                  requests.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{r.request_id}</td>
                      <td className="px-4 py-3 font-bold text-red-600">{r.blood_group}</td>
                      <td className="px-4 py-3 text-slate-700">{r.component_type}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{r.quantity_needed} units</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.urgency === 'critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.urgency}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize font-semibold text-slate-700">
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Emergency Request Modal */}
      <EmergencyRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        facilities={facilities}
        onRequestCreated={loadData}
      />
    </div>
  );
};
