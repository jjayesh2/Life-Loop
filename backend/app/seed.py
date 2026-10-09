import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .models import Facility, InventoryItem, DemandRecord, Transfer, Alert, TraceabilityEvent, AuditLog, Scenario
from .services.traceability_service import generate_qr_svg_or_base64

# Deterministic Facilities
FACILITIES_DATA = [
    {
        "id": 1,
        "code": "MTC-01",
        "name": "Metro Central Trauma Center",
        "facility_type": "Trauma Center (Level 1)",
        "latitude": 40.7306,
        "longitude": -73.9925,
        "address": "450 1st Avenue, Manhattan, NY",
        "contact_phone": "+1 (212) 555-0199",
        "contact_email": "trauma-blood@metrocentral.org",
        "safety_reserve_units": 15,
        "is_active": True
    },
    {
        "id": 2,
        "code": "RBC-02",
        "name": "Regional Red Cross Blood Center",
        "facility_type": "Regional Blood Bank",
        "latitude": 40.7580,
        "longitude": -73.9855,
        "address": "150 West 42nd St, Manhattan, NY",
        "contact_phone": "+1 (212) 555-0142",
        "contact_email": "ops@regionalredcross.org",
        "safety_reserve_units": 25,
        "is_active": True
    },
    {
        "id": 3,
        "code": "SJM-03",
        "name": "St. Jude Memorial Hospital",
        "facility_type": "General Hospital",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "address": "88 Fulton Street, Financial District, NY",
        "contact_phone": "+1 (212) 555-0188",
        "contact_email": "lab@stjudememorial.org",
        "safety_reserve_units": 10,
        "is_active": True
    },
    {
        "id": 4,
        "code": "UMC-04",
        "name": "University Academic Medical Center",
        "facility_type": "University Hospital",
        "latitude": 40.7831,
        "longitude": -73.9712,
        "address": "1000 5th Avenue, Upper East Side, NY",
        "contact_phone": "+1 (212) 555-0111",
        "contact_email": "transfusion@universitymed.edu",
        "safety_reserve_units": 20,
        "is_active": True
    },
    {
        "id": 5,
        "code": "MGH-05",
        "name": "Mercy General Community Hospital",
        "facility_type": "Community Hospital",
        "latitude": 40.6782,
        "longitude": -73.9442,
        "address": "320 Eastern Parkway, Brooklyn, NY",
        "contact_phone": "+1 (718) 555-0165",
        "contact_email": "bloodops@mercygeneral.org",
        "safety_reserve_units": 8,
        "is_active": True
    },
    {
        "id": 6,
        "code": "HCH-06",
        "name": "Harbor Pediatric & Urgent Care",
        "facility_type": "Specialty Center",
        "latitude": 40.7024,
        "longitude": -73.9875,
        "address": "55 Water Street, DUMBO, Brooklyn, NY",
        "contact_phone": "+1 (718) 555-0123",
        "contact_email": "pediatric-blood@harborurgent.org",
        "safety_reserve_units": 6,
        "is_active": True
    },
    {
        "id": 7,
        "code": "BEH-07",
        "name": "Bayview Emergency Dispatch Hub",
        "facility_type": "Mobile Logistics Depot",
        "latitude": 40.7505,
        "longitude": -74.0014,
        "address": "Hudson Yards Depot, Pier 76, NY",
        "contact_phone": "+1 (212) 555-0176",
        "contact_email": "dispatch@bayviewemergency.org",
        "safety_reserve_units": 12,
        "is_active": True
    }
]

# Configurable travel time matrix in minutes
TRAVEL_TIME_MATRIX = {
    (1, 2): 18.0, (2, 1): 18.0,
    (1, 3): 14.0, (3, 1): 14.0,
    (1, 4): 22.0, (4, 1): 22.0,
    (1, 5): 28.0, (5, 1): 28.0,
    (1, 6): 20.0, (6, 1): 20.0,
    (1, 7): 16.0, (7, 1): 16.0,
    
    (2, 3): 24.0, (3, 2): 24.0,
    (2, 4): 15.0, (4, 2): 15.0,
    (2, 5): 34.0, (5, 2): 34.0,
    (2, 6): 26.0, (6, 2): 26.0,
    (2, 7): 12.0, (7, 2): 12.0,

    (3, 4): 30.0, (4, 3): 30.0,
    (3, 5): 18.0, (5, 3): 18.0,
    (3, 6): 12.0, (6, 3): 12.0,
    (3, 7): 20.0, (7, 3): 20.0,

    (4, 5): 42.0, (5, 4): 42.0,
    (4, 6): 35.0, (6, 4): 35.0,
    (4, 7): 22.0, (7, 4): 22.0,

    (5, 6): 16.0, (6, 5): 16.0,
    (5, 7): 32.0, (7, 5): 32.0,

    (6, 7): 25.0, (7, 6): 25.0,
}

