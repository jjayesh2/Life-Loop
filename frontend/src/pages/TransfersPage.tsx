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
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
  fetchTransferManifest
} from '../services/api';
import { ManifestModal } from '../components/ManifestModal';

export const TransfersPage: React.FC = () => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('proposed');
  
  // Manifest modal
  const [manifestData, setManifestData] = useState<any>(null);
  const [showManifest, setShowManifest] = useState(false);

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

  const handleApprove = async (txId: string) => {
    try {
      await approveTransfer(txId);
      loadTransfers();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
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
    const reason = prompt("Enter cancellation or rejection reason:");
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
                        onClick={() => handleCancel(tx.transfer_id)}
                        className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg font-medium transition"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(tx.transfer_id)}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold shadow-sm transition"
                      >
                        Approve Transfer
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

      {/* Official Manifest Print Modal */}
      <ManifestModal
        manifestData={manifestData}
        isOpen={showManifest}
        onClose={() => setShowManifest(false)}
      />
    </div>
  );
};
