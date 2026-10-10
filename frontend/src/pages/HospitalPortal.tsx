import React, { useState, useEffect } from 'react';
import {
  Building2,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Plus,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { Facility, EmergencyRequest } from '../types';
import { fetchEmergencyRequests, subscribeToRealtimeEvents } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface HospitalPortalProps {
  facilities: Facility[];
  onOpenEmergencyModal: () => void;
}

export const HospitalPortal: React.FC<HospitalPortalProps> = ({ facilities, onOpenEmergencyModal }) => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewScope, setViewScope] = useState<'my_requests' | 'network_stat'>('my_requests');

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await fetchEmergencyRequests(currentUser?.facility_id || undefined);
      setRequests(data);
    } catch (err) {
      console.error("Failed to load emergency requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    
    // Subscribe to real-time WebSocket events across devices
    const unsubscribe = subscribeToRealtimeEvents((event) => {
      if (
        event.type === 'EMERGENCY_REQUEST_CREATED' ||
        event.type === 'TRANSFER_APPROVED' ||
        event.type === 'TRANSFER_REJECTED' ||
        event.type === 'EMERGENCY_REQUEST_UPDATED' ||
        event.type === 'STATUS_CHANGE'
      ) {
        loadRequests();
      }
    });

    // Fallback resilient polling every 5 seconds
    const interval = setInterval(loadRequests, 5000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser]);

  // Separate requests created by this hospital vs incoming broadcast/peer requests
  const myRequests = requests.filter(r => r.is_requester !== false && (!currentUser?.facility_id || r.requesting_facility_id === currentUser.facility_id));
  const peerRequests = requests.filter(r => r.requesting_facility_id !== currentUser?.facility_id);

  const displayedList = viewScope === 'my_requests' ? myRequests : peerRequests;

  const filtered = displayedList.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-teal-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Hospital Clinical Portal</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Active Requisitions, Cross-Hospital STAT Requests & Courier Tracking for{' '}
            <strong className="text-slate-700">{currentUser?.facility_name || 'All Connected Hospitals'}</strong>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadRequests}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onOpenEmergencyModal}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center space-x-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create STAT Requisition</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hospital Outgoing Requisitions</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{myRequests.length}</span>
          <span className="text-[11px] text-teal-600 font-medium">Originated by this clinical facility</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Regional STAT Peer Alerts</span>
          <span className="text-2xl font-black text-red-600 mt-1 block">
            {peerRequests.length}
          </span>
          <span className="text-[11px] text-slate-400">Broadcasts from other district hospitals</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">In-Transit Couriers</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">
            {requests.filter(r => r.status === 'in_transit').length}
          </span>
          <span className="text-[11px] text-blue-700 font-medium">Cold boxes tracked live</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Fulfilled & Received</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {requests.filter(r => r.status === 'completed' || r.status === 'fully_approved').length}
          </span>
          <span className="text-[11px] text-emerald-700 font-medium">Reconciled to ICU inventory</span>
        </div>
      </div>

      {/* Scope Selector Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setViewScope('my_requests')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
            viewScope === 'my_requests'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          My Facility's Requisitions ({myRequests.length})
        </button>
        <button
          onClick={() => setViewScope('network_stat')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-2 ${
            viewScope === 'network_stat'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Regional Peer Emergency Broadcasts ({peerRequests.length})</span>
        </button>
      </div>

      {/* Requisitions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-800">
            {viewScope === 'my_requests' ? 'Outgoing Facility Blood Demands' : 'Incoming Regional STAT Requisitions'}
          </h2>
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="proposed">Proposed (MILP Match)</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Request ID</th>
                <th className="p-3">Requesting Hospital</th>
                <th className="p-3">Blood Group & Component</th>
                <th className="p-3">Quantity (Total / Fulfilled)</th>
                <th className="p-3">Urgency</th>
                <th className="p-3">Status</th>
                <th className="p-3">Submitted At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    {viewScope === 'my_requests'
                      ? 'No blood requisitions originated by this hospital. Click "Create STAT Requisition" to initiate an emergency request.'
                      : 'No active regional emergency broadcasts from other district hospitals.'}
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-teal-800">
                      <div>{req.request_id}</div>
                      {req.is_requester === false && req.is_eligible_supplier && (
                        <span className="inline-block mt-0.5 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                          Compatible Stock Available
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-slate-800">
                      <div>{req.requesting_facility_name || 'Hospital Ward'}</div>
                      {req.is_requester ? (
                        <span className="text-[10px] text-teal-600 font-semibold">(Your Hospital)</span>
                      ) : (
                        <span className="text-[10px] text-amber-600 font-semibold">(Peer Hospital)</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="font-black text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 mr-2">
                        {req.blood_group}
                      </span>
                      <span className="text-slate-600">{req.component_type}</span>
                    </td>
                    <td className="p-3 font-bold text-slate-800">
                      <span>{req.quantity_needed} Bags</span>
                      {req.quantity_fulfilled > 0 && (
                        <span className="block text-[11px] text-emerald-600 font-normal">
                          Fulfilled: {req.quantity_fulfilled} / Remaining: {req.remaining_needed ?? (req.quantity_needed - req.quantity_fulfilled)}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        req.urgency === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {req.urgency}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        req.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : (req.status === 'in_transit' ? 'bg-blue-100 text-blue-800' : (req.status === 'partially_approved' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-50 text-amber-700'))
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
