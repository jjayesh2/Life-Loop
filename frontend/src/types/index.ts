export interface Facility {
  id: number;
  code: string;
  name: string;
  facility_type: string;
  latitude: float;
  longitude: float;
  address: string;
  contact_phone?: string;
  contact_email?: string;
  safety_reserve_units: number;
  is_active: boolean;
  total_inventory?: number;
  shortage_count?: number;
}

export type float = number;

export interface TraceabilityEvent {
  id: number;
  event_type: string;
  facility_name: string;
  operator: string;
  details: string;
  timestamp: string;
}

export interface InventoryItem {
  id: number;
  tracking_id: string;
  facility_id: number;
  facility_name?: string;
  blood_group: string;
  component_type: string;
  quantity: number;
  batch_ref: string;
  collection_date: string;
  expiry_date: string;
  status: 'available' | 'reserved' | 'in_transit' | 'quarantined' | 'expired' | 'unavailable';
  storage_temp_c: number;
  qr_code_svg?: string;
  created_at: string;
  updated_at: string;
  traceability_events?: TraceabilityEvent[];
}

export interface DemandRecord {
  id: number;
  facility_id: number;
  facility_name?: string;
  blood_group: string;
  component_type: string;
  quantity_needed: number;
  urgency: 'critical' | 'urgent' | 'routine';
  deadline_hours: number;
  status: 'unmet' | 'fulfilled' | 'partially_fulfilled';
  is_simulated: boolean;
  created_at: string;
}

export interface Transfer {
  id: number;
  transfer_id: string;
  origin_facility_id: number;
  origin_name?: string;
  destination_facility_id: number;
  destination_name?: string;
  inventory_item_id: number;
  tracking_id?: string;
  component_type: string;
  blood_group: string;
  quantity: number;
  travel_time_minutes: number;
  distance_km: number;
  status: 'proposed' | 'approved' | 'dispatched' | 'received' | 'cancelled' | 'rejected';
  cancellation_reason?: string;
  optimization_run_id?: string;
  rationale?: string;
  created_at: string;
  approved_at?: string;
  dispatched_at?: string;
  received_at?: string;
}

export interface Alert {
  id: number;
  facility_id: number;
  facility_name?: string;
  inventory_item_id?: number;
  tracking_id?: string;
  blood_group?: string;
  component_type?: string;
  alert_type: string;
  severity: 'critical' | 'urgent' | 'warning' | 'info';
  message: string;
  hours_remaining?: number;
  status: 'active' | 'acknowledged' | 'resolved';
  email_delivery_status: string;
  created_at: string;
  acknowledged_at?: string;
}

export interface ProposedTransfer {
  origin_id: number;
  origin_name: string;
  destination_id: number;
  destination_name: string;
  item_id: number;
  tracking_id: string;
  blood_group: string;
  component_type: string;
  quantity: number;
  travel_time_minutes: number;
  hours_until_expiry: number;
  explanation: string;
}

export interface OptimizationResult {
  run_id: string;
  solver_name: string;
  solver_status: string;
  is_feasible: boolean;
  runtime_seconds: number;
  objective_value?: number;
  proposed_transfers: ProposedTransfer[];
  unmet_demand_count: number;
  prevented_waste_units: number;
  total_travel_time_minutes: number;
  constraint_validation: {
    is_valid: boolean;
    violations: string[];
    checks_run?: string[];
  };
  baseline_comparison: {
    total_demand_units: number;
    baseline: {
      name: string;
      unmet_demand_units: number;
      projected_expired_waste_units: number;
      service_level_pct: number;
      transfers_dispatched: number;
      units_moved: number;
      transport_time_minutes: number;
    };
    life_loop_optimized: {
      name: string;
      unmet_demand_units: number;
      projected_expired_waste_units: number;
      service_level_pct: number;
      transfers_dispatched: number;
      units_moved: number;
      transport_time_minutes: number;
    };
    improvement: {
      unmet_demand_reduction_pct: number;
      waste_reduction_pct: number;
      service_level_gain_pct: number;
    };
  };
  created_at: string;
}

export interface DashboardSummary {
  total_available_units: number;
  total_reserved_units: number;
  facilities_at_shortage_risk: number;
  units_approaching_expiry: number;
  active_proposed_transfers: number;
  completed_transfers: number;
  latest_optimization_status: string;
  active_alerts_count: number;
  inventory_by_group: Record<string, number>;
  inventory_by_component: Record<string, number>;
  shortage_facilities: Array<{
    facility_id: number;
    name: string;
    facility_type: string;
    available_stock: number;
    safety_reserve: number;
    deficit: number;
  }>;
  approaching_expiry_items: Array<{
    id: number;
    tracking_id: string;
    facility_name: string;
    blood_group: string;
    component_type: string;
    quantity: number;
    hours_remaining: number;
  }>;
  recent_transfers: Array<any>;
  recent_alerts: Array<any>;
  latest_run_summary?: any;
}

export interface AuditLog {
  id: number;
  action: string;
  actor: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  timestamp: string;
}
