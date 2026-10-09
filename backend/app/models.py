import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class Facility(Base):
    __tablename__ = "facilities"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True)
    name = Column(String(150), nullable=False)
    facility_type = Column(String(50), nullable=False)  # Trauma Center, Blood Bank, General Hospital, Clinic
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(255), nullable=False)
    contact_phone = Column(String(50), nullable=True)
    contact_email = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    safety_reserve_units = Column(Integer, default=15)  # min reserve units across components

    inventory_items = relationship("InventoryItem", back_populates="facility")
    demands = relationship("DemandRecord", back_populates="facility")
    alerts = relationship("Alert", back_populates="facility")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    tracking_id = Column(String(64), unique=True, index=True, nullable=False)
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    blood_group = Column(String(10), nullable=False)  # A+, A-, B+, B-, AB+, AB-, O+, O-
    component_type = Column(String(50), nullable=False)  # Red Blood Cells, Platelets, Fresh Frozen Plasma, Cryoprecipitate, Whole Blood
    quantity = Column(Integer, nullable=False, default=1)
    batch_ref = Column(String(64), nullable=False, index=True)
    collection_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=False, index=True)
    status = Column(String(30), default="available")  # available, reserved, in_transit, quarantined, expired, unavailable
    storage_temp_c = Column(Float, default=4.0)
    qr_code_svg = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    facility = relationship("Facility", back_populates="inventory_items")
    traceability_events = relationship("TraceabilityEvent", back_populates="inventory_item", cascade="all, delete-orphan")


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
    origin_facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    destination_facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    component_type = Column(String(50), nullable=False)
    blood_group = Column(String(10), nullable=False)
    quantity = Column(Integer, nullable=False)
    travel_time_minutes = Column(Float, nullable=False)
    distance_km = Column(Float, default=15.0)
    status = Column(String(30), default="proposed")  # proposed, approved, dispatched, received, cancelled, rejected
    cancellation_reason = Column(String(255), nullable=True)
    optimization_run_id = Column(String(64), nullable=True, index=True)
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)

    origin = relationship("Facility", foreign_keys=[origin_facility_id])
    destination = relationship("Facility", foreign_keys=[destination_facility_id])
    inventory_item = relationship("InventoryItem")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=True)
    alert_type = Column(String(50), nullable=False)  # approaching_expiry, urgent_expiry, expired, shortage_risk
    severity = Column(String(20), nullable=False)  # warning, critical, urgent, info
    message = Column(String(255), nullable=False)
    hours_remaining = Column(Float, nullable=True)
    status = Column(String(20), default="active")  # active, acknowledged, resolved
    email_delivery_status = Column(String(50), default="Not configured (No SMTP)")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    acknowledged_at = Column(DateTime, nullable=True)

    facility = relationship("Facility", back_populates="alerts")
    inventory_item = relationship("InventoryItem")


class TraceabilityEvent(Base):
    __tablename__ = "traceability_events"

    id = Column(Integer, primary_key=True, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # collection, storage_checked, transfer_proposed, dispatched, received, quarantined, status_change
    facility_name = Column(String(150), nullable=False)
    operator = Column(String(100), default="Life-Loop Authorized Operator")
    details = Column(String(255), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    inventory_item = relationship("InventoryItem", back_populates="traceability_events")


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(30), default="idle")  # idle, active, completed
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