def seed_database(db: Session, force: bool = False):
    """
    Idempotent deterministic seeder populating facilities, inventory,
    demands, initial alerts, and audit logs.
    """
    if not force and db.query(Facility).first():
        return  # already seeded

    # Clear existing if force
    if force:
        db.query(Alert).delete()
        db.query(Transfer).delete()
        db.query(DemandRecord).delete()
        db.query(TraceabilityEvent).delete()
        db.query(InventoryItem).delete()
        db.query(Facility).delete()
        db.query(Scenario).delete()
        db.query(AuditLog).delete()
        db.commit()

    # 1. Insert Facilities
    facilities_map = {}
    for f_data in FACILITIES_DATA:
        fac = Facility(**f_data)
        db.add(fac)
        facilities_map[fac.id] = fac
    db.commit()

    now = datetime.utcnow()

    # 2. Seed Inventory Items with varied expiries and quantities
    # Designed specifically so:
    # - Facility 2 (Regional Blood Center) has ample surplus O- & O+ RBC
    # - Facility 5 (Mercy General) has 2 near-expiry units (18h and 46h remaining)
    # - Facility 4 (University Hospital) has surplus Platelets & Plasma
    # - Facility 1 (Metro Trauma) has low stock (< reserve)
    inventory_specs = [
        # Regional Blood Center (Hub with surplus stock)
        {"f_id": 2, "group": "O-", "comp": "Red Blood Cells", "qty": 18, "exp_hours": 360, "batch": "B-RBC-O-201"},
        {"f_id": 2, "group": "O+", "comp": "Red Blood Cells", "qty": 35, "exp_hours": 480, "batch": "B-RBC-OP-202"},
        {"f_id": 2, "group": "A+", "comp": "Red Blood Cells", "qty": 28, "exp_hours": 400, "batch": "B-RBC-AP-203"},
        {"f_id": 2, "group": "A-", "comp": "Red Blood Cells", "qty": 14, "exp_hours": 240, "batch": "B-RBC-AN-204"},
        {"f_id": 2, "group": "AB+", "comp": "Fresh Frozen Plasma", "qty": 20, "exp_hours": 720, "batch": "B-FFP-AB-205"},
        {"f_id": 2, "group": "B+", "comp": "Platelets", "qty": 12, "exp_hours": 96, "batch": "B-PLT-BP-206"},

        # Metro Central Trauma Center (Severe shortage of O- & O+ RBC)
        {"f_id": 1, "group": "O-", "comp": "Red Blood Cells", "qty": 2, "exp_hours": 120, "batch": "B-RBC-O-101"},
        {"f_id": 1, "group": "O+", "comp": "Red Blood Cells", "qty": 5, "exp_hours": 180, "batch": "B-RBC-OP-102"},
        {"f_id": 1, "group": "A+", "comp": "Red Blood Cells", "qty": 8, "exp_hours": 210, "batch": "B-RBC-AP-103"},
        {"f_id": 1, "group": "B+", "comp": "Fresh Frozen Plasma", "qty": 10, "exp_hours": 600, "batch": "B-FFP-BP-104"},

        # Mercy General (Has near-expiry batches risking waste!)
        {"f_id": 5, "group": "O-", "comp": "Red Blood Cells", "qty": 4, "exp_hours": 18.5, "batch": "B-RBC-O-501"},  # Urgent alert (<24h)
        {"f_id": 5, "group": "A+", "comp": "Platelets", "qty": 6, "exp_hours": 42.0, "batch": "B-PLT-AP-502"},       # Approaching alert (<72h)
        {"f_id": 5, "group": "B-", "comp": "Red Blood Cells", "qty": 7, "exp_hours": 300, "batch": "B-RBC-BN-503"},

        # University Academic Medical Center (Surplus Platelets & Plasma)
        {"f_id": 4, "group": "AB+", "comp": "Fresh Frozen Plasma", "qty": 22, "exp_hours": 900, "batch": "B-FFP-AB-401"},
        {"f_id": 4, "group": "O+", "comp": "Platelets", "qty": 15, "exp_hours": 110, "batch": "B-PLT-OP-402"},
        {"f_id": 4, "group": "A-", "comp": "Red Blood Cells", "qty": 16, "exp_hours": 320, "batch": "B-RBC-AN-403"},

        # St. Jude Memorial (Moderate stock)
        {"f_id": 3, "group": "O+", "comp": "Red Blood Cells", "qty": 12, "exp_hours": 260, "batch": "B-RBC-OP-301"},
        {"f_id": 3, "group": "B+", "comp": "Red Blood Cells", "qty": 9, "exp_hours": 220, "batch": "B-RBC-BP-302"},
        {"f_id": 3, "group": "AB-", "comp": "Cryoprecipitate", "qty": 8, "exp_hours": 800, "batch": "B-CRY-AB-303"},

        # Harbor Pediatric Center (Short on O- & Platelets)
        {"f_id": 6, "group": "O-", "comp": "Red Blood Cells", "qty": 2, "exp_hours": 140, "batch": "B-RBC-O-601"},
        {"f_id": 6, "group": "A+", "comp": "Whole Blood", "qty": 5, "exp_hours": 280, "batch": "B-WBL-AP-602"},

        # Bayview Logistics Hub (Reserve buffer)
        {"f_id": 7, "group": "O+", "comp": "Red Blood Cells", "qty": 14, "exp_hours": 380, "batch": "B-RBC-OP-701"},
        {"f_id": 7, "group": "O-", "comp": "Red Blood Cells", "qty": 6, "exp_hours": 320, "batch": "B-RBC-O-702"}
    ]

    saved_items = []
    for spec in inventory_specs:
        tid = f"LL-{spec['group'].replace('+', 'POS').replace('-', 'NEG')}-{spec['batch'][-3:]}-{uuid.uuid4().hex[:4].upper()}"
        col_date = now - timedelta(days=7)
        exp_date = now + timedelta(hours=spec["exp_hours"])
        
        qr_svg = generate_qr_svg_or_base64(tid)

        item = InventoryItem(
            tracking_id=tid,
            facility_id=spec["f_id"],
            blood_group=spec["group"],
            component_type=spec["comp"],
            quantity=spec["qty"],
            batch_ref=spec["batch"],
            collection_date=col_date,
            expiry_date=exp_date,
            status="available",
            storage_temp_c=4.0 if "Platelet" not in spec["comp"] else 22.0,
            qr_code_svg=qr_svg,
            created_at=col_date
        )
        db.add(item)
        saved_items.append((item, spec))

    db.commit()

    # 3. Add initial traceability event for each unit
    for item, spec in saved_items:
        fac = facilities_map.get(spec["f_id"])
        ev = TraceabilityEvent(
            inventory_item_id=item.id,
            event_type="collection_verified",
            facility_name=fac.name if fac else "Blood Center",
            operator="System Initializer",
            details=f"Batch {spec['batch']} cold-chain validated at {item.storage_temp_c}°C. Barcode tag applied.",
            timestamp=item.collection_date
        )
        db.add(ev)
    db.commit()

    # 4. Seed Demands
    # Urgent demands at Metro Trauma Center and Harbor Pediatric:
    demands_data = [
        # Metro Trauma Center has high critical demand for O- & O+ RBC
        {
            "facility_id": 1,
            "blood_group": "O-",
            "component_type": "Red Blood Cells",
            "quantity_needed": 6,
            "urgency": "critical",
            "deadline_hours": 4.0,
            "status": "unmet",
            "is_simulated": False
        },
        {
            "facility_id": 1,
            "blood_group": "O+",
            "component_type": "Red Blood Cells",
            "quantity_needed": 8,
            "urgency": "urgent",
            "deadline_hours": 6.0,
            "status": "unmet",
            "is_simulated": False
        },
        # Harbor Pediatric needs Platelets
        {
            "facility_id": 6,
            "blood_group": "A+",
            "component_type": "Platelets",
            "quantity_needed": 4,
            "urgency": "urgent",
            "deadline_hours": 8.0,
            "status": "unmet",
            "is_simulated": False
        },
        # St. Jude Memorial needs O- RBC
        {
            "facility_id": 3,
            "blood_group": "O-",
            "component_type": "Red Blood Cells",
            "quantity_needed": 3,
            "urgency": "routine",
            "deadline_hours": 12.0,
            "status": "unmet",
            "is_simulated": False
        }
    ]

    for d_data in demands_data:
        dem = DemandRecord(**d_data)
        db.add(dem)
    db.commit()

    # 5. Seed default Scenario
    default_scenario = Scenario(
        scenario_id="DEFAULT-BASE",
        name="Metropolitan Standard Operating Distribution",
        description="Baseline synthetic metropolitan blood network with typical elective surgery demand, regional surplus at Blood Bank, and impending expiry risk in Brooklyn.",
        status="idle",
        events_json="[]",
        created_at=now
    )
    db.add(default_scenario)

    # 6. Seed initial audit log
    audit = AuditLog(
        action="SYSTEM_INITIALIZED",
        actor="System",
        entity_type="Database",
        entity_id="ALL",
        details="Deterministic seed database generated with 7 facilities, 20 batches, 4 demand profiles.",
        timestamp=now
    )
    db.add(audit)
    db.commit()

    # 7. Run initial expiry alerts
    from .services.expiry_service import evaluate_expiry_alerts
    evaluate_expiry_alerts(db)

    print("Deterministic seed data successfully loaded into SQLite.")
