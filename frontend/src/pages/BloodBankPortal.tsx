import React, { useState, useEffect } from 'react';
import {
  Building2,
  Boxes,
  Flame,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  QrCode,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Thermometer,
  Layers,
  Sparkles
} from 'lucide-react';
import { Facility, Transfer, InventoryItem, Alert } from '../types';
import { fetchTransfers, fetchInventory, fetchAlerts, approveTransfer, rejectTransfer } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { soundService } from '../services/soundService';

interface BloodBankPortalProps {
  facilities: Facility[];
  onNavigateToTab: (tab: string) => void;
  onOpenTraceability?: (trackingId: string) => void;
}

export const BloodBankPortal: React.FC<BloodBankPortalProps> = ({
  facilities,
  onNavigateToTab,
  onOpenTraceability
}) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Modal states for approvals/rejections
  const [approveModalTx, setApproveModalTx] = useState<Transfer | null>(null);
  const [authQty, setAuthQty] = useState<number>(1);
  const [rejectModalTx, setRejectModalTx] = useState<Transfer | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(
    'Local emergency reserve threshold reached; unable to release requested units.'
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [txs, inv, alts] = await Promise.all([
        fetchTransfers(),
        fetchInventory(currentUser?.facility_id ? { facility_id: currentUser.facility_id } : undefined),
        fetchAlerts()
      ]);
      setTransfers(txs);
      setInventory(inv);
      setAlerts(alts);
    } catch (err) {
      console.error("Failed to load blood bank data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Calculations
  const currentFacility = facilities.find(f => f.id === currentUser?.facility_id) || null;
  const totalUnits = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const availableUnits = inventory
    .filter(i => i.status === 'available')
    .reduce((sum, item) => sum + item.quantity, 0);
  const reservedUnits = inventory
    .filter(i => i.status === 'reserved')
    .reduce((sum, item) => sum + item.quantity, 0);
  const quarantinedUnits = inventory
    .filter(i => i.status === 'quarantined')
    .reduce((sum, item) => sum + item.quantity, 0);

  // Incoming transfer proposals directed to this blood bank
  const incomingProposals = transfers.filter(
    t => t.status === 'proposed' && t.origin_facility_id === currentUser?.facility_id
  );

  // Outgoing active transfers from this blood bank
  const outgoingTransfers = transfers.filter(
    t => ['approved', 'dispatched'].includes(t.status) && t.origin_facility_id === currentUser?.facility_id
  );

  // Critical alerts for this facility
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'urgent');

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
        soundService.speak(`Transfer approved for ${authQty} units. Remaining demand re-allocated.`);
      } else {
        soundService.speak(`Stock reserved and authorized. Transfer approved for ${authQty} units.`);
      }
      setApproveModalTx(null);
      await loadData();
    } catch (err: any) {
      alert(`Approval authorization failed: ${err.message}`);
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
        soundService.speak("Transfer rejected. Algorithm reallocated demand to secondary center.");
      }
      setRejectModalTx(null);
      await loadData();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-teal-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Blood Center Command & Authorization</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Managing stock, release authorizations, and cold-chain dispatches for{' '}
            <strong className="text-slate-800 font-bold">{currentUser?.facility_name || 'Regional Blood Center'}</strong>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onNavigateToTab('bb_inventory')}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center space-x-2 transition"
          >
            <Boxes className="w-4 h-4" />
            <span>Manage Inventory</span>
          </button>
        </div>
      </div>

      {/* 2. Facility Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Tracked Units</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{totalUnits}</span>
          <span className="text-[11px] text-teal-600 font-semibold">{inventory.length} distinct barcoded batches</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Ready for Release</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">{availableUnits}</span>
          <span className="text-[11px] text-slate-400">Available across all component groups</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Pending Requisitions</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">{incomingProposals.length}</span>
          <span className="text-[11px] text-amber-700 font-medium">Awaiting manual release authorization</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">In-Transit Outgoing</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">{outgoingTransfers.length}</span>
          <span className="text-[11px] text-slate-400">Cold-chain couriers en route</span>
        </div>
      </div>

      {/* 3. Urgent Action Panel: Pending Requisition Proposals */}
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
        <div className="bg-amber-500/10 px-5 py-4 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Flame className="w-5 h-5 text-amber-600 animate-pulse" />
            <h2 className="text-sm font-black text-slate-900 tracking-wide uppercase">
              Urgent Transfer Proposals Requiring Officer Authorization
            </h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[11px]">
            {incomingProposals.length} Action Needed
          </span>
        </div>

        <div className="p-5">
          {incomingProposals.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-slate-800">All Requisition Proposals Addressed</p>
              <p className="text-xs text-slate-500 mt-1">
                No outstanding transfer proposals pending approval for {currentUser?.facility_name}.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {incomingProposals.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                        {tx.transfer_id}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        Destination:{' '}
                        <strong className="text-slate-900 font-bold">{tx.destination_name}</strong>
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-600 mt-1">
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 font-black rounded text-[11px]">
                        {tx.blood_group} {tx.component_type}
                      </span>
                      <span>
                        Requested Quantity:{' '}
                        <strong className="text-slate-900 font-bold">{tx.quantity} Unit(s)</strong>
                      </span>
                      <span>
                        Distance:{' '}
                        <strong className="text-slate-900">{tx.distance_km} km</strong> ({Math.round(tx.travel_time_minutes)} min)
                      </span>
                    </div>
                    {tx.rationale && (
                      <p className="text-[11px] text-slate-500 bg-white/70 p-2 rounded border border-amber-100 mt-2">
                        <strong>MILP Optimization Rationale:</strong> {tx.rationale}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 self-end md:self-center">
                    <button
                      onClick={() => openRejectModal(tx)}
                      className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition"
                    >
                      Reject Requisition
                    </button>
                    <button
                      onClick={() => openApproveModal(tx)}
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center space-x-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Authorize Stock</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Two-Column Layout: Stock Overview & Active Outgoing Dispatches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Quick Inventory by Blood Group */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center space-x-2">
              <Boxes className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">Current Blood Group Balances</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('bb_inventory')}
              className="text-xs text-teal-600 hover:text-teal-700 font-bold"
            >
              View Full Table &rarr;
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((grp) => {
              const count = inventory
                .filter(i => i.blood_group === grp && i.status === 'available')
                .reduce((s, i) => s + i.quantity, 0);
              const isLow = count < 5;
              return (
                <div
                  key={grp}
                  className={`p-3 rounded-lg border text-center transition ${
                    isLow
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <span className="text-xs font-black block">{grp}</span>
                  <span className="text-lg font-black block mt-0.5">{count}</span>
                  <span className="text-[9px] uppercase tracking-wider block opacity-75">
                    {isLow ? 'Low Stock' : 'Units'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Reserved & Quarantined Breakdown */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              <span>Reserved for Transfers: </span>
              <strong className="text-amber-600 font-bold">{reservedUnits} units</strong>
            </div>
            <div>
              <span>Quarantined / Testing: </span>
              <strong className="text-rose-600 font-bold">{quarantinedUnits} units</strong>
            </div>
          </div>
        </div>

        {/* Right: Outgoing Dispatches */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center space-x-2">
              <Send className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">Outgoing Consignments</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('bb_outgoing')}
              className="text-xs text-teal-600 hover:text-teal-700 font-bold"
            >
              All Dispatches &rarr;
            </button>
          </div>

          {outgoingTransfers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No active outgoing transfers currently in progress.
            </div>
          ) : (
            <div className="space-y-3">
              {outgoingTransfers.slice(0, 4).map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-900">{tx.transfer_id}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-teal-100 text-teal-800">
                        {tx.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Destination: <strong>{tx.destination_name}</strong> ({tx.blood_group} {tx.component_type} &times; {tx.quantity})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      {tx.driver_id ? 'Courier Assigned' : 'Awaiting Driver'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ETA: ~{Math.round(tx.travel_time_minutes)} min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Quality & Expiry Surveillance for Blood Bank */}
      {criticalAlerts.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-rose-900">
              Immediate Quality Surveillance Alert ({criticalAlerts.length} issues)
            </h4>
            <p className="text-[11px] text-rose-700 mt-0.5">
              Units approaching 48h shelf-life limit or temperature threshold in storage.
            </p>
            <div className="mt-2 space-y-1">
              {criticalAlerts.slice(0, 2).map((a) => (
                <div key={a.id} className="text-[11px] bg-white/80 p-2 rounded border border-rose-200 text-slate-800">
                  <strong>[{a.alert_type.toUpperCase()}]</strong> {a.message}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('bb_expiry')}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold self-center shadow"
          >
            Review Alerts
          </button>
        </div>
      )}

      {/* Partial / Full Approval Modal */}
      {approveModalTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Authorize Stock Release</h3>
                <p className="text-xs text-slate-500">Consignment: {approveModalTx.transfer_id}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs text-slate-600 border border-slate-200">
              <div className="flex justify-between">
                <span>Destination Hospital:</span>
                <strong className="text-slate-900">{approveModalTx.destination_name}</strong>
              </div>
              <div className="flex justify-between">
                <span>Blood Component:</span>
                <strong className="text-slate-900">{approveModalTx.blood_group} {approveModalTx.component_type}</strong>
              </div>
              <div className="flex justify-between">
                <span>MILP Requested Quantity:</span>
                <strong className="text-teal-700 font-bold">{approveModalTx.quantity} Unit(s)</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Authorized Release Quantity (Units)
              </label>
              <input
                type="number"
                min="1"
                max={approveModalTx.quantity}
                value={authQty}
                onChange={(e) => setAuthQty(Math.max(1, Math.min(approveModalTx.quantity, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
              {authQty < approveModalTx.quantity && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 leading-tight">
                  <strong>Partial Release Notice:</strong> Releasing {authQty} of {approveModalTx.quantity} units. The remaining {approveModalTx.quantity - authQty} units will automatically trigger secondary MILP re-allocation to adjacent centers.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setApproveModalTx(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md"
              >
                Confirm &amp; Reserve Units
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Reject Stock Release</h3>
                <p className="text-xs text-slate-500">Proposal: {rejectModalTx.transfer_id}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-rose-500"
              />
              <p className="text-[11px] text-slate-500">
                Rejecting will trigger the re-optimization algorithm to allocate this demand to another connected blood bank.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setRejectModalTx(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-md"
              >
                Confirm Rejection &amp; Reallocate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
