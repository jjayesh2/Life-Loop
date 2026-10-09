from datetime import datetime, timezone
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from ..models import InventoryItem, Alert, Facility, AuditLog

def evaluate_expiry_alerts(db: Session) -> Dict[str, Any]:
    """
    Evaluates all inventory items against expiry thresholds:
    - Approaching Expiry: <= 72 hours
    - Urgent Expiry: <= 24 hours
    - Expired: <= 0 hours (marks item as 'expired' status and prevents transfer)
    Prevents duplicate active alerts for the same unit.
    """
    now = datetime.utcnow()
    items = db.query(InventoryItem).filter(InventoryItem.status.in_(["available", "reserved"])).all()
    
    new_alerts_created = 0
    acknowledged_count = 0
    expired_marked_count = 0

    for item in items:
        hours_remaining = (item.expiry_date - now).total_seconds() / 3600.0
        
        # Check if already expired
        if hours_remaining <= 0:
            item.status = "expired"
            expired_marked_count += 1
            severity = "critical"
            alert_type = "expired"
            msg = f"CRITICAL: Batch {item.batch_ref} ({item.blood_group} {item.component_type}) expired {abs(round(hours_remaining, 1))}h ago. Unit quarantined."
        elif hours_remaining <= 24.0:
            severity = "urgent"
            alert_type = "urgent_expiry"
            msg = f"URGENT: Unit {item.tracking_id} ({item.blood_group} {item.component_type}) expires in {round(hours_remaining, 1)} hours! Immediate redistribution advised."
        elif hours_remaining <= 72.0:
            severity = "warning"
            alert_type = "approaching_expiry"
            msg = f"WARNING: Unit {item.tracking_id} ({item.blood_group} {item.component_type}) expires in {round(hours_remaining, 1)} hours ({round(hours_remaining/24.0, 1)} days)."
        else:
            continue

        # Check existing active alert to avoid duplicates
        existing = db.query(Alert).filter(
            Alert.inventory_item_id == item.id,
            Alert.alert_type == alert_type,
            Alert.status == "active"
        ).first()

        if not existing:
            alert = Alert(
                facility_id=item.facility_id,
                inventory_item_id=item.id,
                alert_type=alert_type,
                severity=severity,
                message=msg,
                hours_remaining=round(hours_remaining, 1),
                status="active",
                email_delivery_status="Not configured (No SMTP)",
                created_at=now
            )
            db.add(alert)
            new_alerts_created += 1

            # Log audit trail
            audit = AuditLog(
                action="EXPIRY_ALERT_GENERATED",
                actor="ExpiryEngine",
                entity_type="Alert",
                entity_id=item.tracking_id,
                details=msg,
                timestamp=now
            )
            db.add(audit)

    db.commit()

    total_active = db.query(Alert).filter(Alert.status == "active").count()
    return {
        "status": "success",
        "evaluated_at": now.isoformat(),
        "new_alerts_created": new_alerts_created,
        "items_auto_expired": expired_marked_count,
        "total_active_alerts": total_active
    }

def acknowledge_alert(db: Session, alert_id: int, operator: str = "Life-Loop Operator") -> Alert:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise ValueError(f"Alert {alert_id} not found")
    
    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.utcnow()
    
    audit = AuditLog(
        action="ALERT_ACKNOWLEDGED",
        actor=operator,
        entity_type="Alert",
        entity_id=str(alert_id),
        details=f"Alert #{alert_id} ({alert.message}) acknowledged by {operator}",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    db.refresh(alert)
    return alert

def resolve_alert(db: Session, alert_id: int, resolution_notes: str = "Resolved by authorized operator", operator: str = "Life-Loop Operator") -> Alert:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise ValueError(f"Alert {alert_id} not found")
    
    alert.status = "resolved"
    
    audit = AuditLog(
        action="ALERT_RESOLVED",
        actor=operator,
        entity_type="Alert",
        entity_id=str(alert_id),
        details=f"Alert #{alert_id} resolved by {operator}. Notes: {resolution_notes}",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    db.refresh(alert)
    return alert

