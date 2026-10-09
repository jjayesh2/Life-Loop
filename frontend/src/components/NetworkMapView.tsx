import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Facility, Transfer } from '../types';
import { Building2, AlertTriangle, Truck, Clock, ShieldCheck, MapPin, CheckCircle, ExternalLink, Filter } from 'lucide-react';

interface NetworkMapViewProps {
  facilities: Facility[];
  transfers: Transfer[];
  selectedFacility: Facility | null;
  onSelectFacility: (facility: Facility) => void;
  disruptions?: Record<string, number>;
}

// Custom Leaflet Icons using SVG DivIcons
const createFacilityIcon = (facilityType: string, isShortage: boolean, isConnected: boolean) => {
  const isHub = facilityType.includes('Blood Bank') || facilityType.includes('Raktpedhi');
  
  let bg = '#64748b'; // default slate for public directory
  let symbol = '🏛';

  if (isConnected) {
    if (isShortage) {
      bg = '#dc2626'; // red for shortage
      symbol = '!';
    } else if (isHub) {
      bg = '#0d9488'; // teal for blood bank
      symbol = '🩸';
    } else {
      bg = '#1e3a8a'; // navy for hospital
      symbol = '✚';
    }
  }

  const border = isConnected ? '3px solid white' : '2px dashed #cbd5e1';

  return L.divIcon({
    className: 'custom-facility-marker',
    html: `
      <div style="
        background-color: ${bg};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: ${border};
        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 13px;
        transition: transform 0.2s;
      ">
        ${symbol}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createVehicleIcon = (tempStatus?: string) => {
  const bg = tempStatus === 'critical' ? '#dc2626' : '#2563eb';
  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        background-color: ${bg};
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
      ">
        🚐
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

export const NetworkMapView: React.FC<NetworkMapViewProps> = ({
  facilities,
  transfers,
  selectedFacility,
  onSelectFacility,
  disruptions = {}
}) => {
  const [showOnlyConnected, setShowOnlyConnected] = useState<boolean>(false);

  // Nashik City & District coordinates center: [19.9975, 73.7898]
  const defaultCenter: [number, number] = [19.9975, 73.7898];

  const visibleFacilities = showOnlyConnected
    ? facilities.filter(f => f.is_connected)
    : facilities;

  const activeTransfers = transfers.filter(t => ['proposed', 'approved', 'driver_assigned', 'dispatched'].includes(t.status));

  return (
    <div className="relative w-full h-[580px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      {/* Top Controls: Filter & District Badge */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center space-x-2 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-200 flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-slate-800">Nashik District Network</span>
          <span className="text-[10px] text-slate-500 font-medium">Maharashtra</span>
        </div>

        <button
          onClick={() => setShowOnlyConnected(!showOnlyConnected)}
          className={`px-3 py-2 rounded-xl shadow-md border text-xs font-bold flex items-center space-x-1.5 transition ${
            showOnlyConnected
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-white'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>{showOnlyConnected ? 'Connected Facilities (7)' : 'All Public Directory (12)'}</span>
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md p-3.5 rounded-xl shadow-md border border-slate-200 text-xs space-y-1.5 pointer-events-auto max-w-xs">
        <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block border-b border-slate-100 pb-1">
          Nashik Hubs & Transit Routes
        </span>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-teal-600"></span>
          <span className="text-slate-700">Connected Blood Bank (Live API)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-blue-900"></span>
          <span className="text-slate-700">Connected Hospital (Live Requisition)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-slate-500"></span>
          <span className="text-slate-700">Public Directory Listing (Gov Verified)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-red-600"></span>
          <span className="text-slate-700">Facility with Shortage Risk</span>
        </div>
        <div className="flex items-center space-x-2 pt-1 border-t border-slate-100">
          <span className="w-4 h-0.5 bg-blue-500 border-b border-dashed border-blue-600"></span>
          <span className="text-slate-700">Active Cold-Chain Courier Route</span>
        </div>
      </div>

      {/* Leaflet Map */}
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Nashik GIS'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Facility Markers */}
        {visibleFacilities.map((fac) => {
          const isShortage = (fac.shortage_count ?? 0) > 0 || (fac.total_inventory ?? 0) < fac.safety_reserve_units;
          return (
            <Marker
              key={fac.id}
              position={[fac.latitude, fac.longitude]}
              icon={createFacilityIcon(fac.facility_type, isShortage, fac.is_connected)}
              eventHandlers={{
                click: () => onSelectFacility(fac),
              }}
            >
              <Popup>
                <div className="p-1 min-w-[220px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-teal-600">{fac.code}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      fac.is_connected
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {fac.is_connected ? 'Live Connected' : 'Public Directory'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 mt-1">{fac.name}</h4>
                  <p className="text-[11px] text-slate-500">{fac.facility_type} • {fac.district || 'Nashik'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{fac.address}</p>

                  <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-1 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[9px]">AVAILABLE STOCK</span>
                      <span className="font-bold text-slate-800">
                        {fac.is_connected ? `${fac.total_inventory ?? 0} units` : 'Inquire Bank'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">SAFETY RESERVE</span>
                      <span className="font-bold text-slate-800">{fac.safety_reserve_units} units</span>
                    </div>
                  </div>

                  {fac.contact_phone && (
                    <p className="text-[10px] text-slate-600 mt-1.5 font-medium">
                      📞 {fac.contact_phone}
                    </p>
                  )}

                  {fac.source_url && (
                    <div className="mt-2 pt-1 border-t border-slate-100">
                      <a
                        href={fac.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-teal-600 hover:underline flex items-center space-x-1"
                      >
                        <span>Verified Gov Directory</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}

                  {isShortage && fac.is_connected && (
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

          const isInTransit = tx.status === 'dispatched';
          const color = isInTransit ? '#2563eb' : '#0d9488';

          // Calculate midpoint for vehicle pin
          const midLat = (orig.latitude + dest.latitude) / 2;
          const midLng = (orig.longitude + dest.longitude) / 2;

          return (
            <React.Fragment key={tx.id}>
              <Polyline
                positions={[
                  [orig.latitude, orig.longitude],
                  [dest.latitude, dest.longitude]
                ]}
                pathOptions={{
                  color,
                  weight: 4,
                  opacity: 0.9,
                  dashArray: isInTransit ? '8, 8' : undefined
                }}
              >
                <Tooltip sticky>
                  <div className="text-xs p-1">
                    <span className="font-bold text-slate-900 block">
                      {tx.transfer_id} • {tx.blood_group} ({tx.component_type})
                    </span>
                    <span className="text-slate-600 text-[11px] block">
                      {orig.name} → {dest.name} ({tx.quantity} units)
                    </span>
                    <span className="text-blue-600 font-semibold text-[10px]">
                      ETA: {tx.eta_minutes ?? tx.travel_time_minutes} min ({tx.distance_km} km)
                    </span>
                  </div>
                </Tooltip>
              </Polyline>

              {/* Vehicle marker on route for in-transit shipments */}
              {isInTransit && (
                <Marker
                  position={[midLat, midLng]}
                  icon={createVehicleIcon(tx.temperature_status)}
                >
                  <Popup>
                    <div className="p-1 text-xs">
                      <span className="font-bold text-blue-900 block">🚐 {tx.driver_name || 'Courier Van'}</span>
                      <p className="text-[11px] text-slate-600">Transit: {orig.name} to {dest.name}</p>
                      <p className="text-[11px] font-bold text-slate-800 mt-1">
                        Temp: {tx.temperature_current_c != null ? `${tx.temperature_current_c.toFixed(1)}°C` : '4.0°C'}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};
