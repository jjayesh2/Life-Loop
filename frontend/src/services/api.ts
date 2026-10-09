import {
  DashboardSummary,
  Facility,
  InventoryItem,
  DemandRecord,
  Transfer,
  Alert,
  OptimizationResult,
  AuditLog
} from '../types';

const BASE_URL = '/api';

export async function fetchDashboard(): Promise<DashboardSummary> {
  const res = await fetch(`${BASE_URL}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch dashboard summary');
  return res.json();
}

export async function fetchFacilities(): Promise<Facility[]> {
  const res = await fetch(`${BASE_URL}/facilities`);
  if (!res.ok) throw new Error('Failed to fetch facilities');
  return res.json();
}

export async function fetchInventory(params?: {
  facility_id?: number;
  blood_group?: string;
  component_type?: string;
  status?: string;
}): Promise<InventoryItem[]> {
  const query = new URLSearchParams();
  if (params?.facility_id) query.set('facility_id', params.facility_id.toString());
  if (params?.blood_group) query.set('blood_group', params.blood_group);
  if (params?.component_type) query.set('component_type', params.component_type);
  if (params?.status) query.set('status', params.status);

  const res = await fetch(`${BASE_URL}/inventory?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch inventory');
  return res.json();
}

export async function createInventoryItem(data: Partial<InventoryItem>): Promise<InventoryItem> {
  const res = await fetch(`${BASE_URL}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create inventory item');
  return res.json();
}

export async function lookupTraceability(identifier: string): Promise<InventoryItem> {
  const res = await fetch(`${BASE_URL}/traceability/${encodeURIComponent(identifier)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Item '${identifier}' not found`);
  }
  return res.json();
}

export async function recordMovementEvent(itemId: number, payload: {
  event_type: string;
  facility_name: string;
  details: string;
  operator?: string;
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/traceability/${itemId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to record movement event');
  return res.json();
}

export async function fetchAlerts(status?: string): Promise<Alert[]> {
  const url = status ? `${BASE_URL}/alerts?status=${status}` : `${BASE_URL}/alerts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function triggerExpiryCheck(): Promise<any> {
  const res = await fetch(`${BASE_URL}/alerts/run-expiry-check`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run expiry check');
  return res.json();
}

export async function acknowledgeAlert(alertId: number): Promise<any> {
  const res = await fetch(`${BASE_URL}/alerts/${alertId}/acknowledge`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to acknowledge alert');
  return res.json();
}

export async function resolveAlert(alertId: number, notes?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/alerts/${alertId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: notes || 'Resolved by authorized operator' })
  });
  if (!res.ok) throw new Error('Failed to resolve alert');
  return res.json();
}

export async function fetchDemands(facilityId?: number): Promise<DemandRecord[]> {
  const url = facilityId ? `${BASE_URL}/demand?facility_id=${facilityId}` : `${BASE_URL}/demand`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch demands');
  return res.json();
}

export async function fetchForecasts(facilityId?: number, componentType?: string): Promise<any> {
  const query = new URLSearchParams();
  if (facilityId) query.set('facility_id', facilityId.toString());
  if (componentType) query.set('component_type', componentType);

  const res = await fetch(`${BASE_URL}/forecasts?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch forecasts');
  return res.json();
}

export async function runOptimization(weights?: {
  unmet_demand?: number;
  expiry_risk?: number;
  travel_time?: number;
}): Promise<OptimizationResult> {
  const res = await fetch(`${BASE_URL}/optimization/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario_id: 'active',
      weight_unmet_demand: weights?.unmet_demand ?? 100.0,
      weight_expiry_risk: weights?.expiry_risk ?? 15.0,
      weight_travel_time: weights?.travel_time ?? 0.2
    })
  });
  if (!res.ok) throw new Error('Failed to run MILP optimization');
  return res.json();
}

export async function fetchLatestOptimization(): Promise<any> {
  const res = await fetch(`${BASE_URL}/optimization/latest`);
  if (!res.ok) throw new Error('Failed to fetch latest optimization');
  return res.json();
}

export async function fetchTransfers(status?: string): Promise<Transfer[]> {
  const url = status ? `${BASE_URL}/transfers?status=${status}` : `${BASE_URL}/transfers`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch transfers');
  return res.json();
}

