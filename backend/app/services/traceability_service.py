import io
import base64
import qrcode
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import InventoryItem, TraceabilityEvent, AuditLog

def generate_qr_svg_or_base64(tracking_id: str) -> str:
    """
    Generates a high-contrast QR code encoding a non-sensitive
    opaque application URL for traceability.
    """
    payload = f"https://lifeloop.health/trace/{tracking_id}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=6,
        border=2,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    b64_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_str}"

def record_movement_event(
    db: Session,
    inventory_item_id: int,
    event_type: str,
    facility_name: str,
    details: str,
    operator: str = "Life-Loop Operator"
) -> TraceabilityEvent:
    event = TraceabilityEvent(
        inventory_item_id=inventory_item_id,
        event_type=event_type,
        facility_name=facility_name,
        operator=operator,
        details=details,
        timestamp=datetime.utcnow()
    )
    db.add(event)
    
    # Audit log entry
    item = db.query(InventoryItem).filter(InventoryItem.id == inventory_item_id).first()
    tracking_id = item.tracking_id if item else str(inventory_item_id)
    
    audit = AuditLog(
        action=f"TRACEABILITY_{event_type.upper()}",
        actor=operator,
        entity_type="InventoryItem",
        entity_id=tracking_id,
        details=f"Facility: {facility_name}. {details}",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    db.refresh(event)
    return event
