import React, { useState, useEffect } from 'react';
import {
  Truck,
  CheckCircle2,
  Clock,
  Printer,
  XCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Send
} from 'lucide-react';
import { Transfer } from '../types';
import {
  fetchTransfers,
  approveTransfer,
  rejectTransfer,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
  fetchTransferManifest,
  triggerTemperatureSpike
} from '../services/api';
import { ManifestModal } from '../components/ManifestModal';
import { soundService } from '../services/soundService';
import { Thermometer, Flame } from 'lucide-react';

export const TransfersPage: React.FC = () => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('proposed');
  
  // Manifest modal
  const [manifestData, setManifestData] = useState<any>(null);
  const [showManifest, setShowManifest] = useState(false);

  // Partial Approval Modal State
  const [approveModalTx, setApproveModalTx] = useState<Transfer | null>(null);
  const [authQty, setAuthQty] = useState<number>(1);

  // Reject Proposal Modal State
  const [rejectModalTx, setRejectModalTx] = useState<Transfer | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Local emergency reserve threshold reached; unable to release requested units.');

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const data = await fetchTransfers(activeTab || undefined);
      setTransfers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, [activeTab]);

  const openApproveModal = (tx: Transfer) => {
    setApproveModalTx(tx);
    setAuthQty(tx.quantity);
  };

  const handleConfirmApprove = async () => {
    if (!approveModalTx) return;
    try {
      soundService.playAlertPing();
      const res = await approveTransfer(approveModalTx.transfer_id, authQty);
      if (res.reallocated_transfers && res.reallocated_transfers.length > 0) {
        soundService.speak(`Transfer approved for ${authQty} units. Remaining demand automatically re-allocated to secondary blood center.`);
      } else {
        soundService.speak(`Transfer approved for ${authQty} units. Courier assigned.`);
      }
      setApproveModalTx(null);
      loadTransfers();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const openRejectModal = (tx: Transfer) => {
    setRejectModalTx(tx);
    setRejectReason('Local emergency reserve threshold reached; unable to release requested units.');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalTx) return;
    try {
      const res = await rejectTransfer(rejectModalTx.transfer_id, rejectReason);
      if (res.reallocated_transfers && res.reallocated_transfers.length > 0) {
        soundService.speak("Transfer rejected. Re-optimization engine reallocated demand to next nearest blood bank.");
      }
      setRejectModalTx(null);
      loadTransfers();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  const handleDispatch = async (txId: string) => {
    try {
      await dispatchTransfer(txId);
      loadTransfers();
    } catch (err: any) {
      alert(`Dispatch failed: ${err.message}`);
    }
  };

  const handleReceive = async (txId: string) => {
    try {
      await receiveTransfer(txId);
      loadTransfers();
    } catch (err: any) {
      alert(`Receipt reconciliation failed: ${err.message}`);
    }
  };

  const handleCancel = async (txId: string) => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    try {
      await cancelTransfer(txId, reason);
      loadTransfers();
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    }
  };

  const handleViewManifest = async (txId: string) => {
    try {
      const data = await fetchTransferManifest(txId);
      setManifestData(data);
      setShowManifest(true);
    } catch (err: any) {
      alert(`Manifest generation failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Inter-Facility Transfer Pipeline</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage-gate workflow: Proposed &rarr; Approved &rarr; Dispatched &rarr; Received, backed by verified cold-chain manifests.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        {['proposed', 'approved', 'dispatched', 'received', 'cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
              activeTab === tab
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Transfers List */}
      <div className="space-y-3.5">
        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-xl border">Loading transfer consignments...</div>
        ) : transfers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-xl border">
            No transfers in &quot;{activeTab}&quot; state.
          </div>
        ) : (
          transfers.map((tx) => (
            <div
              key={tx.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3 hover:border-slate-300 transition"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-mono font-bold text-xs flex-shrink-0">
                    <Truck className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">{tx.transfer_id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-teal-100 text-teal-800">
                        {tx.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {tx.origin_name} &rarr; <strong>{tx.destination_name}</strong>
                    </span>
                  </div>
                </div>

                {/* Specs */}
                <div className="flex items-center space-x-4 text-xs">
                  <div className="text-right">
                    <span className="font-bold text-slate-900 block">{tx.quantity} Unit(s)</span>
                    <span className="text-slate-500 text-[11px] font-medium">{tx.blood_group} {tx.component_type}</span>
                  </div>
                  <div className="text-right border-l pl-4 border-slate-200">
                    <span className="font-bold text-slate-900 block font-mono">{Math.round(tx.travel_time_minutes)} min</span>
                    <span className="text-slate-500 text-[11px]">{tx.distance_km} km</span>
                  </div>
                </div>
              </div>

              {/* Rationale */}
              {tx.rationale && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-100 leading-relaxed">
                  <strong>Rationale:</strong> {tx.rationale}
                </div>
              )}

              {/* Actions Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400 text-[11px]">
                  Created: {new Date(tx.created_at).toLocaleString()}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleViewManifest(tx.transfer_id)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Manifest</span>
                  </button>

                  {tx.status === 'proposed' && (
                    <>
                      <button
                        onClick={() => openRejectModal(tx)}
                        className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg font-medium transition"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => openApproveModal(tx)}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold shadow-sm transition"
                      >
                        Approve / Partial Transfer
                      </button>
                    </>
                  )}

                  {tx.status === 'approved' && (
                    <button
                      onClick={() => handleDispatch(tx.transfer_id)}
                      className="px-3.5 py-1.5 bg-navy-900 hover:bg-navy-850 text-white rounded-lg font-semibold shadow-sm transition flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch Courier</span>
                    </button>
                  )}

                  {/* Judge Simulation Trigger */}
                  {['approved', 'dispatched'].includes(tx.status) && (
                    <button
                      onClick={async () => {
                        soundService.playEmergencySiren();
                        await triggerTemperatureSpike(tx.transfer_id, 11.5);
                        soundService.speak("Critical temperature excursion detected! Thermal breach above 10 degrees.");
                        loadTransfers();
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                      title="Judge Demonstration: Trigger cold chain sensor spike to 11.5°C"
                    >
                      <Thermometer className="w-3.5 h-3.5 text-rose-600" />
                      <span>Simulate Temp Spike (+11.5°C)</span>
                    </button>
                  )}

                  {tx.status === 'dispatched' && (
                    <button
                      onClick={() => handleReceive(tx.transfer_id)}
                      className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold shadow-sm transition flex items-center space-x-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Receipt &amp; Reconcile</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Approval / Partial Fulfillment Modal */}
      {approveModalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Authorize Transfer Consignment</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm or adjust authorized release quantity for consignment <span className="font-mono font-bold text-teal-700">{approveModalTx.transfer_id}</span>.
                </p>
              </div>
            </div>

            <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>Origin Blood Bank:</span>
                <span className="font-bold text-slate-900">{approveModalTx.origin_name}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Destination Hospital:</span>
                <span className="font-bold text-slate-900">{approveModalTx.destination_name}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Blood Component:</span>
                <span className="font-bold text-teal-800">{approveModalTx.blood_group} {approveModalTx.component_type}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>MILP Proposed Allocation:</span>
                <span className="font-bold text-slate-900">{approveModalTx.quantity} Unit(s)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Authorized Units to Release:
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="1"
                  max={approveModalTx.quantity}
                  value={authQty}
                  onChange={(e) => setAuthQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-center font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-500">
                  {authQty < approveModalTx.quantity ? (
                    <span className="text-amber-600 font-semibold">
                      Partial Fulfillment: Remaining {approveModalTx.quantity - authQty} unit(s) will be automatically re-allocated by MILP to a secondary facility.
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">
                      Full Proposed Fulfillment (All {approveModalTx.quantity} units authorized).
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setApproveModalTx(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm transition"
              >
                Authorize & Reserve Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="text-base font-black text-rose-900">Decline Transfer Proposal</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                State reason for declining <span className="font-mono font-bold text-slate-700">{rejectModalTx.transfer_id}</span>. Unmet demand will be immediately re-optimized to the next closest facility.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clinical / Operational Rationale:
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
                placeholder="Specify reason for refusal..."
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRejectModalTx(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition"
              >
                Confirm Decline & Re-Optimize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Manifest Print Modal */}
      <ManifestModal
        manifestData={manifestData}
        isOpen={showManifest}
        onClose={() => setShowManifest(false)}
      />
    </div>
  );
};
