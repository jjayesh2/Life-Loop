import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Set
from fastapi import WebSocket
from sqlalchemy.orm import Session
from ..models import DemandRecord, InventoryItem, Facility, Scenario, AuditLog
from ..optimizer.engine import MILPOptimizer

class WebSocketNotifier:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        dead = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for d in dead:
            self.active_connections.discard(d)

notifier = WebSocketNotifier()

TRAVEL_TIME_DISRUPTIONS: Dict[tuple, float] = {}

def get_travel_time(origin_id: int, dest_id: int, default_mins: float = 35.0) -> float:
    key = (origin_id, dest_id)
    if key in TRAVEL_TIME_DISRUPTIONS:
        return TRAVEL_TIME_DISRUPTIONS[key]
    return default_mins

async def apply_emergency_event(
    db: Session,
    event_type: str,
    payload: Dict[str, Any],
    travel_matrix: Dict[tuple, float]
) -> Dict[str, Any]:
    """
    Applies a simulated emergency event, updates the database state,
    triggers re-optimization, and broadcasts live updates over WebSockets.
    """
    now = datetime.utcnow()
    event_record = {
        "event_type": event_type,
        "timestamp": now.isoformat(),
        "is_simulated": True,
        "details": ""
    }

    if event_type == "trauma_surge":
        fac_id = payload.get("facility_id", 1)
        blood_group = payload.get("blood_group", "O-")
        comp = payload.get("component_type", "Red Blood Cells")
        qty = payload.get("quantity", 8)
        
        fac = db.query(Facility).filter(Facility.id == fac_id).first()
        fac_name = fac.name if fac else f"Facility {fac_id}"
        
        # Add urgent demand
        new_demand = DemandRecord(
            facility_id=fac_id,
            blood_group=blood_group,
            component_type=comp,
            quantity_needed=qty,
            urgency="critical",
            deadline_hours=2.5,
            status="unmet",
            is_simulated=True,
            created_at=now
        )
        db.add(new_demand)
        event_record["details"] = f"[SIMULATED] Mass casualty trauma surge at {fac_name}: +{qty} units of {blood_group} {comp} needed immediately!"

    elif event_type == "route_disruption":
        orig_id = payload.get("route_origin_id", 1)
        dest_id = payload.get("route_dest_id", 2)
        multiplier = payload.get("delay_multiplier", 3.0)
        
        base_time = travel_matrix.get((orig_id, dest_id), 30.0)
        disrupted_time = base_time * multiplier
        TRAVEL_TIME_DISRUPTIONS[(orig_id, dest_id)] = disrupted_time
        travel_matrix[(orig_id, dest_id)] = disrupted_time
        
        orig_fac = db.query(Facility).filter(Facility.id == orig_id).first()
        dest_fac = db.query(Facility).filter(Facility.id == dest_id).first()
        event_record["details"] = f"[SIMULATED] Highway severe closure between {orig_fac.name if orig_fac else orig_id} and {dest_fac.name if dest_fac else dest_id}: Travel time increased from {int(base_time)}m to {int(disrupted_time)}m."

    elif event_type == "facility_offline":
        fac_id = payload.get("facility_id", 2)
        fac = db.query(Facility).filter(Facility.id == fac_id).first()
        if fac:
            fac.is_active = False
            event_record["details"] = f"[SIMULATED] Power grid disruption: {fac.name} temporarily unable to dispatch shipments."

    elif event_type == "new_supply":
        fac_id = payload.get("facility_id", 4)
        fac = db.query(Facility).filter(Facility.id == fac_id).first()
        qty = payload.get("quantity", 10)
        # Create new blood batch
        import uuid
        batch_id = f"DRIVE-{uuid.uuid4().hex[:6].upper()}"
        from datetime import timedelta
        new_item = InventoryItem(
            tracking_id=f"LL-SUPPLY-{uuid.uuid4().hex[:6].upper()}",
            facility_id=fac_id,
            blood_group=payload.get("blood_group", "O+"),
            component_type=payload.get("component_type", "Red Blood Cells"),
            quantity=qty,
            batch_ref=batch_id,
            collection_date=now,
            expiry_date=now + timedelta(days=35),
            status="available",
            storage_temp_c=4.0
        )
        db.add(new_item)
        event_record["details"] = f"[SIMULATED] Mobile donation drive delivered +{qty} units of O+ RBC to {fac.name if fac else fac_id}."

    elif event_type == "inventory_loss":
        fac_id = payload.get("facility_id", 1)
        item = db.query(InventoryItem).filter(InventoryItem.facility_id == fac_id, InventoryItem.status == "available").first()
        if item:
            lost_qty = min(item.quantity, payload.get("quantity", 3))
            item.quantity -= lost_qty
            if item.quantity <= 0:
                item.status = "unavailable"
            event_record["details"] = f"[SIMULATED] Storage cooler temperature alarm at facility #{fac_id}: {lost_qty} units quarantined."
        else:
            event_record["details"] = f"[SIMULATED] Storage alarm triggered, no available units affected."

    # Record in AuditLog
    audit = AuditLog(
        action=f"SIMULATION_EVENT_{event_type.upper()}",
        actor="EmergencySimulator",
        entity_type="Scenario",
        entity_id=event_type,
        details=event_record["details"],
        timestamp=now
    )
    db.add(audit)
    db.commit()

    # Re-run MILP optimizer dynamically on new state
    facilities = [
        {
            "id": f.id,
            "name": f.name,
            "safety_reserve_units": f.safety_reserve_units if f.is_active else 99999
        }
        for f in db.query(Facility).all()
    ]
    inventory = [
        {
            "id": it.id,
            "tracking_id": it.tracking_id,
            "facility_id": it.facility_id,
            "blood_group": it.blood_group,
            "component_type": it.component_type,
            "quantity": it.quantity,
            "status": it.status,
            "expiry_date": it.expiry_date
        }
        for it in db.query(InventoryItem).filter(InventoryItem.status == "available").all()
    ]
    demands = [
        {
            "id": dm.id,
            "facility_id": dm.facility_id,
            "blood_group": dm.blood_group,
            "component_type": dm.component_type,
            "quantity_needed": dm.quantity_needed,
            "urgency": dm.urgency,
            "deadline_hours": dm.deadline_hours,
            "status": dm.status
        }
        for dm in db.query(DemandRecord).filter(DemandRecord.status.in_(["unmet", "partially_fulfilled"])).all()
    ]

    optimizer = MILPOptimizer(
        facilities=facilities,
        inventory=inventory,
        demands=demands,
        travel_time_matrix=travel_matrix,
        now=now
    )
    optimization_result = optimizer.solve()

    # Broadcast via WebSocket
    broadcast_data = {
        "type": "EMERGENCY_EVENT_PROCESSED",
        "event": event_record,
        "optimization": optimization_result
    }
    await notifier.broadcast(broadcast_data)

    return {
        "status": "success",
        "event": event_record,
        "reoptimization_result": optimization_result
    }
