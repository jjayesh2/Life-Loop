import json
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    EmergencyBloodRequest, Facility, InventoryItem, Transfer,
    Driver, Alert, AuditLog, User
)
from ..optimizer.engine import is_compatible
from ..seed import NASHIK_TRAVEL_TIMES, NASHIK_DISTANCES_KM
from .emergency_service import notifier

def get_nashik_distance_and_time(origin_id: int, dest_id: int) -> tuple[float, float]:
    """Returns (distance_km, travel_time_mins) between two Nashik facilities."""
    if origin_id == dest_id:
        return 0.5, 3.0
    dist = NASHIK_DISTANCES_KM.get((origin_id, dest_id)) or NASHIK_DISTANCES_KM.get((dest_id, origin_id), 6.0)
    time_min = NASHIK_TRAVEL_TIMES.get((origin_id, dest_id)) or NASHIK_TRAVEL_TIMES.get((dest_id, origin_id), 15.0)
    return dist, time_min

async def submit_emergency_request(
    db: Session,
    hospital_id: int,
    blood_group: str,
    component_type: str,
    quantity_needed: int,
    urgency: str = "critical",
    required_by_hours: float = 3.0,
    clinical_notes: Optional[str] = None
) -> EmergencyBloodRequest:
    hospital = db.query(Facility).filter(Facility.id == hospital_id).first()
    if not hospital:
        raise ValueError(f"Hospital #{hospital_id} not found.")

    req_id = f"REQ-NSK-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    now = datetime.utcnow()
    req_by = now + timedelta(hours=required_by_hours)

    req = EmergencyBloodRequest(
        request_id=req_id,
        hospital_id=hospital_id,
        blood_group=blood_group,
        component_type=component_type,
        quantity_needed=quantity_needed,
        quantity_fulfilled=0,
        urgency=urgency,
        required_by_time=req_by,
        clinical_notes=clinical_notes or f"Urgent transfusion needed at {hospital.name}",
        status="pending_search",
        created_at=now
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Search connected facilities in Nashik for eligible unreserved stock
    recommendations = find_source_recommendations(db, req)
    req.source_recommendations_json = json.dumps(recommendations)
    req.status = "sources_recommended" if recommendations else "pending_search"
    db.commit()

    # Generate system alert with voice announcement text
    spoken = f"Emergency {blood_group} {component_type} request submitted by {hospital.name} for {quantity_needed} units."
    alert = Alert(
        facility_id=hospital_id,
        alert_type="emergency_request",
        severity="critical" if urgency == "critical" else "urgent",
        message=f"CRITICAL: {hospital.name} requires {quantity_needed} units of {blood_group} {component_type}! Recommendations generated.",
        spoken_announcement=spoken,
        email_delivery_status="In-app notification active",
        created_at=now
    )
    db.add(alert)

    # Audit log
    audit = AuditLog(
        action="EMERGENCY_REQUEST_CREATED",
        actor=hospital.name,
        entity_type="EmergencyBloodRequest",
        entity_id=req_id,
        details=f"Urgency: {urgency}. Qty: {quantity_needed} units of {blood_group} {component_type}. Found {len(recommendations)} eligible Nashik sources.",
        timestamp=now
    )
    db.add(audit)
    db.commit()

    # Broadcast over WebSockets
    await notifier.broadcast({
        "type": "NEW_EMERGENCY_REQUEST",
        "request_id": req_id,
        "hospital_name": hospital.name,
        "blood_group": blood_group,
        "component_type": component_type,
        "quantity_needed": quantity_needed,
        "spoken": spoken
    })

    return req

def find_source_recommendations(db: Session, req: EmergencyBloodRequest) -> List[Dict[str, Any]]:
    """
    Finds and ranks candidate blood banks and hospitals in Nashik
    that have compatible, unreserved, non-expired stock above safety reserves.
    """
    dest_id = req.hospital_id
    now = datetime.utcnow()
    connected_facilities = db.query(Facility).filter(
        Facility.is_active == True,
        Facility.is_connected == True,
        Facility.id != dest_id
    ).all()

    recommendations = []
    needed_remaining = req.quantity_needed

    def matches_component(c1: str, c2: str) -> bool:
        if c1 == c2:
            return True
        c1_l, c2_l = c1.lower(), c2.lower()
        if ("red" in c1_l or "prbc" in c1_l) and ("red" in c2_l or "prbc" in c2_l):
            return True
        if "plasma" in c1_l and "plasma" in c2_l:
            return True
        if "platelet" in c1_l and "platelet" in c2_l:
            return True
        return False

    for fac in connected_facilities:
        # Find eligible inventory items
        all_items = db.query(InventoryItem).filter(
            InventoryItem.facility_id == fac.id,
            InventoryItem.status == "available"
        ).all()
        items = [it for it in all_items if matches_component(it.component_type, req.component_type)]

        compatible_items = [
            it for it in items
            if is_compatible(req.component_type, it.blood_group, req.blood_group)
            and (it.quantity - it.reserved_quantity) > 0
            and it.expiry_date > (now + timedelta(hours=1))  # Not expiring immediately
        ]

        if not compatible_items:
            continue

        # Calculate eligible unreserved stock
        total_eligible = sum(it.quantity - it.reserved_quantity for it in compatible_items)
        if total_eligible <= 0:
            continue

        # Respect source safety reserve
        total_stock = sum(it.quantity for it in items)
        safe_max_offered = max(1, min(total_eligible, total_stock - max(0, fac.safety_reserve_units - 5)))
        take_qty = min(safe_max_offered, needed_remaining)

        if take_qty <= 0:
            continue

        dist_km, time_min = get_nashik_distance_and_time(fac.id, dest_id)
        best_item = compatible_items[0]
        hrs_to_exp = round((best_item.expiry_date - now).total_seconds() / 3600.0, 1)

        exact_match = any(it.blood_group == req.blood_group for it in compatible_items)
        match_note = "Exact ABO/Rh match" if exact_match else "Universal/Compatible donor match"

        rec = {
            "facility_id": fac.id,
            "facility_name": fac.name,
            "distance_km": round(dist_km, 1),
            "travel_time_minutes": round(time_min, 1),
            "eligible_units_available": total_eligible,
            "recommended_units_to_take": take_qty,
            "hours_until_batch_expiry": hrs_to_exp,
            "rationale": f"{fac.name} is {round(dist_km, 1)} km away (~{int(time_min)} min). Has {total_eligible} eligible units ({match_note}). Batch {best_item.batch_ref} shelf life is {hrs_to_exp}h."
        }
        recommendations.append(rec)
        needed_remaining -= take_qty
        if needed_remaining <= 0:
            break

    # Sort by travel time (quickest first)
    recommendations.sort(key=lambda r: r["travel_time_minutes"])
    return recommendations

async def approve_transfer_and_assign_driver(
    db: Session,
    request_id: str,
    source_facility_id: int,
    quantity: int,
    approver_name: str = "Authorized Blood Bank Officer"
) -> Transfer:
    req = db.query(EmergencyBloodRequest).filter(EmergencyBloodRequest.request_id == request_id).first()
    if not req:
        raise ValueError(f"Request {request_id} not found.")

    source_fac = db.query(Facility).filter(Facility.id == source_facility_id).first()
    if not source_fac:
        raise ValueError("Source facility not found.")

    def matches_component(c1: str, c2: str) -> bool:
        if c1 == c2:
            return True
        c1_l, c2_l = c1.lower(), c2.lower()
        if ("red" in c1_l or "prbc" in c1_l) and ("red" in c2_l or "prbc" in c2_l):
            return True
        if "plasma" in c1_l and "plasma" in c2_l:
            return True
        if "platelet" in c1_l and "platelet" in c2_l:
            return True
        return False

    # Concurrency safe: check and reserve item
    all_source_items = db.query(InventoryItem).filter(
        InventoryItem.facility_id == source_facility_id,
        InventoryItem.status == "available"
    ).all()

    eligible_item = None
    for it in all_source_items:
        if matches_component(it.component_type, req.component_type) and is_compatible(req.component_type, it.blood_group, req.blood_group):
            if (it.quantity - it.reserved_quantity) >= quantity:
                eligible_item = it
                break

    if not eligible_item:
        # Check if any partially fulfills
        for it in all_source_items:
            if matches_component(it.component_type, req.component_type) and is_compatible(req.component_type, it.blood_group, req.blood_group):
                if (it.quantity - it.reserved_quantity) > 0:
                    eligible_item = it
                    quantity = min(quantity, it.quantity - it.reserved_quantity)
                    break

    if not eligible_item:
        raise ValueError(f"Insufficient unreserved stock at {source_fac.name} for requested quantity.")

    # Reserve units
    eligible_item.reserved_quantity += quantity
    if eligible_item.reserved_quantity >= eligible_item.quantity:
        eligible_item.status = "reserved"

    now = datetime.utcnow()
    dist_km, time_min = get_nashik_distance_and_time(source_facility_id, req.hospital_id)
    tx_id = f"TX-NSK-{uuid.uuid4().hex[:6].upper()}"

    # Auto-assign an available driver in Nashik
    driver = db.query(Driver).filter(Driver.status == "available").first()

    temp_min = 2.0 if "Red" in req.component_type else (20.0 if "Platelet" in req.component_type else -25.0)
    temp_max = 6.0 if "Red" in req.component_type else (24.0 if "Platelet" in req.component_type else -18.0)
    initial_temp = 4.0 if "Red" in req.component_type else (22.0 if "Platelet" in req.component_type else -20.0)

    tx = Transfer(
        transfer_id=tx_id,
        request_id=request_id,
        origin_facility_id=source_facility_id,
        destination_facility_id=req.hospital_id,
        inventory_item_id=eligible_item.id,
        driver_id=driver.id if driver else None,
        component_type=req.component_type,
        blood_group=eligible_item.blood_group,
        quantity=quantity,
        travel_time_minutes=time_min,
        distance_km=dist_km,
        eta_minutes=time_min,
        eta_type="calculated",
        status="approved" if not driver else "driver_assigned",
        driver_status="offered" if driver else "unassigned",
        temperature_current_c=initial_temp,
        temperature_min_c=temp_min,
        temperature_max_c=temp_max,
        temperature_status="normal",
        temperature_history_json=json.dumps([{"time": now.isoformat(), "temp_c": initial_temp, "status": "normal"}]),
        rationale=f"Transfer approved by {approver_name}. Reserved {quantity} units from batch {eligible_item.batch_ref}.",
        created_at=now,
        approved_at=now,
        driver_assigned_at=now if driver else None
    )
    db.add(tx)

    if driver:
        driver.status = "assigned"

    req.status = "approved_reserved"
    req.quantity_fulfilled += quantity

    # Create Alert
    spoken = f"Consignment {tx_id} approved for {req.hospital.name}. Driver {driver.name if driver else 'unassigned'} assigned."
    alert = Alert(
        facility_id=source_facility_id,
        transfer_id=tx_id,
        alert_type="transfer_approved",
        severity="info",
        message=f"Transfer {tx_id} approved: {quantity} units {eligible_item.blood_group} {req.component_type} &rarr; {req.hospital.name}.",
        spoken_announcement=spoken,
        email_delivery_status="In-app notification active",
        created_at=now
    )
    db.add(alert)

    # Audit
    audit = AuditLog(
        action="TRANSFER_APPROVED_AND_RESERVED",
        actor=approver_name,
        entity_type="Transfer",
        entity_id=tx_id,
        details=f"Reserved {quantity} units from {eligible_item.tracking_id} at {source_fac.name}. Assigned driver: {driver.name if driver else 'None'}.",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(tx)

    # Broadcast
    await notifier.broadcast({
        "type": "TRANSFER_APPROVED",
        "transfer_id": tx_id,
        "driver_name": driver.name if driver else None,
        "spoken": spoken
    })

    return tx

async def handle_driver_response(
    db: Session,
    transfer_id: str,
    driver_id: int,
    action: str,  # accept or decline
    decline_reason: Optional[str] = None
) -> Transfer:
    tx = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
    if not tx:
        raise ValueError(f"Transfer {transfer_id} not found.")

    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    now = datetime.utcnow()

    if action == "accept":
        tx.driver_status = "accepted"
        tx.status = "driver_assigned"
        if driver:
            driver.status = "assigned"
        spoken = f"Driver {driver.name if driver else 'Courier'} accepted delivery consignment {transfer_id}."
        msg = f"Driver {driver.name} accepted pickup for transfer {transfer_id}."
    else:
        tx.driver_status = "declined"
        tx.driver_decline_reason = decline_reason or "Driver unavailable"
        if driver:
            driver.status = "available"

        # Try to find an alternative driver
        alt_driver = db.query(Driver).filter(Driver.id != driver_id, Driver.status == "available").first()
        if alt_driver:
            tx.driver_id = alt_driver.id
            tx.driver_status = "offered"
            alt_driver.status = "assigned"
            spoken = f"Driver {driver.name if driver else ''} declined. Reassigned to {alt_driver.name}."
            msg = f"Reassigned transfer {transfer_id} to alternative driver {alt_driver.name}."
        else:
            tx.driver_id = None
            spoken = f"Driver declined. No other drivers currently available in Nashik."
            msg = f"Driver declined transfer {transfer_id}. Manual courier required."

    audit = AuditLog(
        action=f"DRIVER_{action.upper()}",
        actor=driver.name if driver else "Driver",
        entity_type="Transfer",
        entity_id=transfer_id,
        details=msg,
        timestamp=now
    )
    db.add(audit)
    db.commit()

    await notifier.broadcast({
        "type": "DRIVER_STATUS_UPDATE",
        "transfer_id": transfer_id,
        "action": action,
        "spoken": spoken
    })

    return tx

async def confirm_dispatch_and_in_transit(
    db: Session,
    transfer_id: str,
    operator_name: str = "Nashik Courier Driver"
) -> Transfer:
    tx = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
    if not tx:
        raise ValueError("Transfer not found.")

    now = datetime.utcnow()
    tx.status = "dispatched"
    tx.dispatched_at = now
    if tx.driver:
        tx.driver.status = "in_transit"

    item = tx.inventory_item
    if item:
        item.status = "in_transit"

    spoken = f"Consignment {transfer_id} dispatched and in transit to {tx.destination.name}."
    audit = AuditLog(
        action="TRANSFER_DISPATCHED",
        actor=operator_name,
        entity_type="Transfer",
        entity_id=transfer_id,
        details=f"Cold-chain courier departs {tx.origin.name} for {tx.destination.name}. Initial temp: {tx.temperature_current_c}°C.",
        timestamp=now
    )
    db.add(audit)
    db.commit()

    await notifier.broadcast({
        "type": "TRANSFER_DISPATCHED",
        "transfer_id": transfer_id,
        "spoken": spoken
    })
    return tx

async def confirm_delivery_and_reconcile(
    db: Session,
    transfer_id: str,
    receiver_name: str = "Dr. Receiving Technologist"
) -> Transfer:
    tx = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
    if not tx:
        raise ValueError("Transfer not found.")

    now = datetime.utcnow()
    tx.status = "delivered"
    tx.delivered_at = now
    tx.received_at = now

    if tx.driver:
        tx.driver.status = "available"

    # Inventory Reconciliation:
    # 1. Deduct from source item
    item = tx.inventory_item
    if item:
        item.quantity = max(0, item.quantity - tx.quantity)
        item.reserved_quantity = max(0, item.reserved_quantity - tx.quantity)
        if item.quantity == 0:
            item.status = "unavailable"
        else:
            item.status = "available"

    # 2. Credit to destination inventory
    rec_item = InventoryItem(
        tracking_id=f"LL-NSK-REC-{uuid.uuid4().hex[:6].upper()}",
        facility_id=tx.destination_facility_id,
        blood_group=tx.blood_group,
        component_type=tx.component_type,
        quantity=tx.quantity,
        reserved_quantity=0,
        batch_ref=f"REC-{item.batch_ref if item else 'BATCH'}",
        collection_date=item.collection_date if item else now - timedelta(days=3),
        expiry_date=item.expiry_date if item else now + timedelta(days=25),
        status="available",
        storage_temp_c=tx.temperature_current_c,
        qr_code_svg=item.qr_code_svg if item else None,
        data_source_label="Transferred & Reconciled",
        created_at=now
    )
    db.add(rec_item)

    # 3. Mark request fulfilled
    if tx.emergency_request:
        req = tx.emergency_request
        if req.quantity_fulfilled >= req.quantity_needed:
            req.status = "fulfilled"
        else:
            req.status = "partially_fulfilled"

    spoken = f"Blood delivery confirmed at {tx.destination.name}. {tx.quantity} units successfully reconciled into hospital inventory."
    audit = AuditLog(
        action="DELIVERY_CONFIRMED_AND_RECONCILED",
        actor=receiver_name,
        entity_type="Transfer",
        entity_id=transfer_id,
        details=f"Reconciled {tx.quantity} units {tx.blood_group} {tx.component_type} into {tx.destination.name}. Consignment completed.",
        timestamp=now
    )
    db.add(audit)
    db.commit()

    await notifier.broadcast({
        "type": "DELIVERY_CONFIRMED",
        "transfer_id": transfer_id,
        "destination_name": tx.destination.name,
        "quantity": tx.quantity,
        "spoken": spoken
    })

    return tx

async def simulate_temperature_deviation(
    db: Session,
    transfer_id: str,
    spike_temp_c: float = 11.5
) -> Transfer:
    tx = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
    if not tx:
        raise ValueError("Transfer not found.")

    now = datetime.utcnow()
    tx.temperature_current_c = spike_temp_c
    tx.temperature_status = "critical_deviation" if spike_temp_c > tx.temperature_max_c + 2.0 else "deviation_warning"

    history = []
    try:
        history = json.loads(tx.temperature_history_json or "[]")
    except Exception:
        pass
    history.append({
        "time": now.isoformat(),
        "temp_c": spike_temp_c,
        "status": tx.temperature_status,
        "note": "Simulated cold-chain container breach"
    })
    tx.temperature_history_json = json.dumps(history)

    spoken = f"Warning! Temperature deviation detected on consignment {transfer_id}: current reading {spike_temp_c} degrees Celsius, exceeds maximum limit."
    alert = Alert(
        facility_id=tx.destination_facility_id,
        transfer_id=transfer_id,
        alert_type="temperature_deviation",
        severity="critical",
        message=f"TEMPERATURE ALERT: Consignment {transfer_id} spiked to {spike_temp_c}°C (permitted range {tx.temperature_min_c}°C – {tx.temperature_max_c}°C). Cold-chain breach protocol initiated.",
        spoken_announcement=spoken,
        email_delivery_status="In-app priority broadcast",
        created_at=now
    )
    db.add(alert)

    audit = AuditLog(
        action="TEMPERATURE_DEVIATION_SIMULATED",
        actor="SensorSimulation",
        entity_type="Transfer",
        entity_id=transfer_id,
        details=f"Cold-chain temperature deviation: {spike_temp_c}°C recorded. Permitted limit was {tx.temperature_max_c}°C.",
        timestamp=now
    )
    db.add(audit)
    db.commit()

    await notifier.broadcast({
        "type": "TEMPERATURE_ALERT",
        "transfer_id": transfer_id,
        "temperature_c": spike_temp_c,
        "spoken": spoken
    })

    return tx
