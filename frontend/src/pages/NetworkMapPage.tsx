import React, { useState } from 'react';
import { NetworkMapView } from '../components/NetworkMapView';
import { Facility, Transfer } from '../types';
import { Building2, AlertTriangle, Truck, Clock, ShieldCheck, MapPin } from 'lucide-react';

interface NetworkMapPageProps {
  facilities: Facility[];
  transfers: Transfer[];
}

export const NetworkMapPage: React.FC<NetworkMapPageProps> = ({ facilities, transfers }) => {
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(facilities[0] || null);

  const activeTransfers = transfers.filter(t => ['proposed', 'approved', 'dispatched'].includes(t.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Nashik District Blood Logistics &amp; Repository Network</h1>
        <p className="text-xs text-slate-500">
          Geographic surveillance of verified hospital nodes, charitable blood banks, and in-transit cold chain corridors across Nashik, Maharashtra.
        </p>
      </div>

      {/* Main Map Component */}
      <NetworkMapView
        facilities={facilities}
        transfers={transfers}
        selectedFacility={selectedFacility}
        onSelectFacility={setSelectedFacility}
      />

      {/* Facility Inspection & Route Matrix Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selected Facility Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Building2 className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-slate-900 text-sm">Facility Detail Inspector</h3>
          </div>

          {selectedFacility ? (
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-[10px] text-teal-600 font-bold uppercase">{selectedFacility.code}</span>
                <h4 className="text-base font-bold text-slate-900">{selectedFacility.name}</h4>
                <p className="text-slate-500 mt-0.5">{selectedFacility.facility_type}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Address</span>
                <span className="text-slate-700 font-medium">{selectedFacility.address}</span>
                <span className="text-slate-400 text-[11px] block mt-1">{selectedFacility.contact_phone}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 bg-teal-50 rounded-lg border border-teal-100">
                  <span className="text-[10px] text-teal-700 font-bold uppercase block">On-Hand Stock</span>
                  <span className="text-lg font-black text-teal-900">{selectedFacility.total_inventory ?? 0}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Safety Reserve</span>
                  <span className="text-lg font-black text-slate-800">{selectedFacility.safety_reserve_units}</span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-slate-500 font-semibold block mb-1">Active Route Connections:</span>
                <div className="space-y-1">
                  {activeTransfers
                    .filter(t => t.origin_facility_id === selectedFacility.id || t.destination_facility_id === selectedFacility.id)
                    .map(tx => (
                      <div key={tx.id} className="p-2 bg-slate-50 rounded border text-[11px] flex items-center justify-between">
                        <span className="font-mono font-bold text-teal-800">{tx.transfer_id}</span>
                        <span>{tx.origin_name} → {tx.destination_name}</span>
                        <span className="font-bold text-slate-700">{Math.round(tx.travel_time_minutes)} min</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Select any pin on the map to inspect facility parameters.</p>
          )}
        </div>

        {/* Participating Facilities Roster */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">Participating Metropolitan Network Nodes ({facilities.length})</h3>
            <span className="text-xs text-slate-400">Click row to focus</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            {facilities.map((fac) => {
              const isShortage = (fac.shortage_count ?? 0) > 0 || (fac.total_inventory ?? 0) < fac.safety_reserve_units;
              const isSelected = selectedFacility?.id === fac.id;

              return (
                <div
                  key={fac.id}
                  onClick={() => setSelectedFacility(fac)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/40 shadow-sm'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-slate-900">{fac.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">{fac.facility_type}</span>
                    <span className="text-[10px] text-slate-400">Stock: {fac.total_inventory ?? 0} / Reserve: {fac.safety_reserve_units}</span>
                  </div>

                  {isShortage && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 flex items-center space-x-0.5">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <span>Deficit</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
