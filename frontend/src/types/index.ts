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
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  source_url?: string;
  date_verified?: string;
  verification_status?: string;
  is_connected: boolean;
  safety_reserve_units: number;
  is_active: boolean;
  total_inventory?: number;
  shortage_count?: number;
}

export type float = number;

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'network_admin' | 'hospital_staff' | 'blood_bank_staff' | 'driver';
  facility_id?: number;
  facility_name?: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_number?: string;
}

export interface Driver {
  id: number;
  user_id: number;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  current_lat?: number;
  current_lng?: number;
  status: 'available' | 'assigned' | 'in_transit' | 'off_duty';
  last_location_update?: string;
}

export interface SourceRecommendationItem {
  facility_id: number;
  facility_name: string;
  facility_type: string;
  distance_km: number;
  travel_time_minutes: number;
  available_units: number;
  is_connected: boolean;
  score: number;
  rationale: string;
}

export interface EmergencyBloodRequest {
  id: number;
  request_id: string;
  hospital_id: number;
  hospital_name?: string;
  blood_group: string;
  component_type: string;
  quantity_needed: number;
  quantity_fulfilled: number;
  urgency: 'critical' | 'urgent' | 'routine';
  required_by_time?: string;
  clinical_notes?: string;
  status: 'pending_search' | 'sources_recommended' | 'approved_reserved' | 'dispatched' | 'delivered' | 'cancelled';
  source_recommendations: SourceRecommendationItem[];
  created_at: string;
  updated_at?: string;
}

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
  reserved_quantity?: number;
  batch_ref: string;
  collection_date: string;
  expiry_date: string;
  status: 'available' | 'reserved' | 'in_transit' | 'quarantined' | 'expired' | 'unavailable';
  storage_temp_c: number;
  data_source_label?: string;
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

export interface TemperatureReading {
  timestamp: string;
  temp_c: number;
}

export interface Transfer {
  id: number;
  transfer_id: string;
  request_id?: string;
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
  eta_minutes?: number;
  eta_type?: string;
  status: 'proposed' | 'awaiting_approval' | 'approved' | 'driver_assigned' | 'dispatched' | 'delivered' | 'received' | 'cancelled' | 'rejected';
  cancellation_reason?: string;
  driver_id?: number;
  driver_name?: string;
  driver_phone?: string;
  driver_vehicle?: string;
  driver_status?: string;
  driver_decline_reason?: string;
  optimization_run_id?: string;
  rationale?: string;
  temperature_current_c?: number;
  temperature_min_c?: number;
  temperature_max_c?: number;
  temperature_status?: 'normal' | 'warning' | 'critical';
  temperature_history?: TemperatureReading[];
  created_at: string;
  approved_at?: string;
  driver_assigned_at?: string;
  dispatched_at?: string;
  delivered_at?: string;
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
  spoken_announcement?: string;
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
