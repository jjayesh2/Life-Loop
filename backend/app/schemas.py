from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class FacilityBase(BaseModel):
    code: str
    name: str
    facility_type: str
    latitude: float
    longitude: float
    address: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    safety_reserve_units: int = 15
    is_active: bool = True

class FacilityOut(FacilityBase):
    id: int
    total_inventory: Optional[int] = 0
    shortage_count: Optional[int] = 0
    class Config:
        from_attributes = True

class InventoryItemBase(BaseModel):
    tracking_id: str
    facility_id: int
    blood_group: str
    component_type: str
    quantity: int = 1
    batch_ref: str
    collection_date: datetime
    expiry_date: datetime
    status: str = "available"
    storage_temp_c: float = 4.0

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
    class Config:
        from_attributes = True

class InventoryItemOut(InventoryItemBase):
    id: int
    facility_name: Optional[str] = None
    qr_code_svg: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    traceability_events: List[TraceabilityEventOut] = []
    class Config:
        from_attributes = True

class DemandRecordBase(BaseModel):
    facility_id: int
    blood_group: str
    component_type: str
    quantity_needed: int
    urgency: str = "urgent"
    deadline_hours: float = 6.0
    status: str = "unmet"
    is_simulated: bool = False

class DemandRecordOut(DemandRecordBase):
    id: int
    facility_name: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class TransferOut(BaseModel):
    id: int
    transfer_id: str
    origin_facility_id: int
    origin_name: Optional[str] = None
    destination_facility_id: int
    destination_name: Optional[str] = None
    inventory_item_id: int
    tracking_id: Optional[str] = None
    component_type: str
    blood_group: str
    quantity: int
    travel_time_minutes: float
    distance_km: float
    status: str
    cancellation_reason: Optional[str] = None
    optimization_run_id: Optional[str] = None
    rationale: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class AlertOut(BaseModel):
    id: int
    facility_id: int
    facility_name: Optional[str] = None
    inventory_item_id: Optional[int] = None
    tracking_id: Optional[str] = None
    blood_group: Optional[str] = None
    component_type: Optional[str] = None
    alert_type: str
    severity: str
    message: str
    hours_remaining: Optional[float] = None
    status: str
    email_delivery_status: str
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class OptimizationRequest(BaseModel):
    scenario_id: Optional[str] = "default"
    horizon_hours: float = 24.0
    weight_unmet_demand: float = 100.0
    weight_expiry_risk: float = 10.0
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
    event_type: str  # trauma_surge, route_disruption, facility_offline, new_supply, inventory_loss
    facility_id: Optional[int] = None
    blood_group: Optional[str] = None
    component_type: Optional[str] = None
    quantity: Optional[int] = None
    route_origin_id: Optional[int] = None
    route_dest_id: Optional[int] = None
    delay_multiplier: Optional[float] = None
    note: Optional[str] = None

class DashboardSummary(BaseModel):
    total_available_units: int
    total_reserved_units: int
    facilities_at_shortage_risk: int
    units_approaching_expiry: int
    active_proposed_transfers: int
    completed_transfers: int
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
    class Config:
        from_attributes = True

class RecordMovementRequest(BaseModel):
    event_type: str
    operator: str = "Life-Loop Operator"
    details: str
    facility_name: str
