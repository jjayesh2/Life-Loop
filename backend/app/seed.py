import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .models import (
    Facility, User, Driver, InventoryItem, EmergencyRequest,
    DemandRecord, Transfer, TemperatureLog, Alert, TraceabilityEvent,
    AuditLog, Scenario
)
from .services.traceability_service import generate_qr_svg_or_base64

# Verified Real Nashik Healthcare Facilities
# 7 Live-Connected Life-Loop Nodes + 5 Public Directory Listings
NASHIK_FACILITIES = [
    {
        "id": 1,
        "code": "NMC-DIST-01",
        "name": "District Civil Hospital & Regional Blood Center",
        "facility_type": "District Civil Hospital & Regional Blood Bank",
        "latitude": 19.9972,
        "longitude": 73.7850,
        "address": "Hospital Road, Shalimar, Nashik - 422001",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422001",
        "contact_phone": "+91 253 257 2038",
        "contact_email": "civilhospital.nashik@maharashtra.gov.in",
        "source_url": "https://nashik.gov.in/en/public-utility-category/hospitals/",
        "date_verified": "2026-03-15",
        "verification_status": "Govt Verified & Connected",
        "is_connected": True,
        "safety_reserve_units": 20,
        "is_active": True
    },
    {
        "id": 2,
        "code": "NMC-ARPAN-02",
        "name": "Arpan Blood Bank & Component Separation Unit",
        "facility_type": "Charitable Dedicated Blood Bank",
        "latitude": 19.9925,
        "longitude": 73.7820,
        "address": "Opposite Rajiv Gandhi Bhavan, Sharanpur Road, Nashik - 422002",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422002",
        "contact_phone": "+91 253 257 5555",
        "contact_email": "arpanbloodbank@rediffmail.com",
        "source_url": "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/transactions/bbpublicindex.html",
        "date_verified": "2026-03-20",
        "verification_status": "e-RaktKosh Certified Hub",
        "is_connected": True,
        "safety_reserve_units": 30,
        "is_active": True
    },
    {
        "id": 3,
        "code": "NMC-JKP-03",
        "name": "Jankalyan Raktpedhi Nashik",
        "facility_type": "Regional Blood Bank & Apheresis Center",
        "latitude": 20.0041,
        "longitude": 73.7689,
        "address": "Near Canada Corner, Gangapur Road, Nashik - 422005",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422005",
        "contact_phone": "+91 253 231 6688",
        "contact_email": "jankalyan.nashik@raktpedhi.org",
        "source_url": "https://eraktkosh.mohfw.gov.in/",
        "date_verified": "2026-03-22",
        "verification_status": "NABH Accredited & Connected",
        "is_connected": True,
        "safety_reserve_units": 25,
        "is_active": True
    },
    {
        "id": 4,
        "code": "NMC-APOLLO-04",
        "name": "Apollo Hospitals Nashik",
        "facility_type": "Tertiary Multi-Specialty Hospital & Trauma Center",
        "latitude": 19.9722,
        "longitude": 73.8055,
        "address": "Swaminarayan Nagar, Panchavati, Nashik - 422003",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422003",
        "contact_phone": "+91 253 230 3030",
        "contact_email": "emergency.nashik@apollohospitals.com",
        "source_url": "https://nashik.gov.in/en/public-utilities/hospitals/",
        "date_verified": "2026-03-10",
        "verification_status": "Connected Hospital Node",
        "is_connected": True,
        "safety_reserve_units": 15,
        "is_active": True
    },
    {
        "id": 5,
        "code": "NMC-WOCK-05",
        "name": "Wockhardt Hospitals Nashik",
        "facility_type": "Super Specialty Care & Emergency Center",
        "latitude": 19.9880,
        "longitude": 73.7745,
        "address": "Wani House, Near Mumbai Naka, Nashik - 422001",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422001",
        "contact_phone": "+91 253 662 4444",
        "contact_email": "transfusion@wockhardthospitals.com",
        "source_url": "https://nashik.gov.in/en/public-utilities/hospitals/",
        "date_verified": "2026-03-12",
        "verification_status": "Connected Hospital Node",
        "is_connected": True,
        "safety_reserve_units": 12,
        "is_active": True
    },
    {
        "id": 6,
        "code": "NMC-MVP-06",
        "name": "Dr. Vasantrao Pawar Medical College Hospital (MVP Adgaon)",
        "facility_type": "Tertiary Medical College & Teaching Hospital",
        "latitude": 20.0385,
        "longitude": 73.8340,
        "address": "Vasantdada Nagar, Adgaon, Mumbai-Agra Highway, Nashik - 422003",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422003",
        "contact_phone": "+91 253 230 3802",
        "contact_email": "bloodbank@mvpmc.edu.in",
        "source_url": "https://nashik.gov.in/en/public-utilities/hospitals/",
        "date_verified": "2026-03-18",
        "verification_status": "Teaching Hospital & Blood Bank",
        "is_connected": True,
        "safety_reserve_units": 18,
        "is_active": True
    },
    {
        "id": 7,
        "code": "NMC-BYTCO-07",
        "name": "NMC Bytco Multi-Speciality Hospital Nashik Road",
        "facility_type": "Municipal General Hospital",
        "latitude": 19.9535,
        "longitude": 73.8375,
        "address": "Nashik-Pune Road, Nashik Road, Nashik - 422101",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422101",
        "contact_phone": "+91 253 246 5432",
        "contact_email": "bytcohospital@nmc.gov.in",
        "source_url": "https://nashik.gov.in/en/public-utilities/hospitals/",
        "date_verified": "2026-03-14",
        "verification_status": "Municipal Hospital Node",
        "is_connected": True,
        "safety_reserve_units": 10,
        "is_active": True
    },
    # 5 Verified Public Directory Listings (Not yet live-connected to automated dispatch)
    {
        "id": 8,
        "code": "PUB-ZHUS-08",
        "name": "Dr. Zakir Hussain Municipal Hospital",
        "facility_type": "Municipal Hospital",
        "latitude": 20.0110,
        "longitude": 73.7915,
        "address": "Kathada, Old Nashik, Nashik - 422001",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422001",
        "contact_phone": "+91 253 257 3344",
        "contact_email": "zakirhussain@nmc.gov.in",
        "source_url": "https://nashik.gov.in/en/public-utility-category/hospitals/",
        "date_verified": "2026-03-25",
        "verification_status": "Public Directory Listing",
        "is_connected": False,
        "safety_reserve_units": 8,
        "is_active": True
    },
    {
        "id": 9,
        "code": "PUB-SAHY-09",
        "name": "Sahyadri Super Speciality Hospital Nashik",
        "facility_type": "Super Specialty Hospital",
        "latitude": 19.9860,
        "longitude": 73.7620,
        "address": "Wadala Naka, Mumbai Naka, Nashik - 422002",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422002",
        "contact_phone": "+91 253 671 9999",
        "contact_email": "contact@sahyadrihospitals.com",
        "source_url": "https://nashik.gov.in/en/public-utility-category/hospitals/",
        "date_verified": "2026-03-25",
        "verification_status": "Public Directory Listing",
        "is_connected": False,
        "safety_reserve_units": 10,
        "is_active": True
    },
    {
        "id": 10,
        "code": "PUB-HCGM-10",
        "name": "HCG Manavata Cancer Centre",
        "facility_type": "Specialty Oncology Center",
        "latitude": 19.9810,
        "longitude": 73.7710,
        "address": "Near Mahamarg Bus Stand, Mumbai Naka, Nashik - 422002",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422002",
        "contact_phone": "+91 253 222 7100",
        "contact_email": "manavata@hcgoncology.com",
        "source_url": "https://nashik.gov.in/en/public-utility-category/hospitals/",
        "date_verified": "2026-03-25",
        "verification_status": "Public Directory Listing",
        "is_connected": False,
        "safety_reserve_units": 6,
        "is_active": True
    },
    {
        "id": 11,
        "code": "PUB-REDC-11",
        "name": "Indian Red Cross Society Blood Centre Nashik",
        "facility_type": "Red Cross Blood Bank",
        "latitude": 20.0015,
        "longitude": 73.7845,
        "address": "Red Cross Building, MG Road, Shalimar, Nashik - 422001",
        "city": "Nashik",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "422001",
        "contact_phone": "+91 253 257 8899",
        "contact_email": "redcrossnashik@gmail.com",
        "source_url": "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/transactions/bbpublicindex.html",
        "date_verified": "2026-03-25",
        "verification_status": "Public Directory Listing",
        "is_connected": False,
        "safety_reserve_units": 15,
        "is_active": True
    },
    {
        "id": 12,
        "code": "PUB-MALG-12",
        "name": "Sub-District Hospital Malegaon",
        "facility_type": "Rural Sub-District Hospital",
        "latitude": 20.5530,
        "longitude": 74.5290,
        "address": "Camp Road, Malegaon, Nashik District - 423203",
        "city": "Malegaon",
        "district": "Nashik",
        "state": "Maharashtra",
        "pincode": "423203",
        "contact_phone": "+91 2554 232 101",
        "contact_email": "sdh.malegaon@maharashtra.gov.in",
        "source_url": "https://nashik.gov.in/en/public-utility-category/hospitals/",
        "date_verified": "2026-03-25",
        "verification_status": "District Outpost (Public Directory)",
        "is_connected": False,
        "safety_reserve_units": 12,
        "is_active": True
    }
]

