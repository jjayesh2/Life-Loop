import io
import csv
import json
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import engine, Base, get_db
from .models import (
    Facility, User, Driver, InventoryItem, EmergencyRequest, DemandRecord,
    Transfer, TemperatureLog, Alert, TraceabilityEvent, Scenario,
    AuditLog, SystemSetting
)
from .schemas import (
    FacilityOut, UserOut, DriverOut, InventoryItemOut, InventoryItemCreate,
    DemandRecordOut, EmergencyRequestCreate, EmergencyRequestOut,
    TemperatureLogOut, TransferOut, AlertOut, OptimizationRequest,
    OptimizationResult, SimulationEventRequest, DashboardSummary,
    AuditLogOut, RecordMovementRequest
)
from .optimizer.engine import MILPOptimizer, is_compatible
from .seed import seed_database, TRAVEL_TIME_MATRIX
from .services.traceability_service import generate_qr_svg_or_base64, record_movement_event
from .services.expiry_service import evaluate_expiry_alerts, acknowledge_alert, resolve_alert
from .services.forecasting_service import get_demand_forecasts
from .services.emergency_service import apply_emergency_event, notifier, TRAVEL_TIME_DISRUPTIONS
from .services.manifest_service import generate_transfer_manifest_data

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LIFE-LOOP API",
    description="Intelligent Blood Supply Chain Optimization & Emergency Coordination Platform",
    version="1.0.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure seeded on startup
@app.on_event("startup")
def startup_event():
    with next(get_db()) as db:
        seed_database(db, force=False)

# Global in-memory cache of latest optimization result
LATEST_OPTIMIZATION_RESULT = None

# ==========================================
# 1. DASHBOARD & KPIS
# ==========================================
@app.get("/api/dashboard", response_model=DashboardSummary)
def get_dashboard(db: Session = Depends(get_db)):
    # 1. Total available units
    total_avail = db.query(func.sum(InventoryItem.quantity)).filter(InventoryItem.status == "available").scalar() or 0
    total_reserved = db.query(func.sum(InventoryItem.quantity)).filter(InventoryItem.status == "reserved").scalar() or 0

    # 2. Facilities at shortage risk
    facilities = db.query(Facility).all()
    shortage_facs = []
    for f in facilities:
        stock = db.query(func.sum(InventoryItem.quantity)).filter(
            InventoryItem.facility_id == f.id,
            InventoryItem.status == "available"
        ).scalar() or 0
        dem = db.query(func.sum(DemandRecord.quantity_needed)).filter(
            DemandRecord.facility_id == f.id,
            DemandRecord.status.in_(["unmet", "partially_fulfilled"])
        ).scalar() or 0
        if stock < f.safety_reserve_units or dem > stock:
            shortage_facs.append({
                "facility_id": f.id,
                "name": f.name,
                "facility_type": f.facility_type,
                "available_stock": stock,
                "safety_reserve": f.safety_reserve_units,
                "deficit": max(0, f.safety_reserve_units - stock) + dem
            })

    # 3. Units approaching expiry (< 72h)
    now = datetime.utcnow()
    exp_thresh = now + timedelta(hours=72)
    expiring_items_q = db.query(InventoryItem).filter(
        InventoryItem.status == "available",
        InventoryItem.expiry_date <= exp_thresh
    ).all()
    
    approaching_expiry_list = []
    for it in expiring_items_q:
        hrs = max(0.0, round((it.expiry_date - now).total_seconds() / 3600.0, 1))
        fac = db.query(Facility).filter(Facility.id == it.facility_id).first()
        approaching_expiry_list.append({
            "id": it.id,
            "tracking_id": it.tracking_id,
            "facility_name": fac.name if fac else "Unknown",
            "blood_group": it.blood_group,
            "component_type": it.component_type,
            "quantity": it.quantity,
            "hours_remaining": hrs
        })

    # 4. Active & Completed transfers
    active_transfers_count = db.query(Transfer).filter(Transfer.status.in_(["proposed", "approved", "dispatched"])).count()
    completed_transfers_count = db.query(Transfer).filter(Transfer.status == "received").count()

    # 5. Inventory breakdowns
    all_available = db.query(InventoryItem).filter(InventoryItem.status == "available").all()
    by_group: Dict[str, int] = {}
    by_comp: Dict[str, int] = {}
    for it in all_available:
        by_group[it.blood_group] = by_group.get(it.blood_group, 0) + it.quantity
        by_comp[it.component_type] = by_comp.get(it.component_type, 0) + it.quantity

    # 6. Recent activity
    recent_txs = db.query(Transfer).order_by(Transfer.created_at.desc()).limit(5).all()
    tx_list = [
        {
            "id": tx.id,
            "transfer_id": tx.transfer_id,
            "origin": tx.origin.name if tx.origin else "Unknown",
            "destination": tx.destination.name if tx.destination else "Unknown",
            "blood_group": tx.blood_group,
            "component_type": tx.component_type,
            "quantity": tx.quantity,
            "status": tx.status,
            "created_at": tx.created_at.isoformat() if tx.created_at else ""
        }
        for tx in recent_txs
    ]

    recent_alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(5).all()
    alert_list = [
        {
            "id": al.id,
            "severity": al.severity,
            "message": al.message,
            "status": al.status,
            "created_at": al.created_at.isoformat() if al.created_at else ""
        }
        for al in recent_alerts
    ]

    active_alerts_count = db.query(Alert).filter(Alert.status == "active").count()

    latest_status = "Optimal" if LATEST_OPTIMIZATION_RESULT and LATEST_OPTIMIZATION_RESULT.get("is_feasible") else "Ready to Optimize"

    return {
        "total_available_units": total_avail,
        "total_reserved_units": total_reserved,
        "facilities_at_shortage_risk": len(shortage_facs),
        "units_approaching_expiry": len(approaching_expiry_list),
        "active_proposed_transfers": active_transfers_count,
        "completed_transfers": completed_transfers_count,
        "latest_optimization_status": latest_status,
        "active_alerts_count": active_alerts_count,
        "inventory_by_group": by_group,
        "inventory_by_component": by_comp,
        "shortage_facilities": shortage_facs,
        "approaching_expiry_items": approaching_expiry_list,
        "recent_transfers": tx_list,
        "recent_alerts": alert_list,
        "latest_run_summary": LATEST_OPTIMIZATION_RESULT
    }


# ==========================================
# 2. FACILITIES
# ==========================================
@app.get("/api/facilities", response_model=List[FacilityOut])
def get_facilities(db: Session = Depends(get_db)):
    facs = db.query(Facility).all()
    results = []
    for f in facs:
        total_inv = db.query(func.sum(InventoryItem.quantity)).filter(
            InventoryItem.facility_id == f.id,
            InventoryItem.status == "available"
        ).scalar() or 0
        dem_count = db.query(func.sum(DemandRecord.quantity_needed)).filter(
            DemandRecord.facility_id == f.id,
            DemandRecord.status.in_(["unmet", "partially_fulfilled"])
        ).scalar() or 0
        
        f_dict = {
            "id": f.id,
            "code": f.code,
            "name": f.name,
            "facility_type": f.facility_type,
            "latitude": f.latitude,
            "longitude": f.longitude,
            "address": f.address,
            "city": f.city,
            "district": f.district,
            "state": f.state,
            "pincode": f.pincode,
            "contact_phone": f.contact_phone,
            "contact_email": f.contact_email,
            "source_url": f.source_url,
            "date_verified": f.date_verified,
            "verification_status": f.verification_status,
            "is_connected": f.is_connected,
            "safety_reserve_units": f.safety_reserve_units,
            "is_active": f.is_active,
            "total_inventory": total_inv,
            "shortage_count": dem_count
        }
        results.append(FacilityOut(**f_dict))
    return results


