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
  Filter,
  Check,
  X,
  ShieldAlert,
  ArrowRight,
  PackageCheck
} from 'lucide-react';
import { Facility, EmergencyRequest, Transfer } from '../types';
import {
  fetchEmergencyRequests,
  subscribeToRealtimeEvents,
  acceptEmergencyRequest,
  rejectEmergencyRequest,
  confirmTransferReceipt
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { soundService } from '../services/soundService';

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

  // Accept Modal State
  const [acceptModalReq, setAcceptModalReq] = useState<EmergencyRequest | null>(null);
  const [acceptQty, setAcceptQty] = useState<number>(1);
  const [acceptNotes, setAcceptNotes] = useState<string>('Approved from clinical emergency reserves');
  const [isAccepting, setIsAccepting] = useState<boolean>(false);

  // Reject Modal State
  const [rejectModalReq, setRejectModalReq] = useState<EmergencyRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Local ICU surge reserves required for ongoing trauma care');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Confirm Receipt State
  const [confirmingTransferId, setConfirmingTransferId] = useState<string | null>(null);

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

    const interval = setInterval(loadRequests, 5000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser]);

  // Handle Accept
  const handleOpenAccept = (req: EmergencyRequest) => {
    setAcceptModalReq(req);
    const maxPoss = Math.min(
      req.remaining_shortage ?? req.quantity_needed,
      req.available_eligible_stock ?? req.quantity_needed
    );
    setAcceptQty(Math.max(1, maxPoss));
    setAcceptNotes('Approved from clinical emergency reserves');
  };

  const handleConfirmAccept = async () => {
    if (!acceptModalReq) return;
    try {
      setIsAccepting(true);
      soundService.playAlertPing();
      await acceptEmergencyRequest(acceptModalReq.request_id, acceptQty, acceptNotes);
      soundService.speak(`Emergency request accepted for ${acceptQty} units. Transport consignment generated.`);
      setAcceptModalReq(null);
      await loadRequests();
    } catch (err: any) {
      alert(`Acceptance failed: ${err.message}`);
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle Reject
  const handleOpenReject = (req: EmergencyRequest) => {
    setRejectModalReq(req);
    setRejectReason('Local ICU surge reserves required for ongoing trauma care');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalReq) return;
    try {
      setIsRejecting(true);
      await rejectEmergencyRequest(rejectModalReq.request_id, rejectReason);
      soundService.speak("Response logged. Request remains open for regional network facilities.");
      setRejectModalReq(null);
      await loadRequests();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setIsRejecting(false);
    }
  };

  // Handle Confirm Receipt of delivered transfer
  const handleConfirmReceipt = async (transferId: string) => {
    try {
      setConfirmingTransferId(transferId);
      soundService.playSuccessChime();
      await confirmTransferReceipt(transferId, currentUser?.name || 'Hospital Receiving Nurse');
      soundService.speak("Delivery confirmed. Stock reconciled into hospital inventory.");
      await loadRequests();
    } catch (err: any) {
      alert(`Confirmation failed: ${err.message}`);
    } finally {
      setConfirmingTransferId(null);
    }
  };

  // Separate requests created by this hospital vs incoming broadcast/peer requests
  const myRequests = requests.filter(r => r.is_requester !== false && (!currentUser?.facility_id || r.requesting_facility_id === currentUser.facility_id));
  const peerRequests = requests.filter(r => r.requesting_facility_id !== currentUser?.facility_id);

  const displayedList = viewScope === 'my_requests' ? myRequests : peerRequests;

  const filtered = displayedList.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status.toLowerCase() === filterStatus.toLowerCase();
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
            Active Requisitions, Regional Network Coordination & Verified Bedside Delivery for{' '}
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
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">My Outgoing Requisitions</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{myRequests.length}</span>
          <span className="text-[11px] text-teal-600 font-medium">Originated by this clinical facility</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Incoming Peer Requests</span>
          <span className="text-2xl font-black text-red-600 mt-1 block">
            {peerRequests.length}
          </span>
          <span className="text-[11px] text-slate-400">Broadcasts from other district facilities</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">In-Transit Consignments</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">
            {requests.filter(r => (r.quantity_in_transit || 0) > 0 || r.status === 'in_transit' || (r.transfers || []).some(t => t.status === 'in_transit' || t.status === 'dispatched')).length}
          </span>
          <span className="text-[11px] text-blue-700 font-medium">Cold boxes tracked live via GPS</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Fulfilled & Received</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {requests.filter(r => r.status === 'COMPLETED' || r.status === 'completed' || r.status === 'fully_approved').length}
          </span>
          <span className="text-[11px] text-emerald-700 font-medium">Stock reconciled to bedside inventory</span>
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
          <span>Incoming Network Blood Requests ({peerRequests.length})</span>
        </button>
      </div>

      {/* Requisitions List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-800">
            {viewScope === 'my_requests' ? 'Outgoing Facility Blood Requisitions & Tracking' : 'Incoming Regional Peer Requests (Actionable)'}
          </h2>
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending_responses">Pending Responses</option>
              <option value="partially_fulfilled">Partially Fulfilled</option>
              <option value="ready_for_driver">Ready For Driver</option>
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
                <th className="p-3">{viewScope === 'my_requests' ? 'Destination Ward' : 'Requesting Hospital'}</th>
                <th className="p-3">Blood Group & Component</th>
                <th className="p-3">Quantity Progress</th>
                <th className="p-3">Urgency</th>
                <th className="p-3">Status & Lifecycle</th>
                <th className="p-3 text-right">Actions / Verification</th>
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
                filtered.map((req) => {
                  const remShortage = req.remaining_shortage ?? Math.max(0, req.quantity_needed - (req.quantity_accepted || 0));
                  const myResp = req.my_response;
                  const canAct = !req.is_requester && (req.is_eligible_supplier || (req.available_eligible_stock || 0) > 0) && remShortage > 0;
                  const linkedTransfers = req.transfers || [];
                  const pendingReceiptTransfer = linkedTransfers.find(t => t.driver_status === 'delivered' && t.status !== 'received');

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-teal-800">
                        <div>{req.request_id}</div>
                        <span className="text-[10px] text-slate-400 font-normal block">
                          {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {req.is_requester === false && req.is_eligible_supplier && (
                          <span className="inline-block mt-0.5 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                            Compatible Stock: {req.available_eligible_stock || 0} Units
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        <div>{req.requesting_facility_name || 'Hospital Ward'}</div>
                        {req.delivery_destination && (
                          <div className="text-[10px] text-slate-500 font-normal truncate max-w-[160px]">
                            {req.delivery_destination}
                          </div>
                        )}
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
                        <div>Total: {req.quantity_needed} Units</div>
                        <div className="text-[11px] font-normal text-slate-500 space-y-0.5 mt-0.5">
                          {(req.quantity_accepted || 0) > 0 && (
                            <span className="text-emerald-700 block">Accepted: {req.quantity_accepted} units</span>
                          )}
                          {remShortage > 0 ? (
                            <span className="text-amber-700 block">Remaining Shortage: {remShortage} units</span>
                          ) : (
                            <span className="text-emerald-600 font-bold block">Fully Covered</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.urgency === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {req.urgency}
                        </span>
                      </td>
                      <td className="p-3">
                        <div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            req.status === 'COMPLETED' || req.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : (req.status === 'in_transit' || (req.quantity_in_transit || 0) > 0 ? 'bg-blue-100 text-blue-800' : (req.status === 'PARTIALLY_FULFILLED' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-50 text-amber-700'))
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        {/* Lifecycle steps summary */}
                        {linkedTransfers.length > 0 && (
                          <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                            {linkedTransfers.map((tx) => (
                              <div key={tx.id} className="flex items-center space-x-1">
                                <span className="font-mono font-bold text-teal-700">{tx.transfer_id}:</span>
                                <span className="font-semibold text-slate-700">{tx.driver_status || tx.status}</span>
                                {tx.driver_name && <span>({tx.driver_name})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {/* Requester View: Confirmation button when courier delivers */}
                        {req.is_requester && pendingReceiptTransfer && (
                          <button
                            onClick={() => handleConfirmReceipt(pendingReceiptTransfer.transfer_id)}
                            disabled={confirmingTransferId === pendingReceiptTransfer.transfer_id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center space-x-1.5 ml-auto"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Confirm Receipt ({pendingReceiptTransfer.transfer_id})</span>
                          </button>
                        )}

                        {/* Peer Facility View: Accept/Reject Buttons */}
                        {!req.is_requester && (
                          <div className="flex items-center justify-end space-x-2">
                            {myResp ? (
                              <span className={`text-[11px] font-bold px-2 py-1 rounded ${
                                myResp.response_type === 'accepted'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                                {myResp.response_type === 'accepted'
                                  ? `Accepted ${myResp.quantity_accepted} units`
                                  : 'Declined (Logged)'}
                              </span>
                            ) : canAct ? (
                              <>
                                <button
                                  onClick={() => handleOpenReject(req)}
                                  className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded-lg text-xs font-semibold transition"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleOpenAccept(req)}
                                  className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center space-x-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Accept</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                {remShortage === 0 ? 'Shortage Covered' : 'No compatible stock'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accept Modal */}
      {acceptModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span>Accept Blood Requisition</span>
              </h3>
              <button onClick={() => setAcceptModalReq(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs bg-slate-50 p-3 rounded-xl space-y-1">
              <div>Request ID: <strong className="font-mono text-teal-700">{acceptModalReq.request_id}</strong></div>
              <div>Hospital: <strong>{acceptModalReq.requesting_facility_name}</strong></div>
              <div>Component: <strong className="text-red-700">{acceptModalReq.blood_group} {acceptModalReq.component_type}</strong></div>
              <div>Remaining Shortage: <strong>{acceptModalReq.remaining_shortage ?? acceptModalReq.quantity_needed} Units</strong></div>
              <div>Your Compatible Unreserved Stock: <strong className="text-emerald-700">{acceptModalReq.available_eligible_stock ?? 0} Units</strong></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity to Accept & Reserve</label>
              <input
                type="number"
                min="1"
                max={Math.min(acceptModalReq.remaining_shortage ?? acceptModalReq.quantity_needed, acceptModalReq.available_eligible_stock ?? acceptModalReq.quantity_needed)}
                value={acceptQty}
                onChange={(e) => setAcceptQty(Number(e.target.value))}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Units will be atomically reserved in database and a transportation assignment created.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Clinical Authorization Notes</label>
              <input
                type="text"
                value={acceptNotes}
                onChange={(e) => setAcceptNotes(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setAcceptModalReq(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAccepting}
                onClick={handleConfirmAccept}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow disabled:opacity-50"
              >
                {isAccepting ? 'Reserving...' : 'Confirm Acceptance & Reserve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span>Decline Blood Requisition</span>
              </h3>
              <button onClick={() => setRejectModalReq(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs bg-red-50 p-3 rounded-xl border border-red-200 text-red-900">
              Declining will record your facility's response. The emergency request will remain active and open for other network facilities to fulfill.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Declining</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRejecting}
                onClick={handleConfirmReject}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow disabled:opacity-50"
              >
                {isRejecting ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
