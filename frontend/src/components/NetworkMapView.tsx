import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Facility, Transfer } from '../types';
import { Building2, AlertTriangle, Truck, Clock, ShieldCheck, MapPin } from 'lucide-react';

interface NetworkMapViewProps {
  facilities: Facility[];
  transfers: Transfer[];
  selectedFacility: Facility | null;
  onSelectFacility: (facility: Facility) => void;
  disruptions?: Record<string, number>;
}

// Custom Leaflet Icons using SVG DivIcons
const createFacilityIcon = (facilityType: string, isShortage: boolean) => {
  const isHub = facilityType.includes('Blood Bank') || facilityType.includes('Depot');
  const bg = isShortage ? '#dc2626' : (isHub ? '#0d9488' : '#1e3a8a');
  
  return L.divIcon({
    className: 'custom-facility-marker',
    html: `
      <div style="
        background-color: ${bg};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 11px;
      ">
        ${isHub ? '⚑' : '+'}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

export const NetworkMapView: React.FC<NetworkMapViewProps> = ({
  facilities,
  transfers,
  selectedFacility,
  onSelectFacility,
  disruptions = {}
}) => {
  const [mapError, setMapError] = useState(false);

  // Default center around Nashik City & District, Maharashtra, India
  const defaultCenter: [number, number] = [19.9975, 73.7898];

  const activeTransfers = transfers.filter(t => ['proposed', 'approved', 'dispatched'].includes(t.status));

  return (
    <div className="relative w-full h-[540px] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      {/* Legend Overlay */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-md border border-slate-200 text-xs space-y-1.5 pointer-events-auto">
        <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block border-b border-slate-100 pb-1">
          Network Map Legend
        </span>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-teal-600"></span>
          <span className="text-slate-700">Regional Blood Bank / Logistics Hub</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-blue-800"></span>
          <span className="text-slate-700">Hospital / Trauma Center (Sufficient)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-red-600"></span>
          <span className="text-slate-700">Facility with Shortage Deficit</span>
        </div>
        <div className="flex items-center space-x-2 pt-1 border-t border-slate-100">
          <span className="w-4 h-0.5 bg-teal-500"></span>
          <span className="text-slate-700">Proposed Transfer Route</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-4 h-0.5 bg-amber-500 border-b border-dashed border-amber-600"></span>
          <span className="text-slate-700">In-Transit Courier Route</span>
        </div>
      </div>

      {/* Leaflet Map */}
      {!mapError ? (
        <MapContainer
          center={defaultCenter}
          zoom={12}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Facility Markers */}
          {facilities.map((fac) => {
            const isShortage = (fac.shortage_count ?? 0) > 0 || (fac.total_inventory ?? 0) < fac.safety_reserve_units;
            return (
              <Marker
                key={fac.id}
                position={[fac.latitude, fac.longitude]}
                icon={createFacilityIcon(fac.facility_type, isShortage)}
                eventHandlers={{
                  click: () => onSelectFacility(fac),
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[180px]">
                    <span className="text-[10px] uppercase font-bold text-teal-600 block">{fac.code}</span>
                    <h4 className="text-xs font-bold text-slate-900">{fac.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{fac.facility_type}</p>
                    
                    <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-1 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[9px]">AVAILABLE</span>
                        <span className="font-bold text-slate-800">{fac.total_inventory ?? 0} units</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">RESERVE REQ</span>
                        <span className="font-bold text-slate-800">{fac.safety_reserve_units} units</span>
                      </div>
                    </div>

                    {isShortage && (
                      <div className="mt-2 bg-red-50 text-red-700 p-1.5 rounded text-[10px] font-semibold flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                        <span>Projected Shortage Deficit</span>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Transfer Route Polylines */}
          {activeTransfers.map((tx) => {
            const orig = facilities.find(f => f.id === tx.origin_facility_id);
            const dest = facilities.find(f => f.id === tx.destination_facility_id);
            if (!orig || !dest) return null;

            const isDispatched = tx.status === 'dispatched';
            const color = isDispatched ? '#f59e0b' : '#0d9488';

            return (
              <Polyline
                key={tx.id}
                positions={[
                  [orig.latitude, orig.longitude],
                  [dest.latitude, dest.longitude]
                ]}
                pathOptions={{
                  color,
                  weight: 3.5,
                  opacity: 0.85,
                  dashArray: isDispatched ? '6, 6' : undefined
                }}
              >
                <Tooltip sticky>
                  <div className="text-xs p-0.5">
                    <span className="font-bold text-slate-800 block">
                      {tx.transfer_id} ({tx.blood_group} {tx.component_type})
                    </span>
                    <span className="text-slate-600 text-[11px]">
                      {orig.name} → {dest.name} ({tx.quantity} units, {int_min(tx.travel_time_minutes)} min)
                    </span>
                  </div>
                </Tooltip>
              </Polyline>
            );
          })}
        </MapContainer>
      ) : (
        /* Graceful Fallback if map tiles blocked */
        <div className="p-8 text-center flex flex-col items-center justify-center h-full space-y-3">
          <MapPin className="w-8 h-8 text-teal-600" />
          <h3 className="font-bold text-slate-800">Metropolitan Facility Matrix (Tile Fallback)</h3>
          <p className="text-xs text-slate-500 max-w-md">
            Showing participating network nodes and dynamic coordinates while external OpenStreetMap tiles load.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-left max-w-lg w-full">
            {facilities.map(f => (
              <div key={f.id} className="p-2 border rounded bg-white">
                <span className="font-bold text-slate-800">{f.name}</span>
                <span className="block text-slate-500 text-[10px]">{f.facility_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function int_min(mins: number): number {
  return Math.round(mins);
}