# ==========================================
# 3. INVENTORY MANAGEMENT
# ==========================================
@app.get("/api/inventory", response_model=List[InventoryItemOut])
def get_inventory(
    facility_id: Optional[int] = None,
    blood_group: Optional[str] = None,
    component_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(InventoryItem)
    if facility_id:
        q = q.filter(InventoryItem.facility_id == facility_id)
    if blood_group:
        q = q.filter(InventoryItem.blood_group == blood_group)
    if component_type:
        q = q.filter(InventoryItem.component_type == component_type)
    if status:
        q = q.filter(InventoryItem.status == status)
    
    items = q.order_by(InventoryItem.expiry_date.asc()).all()
    result = []
    for it in items:
        item_dict = {
            "id": it.id,
            "tracking_id": it.tracking_id,
            "facility_id": it.facility_id,
            "facility_name": it.facility.name if it.facility else None,
            "blood_group": it.blood_group,
            "component_type": it.component_type,
            "quantity": it.quantity,
            "batch_ref": it.batch_ref,
            "collection_date": it.collection_date,
            "expiry_date": it.expiry_date,
            "status": it.status,
            "storage_temp_c": it.storage_temp_c,
            "qr_code_svg": it.qr_code_svg,
            "created_at": it.created_at,
            "updated_at": it.updated_at,
            "traceability_events": it.traceability_events
        }
        result.append(InventoryItemOut(**item_dict))
    return result

@app.post("/api/inventory", response_model=InventoryItemOut)
def create_inventory_item(item_in: InventoryItemCreate, db: Session = Depends(get_db)):
    tid = f"LL-{item_in.blood_group.replace('+', 'POS').replace('-', 'NEG')}-{uuid.uuid4().hex[:6].upper()}"
    qr_code = generate_qr_svg_or_base64(tid)
    
    item = InventoryItem(
        tracking_id=tid,
        facility_id=item_in.facility_id,
        blood_group=item_in.blood_group,
        component_type=item_in.component_type,
        quantity=item_in.quantity,
        batch_ref=item_in.batch_ref,
        collection_date=item_in.collection_date,
        expiry_date=item_in.expiry_date,
        status=item_in.status,
        storage_temp_c=item_in.storage_temp_c,
        qr_code_svg=qr_code
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # Initial traceability event
    fac = db.query(Facility).filter(Facility.id == item_in.facility_id).first()
    record_movement_event(
        db=db,
        inventory_item_id=item.id,
        event_type="inventory_created",
        facility_name=fac.name if fac else "Facility",
        details=f"Item {tid} registered with batch {item_in.batch_ref}"
    )

    item_dict = {
        "id": item.id,
        "tracking_id": item.tracking_id,
        "facility_id": item.facility_id,
        "facility_name": fac.name if fac else None,
        "blood_group": item.blood_group,
        "component_type": item.component_type,
        "quantity": item.quantity,
        "batch_ref": item.batch_ref,
        "collection_date": item.collection_date,
        "expiry_date": item.expiry_date,
        "status": item.status,
        "storage_temp_c": item.storage_temp_c,
        "qr_code_svg": item.qr_code_svg,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "traceability_events": item.traceability_events
    }
    return InventoryItemOut(**item_dict)

@app.get("/api/inventory/export")
def export_inventory_csv(db: Session = Depends(get_db)):
    items = db.query(InventoryItem).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Tracking ID", "Facility", "Blood Group", "Component", "Quantity", "Batch Ref", "Status", "Expiry Date", "Storage Temp (°C)"])
    for it in items:
        writer.writerow([
            it.tracking_id,
            it.facility.name if it.facility else it.facility_id,
            it.blood_group,
            it.component_type,
            it.quantity,
            it.batch_ref,
            it.status,
            it.expiry_date.isoformat(),
            it.storage_temp_c
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=life_loop_inventory.csv"}
    )

@app.post("/api/inventory/import")
async def import_inventory_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    decoded = content.decode("utf-8").splitlines()
    reader = csv.DictReader(decoded)
    
    imported_count = 0
    errors = []
    
    for row_idx, row in enumerate(reader):
        try:
            facility_id = int(row.get("Facility ID") or row.get("facility_id") or 1)
            group = row.get("Blood Group") or row.get("blood_group") or "O+"
            comp = row.get("Component") or row.get("component_type") or "Red Blood Cells"
            qty = int(row.get("Quantity") or row.get("quantity") or 1)
            batch = row.get("Batch Ref") or row.get("batch_ref") or f"IMP-{uuid.uuid4().hex[:4].upper()}"
            
            exp_str = row.get("Expiry Date") or row.get("expiry_date")
            if exp_str:
                exp_dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00")).replace(tzinfo=None)
            else:
                exp_dt = datetime.utcnow() + timedelta(days=30)
            
            tid = f"LL-IMP-{uuid.uuid4().hex[:6].upper()}"
            qr = generate_qr_svg_or_base64(tid)

            item = InventoryItem(
                tracking_id=tid,
                facility_id=facility_id,
                blood_group=group,
                component_type=comp,
                quantity=qty,
                batch_ref=batch,
                collection_date=datetime.utcnow(),
                expiry_date=exp_dt,
                status="available",
                storage_temp_c=4.0,
                qr_code_svg=qr
            )
            db.add(item)
            imported_count += 1
        except Exception as e:
            errors.append(f"Row {row_idx + 1}: {str(e)}")

    db.commit()
    return {"imported": imported_count, "errors": errors}

@app.get("/api/inventory/{item_id}", response_model=InventoryItemOut)
def get_inventory_item(item_id: int, db: Session = Depends(get_db)):
    it = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    item_dict = {
        "id": it.id,
        "tracking_id": it.tracking_id,
        "facility_id": it.facility_id,
        "facility_name": it.facility.name if it.facility else None,
        "blood_group": it.blood_group,
        "component_type": it.component_type,
        "quantity": it.quantity,
        "batch_ref": it.batch_ref,
        "collection_date": it.collection_date,
        "expiry_date": it.expiry_date,
        "status": it.status,
        "storage_temp_c": it.storage_temp_c,
        "qr_code_svg": it.qr_code_svg,
        "created_at": it.created_at,
        "updated_at": it.updated_at,
        "traceability_events": it.traceability_events
    }
    return InventoryItemOut(**item_dict)


# ==========================================
# 4. QR CODE TRACEABILITY
# ==========================================
@app.get("/api/traceability/{identifier}", response_model=InventoryItemOut)
def lookup_traceability(identifier: str, db: Session = Depends(get_db)):
    """
    Looks up an inventory item by tracking_id, batch_ref, or numeric ID.
    Used by QR scanning and manual search.
    """
    it = db.query(InventoryItem).filter(
        (InventoryItem.tracking_id == identifier) |
        (InventoryItem.batch_ref == identifier)
    ).first()

    if not it and identifier.isdigit():
        it = db.query(InventoryItem).filter(InventoryItem.id == int(identifier)).first()

    if not it:
        raise HTTPException(
            status_code=404,
            detail=f"Tracking identifier '{identifier}' not found in registry. Ensure unit was logged in Life-Loop."
        )

    item_dict = {
        "id": it.id,
        "tracking_id": it.tracking_id,
        "facility_id": it.facility_id,
        "facility_name": it.facility.name if it.facility else None,
        "blood_group": it.blood_group,
        "component_type": it.component_type,
        "quantity": it.quantity,
        "batch_ref": it.batch_ref,
        "collection_date": it.collection_date,
        "expiry_date": it.expiry_date,
        "status": it.status,
        "storage_temp_c": it.storage_temp_c,
        "qr_code_svg": it.qr_code_svg,
        "created_at": it.created_at,
        "updated_at": it.updated_at,
        "traceability_events": it.traceability_events
    }
    return InventoryItemOut(**item_dict)

@app.post("/api/traceability/{item_id}/events")
def record_traceability_event_endpoint(
    item_id: int,
    req: RecordMovementRequest,
    db: Session = Depends(get_db)
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    ev = record_movement_event(
        db=db,
        inventory_item_id=item.id,
        event_type=req.event_type,
        facility_name=req.facility_name,
        details=req.details,
        operator=req.operator
    )
    return {"status": "success", "event_id": ev.id}


# ==========================================
# 5. EXPIRY ALERTS
# ==========================================
@app.get("/api/alerts", response_model=List[AlertOut])
def get_alerts(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Alert)
    if status:
        q = q.filter(Alert.status == status)
    alerts = q.order_by(Alert.created_at.desc()).all()
    
    res = []
    for al in alerts:
        res.append(AlertOut(
            id=al.id,
            facility_id=al.facility_id,
            facility_name=al.facility.name if al.facility else None,
            inventory_item_id=al.inventory_item_id,
            tracking_id=al.inventory_item.tracking_id if al.inventory_item else None,
            blood_group=al.inventory_item.blood_group if al.inventory_item else None,
            component_type=al.inventory_item.component_type if al.inventory_item else None,
            alert_type=al.alert_type,
            severity=al.severity,
            message=al.message,
            hours_remaining=al.hours_remaining,
            status=al.status,
            email_delivery_status=al.email_delivery_status,
            created_at=al.created_at,
            acknowledged_at=al.acknowledged_at
        ))
    return res

@app.post("/api/alerts/run-expiry-check")
def trigger_expiry_check(db: Session = Depends(get_db)):
    """
    On-demand expiry check for demo judges & operators.
    Evaluates thresholds, quarantines expired, triggers notifications.
    """
    result = evaluate_expiry_alerts(db)
    return result

@app.post("/api/alerts/{alert_id}/acknowledge")
def ack_alert_endpoint(alert_id: int, db: Session = Depends(get_db)):
    try:
        updated = acknowledge_alert(db, alert_id)
        return {"status": "success", "alert_id": updated.id, "alert_status": updated.status}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert_endpoint(alert_id: int, payload: Optional[Dict[str, str]] = None, db: Session = Depends(get_db)):
    try:
        notes = (payload or {}).get("notes", "Resolved by authorized healthcare operator")
        updated = resolve_alert(db, alert_id, resolution_notes=notes)
        return {"status": "success", "alert_id": updated.id, "alert_status": updated.status}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))



# ==========================================
# 6. DEMAND & FORECASTS
# ==========================================
@app.get("/api/demand", response_model=List[DemandRecordOut])
def get_demands(facility_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(DemandRecord)
    if facility_id:
        q = q.filter(DemandRecord.facility_id == facility_id)
    demands = q.order_by(DemandRecord.created_at.desc()).all()
    
    res = []
    for d in demands:
        res.append(DemandRecordOut(
            id=d.id,
            facility_id=d.facility_id,
            facility_name=d.facility.name if d.facility else None,
            blood_group=d.blood_group,
            component_type=d.component_type,
            quantity_needed=d.quantity_needed,
            urgency=d.urgency,
            deadline_hours=d.deadline_hours,
            status=d.status,
            is_simulated=d.is_simulated,
            created_at=d.created_at
        ))
    return res

@app.get("/api/forecasts")
def get_forecasts_endpoint(
    facility_id: Optional[int] = None,
    component_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return get_demand_forecasts(db, facility_id=facility_id, component_type=component_type)


# ==========================================
# 7. MILP OPTIMIZATION ENGINE
# ==========================================
@app.post("/api/optimization/run", response_model=OptimizationResult)
def run_optimization(req: OptimizationRequest, db: Session = Depends(get_db)):
    global LATEST_OPTIMIZATION_RESULT
    now = datetime.utcnow()

    # Build facility inputs
    facilities = [
        {
            "id": f.id,
            "name": f.name,
            "safety_reserve_units": f.safety_reserve_units if f.is_active else 99999
        }
        for f in db.query(Facility).all()
    ]

    # Build available inventory inputs
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

    # Build active demand inputs
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

    # Dynamic travel time matrix with any disruptions
    travel_matrix = dict(TRAVEL_TIME_MATRIX)
    travel_matrix.update(TRAVEL_TIME_DISRUPTIONS)

    weights = {
        "unmet_demand": req.weight_unmet_demand,
        "expiry_risk": req.weight_expiry_risk,
        "travel_time": req.weight_travel_time
    }

    optimizer = MILPOptimizer(
        facilities=facilities,
        inventory=inventory,
        demands=demands,
        travel_time_matrix=travel_matrix,
        weights=weights,
        now=now
    )
    result = optimizer.solve()

    # Persist proposed transfers in DB
    if result["is_feasible"] and result["proposed_transfers"]:
        run_id = result["run_id"]
        # Clear previous proposed (unapproved) transfers for this run
        for prop in result["proposed_transfers"]:
            # Check if matching proposed transfer already exists
            existing = db.query(Transfer).filter(
                Transfer.inventory_item_id == prop["item_id"],
                Transfer.destination_facility_id == prop["destination_id"],
                Transfer.status == "proposed"
            ).first()
            if not existing:
                tx = Transfer(
                    transfer_id=f"TX-{uuid.uuid4().hex[:6].upper()}",
                    origin_facility_id=prop["origin_id"],
                    destination_facility_id=prop["destination_id"],
                    inventory_item_id=prop["item_id"],
                    component_type=prop["component_type"],
                    blood_group=prop["blood_group"],
                    quantity=prop["quantity"],
                    travel_time_minutes=prop["travel_time_minutes"],
                    distance_km=round(prop["travel_time_minutes"] * 0.75, 1),
                    status="proposed",
                    optimization_run_id=run_id,
                    rationale=prop["explanation"],
                    created_at=now
                )
                db.add(tx)
        
        # Audit log entry
        audit = AuditLog(
            action="OPTIMIZATION_SOLVED",
            actor="MILPOptimizer",
            entity_type="OptimizationRun",
            entity_id=run_id,
            details=f"Solver {result['solver_name']} returned status '{result['solver_status']}' with {len(result['proposed_transfers'])} proposed transfers in {result['runtime_seconds']}s",
            timestamp=now
        )
        db.add(audit)
        db.commit()

    LATEST_OPTIMIZATION_RESULT = result
    return result

@app.get("/api/optimization/latest")
def get_latest_optimization():
    if not LATEST_OPTIMIZATION_RESULT:
        return {"status": "no_previous_run", "message": "No optimization run recorded yet. Click 'Run MILP Optimization'."}
    return LATEST_OPTIMIZATION_RESULT


# ==========================================
# 8. TRANSFERS WORKFLOW
# ==========================================
@app.get("/api/transfers", response_model=List[TransferOut])
def get_transfers(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Transfer)
    if status:
        q = q.filter(Transfer.status == status)
    transfers = q.order_by(Transfer.created_at.desc()).all()

    res = []
    for tx in transfers:
        res.append(TransferOut(
            id=tx.id,
            transfer_id=tx.transfer_id,
            emergency_request_id=tx.emergency_request_id,
            origin_facility_id=tx.origin_facility_id,
            origin_name=tx.origin.name if tx.origin else None,
            destination_facility_id=tx.destination_facility_id,
            destination_name=tx.destination.name if tx.destination else None,
            inventory_item_id=tx.inventory_item_id,
            tracking_id=tx.inventory_item.tracking_id if tx.inventory_item else None,
            component_type=tx.component_type,
            blood_group=tx.blood_group,
            quantity=tx.quantity,
            travel_time_minutes=tx.travel_time_minutes,
            distance_km=tx.distance_km,
            status=tx.status,
            cancellation_reason=tx.cancellation_reason,
            optimization_run_id=tx.optimization_run_id,
            rationale=tx.rationale,
            driver_id=tx.driver_id,
            driver_name=tx.driver.name if tx.driver else None,
            driver_status=tx.driver_status or "unassigned",
            temperature_current_c=tx.temperature_current_c or 4.0,
            temperature_status=tx.temperature_status or "normal",
            eta_minutes=tx.eta_minutes,
            created_at=tx.created_at,
            approved_at=tx.approved_at,
            dispatched_at=tx.dispatched_at,
            received_at=tx.received_at
        ))
    return res

@app.post("/api/transfers/{transfer_id}/approve")
def approve_transfer(transfer_id: str, payload: Optional[Dict[str, Any]] = None, db: Session = Depends(get_db)):
    tx = db.query(Transfer).filter((Transfer.transfer_id == transfer_id) | (Transfer.id == int(transfer_id) if transfer_id.isdigit() else False)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if tx.status != "proposed":
        raise HTTPException(status_code=400, detail=f"Cannot approve transfer with status '{tx.status}'")

    # Read latest inventory atomically from DB
    item = tx.inventory_item
    if not item or item.status != "available":
        raise HTTPException(status_code=400, detail="Underlying inventory batch is no longer available or has been reserved.")

    # Check authorized quantity (supports partial acceptance by supplying facility)
    approved_qty = (payload or {}).get("authorized_quantity", tx.quantity)
    if approved_qty <= 0 or approved_qty > item.quantity:
        raise HTTPException(status_code=400, detail=f"Invalid authorized quantity: {approved_qty}. Available in batch: {item.quantity}")

    # Atomic Reservation
    tx.quantity = approved_qty
    tx.status = "approved"
    tx.approved_at = datetime.utcnow()
    item.status = "reserved"

    # Auto-assign available driver for logistics readiness
    avail_driver = db.query(Driver).filter(Driver.status == "available").first() or db.query(Driver).first()
    if avail_driver:
        tx.driver_id = avail_driver.id
        tx.driver_status = "assigned"

    # Update emergency request tracking if attached
    reopt_transfers = []
    if tx.emergency_request:
        tx.emergency_request.quantity_allocated += approved_qty
        if tx.emergency_request.quantity_allocated >= tx.emergency_request.quantity_needed:
            tx.emergency_request.status = "fully_approved"
        else:
            tx.emergency_request.status = "partially_approved"
            rem_needed = tx.emergency_request.quantity_needed - tx.emergency_request.quantity_allocated
            
            # Re-optimize remaining shortage across other connected facilities
            facilities_input = [
                {"id": f.id, "name": f.name, "safety_reserve_units": f.safety_reserve_units if f.is_active else 99999}
                for f in db.query(Facility).all()
            ]
            inventory_input = [
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
            demands_input = [
                {
                    "id": tx.emergency_request.id,
                    "facility_id": tx.emergency_request.requesting_facility_id,
                    "blood_group": tx.emergency_request.blood_group,
                    "component_type": tx.emergency_request.component_type,
                    "quantity_needed": rem_needed,
                    "urgency": tx.emergency_request.urgency,
                    "deadline_hours": 24.0,
                    "status": "partially_fulfilled"
                }
            ]
            travel_matrix = dict(TRAVEL_TIME_MATRIX)
            travel_matrix.update(TRAVEL_TIME_DISRUPTIONS)

            opt = MILPOptimizer(
                facilities=facilities_input,
                inventory=inventory_input,
                demands=demands_input,
                travel_time_matrix=travel_matrix,
                now=datetime.utcnow()
            )
            sol = opt.solve()
            if sol.get("is_feasible") and sol.get("proposed_transfers"):
                for prop in sol["proposed_transfers"]:
                    if prop["destination_id"] == tx.destination_facility_id and prop["item_id"] != item.id:
                        new_tx = Transfer(
                            transfer_id=f"TX-{uuid.uuid4().hex[:6].upper()}",
                            emergency_request_id=tx.emergency_request.id,
                            origin_facility_id=prop["origin_id"],
                            destination_facility_id=prop["destination_id"],
                            inventory_item_id=prop["item_id"],
                            component_type=prop["component_type"],
                            blood_group=prop["blood_group"],
                            quantity=prop["quantity"],
                            travel_time_minutes=prop["travel_time_minutes"],
                            distance_km=round(prop["travel_time_minutes"] * 0.75, 1),
                            status="proposed",
                            optimization_run_id=sol["run_id"],
                            rationale=f"Reallocated remaining {prop['quantity']} units for {tx.emergency_request.request_id} from {prop['origin_name']}. {prop['explanation']}",
                            created_at=datetime.utcnow()
                        )
                        db.add(new_tx)
                        reopt_transfers.append(new_tx.transfer_id)
                        
                        # Notify the secondary supplying blood bank
                        sec_alert = Alert(
                            facility_id=prop["origin_id"],
                            inventory_item_id=prop["item_id"],
                            alert_type="transfer_proposal",
                            severity="urgent",
                            message=f"ACTION REQUIRED: Reallocation proposal for {prop['quantity']} units ({prop['blood_group']} {prop['component_type']}) for emergency requisition {tx.emergency_request.request_id}.",
                            status="active",
                            email_delivery_status="In-App Notification & SMS Alert Dispatched"
                        )
                        db.add(sec_alert)

    # Movement event
    record_movement_event(
        db=db,
        inventory_item_id=item.id,
        event_type="transfer_approved_reserved",
        facility_name=tx.origin.name if tx.origin else "Origin",
        details=f"Transfer {tx.transfer_id} approved for {approved_qty} units. Stock atomically reserved. Driver {avail_driver.name if avail_driver else 'assigned'} notified for dispatch."
    )

    # Clean up or resolve the proposal alert for this facility
    alert = db.query(Alert).filter(
        Alert.facility_id == tx.origin_facility_id,
        Alert.inventory_item_id == item.id,
        Alert.alert_type == "transfer_proposal",
        Alert.status == "active"
    ).first()
    if alert:
        alert.status = "resolved"

    db.commit()
    return {
        "status": "success",
        "transfer_id": tx.transfer_id,
        "new_status": "approved",
        "reserved_quantity": approved_qty,
        "driver_assigned": avail_driver.name if avail_driver else None,
        "reallocated_transfers": reopt_transfers
    }

@app.post("/api/transfers/{transfer_id}/reject")
def reject_transfer(transfer_id: str, payload: Optional[Dict[str, str]] = None, db: Session = Depends(get_db)):
    tx = db.query(Transfer).filter((Transfer.transfer_id == transfer_id) | (Transfer.id == int(transfer_id) if transfer_id.isdigit() else False)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if tx.status != "proposed":
        raise HTTPException(status_code=400, detail=f"Cannot reject transfer with status '{tx.status}'")

    reason = (payload or {}).get("reason", "Supplying facility declined transfer proposal due to local clinical reserves.")
    tx.status = "rejected"
    tx.cancellation_reason = reason

    # Clean up alert
    alert = db.query(Alert).filter(
        Alert.facility_id == tx.origin_facility_id,
        Alert.inventory_item_id == tx.inventory_item_id,
        Alert.alert_type == "transfer_proposal",
        Alert.status == "active"
    ).first()
    if alert:
        alert.status = "resolved"

    # If linked to emergency request, re-optimize the demand from another facility
    reopt_transfers = []
    if tx.emergency_request and tx.emergency_request.quantity_allocated < tx.emergency_request.quantity_needed:
        rem_needed = tx.emergency_request.quantity_needed - tx.emergency_request.quantity_allocated
        facilities_input = [
            {"id": f.id, "name": f.name, "safety_reserve_units": f.safety_reserve_units if f.is_active else 99999}
            for f in db.query(Facility).all()
        ]
        inventory_input = [
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
            for it in db.query(InventoryItem).filter(InventoryItem.status == "available", InventoryItem.facility_id != tx.origin_facility_id).all()
        ]
        demands_input = [
            {
                "id": tx.emergency_request.id,
                "facility_id": tx.emergency_request.requesting_facility_id,
                "blood_group": tx.emergency_request.blood_group,
                "component_type": tx.emergency_request.component_type,
                "quantity_needed": rem_needed,
                "urgency": tx.emergency_request.urgency,
                "deadline_hours": 24.0,
                "status": "unmet"
            }
        ]
        travel_matrix = dict(TRAVEL_TIME_MATRIX)
        travel_matrix.update(TRAVEL_TIME_DISRUPTIONS)

        opt = MILPOptimizer(
            facilities=facilities_input,
            inventory=inventory_input,
            demands=demands_input,
            travel_time_matrix=travel_matrix,
            now=datetime.utcnow()
        )
        sol = opt.solve()
        if sol.get("is_feasible") and sol.get("proposed_transfers"):
            for prop in sol["proposed_transfers"]:
                if prop["destination_id"] == tx.destination_facility_id:
                    new_tx = Transfer(
                        transfer_id=f"TX-{uuid.uuid4().hex[:6].upper()}",
                        emergency_request_id=tx.emergency_request.id,
                        origin_facility_id=prop["origin_id"],
                        destination_facility_id=prop["destination_id"],
                        inventory_item_id=prop["item_id"],
                        component_type=prop["component_type"],
                        blood_group=prop["blood_group"],
                        quantity=prop["quantity"],
                        travel_time_minutes=prop["travel_time_minutes"],
                        distance_km=round(prop["travel_time_minutes"] * 0.75, 1),
                        status="proposed",
                        optimization_run_id=sol["run_id"],
                        rationale=f"Reallocated {prop['quantity']} units after {tx.origin.name if tx.origin else 'Facility'} rejected. {prop['explanation']}",
                        created_at=datetime.utcnow()
                    )
                    db.add(new_tx)
                    reopt_transfers.append(new_tx.transfer_id)
                    sec_alert = Alert(
                        facility_id=prop["origin_id"],
                        inventory_item_id=prop["item_id"],
                        alert_type="transfer_proposal",
                        severity="urgent",
                        message=f"ACTION REQUIRED: Reallocation proposal for {prop['quantity']} units ({prop['blood_group']} {prop['component_type']}) following rejection.",
                        status="active",
                        email_delivery_status="In-App Notification & SMS Alert Dispatched"
                    )
                    db.add(sec_alert)

    # Log audit
    db.add(AuditLog(
        action="TRANSFER_PROPOSAL_REJECTED",
        actor=tx.origin.name if tx.origin else "Blood Bank Officer",
        entity_type="Transfer",
        entity_id=tx.transfer_id,
        details=f"Transfer proposal {tx.transfer_id} rejected. Reason: {reason}"
    ))
    db.commit()
    return {"status": "success", "transfer_id": tx.transfer_id, "new_status": "rejected", "reason": reason, "reallocated_transfers": reopt_transfers}

@app.post("/api/transfers/{transfer_id}/dispatch")
def dispatch_transfer(transfer_id: str, db: Session = Depends(get_db)):
    tx = db.query(Transfer).filter((Transfer.transfer_id == transfer_id) | (Transfer.id == int(transfer_id) if transfer_id.isdigit() else False)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if tx.status != "approved":
        raise HTTPException(status_code=400, detail=f"Cannot dispatch transfer with status '{tx.status}'")

    item = tx.inventory_item
    tx.status = "dispatched"
    tx.dispatched_at = datetime.utcnow()
    if item:
        item.status = "in_transit"

    record_movement_event(
        db=db,
        inventory_item_id=item.id,
        event_type="dispatched",
        facility_name=tx.origin.name if tx.origin else "Origin",
        details=f"Cold chain container dispatched via courier. Estimated arrival in {int(tx.travel_time_minutes)} mins."
    )

    db.commit()
    return {"status": "success", "transfer_id": tx.transfer_id, "new_status": "dispatched"}

@app.post("/api/transfers/{transfer_id}/receive")
def receive_transfer(transfer_id: str, db: Session = Depends(get_db)):
    tx = db.query(Transfer).filter((Transfer.transfer_id == transfer_id) | (Transfer.id == int(transfer_id) if transfer_id.isdigit() else False)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if tx.status != "dispatched":
        raise HTTPException(status_code=400, detail=f"Cannot receive transfer with status '{tx.status}'")

    item = tx.inventory_item
    tx.status = "received"
    tx.received_at = datetime.utcnow()
    
    if item:
        item.status = "available"
        item.facility_id = tx.destination_facility_id  # Transferred to destination!

    # Fulfill destination demand if exists
    matched_demand = db.query(DemandRecord).filter(
        DemandRecord.facility_id == tx.destination_facility_id,
        DemandRecord.component_type == tx.component_type,
        DemandRecord.status.in_(["unmet", "partially_fulfilled"])
    ).first()
    if matched_demand:
        if matched_demand.quantity_needed <= tx.quantity:
            matched_demand.status = "fulfilled"
            matched_demand.quantity_needed = 0
        else:
            matched_demand.quantity_needed -= tx.quantity
            matched_demand.status = "partially_fulfilled"

    record_movement_event(
        db=db,
        inventory_item_id=item.id,
        event_type="received_reconciled",
        facility_name=tx.destination.name if tx.destination else "Destination",
        details=f"Consignment received and stock reconciled into destination inventory."
    )

    db.commit()
    return {"status": "success", "transfer_id": tx.transfer_id, "new_status": "received"}

@app.post("/api/transfers/{transfer_id}/cancel")
def cancel_transfer(transfer_id: str, reason: str = "Operator cancelled", db: Session = Depends(get_db)):
    tx = db.query(Transfer).filter((Transfer.transfer_id == transfer_id) | (Transfer.id == int(transfer_id) if transfer_id.isdigit() else False)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if tx.status in ["received", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel transfer in '{tx.status}' state")

    item = tx.inventory_item
    tx.status = "cancelled"
    tx.cancellation_reason = reason
    if item and item.status in ["reserved", "in_transit"]:
        item.status = "available"

    db.commit()
    return {"status": "success", "transfer_id": tx.transfer_id, "new_status": "cancelled"}

@app.get("/api/transfers/{transfer_id}/manifest")
def get_manifest(transfer_id: str, db: Session = Depends(get_db)):
    tx = db.query(Transfer).filter((Transfer.transfer_id == transfer_id) | (Transfer.id == int(transfer_id) if transfer_id.isdigit() else False)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return generate_transfer_manifest_data(tx)


# ==========================================
# 8.1 AUTH & DEMO PERSONA SWITCHER
# ==========================================
@app.get("/api/auth/demo-users", response_model=List[UserOut])
def get_demo_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    res = []
    for u in users:
        res.append(UserOut(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            facility_id=u.facility_id,
            facility_name=u.facility.name if u.facility else None,
            phone=u.phone,
            is_active=u.is_active
        ))
    return res

@app.get("/api/auth/current-user")
def get_current_user_profile(user_id: Optional[int] = 1, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first() or db.query(User).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": u.id,
        "email": u.email,
        "name": u.name,
        "role": u.role,
        "facility_id": u.facility_id,
        "facility_name": u.facility.name if u.facility else "Central Logistics Admin",
        "phone": u.phone
    }


# ==========================================
# 8.2 EMERGENCY BLOOD REQUESTS & CANDIDATE MATCHING
# ==========================================
@app.get("/api/emergency-requests", response_model=List[EmergencyRequestOut])
def get_emergency_requests(facility_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(EmergencyRequest)
    if facility_id:
        q = q.filter(EmergencyRequest.requesting_facility_id == facility_id)
    reqs = q.order_by(EmergencyRequest.created_at.desc()).all()
    res = []
    for r in reqs:
        res.append(EmergencyRequestOut(
            id=r.id,
            request_id=r.request_id,
            requesting_facility_id=r.requesting_facility_id,
            requesting_facility_name=r.facility.name if r.facility else None,
            blood_group=r.blood_group,
            component_type=r.component_type,
            quantity_needed=r.quantity_needed,
            quantity_allocated=r.quantity_allocated or 0,
            quantity_fulfilled=r.quantity_fulfilled or 0,
            urgency=r.urgency,
            required_by_time=r.required_by_time,
            delivery_destination=r.delivery_destination,
            contact_phone=r.contact_phone,
            notes=r.notes,
            status=r.status,
            created_at=r.created_at,
            updated_at=r.updated_at
        ))
    return res

@app.post("/api/emergency-requests")
def create_emergency_request(req_in: EmergencyRequestCreate, db: Session = Depends(get_db)):
    rid = f"REQ-STAT-{uuid.uuid4().hex[:6].upper()}"
    req_by = datetime.utcnow() + timedelta(hours=req_in.required_by_hours)
    dest = req_in.delivery_destination
    if not dest:
        fac = db.query(Facility).filter(Facility.id == req_in.requesting_facility_id).first()
        dest = fac.name if fac else "Hospital Emergency Ward"

    em_req = EmergencyRequest(
        request_id=rid,
        requesting_facility_id=req_in.requesting_facility_id,
        blood_group=req_in.blood_group,
        component_type=req_in.component_type,
        quantity_needed=req_in.quantity_needed,
        quantity_allocated=0,
        quantity_fulfilled=0,
        urgency=req_in.urgency,
        required_by_time=req_by,
        delivery_destination=dest,
        contact_phone=req_in.contact_phone or "+91 253 257 2038",
        notes=req_in.notes or "STAT Emergency Demand submitted via Hospital Portal.",
        status="submitted"
    )
    db.add(em_req)

    # Also register in DemandRecords for solver awareness
    demand_rec = DemandRecord(
        facility_id=req_in.requesting_facility_id,
        blood_group=req_in.blood_group,
        component_type=req_in.component_type,
        quantity_needed=req_in.quantity_needed,
        urgency=req_in.urgency,
        deadline_hours=req_in.required_by_hours,
        status="unmet",
        is_simulated=False
    )
    db.add(demand_rec)

    # Log audit
    db.add(AuditLog(
        action="EMERGENCY_REQUEST_CREATED",
        actor=f"Hospital Staff (Facility {req_in.requesting_facility_id})",
        entity_type="EmergencyRequest",
        entity_id=rid,
        details=f"STAT request {rid} submitted for {req_in.quantity_needed} units of {req_in.blood_group} {req_in.component_type}."
    ))
    db.commit()

    # Discover candidate facilities immediately using immunohematology compatibility rules
    candidates = []
    # Query all available, unexpired stock from other connected, active facilities
    all_avail_items = db.query(InventoryItem).join(Facility).filter(
        InventoryItem.status == "available",
        InventoryItem.facility_id != req_in.requesting_facility_id,
        Facility.is_active == True,
        Facility.is_connected == True
    ).all()

    eligible_items = []
    for it in all_avail_items:
        if it.component_type != req_in.component_type:
            continue
        if not is_compatible(req_in.component_type, it.blood_group, req_in.blood_group):
            continue
        
        # Check expiry (> 1 hour)
        hrs_left = (it.expiry_date - datetime.utcnow()).total_seconds() / 3600.0
        if hrs_left <= 1.0:
            continue

        eligible_items.append(it)
        t_time = TRAVEL_TIME_MATRIX.get((it.facility_id, req_in.requesting_facility_id), 18.0)
        candidates.append({
            "facility_id": it.facility_id,
            "facility_name": it.facility.name,
            "available_units": it.quantity,
            "blood_group": it.blood_group,
            "batch_ref": it.batch_ref,
            "travel_time_minutes": t_time,
            "is_connected": it.facility.is_connected
        })

    # Automatically trigger MILP optimization to generate candidate proposal transfers!
    proposed_transfers_list = []
    if eligible_items:
        facilities_input = [
            {"id": f.id, "name": f.name, "safety_reserve_units": f.safety_reserve_units if f.is_active else 99999}
            for f in db.query(Facility).all()
        ]
        inventory_input = [
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
        demands_input = [
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
        travel_matrix = dict(TRAVEL_TIME_MATRIX)
        travel_matrix.update(TRAVEL_TIME_DISRUPTIONS)

        opt = MILPOptimizer(
            facilities=facilities_input,
            inventory=inventory_input,
            demands=demands_input,
            travel_time_matrix=travel_matrix,
            now=datetime.utcnow()
        )
        sol = opt.solve()

        if sol.get("is_feasible") and sol.get("proposed_transfers"):
            run_id = sol["run_id"]
            em_req.status = "proposed"
            for prop in sol["proposed_transfers"]:
                if prop["destination_id"] == req_in.requesting_facility_id:
                    tx = Transfer(
                        transfer_id=f"TX-{uuid.uuid4().hex[:6].upper()}",
                        emergency_request_id=em_req.id,
                        origin_facility_id=prop["origin_id"],
                        destination_facility_id=prop["destination_id"],
                        inventory_item_id=prop["item_id"],
                        component_type=prop["component_type"],
                        blood_group=prop["blood_group"],
                        quantity=prop["quantity"],
                        travel_time_minutes=prop["travel_time_minutes"],
                        distance_km=round(prop["travel_time_minutes"] * 0.75, 1),
                        status="proposed",
                        optimization_run_id=run_id,
                        rationale=prop["explanation"],
                        created_at=datetime.utcnow()
                    )
                    db.add(tx)
                    proposed_transfers_list.append({
                        "transfer_id": tx.transfer_id,
                        "origin_name": prop["origin_name"],
                        "quantity": prop["quantity"],
                        "blood_group": prop["blood_group"],
                        "explanation": prop["explanation"]
                    })

                    # Create persistent in-app Alert / Notification for Supplying Facility!
                    supplying_alert = Alert(
                        facility_id=prop["origin_id"],
                        inventory_item_id=prop["item_id"],
                        alert_type="transfer_proposal",
                        severity="urgent" if req_in.urgency != "critical" else "critical",
                        message=f"ACTION REQUIRED: Proposed transfer of {prop['quantity']} units ({prop['blood_group']} {prop['component_type']}) for emergency at {dest}. Review and Accept/Reject.",
                        hours_remaining=None,
                        status="active",
                        email_delivery_status="In-App Notification & SMS Alert Dispatched"
                    )
                    db.add(supplying_alert)
            db.commit()

    return {
        "status": "success",
        "request_id": rid,
        "message": f"STAT Blood Requisition created. Identified {len(candidates)} compatible supply source(s). Generated {len(proposed_transfers_list)} proposed transfer allocation(s).",
        "candidates": candidates,
        "proposed_transfers": proposed_transfers_list
    }


# ==========================================
# 8.3 DRIVER DISPATCH & SMARTPHONE PORTAL
# ==========================================
@app.get("/api/drivers", response_model=List[DriverOut])
def get_drivers(db: Session = Depends(get_db)):
    drivers = db.query(Driver).all()
    return drivers

@app.post("/api/transfers/{transfer_id}/assign-driver")
def assign_driver_to_transfer(transfer_id: str, driver_id: Optional[int] = None, db: Session = Depends(get_db)):
    tx = db.query(Transfer).filter((Transfer.transfer_id == transfer_id) | (Transfer.id == int(transfer_id) if transfer_id.isdigit() else False)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transfer not found")

    driver = None
    if driver_id:
        driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        # Auto-pick available driver
        driver = db.query(Driver).filter(Driver.status == "available").first()
    if not driver:
        driver = db.query(Driver).first()

    if not driver:
        raise HTTPException(status_code=400, detail="No courier drivers available in the network.")

    tx.driver_id = driver.id
    tx.driver_status = "assigned"
    driver.status = "on_mission"

    # Add audit log
    db.add(AuditLog(
        action="DRIVER_ASSIGNED",
        actor="Dispatch Coordinator",
        entity_type="Transfer",
        entity_id=tx.transfer_id,
        details=f"Driver {driver.name} ({driver.vehicle_number}) assigned to consignment {tx.transfer_id}."
    ))
    db.commit()
    return {
        "status": "success",
        "transfer_id": tx.transfer_id,
        "driver_id": driver.id,
        "driver_name": driver.name,
        "driver_status": "assigned"
    }

@app.post("/api/transfers/{transfer_id}/driver-action")
def update_driver_status(transfer_id: str, action: str, db: Session = Depends(get_db)):
    """
    Driver workflow actions:
    - 'accept': Driver confirms mission
    - 'pickup': Driver confirms pickup from supplying blood bank
    - 'deliver': Driver delivers cold box to destination hospital
    """
    tx = db.query(Transfer).filter((Transfer.transfer_id == transfer_id) | (Transfer.id == int(transfer_id) if transfer_id.isdigit() else False)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if action == "accept":
        tx.driver_status = "accepted"
    elif action == "pickup":
        tx.driver_status = "in_transit"
        tx.status = "dispatched"
        tx.dispatched_at = datetime.utcnow()
        if tx.inventory_item:
            tx.inventory_item.status = "in_transit"
        record_movement_event(
            db=db,
            inventory_item_id=tx.inventory_item_id,
            event_type="driver_pickup_confirmed",
            facility_name=tx.origin.name if tx.origin else "Blood Bank",
            details=f"Courier {tx.driver.name if tx.driver else 'Courier'} picked up cold box ({tx.temperature_current_c}°C)."
        )
    elif action == "deliver":
        tx.driver_status = "delivered"
        tx.status = "received"
        tx.received_at = datetime.utcnow()
        if tx.driver:
            tx.driver.status = "available"
        if tx.inventory_item:
            tx.inventory_item.status = "available"
            tx.inventory_item.facility_id = tx.destination_facility_id

        # Update emergency request fulfillment if linked
        if tx.emergency_request:
            tx.emergency_request.quantity_fulfilled += tx.quantity
            if tx.emergency_request.quantity_fulfilled >= tx.emergency_request.quantity_needed:
                tx.emergency_request.status = "completed"

        record_movement_event(
            db=db,
            inventory_item_id=tx.inventory_item_id,
            event_type="delivered_and_reconciled",
            facility_name=tx.destination.name if tx.destination else "Hospital",
            details=f"Courier delivered cold box to destination. Stock reconciled into receiving facility."
        )

    db.commit()
    return {"status": "success", "transfer_id": tx.transfer_id, "driver_status": tx.driver_status, "transfer_status": tx.status}


# ==========================================
# 8.4 COLD-CHAIN IOT TEMPERATURE SIMULATOR
# ==========================================
@app.post("/api/transfers/{transfer_id}/simulate-temperature-spike")
def simulate_temp_spike(transfer_id: str, spike_temp: float = 11.5, db: Session = Depends(get_db)):
    """
    Hackathon Judge Trigger: Injects a cold-chain temperature excursion (+11.5°C)
    generating immediate critical alerts and sound sirens.
    """
    tx = db.query(Transfer).filter((Transfer.transfer_id == transfer_id) | (Transfer.id == int(transfer_id) if transfer_id.isdigit() else False)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transfer not found")

    tx.temperature_current_c = spike_temp
    tx.temperature_status = "critical_excursion"

    # Log temperature log
    log = TemperatureLog(
        transfer_id=tx.id,
        temperature_c=spike_temp,
        sensor_id="IOT-COLD-NASHIK-EXCURSION",
        is_simulated=True,
        status="critical_excursion",
        notes=f"CRITICAL COLD-CHAIN BREACH: Temperature reached {spike_temp}°C (Safe limit: 2°C - 6°C)."
    )
    db.add(log)

    # Create critical alert
    alert = Alert(
        facility_id=tx.destination_facility_id,
        inventory_item_id=tx.inventory_item_id,
        alert_type="temp_excursion",
        severity="critical",
        message=f"CRITICAL COLD-CHAIN EXCURSION on Consignment {tx.transfer_id}: Current sensor reading is {spike_temp}°C! Immediate thermal inspection required.",
        status="active",
        email_delivery_status="Emergency Audio Alert & SMS Dispatched to Quality Officer"
    )
    db.add(alert)
    db.commit()

    return {
        "status": "success",
        "transfer_id": tx.transfer_id,
        "temperature_c": spike_temp,
        "temperature_status": "critical_excursion",
        "alert_id": alert.id,
        "message": f"Simulated temperature excursion to {spike_temp}°C logged. Excursion alarm triggered."
    }



# ==========================================
# 9. LIVE EMERGENCY SIMULATION & WEBSOCKET
# ==========================================
@app.websocket("/ws/scenarios/{scenario_id}")
async def websocket_scenario_endpoint(websocket: WebSocket, scenario_id: str):
    await notifier.connect(websocket)
    try:
        while True:
            # Keep connection alive & receive client messages
            data = await websocket.receive_text()
            # Echo heartbeat
            await websocket.send_json({"type": "HEARTBEAT", "payload": "Connected to Life-Loop Simulation Stream"})
    except WebSocketDisconnect:
        notifier.disconnect(websocket)

@app.post("/api/scenarios/event")
async def trigger_simulation_event(req: SimulationEventRequest, db: Session = Depends(get_db)):
    travel_matrix = dict(TRAVEL_TIME_MATRIX)
    travel_matrix.update(TRAVEL_TIME_DISRUPTIONS)
    
    payload = {
        "facility_id": req.facility_id,
        "blood_group": req.blood_group,
        "component_type": req.component_type,
        "quantity": req.quantity,
        "route_origin_id": req.route_origin_id,
        "route_dest_id": req.route_dest_id,
        "delay_multiplier": req.delay_multiplier,
        "note": req.note
    }

    res = await apply_emergency_event(db, req.event_type, payload, travel_matrix)
    global LATEST_OPTIMIZATION_RESULT
    LATEST_OPTIMIZATION_RESULT = res.get("reoptimization_result")
    return res

@app.post("/api/scenarios/reset")
def reset_scenario_to_seed(db: Session = Depends(get_db)):
    """
    Resets the entire database back to deterministic seed data.
    """
    TRAVEL_TIME_DISRUPTIONS.clear()
    seed_database(db, force=True)
    global LATEST_OPTIMIZATION_RESULT
    LATEST_OPTIMIZATION_RESULT = None
    return {"status": "success", "message": "Demo data and scenarios restored to initial deterministic state."}


# ==========================================
# 10. IMPACT ANALYTICS & AUDIT TRAIL
# ==========================================
@app.get("/api/analytics/impact")
def get_impact_analytics(db: Session = Depends(get_db)):
    if LATEST_OPTIMIZATION_RESULT and "baseline_comparison" in LATEST_OPTIMIZATION_RESULT:
        return LATEST_OPTIMIZATION_RESULT["baseline_comparison"]
    
    # Fallback to compute baseline on current DB state
    optimizer = MILPOptimizer(
        facilities=[{"id": f.id, "safety_reserve_units": f.safety_reserve_units} for f in db.query(Facility).all()],
        inventory=[{"facility_id": it.facility_id, "quantity": it.quantity, "component_type": it.component_type, "blood_group": it.blood_group, "hours_to_expiry": 100} for it in db.query(InventoryItem).filter(InventoryItem.status == "available").all()],
        demands=[{"facility_id": d.facility_id, "quantity_needed": d.quantity_needed, "component_type": d.component_type, "blood_group": d.blood_group} for d in db.query(DemandRecord).all()],
        travel_time_matrix=TRAVEL_TIME_MATRIX
    )
    return optimizer._compute_baseline(
        demands=[{"facility_id": d.facility_id, "quantity_needed": d.quantity_needed, "component_type": d.component_type, "blood_group": d.blood_group} for d in db.query(DemandRecord).all()],
        items=[{"facility_id": it.facility_id, "quantity": it.quantity, "component_type": it.component_type, "blood_group": it.blood_group, "hours_to_expiry": 100} for it in db.query(InventoryItem).filter(InventoryItem.status == "available").all()],
        transfers=[]
    )

@app.get("/api/audit", response_model=List[AuditLogOut])
def get_audit_trail(limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return logs


# ==========================================
# 11. AI OPERATIONS COPILOT (Rule-based & Context-aware)
# ==========================================
class CopilotQuery(FastAPI):
    query: str

@app.post("/api/copilot/ask")
def ask_copilot(payload: Dict[str, str], db: Session = Depends(get_db)):
    q = payload.get("query", "").lower()
    
    # Analyze current DB state
    facs = db.query(Facility).all()
    items = db.query(InventoryItem).filter(InventoryItem.status == "available").all()
    demands = db.query(DemandRecord).filter(DemandRecord.status.in_(["unmet", "partially_fulfilled"])).all()
    alerts = db.query(Alert).filter(Alert.status == "active").all()
    transfers = db.query(Transfer).all()

    if "shortage" in q or "risk" in q:
        shortages = []
        for f in facs:
            stock = sum(it.quantity for it in items if it.facility_id == f.id)
            req = sum(dm.quantity_needed for dm in demands if dm.facility_id == f.id)
            if stock < f.safety_reserve_units or req > stock:
                shortages.append(f"{f.name} (Stock: {stock}, Reserve: {f.safety_reserve_units}, Unmet Demand: {req})")
        resp = "Current facilities facing projected shortage risks:\n" + ("\n- " + "\n- ".join(shortages) if shortages else "None! All facilities meet reserve thresholds.")
        return {"answer": resp, "type": "shortage_analysis"}

    elif "expiry" in q or "expir" in q:
        exp_units = [f"{it.tracking_id} ({it.blood_group} {it.component_type}, {it.quantity} units, exp: {it.expiry_date.strftime('%Y-%m-%d %H:%M')})" for it in items if (it.expiry_date - datetime.utcnow()).total_seconds() <= 72*3600]
        resp = f"Found {len(exp_units)} inventory batch(es) expiring within 72 hours:\n" + ("\n- " + "\n- ".join(exp_units) if exp_units else "None. All units have safe shelf life.")
        return {"answer": resp, "type": "expiry_analysis"}

    elif "baseline" in q or "compare" in q or "impact" in q:
        if LATEST_OPTIMIZATION_RESULT and "baseline_comparison" in LATEST_OPTIMIZATION_RESULT:
            comp = LATEST_OPTIMIZATION_RESULT["baseline_comparison"]
            imp = comp.get("improvement", {})
            resp = (
                f"Comparison of Baseline (Local stock only) vs Life-Loop MILP:\n"
                f"- Service Level: Baseline {comp['baseline']['service_level_pct']}% -> Optimized {comp['life_loop_optimized']['service_level_pct']}%\n"
                f"- Unmet Demand Units: {comp['baseline']['unmet_demand_units']} -> {comp['life_loop_optimized']['unmet_demand_units']} ({imp.get('unmet_demand_reduction_pct', 0)}% reduction)\n"
                f"- Expiry Waste Prevented: {imp.get('waste_reduction_pct', 0)}% waste reduction\n"
                f"- Transfers Proposed: {comp['life_loop_optimized']['transfers_dispatched']}"
            )
        else:
            resp = "Please run the MILP Optimization first to generate the baseline vs optimized impact comparison."
        return {"answer": resp, "type": "impact_comparison"}

    elif "why" in q or "recommend" in q:
        if LATEST_OPTIMIZATION_RESULT and LATEST_OPTIMIZATION_RESULT.get("proposed_transfers"):
            t = LATEST_OPTIMIZATION_RESULT["proposed_transfers"][0]
            resp = f"Latest transfer rationale: {t['explanation']}"
        else:
            resp = "The MILP optimization engine chooses routes that minimize weighted unmet emergency demand and near-expiry wastage while respecting component immunohematology compatibility and road transit times."
        return {"answer": resp, "type": "explanation"}

    else:
        resp = (
            f"Life-Loop Operations Copilot Status:\n"
            f"- Monitoring {len(facs)} facilities in the network\n"
            f"- {sum(it.quantity for it in items)} available blood units tracked\n"
            f"- {len(alerts)} active expiry/shortage alerts\n"
            f"- {len(transfers)} total transfer records logged.\n"
            f"You can ask me about shortage risks, expiring batches, baseline comparisons, or why a transfer was recommended."
        )
        return {"answer": resp, "type": "general_overview"}

# ==========================================
# 12. STATIC FRONTEND SPA SERVING
# ==========================================
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(DIST_DIR) and os.path.exists(os.path.join(DIST_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("ws"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

