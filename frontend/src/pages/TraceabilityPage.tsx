import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Search,
  Camera,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  History,
  ShieldCheck,
  Send,
  Plus
} from 'lucide-react';
import { InventoryItem, TraceabilityEvent } from '../types';
import { lookupTraceability, recordMovementEvent } from '../services/api';
import { BagLabelModal } from '../components/BagLabelModal';

interface TraceabilityPageProps {
  initialTrackingId?: string;
}

export const TraceabilityPage: React.FC<TraceabilityPageProps> = ({ initialTrackingId }) => {
  const [searchQuery, setSearchQuery] = useState(initialTrackingId || 'LL-RBC-O-201');
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [showPrintLabel, setShowPrintLabel] = useState(false);

  // Movement recorder modal
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [movementForm, setMovementForm] = useState({
    event_type: 'storage_check',
    facility_name: 'Metro Central Trauma Center',
    details: 'Routine cold-chain integrity verified at 3.9°C.',
    operator: 'Logistics Officer'
  });

  const handleLookup = async (idToSearch?: string) => {
    const q = idToSearch || searchQuery;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await lookupTraceability(q.trim());
      setItem(data);
    } catch (err: any) {
      setItem(null);
      setError(err.message || `No tracked unit found matching identifier "${q}".`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialTrackingId) {
      setSearchQuery(initialTrackingId);
      handleLookup(initialTrackingId);
    } else {
      handleLookup('LL-OPOS-202-'); // search prefix
    }
  }, [initialTrackingId]);

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    try {
      await recordMovementEvent(item.id, movementForm);
      setShowRecordModal(false);
      handleLookup(item.tracking_id);
    } catch (err: any) {
      alert(`Failed to log movement: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] bg-teal-500/20 text-teal-800 font-bold px-2 py-0.5 rounded border border-teal-500/30 uppercase tracking-wider">
            Innovation A
          </span>
          <span className="text-slate-400 text-xs">•</span>
          <span className="text-xs text-slate-500">ISBT-128 Mock Traceability</span>
        </div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">Blood Bag & Kit QR Traceability</h1>
        <p className="text-xs text-slate-500">
          Scan bag QR codes or enter tracking IDs to inspect full chain-of-custody, custody transfers, and cold-chain logs.
        </p>
      </div>

      {/* Scanner & Manual Lookup Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Manual Entry */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Scan or enter Tracking ID (e.g. LL-OPOS-202-E839 or Batch Ref B-RBC-OP-202)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>

          <button
            onClick={() => handleLookup()}
            disabled={loading}
            className="w-full md:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center justify-center space-x-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Unit</span>
          </button>

          {/* Camera Scanner Toggle */}
          <button
            onClick={() => setScannerActive(!scannerActive)}
            className={`w-full md:w-auto px-4 py-2.5 rounded-lg text-xs font-semibold border transition flex items-center justify-center space-x-1.5 ${
              scannerActive
                ? 'bg-red-50 text-red-700 border-red-300'
                : 'bg-navy-900 hover:bg-navy-850 text-white border-navy-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{scannerActive ? 'Stop Camera' : 'Camera QR Scanner'}</span>
          </button>
        </div>

        {/* Live Camera Scanner View Simulator */}
        {scannerActive && (
          <div className="bg-slate-900 text-white rounded-xl p-6 flex flex-col items-center justify-center space-y-3 relative overflow-hidden border border-slate-700 animate-in fade-in">
            <div className="w-48 h-48 border-2 border-teal-400 rounded-lg relative flex items-center justify-center">
              <div className="w-full h-0.5 bg-red-500 absolute animate-pulse"></div>
              <QrCode className="w-16 h-16 text-slate-500" />
            </div>
            <p className="text-xs text-slate-300">Point device camera at blood bag kit barcode or QR sticker.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSearchQuery('LL-OPOS-202-');
                  handleLookup('LL-OPOS-202-');
                  setScannerActive(false);
                }}
                className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-[11px] font-medium"
              >
                Simulate Camera Scan (O+ RBC)
              </button>
              <button
                onClick={() => {
                  setSearchQuery('LL-ONEG-501-');
                  handleLookup('LL-ONEG-501-');
                  setScannerActive(false);
                }}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-medium"
              >
                Simulate Scan (Near Expiry O-)
              </button>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Traceability Result Record */}
      {item && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Bar */}
          <div className="bg-navy-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xl shadow-md">
                {item.blood_group}
              </div>
              <div>
                <span className="text-[10px] text-teal-400 font-mono uppercase tracking-wider block">TRACKING ID</span>
                <h2 className="text-base font-bold font-mono text-white">{item.tracking_id}</h2>
                <span className="text-xs text-slate-300">{item.component_type} • Batch {item.batch_ref}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowRecordModal(true)}
                className="flex items-center space-x-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Movement Event</span>
              </button>
              <button
                onClick={() => setShowPrintLabel(true)}
                className="flex items-center space-x-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print QR Sticker</span>
              </button>
            </div>
          </div>

          {/* Record Grid Details */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-200">
            {/* QR Code Hero */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              {item.qr_code_svg ? (
                <img src={item.qr_code_svg} alt="QR Code" className="w-40 h-40 bg-white p-2 rounded-lg border border-slate-200 shadow-sm" />
              ) : (
                <div className="w-40 h-40 bg-slate-200 rounded flex items-center justify-center text-xs text-slate-500">QR Code</div>
              )}
              <span className="text-[11px] font-mono text-slate-500 mt-2">Opaque Identifier: {item.tracking_id}</span>
              <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded mt-1 font-medium">No PHI encoded</span>
            </div>

            {/* Core Spec */}
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Current Facility Location</span>
                <span className="text-sm font-bold text-slate-800">{item.facility_name}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Availability Status</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                  item.status === 'available' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {item.status}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Cold-Chain Temperature</span>
                <span className="font-bold text-slate-800 text-sm">{item.storage_temp_c}°C Validated</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Units in Consignment</span>
                <span className="font-bold text-slate-800 text-sm">{item.quantity} Unit(s)</span>
              </div>
            </div>

            {/* Timestamps & Life */}
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Collection Timestamp</span>
                <span className="font-medium text-slate-700">{new Date(item.collection_date).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-red-500 uppercase font-semibold text-[10px] block">Expiration Timestamp</span>
                <span className="font-bold text-red-600 text-sm">{new Date(item.expiry_date).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Registration Timestamp</span>
                <span className="font-medium text-slate-700">{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Compliance Standard</span>
                <span className="font-medium text-slate-700">Digital Chain-of-Custody Compliant</span>
              </div>
            </div>
          </div>

          {/* Traceability Events Timeline */}
          <div className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <History className="w-4 h-4 text-slate-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Verifiable Custody & Movement Audit History
              </h3>
            </div>

            <div className="space-y-3">
              {item.traceability_events && item.traceability_events.length > 0 ? (
                item.traceability_events.map((ev) => (
                  <div key={ev.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-teal-100 text-teal-900 border border-teal-200">
                        {ev.event_type}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {new Date(ev.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800">{ev.details}</p>
                    <div className="flex items-center space-x-3 text-[10px] text-slate-500">
                      <span>Facility: <strong>{ev.facility_name}</strong></span>
                      <span>•</span>
                      <span>Operator: <strong>{ev.operator}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">No events logged for this unit.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Log Movement Modal */}
      {showRecordModal && item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Log Chain of Custody Movement</h3>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-slate-700">
                &times;
              </button>
            </div>

            <form onSubmit={handleAddMovement} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Event Type</label>
                <select
                  value={movementForm.event_type}
                  onChange={(e) => setMovementForm({ ...movementForm, event_type: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="storage_audit">Storage Cold-Chain Audit</option>
                  <option value="quarantine_checked">Quality Quarantine Review</option>
                  <option value="internal_transfer">Departmental Relocation</option>
                  <option value="courier_handover">Courier Handover Inspection</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Facility Name</label>
                <input
                  type="text"
                  value={movementForm.facility_name}
                  onChange={(e) => setMovementForm({ ...movementForm, facility_name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Details & Sensor Readings</label>
                <textarea
                  rows={2}
                  value={movementForm.details}
                  onChange={(e) => setMovementForm({ ...movementForm, details: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Operator Signature</label>
                <input
                  type="text"
                  value={movementForm.operator}
                  onChange={(e) => setMovementForm({ ...movementForm, operator: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-3 py-1.5 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  Append Event to Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Label Modal */}
      <BagLabelModal
        item={item}
        isOpen={showPrintLabel}
        onClose={() => setShowPrintLabel(false)}
      />
    </div>
  );
};