# Realistic Travel Times in Minutes across Nashik Urban Network
TRAVEL_TIME_MATRIX = {
    (1, 2): 8.0, (2, 1): 8.0,
    (1, 3): 10.0, (3, 1): 10.0,
    (1, 4): 16.0, (4, 1): 16.0,
    (1, 5): 11.0, (5, 1): 11.0,
    (1, 6): 22.0, (6, 1): 22.0,
    (1, 7): 24.0, (7, 1): 24.0,
    (2, 3): 7.0, (3, 2): 7.0,
    (2, 4): 18.0, (4, 2): 18.0,
    (2, 5): 9.0, (5, 2): 9.0,
    (2, 6): 20.0, (6, 2): 20.0,
    (2, 7): 21.0, (7, 2): 21.0,
    (3, 4): 19.0, (4, 3): 19.0,
    (3, 5): 12.0, (5, 3): 12.0,
    (3, 6): 18.0, (6, 3): 18.0,
    (3, 7): 25.0, (7, 3): 25.0,
    (4, 5): 15.0, (5, 4): 15.0,
    (4, 6): 12.0, (6, 4): 12.0,
    (4, 7): 20.0, (7, 4): 20.0,
    (5, 6): 22.0, (6, 5): 22.0,
    (5, 7): 16.0, (7, 5): 16.0,
    (6, 7): 28.0, (7, 6): 28.0,
}

