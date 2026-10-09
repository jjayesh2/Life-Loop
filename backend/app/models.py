import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(150), nullable=False)
    role = Column(String(50), nullable=False)  # network_admin, hospital_staff, blood_bank_staff, driver
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=True)
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    facility = relationship("Facility", foreign_keys=[facility_id])
    driver_profile = relationship("Driver", back_populates="user", uselist=False)


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True)
    name = Column(String(150), nullable=False)
    facility_type = Column(String(50), nullable=False)  # Hospital, Blood Bank, Trauma Center, Clinic
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(255), nullable=False)
    city = Column(String(100), default="Nashik")
    district = Column(String(100), default="Nashik")
    state = Column(String(100), default="Maharashtra")
    pincode = Column(String(20), default="422001")
    contact_phone = Column(String(50), nullable=True)
    contact_email = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    is_connected = Column(Boolean, default=True)  # True = connected to Life-Loop; False = public directory listing
    verification_status = Column(String(50), default="Connected Demo Facility")  # Connected Demo Facility, Public listing, Live verified
    source_url = Column(String(255), default="https://nashik.gov.in/en/public-utilities/hospitals/")
    date_verified = Column(String(50), default="2026-03-15")
    safety_reserve_units = Column(Integer, default=10)

    inventory_items = relationship("InventoryItem", back_populates="facility")
    demands = relationship("DemandRecord", back_populates="facility")
    emergency_requests = relationship("EmergencyBloodRequest", back_populates="hospital")
    alerts = relationship("Alert", back_populates="facility")


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    name = Column(String(150), nullable=False)
    phone = Column(String(50), nullable=False)
    vehicle_type = Column(String(50), default="Cold-Chain Refrigerated Van")  # Cold-Chain Refrigerated Van, Dedicated Medical Bike, Ambulance
    vehicle_number = Column(String(50), default="MH-15-EG-4402")
    current_lat = Column(Float, default=19.9975)
    current_lng = Column(Float, default=73.7898)
    status = Column(String(50), default="available")  # available, assigned, in_transit, off_duty
    last_location_update = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="driver_profile")
    transfers = relationship("Transfer", back_populates="driver")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    tracking_id = Column(String(64), unique=True, index=True, nullable=False)
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    blood_group = Column(String(10), nullable=False)  # A+, A-, B+, B-, AB+, AB-, O+, O-
    component_type = Column(String(50), nullable=False)  # Red Blood Cells, Platelets, Fresh Frozen Plasma, Cryoprecipitate, Whole Blood
    quantity = Column(Integer, nullable=False, default=1)
    reserved_quantity = Column(Integer, nullable=False, default=0)
    batch_ref = Column(String(64), nullable=False, index=True)
    collection_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=False, index=True)
    status = Column(String(30), default="available")  # available, reserved, in_transit, quarantined, expired, unavailable
    storage_temp_c = Column(Float, default=4.0)
    qr_code_svg = Column(Text, nullable=True)
    data_source_label = Column(String(50), default="Demo stock — simulated")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    facility = relationship("Facility", back_populates="inventory_items")
    traceability_events = relationship("TraceabilityEvent", back_populates="inventory_item", cascade="all, delete-orphan")


class EmergencyBloodRequest(Base):
    __tablename__ = "emergency_blood_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(64), unique=True, index=True, nullable=False)
    hospital_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    blood_group = Column(String(10), nullable=False)
    component_type = Column(String(50), nullable=False)
    quantity_needed = Column(Integer, nullable=False)
    quantity_fulfilled = Column(Integer, default=0)
    urgency = Column(String(30), default="critical")  # critical, urgent, routine
    required_by_time = Column(DateTime, nullable=False)
    clinical_notes = Column(Text, nullable=True)
    status = Column(String(50), default="pending_search")
    # Statuses: pending_search, sources_recommended, approved_reserved, driver_assigned, dispatched, delivered, cancelled, partially_fulfilled
    source_recommendations_json = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    hospital = relationship("Facility", back_populates="emergency_requests")
    transfers = relationship("Transfer", back_populates="emergency_request")