export async function approveTransfer(transferId: string, authorizedQuantity?: number): Promise<any> {
  const res = await fetch(`${BASE_URL}/transfers/${transferId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authorizedQuantity !== undefined ? { authorized_quantity: authorizedQuantity } : {})
  });
  if (!res.ok) throw new Error('Failed to approve transfer');
  return res.json();
}

export async function rejectTransfer(transferId: string, reason?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/transfers/${transferId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || 'Facility declined transfer proposal due to clinical reserve policy' })
  });
  if (!res.ok) throw new Error('Failed to reject transfer proposal');
  return res.json();
}

export async function dispatchTransfer(transferId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/transfers/${transferId}/dispatch`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to dispatch transfer');
  return res.json();
}

export async function receiveTransfer(transferId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/transfers/${transferId}/receive`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to receive transfer');
  return res.json();
}

export async function cancelTransfer(transferId: string, reason?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/transfers/${transferId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || 'Operator cancelled' })
  });
  if (!res.ok) throw new Error('Failed to cancel transfer');
  return res.json();
}

export async function fetchTransferManifest(transferId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/transfers/${transferId}/manifest`);
  if (!res.ok) throw new Error('Failed to fetch manifest');
  return res.json();
}

export async function triggerSimulationEvent(payload: {
  event_type: string;
  facility_id?: number;
  blood_group?: string;
  component_type?: string;
  quantity?: number;
  route_origin_id?: number;
  route_dest_id?: number;
  delay_multiplier?: number;
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/scenarios/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to trigger simulation event');
  return res.json();
}

export async function resetScenario(): Promise<any> {
  const res = await fetch(`${BASE_URL}/scenarios/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset scenario');
  return res.json();
}

export async function fetchImpactAnalytics(): Promise<any> {
  const res = await fetch(`${BASE_URL}/analytics/impact`);
  if (!res.ok) throw new Error('Failed to fetch impact analytics');
  return res.json();
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const res = await fetch(`${BASE_URL}/audit`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function askCopilot(query: string): Promise<{ answer: string; type: string }> {
  const res = await fetch(`${BASE_URL}/copilot/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error('Failed to contact Copilot');
  return res.json();
}

// ----------------------------------------
// Role-based Auth & Demo Switcher
// ----------------------------------------
export async function fetchDemoUsers(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/auth/demo-users`);
  if (!res.ok) throw new Error('Failed to fetch demo users');
  return res.json();
}

// ----------------------------------------
// Emergency Blood Requests
// ----------------------------------------
export async function fetchEmergencyRequests(facilityId?: number): Promise<any[]> {
  const url = facilityId ? `${BASE_URL}/emergency-requests?facility_id=${facilityId}` : `${BASE_URL}/emergency-requests`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch emergency requests');
  return res.json();
}

export async function createEmergencyRequest(data: {
  requesting_facility_id: number;
  blood_group: string;
  component_type: string;
  quantity_needed: number;
  urgency?: string;
  required_by_hours?: number;
  delivery_destination?: string;
  contact_phone?: string;
  notes?: string;
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/emergency-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create emergency request');
  return res.json();
}

// ----------------------------------------
// Drivers & Logistics
// ----------------------------------------
export async function fetchDrivers(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/drivers`);
  if (!res.ok) throw new Error('Failed to fetch drivers');
  return res.json();
}

export async function assignDriverToTransfer(transferId: string, driverId?: number): Promise<any> {
  const url = driverId ? `${BASE_URL}/transfers/${transferId}/assign-driver?driver_id=${driverId}` : `${BASE_URL}/transfers/${transferId}/assign-driver`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to assign driver');
  return res.json();
}

export async function submitDriverAction(transferId: string, action: 'accept' | 'pickup' | 'deliver'): Promise<any> {
  const res = await fetch(`${BASE_URL}/transfers/${transferId}/driver-action?action=${action}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to submit driver action ${action}`);
  return res.json();
}

// ----------------------------------------
// Cold Chain IoT Simulator
// ----------------------------------------
export async function triggerTemperatureSpike(transferId: string, spikeTemp: number = 11.5): Promise<any> {
  const res = await fetch(`${BASE_URL}/transfers/${transferId}/simulate-temperature-spike?spike_temp=${spikeTemp}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger temperature excursion');
  return res.json();
}

