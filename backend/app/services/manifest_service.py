from datetime import datetime
from typing import Dict, Any
from ..models import Transfer

def generate_transfer_manifest_data(transfer: Transfer) -> Dict[str, Any]:
    """
    Builds data for a verifiable, print-ready chain-of-custody transfer manifest.
    """
    origin = transfer.origin
    dest = transfer.destination
    item = transfer.inventory_item

    return {
        "manifest_number": f"MNF-{transfer.transfer_id}",
        "transfer_id": transfer.transfer_id,
        "watermark": "DEMO ENVIRONMENT — SYNTHETIC DATA; NOT FOR CLINICAL USE",
        "created_at": transfer.created_at.strftime("%Y-%m-%d %H:%M UTC") if transfer.created_at else "",
        "status": transfer.status.upper(),
        "origin_facility": {
            "name": origin.name if origin else "Unknown Facility",
            "type": origin.facility_type if origin else "",
            "address": origin.address if origin else "",
            "phone": origin.contact_phone if origin else ""
        },
        "destination_facility": {
            "name": dest.name if dest else "Unknown Facility",
            "type": dest.facility_type if dest else "",
            "address": dest.address if dest else "",
            "phone": dest.contact_phone if dest else ""
        },
        "consignment": {
            "tracking_id": item.tracking_id if item else "N/A",
            "batch_ref": item.batch_ref if item else "N/A",
            "blood_group": transfer.blood_group,
            "component_type": transfer.component_type,
            "units_transferred": transfer.quantity,
            "expiry_date": item.expiry_date.strftime("%Y-%m-%d %H:%M UTC") if item and item.expiry_date else "N/A",
            "storage_temp_c": item.storage_temp_c if item else 4.0,
            "qr_code_svg": item.qr_code_svg if item else None
        },
        "logistics": {
            "estimated_transit_minutes": int(transfer.travel_time_minutes),
            "distance_km": round(transfer.distance_km, 1),
            "dispatch_protocol": "Validated Cold-Chain Standard Container (2°C - 6°C)",
            "approval_timestamp": transfer.approved_at.strftime("%Y-%m-%d %H:%M UTC") if transfer.approved_at else "Pending",
            "dispatch_timestamp": transfer.dispatched_at.strftime("%Y-%m-%d %H:%M UTC") if transfer.dispatched_at else "Pending",
            "receipt_timestamp": transfer.received_at.strftime("%Y-%m-%d %H:%M UTC") if transfer.received_at else "Pending",
            "rationale": transfer.rationale or "Algorithmic MILP reallocation to mitigate critical regional deficit."
        },
        "sign_off_blocks": [
            {"role": "Dispatching Blood Bank Officer", "name": "Authorized Technician", "signature_line": "____________________"},
            {"role": "Cold-Chain Transport Courier", "name": "Courier ID #LL-408", "signature_line": "____________________"},
            {"role": "Receiving Hospital Transfusion Lead", "name": "Attending Technologist", "signature_line": "____________________"}
        ]
    }