# Distance in kilometers across Nashik
DISTANCE_MATRIX_KM = {
    (1, 2): 2.5, (2, 1): 2.5,
    (1, 3): 3.2, (3, 1): 3.2,
    (1, 4): 6.8, (4, 1): 6.8,
    (1, 5): 4.1, (5, 1): 4.1,
    (1, 6): 9.5, (6, 1): 9.5,
    (1, 7): 10.2, (7, 1): 10.2,
    (2, 3): 2.1, (3, 2): 2.1,
    (2, 4): 7.2, (4, 2): 7.2,
    (2, 5): 3.0, (5, 2): 3.0,
    (2, 6): 8.8, (6, 2): 8.8,
    (2, 7): 9.5, (7, 2): 9.5,
    (3, 4): 8.0, (4, 3): 8.0,
    (3, 5): 4.5, (5, 3): 4.5,
    (3, 6): 7.9, (6, 3): 7.9,
    (3, 7): 11.0, (7, 3): 11.0,
    (4, 5): 6.1, (5, 4): 6.1,
    (4, 6): 4.5, (6, 4): 4.5,
    (4, 7): 8.5, (7, 4): 8.5,
    (5, 6): 9.2, (6, 5): 9.2,
    (5, 7): 6.5, (7, 5): 6.5,
    (6, 7): 12.5, (7, 6): 12.5,
}

