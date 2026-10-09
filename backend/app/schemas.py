from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- AUTH & USERS ---
class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str  # network_admin, hospital_staff, blood_bank_staff, driver
    facility_id: Optional[int] = None
    facility_name: Optional[str] = None
    phone: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# --- FACILITIES ---
class FacilityBase(BaseModel):
    code: str
    name: str
    facility_type: str
    latitude: float
    longitude: float
    address: str
    city: Optional[str] = "Nashik"
    district: Optional[str] = "Nashik"
    state: Optional[str] = "Maharashtra"
    pincode: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    source_url: Optional[str] = None
    date_verified: Optional[str] = None
    verification_status: Optional[str] = "Verified Public Directory"
    is_connected: Optional[bool] = True
    safety_reserve_units: int = 15
    is_active: bool = True
    is_connected: bool = True
    verification_status: str = "Connected Demo Facility"
    source_url: str = "https://nashik.gov.in/en/public-utilities/hospitals/"
    date_verified: str = "2026-03-15"

class FacilityOut(FacilityBase):
    id: int
    total_inventory: Optional[int] = 0
    shortage_count: Optional[int] = 0
    model_config = ConfigDict(from_attributes=True)

class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    facility_id: Optional[int] = None
    facility_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)

class DriverOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    name: str
    phone: str
    vehicle_type: str
    vehicle_number: str
    current_lat: float
    current_lng: float
    status: str
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)

class FacilityCreate(FacilityBase):
    pass

class FacilityUpdate(BaseModel):
    name: Optional[str] = None
    facility_type: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    safety_reserve_units: Optional[int] = None
    is_connected: Optional[bool] = None
    verification_status: Optional[str] = None

# --- DRIVERS ---
class DriverOut(BaseModel):
    id: int
    user_id: int
    name: str
    phone: str
    vehicle_type: str
    vehicle_number: str
    current_lat: float
    current_lng: float
    status: str
    last_location_update: datetime

# --- INVENTORY ---
class InventoryItemBase(BaseModel):
    tracking_id: str
    facility_id: int
    blood_group: str
    component_type: str
    quantity: int = 1
    reserved_quantity: int = 0
    batch_ref: str
    collection_date: datetime
    expiry_date: datetime
    status: str = "available"
    storage_temp_c: float = 4.0
    data_source_label: str = "Demo stock — simulated"

class InventoryItemCreate(BaseModel):
    facility_id: int
    blood_group: str
    component_type: str
    quantity: int = 1
    batch_ref: str
    collection_date: datetime
    expiry_date: datetime
    status: str = "available"
    storage_temp_c: float = 4.0

class TraceabilityEventOut(BaseModel):
    id: int
    event_type: str
    facility_name: str
    operator: str
    details: str
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class InventoryItemOut(InventoryItemBase):
    id: int
    facility_name: Optional[str] = None
    qr_code_svg: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    traceability_events: List[TraceabilityEventOut] = []
    model_config = ConfigDict(from_attributes=True)

# --- EMERGENCY BLOOD REQUESTS ---
class SourceRecommendationItem(BaseModel):
    facility_id: int
    facility_name: str = ""
    distance_km: float
    travel_time_minutes: float
    eligible_units_available: int
    recommended_units_to_take: int
    hours_until_batch_expiry: float
    rationale: str

class EmergencyRequestCreate(BaseModel):
    hospital_id: int
    blood_group: str
    component_type: str
    quantity_needed: int
    urgency: str = "critical"  # critical, urgent, routine
    required_by_hours: float = 3.0
    clinical_notes: Optional[str] = None

class EmergencyRequestOut(BaseModel):
    id: int
    request_id: str
    hospital_id: int
    hospital_name: Optional[str] = None
    blood_group: str
    component_type: str
    quantity_needed: int
    quantity_fulfilled: int
    urgency: str
    required_by_time: datetime
    clinical_notes: Optional[str] = None
    status: str
    source_recommendations: List[SourceRecommendationItem] = []
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class EmergencyRequestCreate(BaseModel):
    requesting_facility_id: int
    blood_group: str
    component_type: str
    quantity_needed: int
    urgency: str = "critical"
    required_by_hours: float = 4.0
    delivery_destination: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None

class EmergencyRequestOut(BaseModel):
    id: int
    request_id: str
    requesting_facility_id: int
    requesting_facility_name: Optional[str] = None
    blood_group: str
    component_type: str
    quantity_needed: int
    quantity_allocated: int = 0
    quantity_fulfilled: int = 0
    urgency: str
    required_by_time: Optional[datetime] = None
    delivery_destination: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TemperatureLogOut(BaseModel):
    id: int
    transfer_id: int
    temperature_c: float
    sensor_id: str
    is_simulated: bool
    status: str
    notes: Optional[str] = None
    recorded_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- TRANSFERS & SHIPMENTS ---
