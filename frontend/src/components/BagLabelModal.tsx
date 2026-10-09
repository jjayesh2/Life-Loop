import React from 'react';
import { X, Printer, ShieldCheck, Thermometer } from 'lucide-react';
import { InventoryItem } from '../types';

interface BagLabelModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BagLabelModal: React.FC<BagLabelModalProps> = ({ item, isOpen, onClose }) => {
  if (!isOpen || !item) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        {/* Modal Header (No Print) */}
        <div className="p-4 bg-navy-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm tracking-wide">Blood Bag QR Tracking Label</span>
            <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded border border-teal-500/30">
              Unit ID Verified
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-medium transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Label</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-navy-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Bag Kit Label */}
        <div className="p-6 bg-white" id="printable-bag-label">
          <div className="border-2 border-dashed border-slate-400 rounded-lg p-5 relative bg-slate-50/50">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 rotate-[-25deg]">
              <span className="text-4xl font-black text-red-900 uppercase">DEMO — NOT FOR CLINICAL USE</span>
            </div>

            {/* Top Bar */}
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3 mb-3">
              <div>
                <span className="text-[10px] tracking-widest uppercase font-bold text-slate-500 block">LIFE-LOOP TRACEABILITY</span>
                <span className="text-xs font-black text-slate-900">{item.facility_name || 'Regional Blood Center'}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                  ISBT-128 Equivalent Mock
                </span>
              </div>
            </div>

            {/* Main Label Body: QR Code & Big Blood Group */}
            <div className="grid grid-cols-2 gap-4 items-center mb-4">
              <div className="flex flex-col items-center justify-center p-2 bg-white rounded border border-slate-200 shadow-sm">
                {item.qr_code_svg ? (
                  <img src={item.qr_code_svg} alt={`QR for ${item.tracking_id}`} className="w-32 h-32 object-contain" />
                ) : (
                  <div className="w-32 h-32 bg-slate-100 flex items-center justify-center text-xs text-slate-400">QR Code</div>
                )}
                <span className="text-[9px] font-mono font-bold text-slate-600 mt-1">{item.tracking_id}</span>
              </div>

              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Blood Group</span>
                <div className="w-20 h-20 rounded-full bg-red-600 text-white flex items-center justify-center font-black text-3xl shadow-md my-1">
                  {item.blood_group}
                </div>
                <span className="text-xs font-extrabold text-slate-800 tracking-tight">{item.component_type}</span>
              </div>
            </div>

            {/* Spec Details Table */}
            <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-300 py-2.5 mb-3 bg-white px-2 rounded">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">BATCH REFERENCE</span>
                <span className="font-mono font-bold text-slate-800">{item.batch_ref}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">QUANTITY</span>
                <span className="font-bold text-slate-800">{item.quantity} Unit (Approx 450 mL)</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">COLLECTION DATE</span>
                <span className="font-medium text-slate-700">{new Date(item.collection_date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-red-600 font-bold block">EXPIRATION TIMESTAMP</span>
                <span className="font-bold text-red-700">{new Date(item.expiry_date).toLocaleString()}</span>
              </div>
            </div>

            {/* Cold Chain & Safety Notice */}
            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
              <div className="flex items-center space-x-1 text-teal-800 font-medium">
                <Thermometer className="w-3.5 h-3.5 text-teal-600" />
                <span>Store at {item.storage_temp_c}°C Cold-Chain</span>
              </div>
              <div className="flex items-center space-x-1 text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Non-sensitive ID</span>
              </div>
            </div>

            <p className="text-[9px] text-slate-400 text-center mt-3 uppercase tracking-tighter">
              DEMO PROTOTYPE LABEL • DO NOT USE FOR HUMAN TRANSFUSION • LIFE-LOOP SYSTEM
            </p>
          </div>
        </div>

        {/* Modal Footer (No Print) */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 no-print">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 text-xs font-semibold bg-navy-900 text-white rounded-lg hover:bg-navy-850 transition flex items-center space-x-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Label</span>
          </button>
        </div>
      </div>
    </div>
  );
};