# Verified Hackathon Demo Personas
DEMO_USERS = [
    {
        "id": 1,
        "email": "admin@lifeloop.org",
        "name": "Dr. Ramesh Deshmukh (Nashik District Admin)",
        "role": "admin",
        "facility_id": 1,
        "phone": "+91 98220 11001"
    },
    {
        "id": 2,
        "email": "dr.patil@apollo.nashik.org",
        "name": "Dr. Smita Patil (Emergency Lead, Apollo Nashik)",
        "role": "hospital_staff",
        "facility_id": 4,
        "phone": "+91 98220 22002"
    },
    {
        "id": 3,
        "email": "dr.more@civil.nashik.org",
        "name": "Dr. Anand More (Civil Hospital Trauma Head)",
        "role": "hospital_staff",
        "facility_id": 1,
        "phone": "+91 98220 33003"
    },
    {
        "id": 4,
        "email": "officer@arpanbloodbank.org",
        "name": "Dr. Milind Joshi (Senior Officer, Arpan Blood Bank)",
        "role": "blood_bank_officer",
        "facility_id": 2,
        "phone": "+91 98220 44004"
    },
    {
        "id": 5,
        "email": "officer@jankalyan.org",
        "name": "Sunita Kulkarni (Quality Manager, Jankalyan Raktpedhi)",
        "role": "blood_bank_officer",
        "facility_id": 3,
        "phone": "+91 98220 55005"
    },
    {
        "id": 6,
        "email": "courier1@lifeloop.org",
        "name": "Suresh Shinde (Nashik Express Courier 01)",
        "role": "driver",
        "facility_id": None,
        "phone": "+91 98220 66006",
        "vehicle_type": "Cold-Van Insulated",
        "vehicle_number": "MH-15-EG-4401"
    },
    {
        "id": 7,
        "email": "courier2@lifeloop.org",
        "name": "Ganesh Pawar (Two-Wheeler STAT Courier 02)",
        "role": "driver",
        "facility_id": None,
        "phone": "+91 98220 77007",
        "vehicle_type": "Two-Wheeler Medical Cryo-Box",
        "vehicle_number": "MH-15-DX-9912"
    }
]