class TransferOut(BaseModel):
    id: int
    transfer_id: str
    emergency_request_id: Optional[int] = None
    origin_facility_id: int
    origin_name: Optional[str] = None
    destination_facility_id: int
    destination_name: Optional[str] = None
    inventory_item_id: int
    tracking_id: Optional[str] = None
    driver_id: Optional[int] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_vehicle: Optional[str] = None
    driver_status: str = "unassigned"  # unassigned, offered, accepted, declined
    driver_decline_reason: Optional[str] = None

    component_type: str
    blood_group: str
    quantity: int
    travel_time_minutes: float
    distance_km: float
    eta_minutes: Optional[float] = None
    eta_type: str = "calculated"
    status: str
    cancellation_reason: Optional[str] = None
    optimization_run_id: Optional[str] = None
    rationale: Optional[str] = None
    driver_id: Optional[int] = None
    driver_name: Optional[str] = None
    driver_status: Optional[str] = "unassigned"
    temperature_current_c: Optional[float] = 4.0
    temperature_status: Optional[str] = "normal"
    eta_minutes: Optional[float] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    driver_assigned_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# --- ALERTS ---
class AlertOut(BaseModel):
    id: int
    facility_id: int
    facility_name: Optional[str] = None
    inventory_item_id: Optional[int] = None
    transfer_id: Optional[str] = None
    tracking_id: Optional[str] = None
    blood_group: Optional[str] = None
    component_type: Optional[str] = None
    alert_type: str
    severity: str
    message: str
    hours_remaining: Optional[float] = None
    status: str
    email_delivery_status: str
    spoken_announcement: Optional[str] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# --- OPTIMIZATION & SIMULATION ---
class OptimizationRequest(BaseModel):
    scenario_id: Optional[str] = "nashik_live"
    horizon_hours: float = 24.0
    weight_unmet_demand: float = 100.0
    weight_expiry_risk: float = 15.0
    weight_travel_time: float = 0.5
    strict_reserves: bool = True

class ProposedTransferItem(BaseModel):
    origin_id: int
    origin_name: str
    destination_id: int
    destination_name: str
    item_id: int
    tracking_id: str
    blood_group: str
    component_type: str
    quantity: int
    travel_time_minutes: float
    hours_until_expiry: float
    explanation: str

class OptimizationResult(BaseModel):
    run_id: str
    solver_name: str
    solver_status: str
    is_feasible: bool
    runtime_seconds: float
    objective_value: Optional[float] = None
    proposed_transfers: List[ProposedTransferItem] = []
    unmet_demand_count: int
    prevented_waste_units: int
    total_travel_time_minutes: float
    constraint_validation: Dict[str, Any]
    baseline_comparison: Dict[str, Any]
    created_at: datetime

class SimulationEventRequest(BaseModel):
    event_type: str  # trauma_surge, route_disruption, facility_offline, new_supply, temp_deviation
    facility_id: Optional[int] = None
    transfer_id: Optional[str] = None
    blood_group: Optional[str] = None
    component_type: Optional[str] = None
    quantity: Optional[int] = None
    route_origin_id: Optional[int] = None
    route_dest_id: Optional[int] = None
    delay_multiplier: Optional[float] = None
    spike_temp_c: Optional[float] = None
    note: Optional[str] = None

class DashboardSummary(BaseModel):
    total_available_units: int
    total_reserved_units: int
    facilities_at_shortage_risk: int
    units_approaching_expiry: int
    active_proposed_transfers: int
    completed_transfers: int
    active_drivers_count: int
    connected_facilities_count: int
    public_listings_count: int
    pending_emergency_requests_count: int
    latest_optimization_status: str
    active_alerts_count: int
    inventory_by_group: Dict[str, int]
    inventory_by_component: Dict[str, int]
    shortage_facilities: List[Dict[str, Any]]
    approaching_expiry_items: List[Dict[str, Any]]
    recent_transfers: List[Dict[str, Any]]
    recent_alerts: List[Dict[str, Any]]
    latest_run_summary: Optional[Dict[str, Any]] = None

class AuditLogOut(BaseModel):
    id: int
    action: str
    actor: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class RecordMovementRequest(BaseModel):
    event_type: str
    operator: str = "Nashik Blood Officer"
    details: str
    facility_name: str