class DemandRecord(Base):
    __tablename__ = "demand_records"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    blood_group = Column(String(10), nullable=False)
    component_type = Column(String(50), nullable=False)
    quantity_needed = Column(Integer, nullable=False)
    urgency = Column(String(20), default="urgent")  # critical, urgent, routine
    deadline_hours = Column(Float, default=6.0)
    status = Column(String(30), default="unmet")  # unmet, fulfilled, partially_fulfilled
    is_simulated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    facility = relationship("Facility", back_populates="demands")


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(String(64), unique=True, index=True, nullable=False)
    request_id = Column(String(64), ForeignKey("emergency_blood_requests.request_id"), nullable=True)
    origin_facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    destination_facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)

    component_type = Column(String(50), nullable=False)
    blood_group = Column(String(10), nullable=False)
    quantity = Column(Integer, nullable=False)
    travel_time_minutes = Column(Float, nullable=False)
    distance_km = Column(Float, default=5.0)
    eta_minutes = Column(Float, nullable=True)
    eta_type = Column(String(30), default="calculated")  # calculated, traffic_aware, simulated

    # Workflow status:
    # proposed -> awaiting_approval -> approved -> driver_assigned -> dispatched -> delivered -> reconciled (or cancelled/rejected)
    status = Column(String(30), default="proposed")
    cancellation_reason = Column(String(255), nullable=True)
    driver_status = Column(String(30), default="unassigned")  # unassigned, offered, accepted, declined
    driver_decline_reason = Column(String(255), nullable=True)

    # Temperature tracking (Validated component ranges)
    temperature_current_c = Column(Float, default=4.0)
    temperature_min_c = Column(Float, default=2.0)
    temperature_max_c = Column(Float, default=6.0)
    temperature_status = Column(String(30), default="normal")  # normal, deviation_warning, critical_deviation
    temperature_history_json = Column(Text, default="[]")

    optimization_run_id = Column(String(64), nullable=True, index=True)
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    driver_assigned_at = Column(DateTime, nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)

    origin = relationship("Facility", foreign_keys=[origin_facility_id])
    destination = relationship("Facility", foreign_keys=[destination_facility_id])
    inventory_item = relationship("InventoryItem")
    driver = relationship("Driver", back_populates="transfers")
    emergency_request = relationship("EmergencyBloodRequest", back_populates="transfers")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=True)
    transfer_id = Column(String(64), nullable=True)
    alert_type = Column(String(50), nullable=False)  # emergency_request, approaching_expiry, urgent_expiry, expired, shortage_risk, temperature_deviation, shipment_delay
    severity = Column(String(20), nullable=False)  # critical, urgent, warning, info
    message = Column(String(255), nullable=False)
    hours_remaining = Column(Float, nullable=True)
    status = Column(String(20), default="active")  # active, acknowledged, resolved
    email_delivery_status = Column(String(50), default="In-app notification active")
    spoken_announcement = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    acknowledged_at = Column(DateTime, nullable=True)

    facility = relationship("Facility", back_populates="alerts")
    inventory_item = relationship("InventoryItem")


class TraceabilityEvent(Base):
    __tablename__ = "traceability_events"

    id = Column(Integer, primary_key=True, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    facility_name = Column(String(150), nullable=False)
    operator = Column(String(100), default="Nashik Blood Bank Officer")
    details = Column(String(255), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    inventory_item = relationship("InventoryItem", back_populates="traceability_events")


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(30), default="idle")
    events_json = Column(Text, default="[]")
    baseline_metrics_json = Column(Text, default="{}")
    optimized_metrics_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    actor = Column(String(100), default="Operator")
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(64), nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(50), primary_key=True)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