def seed_database(db: Session, force: bool = False):
    """
    Deterministic seeder populating Nashik facilities, demo accounts,
    drivers, tracked inventory batches, demand records, and alerts.
    """
    if not force and db.query(Facility).first():
        return  # already seeded

    if force:
        db.query(TemperatureLog).delete()
        db.query(Alert).delete()
        db.query(Transfer).delete()
        db.query(EmergencyRequest).delete()
        db.query(DemandRecord).delete()
        db.query(TraceabilityEvent).delete()
        db.query(InventoryItem).delete()
        db.query(Driver).delete()
        db.query(User).delete()
        db.query(Facility).delete()
        db.query(Scenario).delete()
        db.query(AuditLog).delete()
        db.commit()

    # 1. Seed Facilities
    fac_map = {}
    for f_data in NASHIK_FACILITIES:
        fac = Facility(**f_data)
        db.add(fac)
        fac_map[fac.id] = fac
    db.commit()

    # 2. Seed Users & Drivers
    user_map = {}
    for u_data in DEMO_USERS:
        v_type = u_data.get("vehicle_type")
        v_num = u_data.get("vehicle_number")
        u_dict = {
            "id": u_data["id"],
            "email": u_data["email"],
            "name": u_data["name"],
            "role": u_data["role"],
            "facility_id": u_data["facility_id"],
            "phone": u_data["phone"]
        }
        user = User(**u_dict)
        db.add(user)
        db.commit()
        user_map[user.id] = user

        if u_data["role"] == "driver":
            driver = Driver(
                user_id=user.id,
                name=user.name,
                phone=user.phone or "+91 98220 00000",
                vehicle_type=v_type or "Cold-Van",
                vehicle_number=v_num or "MH-15-BL-1001",
                current_lat=19.9975,
                current_lng=73.7898,
                status="available"
            )
            db.add(driver)
            db.commit()

    now = datetime.utcnow()

    # 3. Seed Tracked Inventory Batches (Synthetic demo stock with clear status)
    # Designed with specific conditions:
    # - Arpan Blood Bank (Facility 2): Ample stock of O-, O+, A+ RBC
    # - Jankalyan Raktpedhi (Facility 3): Surplus Platelets & FFP
    # - District Civil Hospital (Facility 1): Approaching expiry O- batch (22h remaining) triggering 24h alert
    # - Apollo Nashik (Facility 4): Facing critical trauma shortage
    inventory_specs = [
        # Facility 2: Arpan Blood Bank (Regional Component Hub)
        {"f_id": 2, "group": "O-", "comp": "Red Blood Cells", "qty": 14, "exp_hours": 360, "batch": "B-NK-RBC-O-201"},
        {"f_id": 2, "group": "O+", "comp": "Red Blood Cells", "qty": 30, "exp_hours": 420, "batch": "B-NK-RBC-OP-202"},
        {"f_id": 2, "group": "A+", "comp": "Red Blood Cells", "qty": 25, "exp_hours": 380, "batch": "B-NK-RBC-AP-203"},
        {"f_id": 2, "group": "B+", "comp": "Red Blood Cells", "qty": 18, "exp_hours": 300, "batch": "B-NK-RBC-BP-204"},
        {"f_id": 2, "group": "AB+", "comp": "Fresh Frozen Plasma", "qty": 15, "exp_hours": 720, "batch": "B-NK-FFP-AB-205"},

        # Facility 3: Jankalyan Raktpedhi (Platelet & Apheresis Hub)
        {"f_id": 3, "group": "O+", "comp": "Platelets", "qty": 16, "exp_hours": 96, "batch": "B-NK-PLT-OP-301"},
        {"f_id": 3, "group": "A+", "comp": "Platelets", "qty": 12, "exp_hours": 44, "batch": "B-NK-PLT-AP-302"},  # 44h alert (<48h)
        {"f_id": 3, "group": "B+", "comp": "Red Blood Cells", "qty": 20, "exp_hours": 340, "batch": "B-NK-RBC-BP-303"},
        {"f_id": 3, "group": "AB-", "comp": "Cryoprecipitate", "qty": 8, "exp_hours": 600, "batch": "B-NK-CRY-AB-304"},

        # Facility 1: District Civil Hospital (Trauma Center with 22h near-expiry batch)
        {"f_id": 1, "group": "O-", "comp": "Red Blood Cells", "qty": 3, "exp_hours": 22.0, "batch": "B-NK-RBC-O-101"}, # 22h urgent alert (<24h)
        {"f_id": 1, "group": "O+", "comp": "Red Blood Cells", "qty": 6, "exp_hours": 180, "batch": "B-NK-RBC-OP-102"},
        {"f_id": 1, "group": "A-", "comp": "Red Blood Cells", "qty": 4, "exp_hours": 240, "batch": "B-NK-RBC-AN-103"},
        {"f_id": 1, "group": "B+", "comp": "Fresh Frozen Plasma", "qty": 10, "exp_hours": 600, "batch": "B-NK-FFP-BP-104"},

        # Facility 4: Apollo Hospitals Nashik (Low stock, high ICU demand)
        {"f_id": 4, "group": "O+", "comp": "Red Blood Cells", "qty": 4, "exp_hours": 200, "batch": "B-NK-RBC-OP-401"},
        {"f_id": 4, "group": "A+", "comp": "Red Blood Cells", "qty": 5, "exp_hours": 220, "batch": "B-NK-RBC-AP-402"},
        {"f_id": 4, "group": "B+", "comp": "Platelets", "qty": 4, "exp_hours": 80, "batch": "B-NK-PLT-BP-403"},

        # Facility 5: Wockhardt Hospitals (Moderate stock)
        {"f_id": 5, "group": "O+", "comp": "Red Blood Cells", "qty": 8, "exp_hours": 250, "batch": "B-NK-RBC-OP-501"},
        {"f_id": 5, "group": "AB+", "comp": "Fresh Frozen Plasma", "qty": 12, "exp_hours": 800, "batch": "B-NK-FFP-AB-502"},

        # Facility 6: MVP Adgaon Teaching Hospital
        {"f_id": 6, "group": "O-", "comp": "Red Blood Cells", "qty": 5, "exp_hours": 280, "batch": "B-NK-RBC-O-601"},
        {"f_id": 6, "group": "A+", "comp": "Red Blood Cells", "qty": 14, "exp_hours": 320, "batch": "B-NK-RBC-AP-602"},

        # Facility 7: NMC Bytco Hospital Nashik Road
        {"f_id": 7, "group": "O+", "comp": "Red Blood Cells", "qty": 7, "exp_hours": 290, "batch": "B-NK-RBC-OP-701"}
    ]

    saved_items = []
    for spec in inventory_specs:
        tid = f"LL-NSK-{spec['group'].replace('+', 'POS').replace('-', 'NEG')}-{spec['batch'][-3:]}-{uuid.uuid4().hex[:4].upper()}"
        col_date = now - timedelta(days=6)
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

    # 4. Traceability Events
    for item, spec in saved_items:
        fac = fac_map.get(spec["f_id"])
        ev = TraceabilityEvent(
            inventory_item_id=item.id,
            event_type="collection_verified",
            facility_name=fac.name if fac else "Nashik Blood Center",
            operator="Nashik Blood Bank Officer",
            details=f"Batch {spec['batch']} cold-chain validated at {item.storage_temp_c}°C. Barcode tag applied.",
            timestamp=item.collection_date
        )
        db.add(ev)
    db.commit()

    # 5. Seed Demands
    # Emergency Demand at Apollo Hospitals (Needs 8 units O- Red Blood Cells)
    # Severe Shortage at Civil Hospital (Needs 6 units O+ Red Blood Cells)
    demands_data = [
        {
            "facility_id": 4, # Apollo Hospitals
            "blood_group": "O-",
            "component_type": "Red Blood Cells",
            "quantity_needed": 8,
            "urgency": "critical",
            "deadline_hours": 3.0,
            "status": "unmet",
            "is_simulated": True
        },
        {
            "facility_id": 4, # Apollo Hospitals
            "blood_group": "A+",
            "component_type": "Platelets",
            "quantity_needed": 4,
            "urgency": "urgent",
            "deadline_hours": 6.0,
            "status": "unmet",
            "is_simulated": True
        },
        {
            "facility_id": 1, # District Civil Hospital
            "blood_group": "O+",
            "component_type": "Red Blood Cells",
            "quantity_needed": 6,
            "urgency": "urgent",
            "deadline_hours": 8.0,
            "status": "unmet",
            "is_simulated": True
        }
    ]
    for d_data in demands_data:
        db.add(DemandRecord(**d_data))
    db.commit()

    # 6. Seed Initial Expiry Alerts (48h and 24h triggers)
    # Item at Civil Hospital with 22h remaining:
    civil_item = db.query(InventoryItem).filter(InventoryItem.facility_id == 1, InventoryItem.batch_ref == "B-NK-RBC-O-101").first()
    if civil_item:
        al1 = Alert(
            facility_id=1,
            inventory_item_id=civil_item.id,
            alert_type="urgent_expiry",
            severity="critical",
            message=f"CRITICAL 24H ALERT: Batch B-NK-RBC-O-101 (O- Red Blood Cells) expires in 22.0 hours at District Civil Hospital. Immediate redistribution recommended.",
            hours_remaining=22.0,
            status="active",
            email_delivery_status="Alert SMS Dispatched to Dr. Anand More (+91 98220 33003)"
        )
        db.add(al1)

    # Item at Jankalyan with 44h remaining:
    jk_item = db.query(InventoryItem).filter(InventoryItem.facility_id == 3, InventoryItem.batch_ref == "B-NK-PLT-AP-302").first()
    if jk_item:
        al2 = Alert(
            facility_id=3,
            inventory_item_id=jk_item.id,
            alert_type="approaching_expiry",
            severity="warning",
            message=f"ADVANCE 48H ALERT: Batch B-NK-PLT-AP-302 (A+ Platelets) expires in 44.0 hours at Jankalyan Raktpedhi. Safe usage window active.",
            hours_remaining=44.0,
            status="active",
            email_delivery_status="Alert Logged on Jankalyan Dashboard"
        )
        db.add(al2)
    db.commit()

    # 7. Seed Initial Audit Log
    db.add(AuditLog(
        action="SYSTEM_INIT_NASHIK",
        actor="System Initializer",
        entity_type="SYSTEM",
        entity_id="NASHIK_HUB",
        details="Nashik Blood Supply Chain Network initialized with 12 verified healthcare nodes, 7 connected centers, and MILP optimization models."
    ))
    db.commit()
