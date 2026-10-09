import React from 'react';
import { X, Printer, Truck, ShieldCheck, MapPin, CheckCircle2 } from 'lucide-react';

interface ManifestModalProps {
  manifestData: any;
  isOpen: boolean;
  onClose: () => void;
}

export const ManifestModal: React.FC<ManifestModalProps> = ({ manifestData, isOpen, onClose }) => {
  if (!isOpen || !manifestData) return null;

  const handlePrint = () => {
    window.print();
  };

  const {
    manifest_number,
    transfer_id,
    watermark,
    created_at,
    status,
    origin_facility,
    destination_facility,
    consignment,
    logistics,
    sign_off_blocks
  } = manifestData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-300 my-8 overflow-hidden">
        {/* Modal Top Bar (Screen Only) */}
        <div className="p-4 bg-navy-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-teal-400" />
            <span className="font-bold text-sm tracking-wide">Cold-Chain Transfer Manifest & Chain of Custody</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official Manifest</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-navy-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Manifest Document */}
        <div className="p-8 bg-white relative" id="printable-manifest">
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] rotate-[-30deg]">
            <span className="text-5xl font-black text-red-900 tracking-wider text-center leading-normal">
              {watermark}
            </span>
          </div>

          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight text-slate-900">LIFE-LOOP</span>
                <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded border border-red-200">
                  CRITICAL BLOOD LOGISTICS
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Automated Inter-Facility Redistribution Manifest</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-slate-900 block">{manifest_number}</span>
              <span className="text-[11px] text-slate-500 block">Transfer ID: {transfer_id}</span>
              <span className="text-[11px] text-slate-500 block">Generated: {created_at}</span>
            </div>
          </div>

          {/* Status Ribbon */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700">Consignment Status:</span>
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded bg-teal-100 text-teal-900 border border-teal-300">
                {status}
              </span>
            </div>
            <div className="text-xs text-slate-600 font-medium">
              Protocol: <span className="font-bold text-slate-900">{logistics.dispatch_protocol}</span>
            </div>
          </div>

          {/* Facilities Grid */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Origin */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                DISPATCHING FACILITY (ORIGIN)
              </span>
              <h4 className="text-sm font-bold text-slate-900">{origin_facility.name}</h4>
              <p className="text-xs text-slate-600 mt-1">{origin_facility.address}</p>
              <p className="text-xs text-slate-500 mt-0.5">Contact: {origin_facility.phone || 'Operations Desk'}</p>
            </div>

            {/* Destination */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                RECEIVING FACILITY (DESTINATION)
              </span>
              <h4 className="text-sm font-bold text-slate-900">{destination_facility.name}</h4>
              <p className="text-xs text-slate-600 mt-1">{destination_facility.address}</p>
              <p className="text-xs text-slate-500 mt-0.5">Contact: {destination_facility.phone || 'Transfusion Lab'}</p>
            </div>
          </div>

          {/* Consignment Items Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2.5">Tracking ID</th>
                  <th className="p-2.5">Component & Group</th>
                  <th className="p-2.5">Batch Ref</th>
                  <th className="p-2.5 text-center">Units</th>
                  <th className="p-2.5">Expiry Timestamp</th>
                  <th className="p-2.5">Temp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr>
                  <td className="p-2.5 font-mono font-bold text-teal-800">{consignment.tracking_id}</td>
                  <td className="p-2.5 font-semibold text-slate-900">
                    <span className="font-black text-red-600 mr-1.5">{consignment.blood_group}</span>
                    {consignment.component_type}
                  </td>
                  <td className="p-2.5 font-mono text-slate-600">{consignment.batch_ref}</td>
                  <td className="p-2.5 text-center font-bold text-slate-900">{consignment.units_transferred}</td>
                  <td className="p-2.5 font-medium text-slate-700">{consignment.expiry_date}</td>
                  <td className="p-2.5 text-slate-700 font-medium">{consignment.storage_temp_c}°C</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Transit Logistics & Rationale */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-2 mb-6">
            <div className="flex justify-between text-slate-700">
              <span><strong>Estimated Transit Duration:</strong> {logistics.estimated_transit_minutes} Minutes</span>
              <span><strong>Distance:</strong> {logistics.distance_km} km</span>
              <span><strong>Approved:</strong> {logistics.approval_timestamp}</span>
            </div>
            <p className="text-slate-600 text-[11px] pt-1 border-t border-slate-200">
              <strong>Optimization Rationale:</strong> {logistics.rationale}
            </p>
          </div>

          {/* Chain of Custody Sign-Off Blocks */}
          <div className="border-t-2 border-slate-800 pt-4">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-3">
              Chain of Custody Verifications & Sign-Offs
            </span>
            <div className="grid grid-cols-3 gap-4">
              {sign_off_blocks.map((block: any, idx: number) => (
                <div key={idx} className="border border-slate-200 p-2.5 rounded bg-slate-50/50 text-[11px]">
                  <span className="font-bold text-slate-800 block text-[10px] uppercase truncate">{block.role}</span>
                  <span className="text-slate-500 block text-[10px] mb-4">{block.name}</span>
                  <div className="border-b border-slate-400 mb-1"></div>
                  <span className="text-[9px] text-slate-400 block text-center">Authorized Signature</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Watermark Notice */}
          <p className="text-[10px] text-slate-400 text-center mt-6 uppercase tracking-wider">
            {watermark}
          </p>
        </div>

        {/* Modal Footer (Screen Only) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-lg hover:bg-navy-850 transition flex items-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Manifest</span>
          </button>
        </div>
      </div>
    </div>
  );
};
