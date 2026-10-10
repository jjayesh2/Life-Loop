import os
import sys
import pytest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import Facility, InventoryItem, DemandRecord, Transfer, EmergencyRequest
from app.seed import seed_database

TEST_DB_URL = "sqlite:///./test_cross_device.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db, force=True)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_cross_device.db"):
        try:
            os.remove("./test_cross_device.db")
        except Exception:
            pass

client = TestClient(app)

def test_cross_device_emergency_workflow():
    """
    Simulates:
    1. Hospital 1 (facility 1) creates STAT Emergency Request for 4 units of O- Red Blood Cells.
    2. Hospital 2 (facility 4) queries /api/emergency-requests and sees Hospital 1's request with is_requester=False.
    3. Blood Bank (facility 2) queries /api/emergency-requests and sees it as an eligible supplier.
    4. Proposed transfer is created / approved for 2 units (partial fulfillment).
    5. Inventory reserved_quantity updates atomically, request remaining_needed drops to 2, status becomes partially_approved.
    6. Deduplication check verifies that immediate duplicate submissions within 30s are caught.
    """
    # 1. Hospital 1 creates STAT emergency request
    create_payload = {
        "requesting_facility_id": 1,
        "blood_group": "O-",
        "component_type": "Red Blood Cells",
        "quantity_needed": 4,
        "urgency": "critical",
        "required_by_hours": 2,
        "delivery_destination": "ICU Trauma Bay 1",
        "notes": "Severe poly-trauma MVA victim"
    }

    res_create = client.post("/api/emergency-requests", json=create_payload)
    assert res_create.status_code == 200, f"Error: {res_create.text}"
    req_data = res_create.json()
    req_id = req_data["id"]
    req_code = req_data["request_id"]
    assert req_code.startswith("REQ-")
    assert req_data["quantity_needed"] == 4
    assert req_data["status"] == "success"
    assert req_data["request_status"] in ["submitted", "proposed"]

    # Deduplication test: re-submitting identical payload immediately returns existing request
    res_dup = client.post("/api/emergency-requests", json=create_payload)
    assert res_dup.status_code == 200
    assert res_dup.json()["id"] == req_id

    # 2. Hospital 2 (facility 4) queries /api/emergency-requests
    res_hosp2 = client.get("/api/emergency-requests?facility_id=4&role=hospital_staff")
    assert res_hosp2.status_code == 200
    hosp2_requests = res_hosp2.json()
    matching_hosp2 = [r for r in hosp2_requests if r["request_id"] == req_code]
    assert len(matching_hosp2) == 1, "Hospital 2 must see Hospital 1's STAT emergency request"
    assert matching_hosp2[0]["is_requester"] is False
    assert matching_hosp2[0]["requesting_facility_id"] == 1

    # 3. Blood Bank (facility 2) queries /api/emergency-requests
    res_bb = client.get("/api/emergency-requests?facility_id=2&role=blood_bank_officer")
    assert res_bb.status_code == 200
    bb_requests = res_bb.json()
    matching_bb = [r for r in bb_requests if r["request_id"] == req_code]
    assert len(matching_bb) == 1, "Blood Bank 2 must see incoming emergency request"
    assert matching_bb[0]["is_eligible_supplier"] is True

    # 4. Find the proposed transfer or create one to simulate partial fulfillment
    db = TestingSessionLocal()
    # Find an available inventory item in facility 2
    item = db.query(InventoryItem).filter(
        InventoryItem.facility_id == 2,
        InventoryItem.blood_group == "O-",
        InventoryItem.component_type == "Red Blood Cells",
        InventoryItem.status == "available"
    ).first()
    assert item is not None, "Facility 2 must have O- Red Blood Cells in test DB"
    initial_reserved = item.reserved_quantity
    item_id = item.id

    transfer = Transfer(
        transfer_id=f"TR-TEST-{req_id}",
        emergency_request_id=req_id,
        origin_facility_id=2,
        destination_facility_id=1,
        inventory_item_id=item_id,
        component_type="Red Blood Cells",
        blood_group="O-",
        quantity=4,
        travel_time_minutes=15.0,
        distance_km=8.5,
        status="proposed"
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    transfer_id = transfer.id
    db.close()

    # 5. Blood Bank partially approves 2 units out of 4
    approve_res = client.post(f"/api/transfers/{transfer_id}/approve?authorized_quantity=2")
    assert approve_res.status_code == 200, f"Approve error: {approve_res.text}"
    approved_transfer = approve_res.json()
    assert approved_transfer["status"] == "success"
    assert approved_transfer["new_status"] == "approved"
    assert approved_transfer["reserved_quantity"] == 2

    # Verify atomic DB updates
    db = TestingSessionLocal()
    refreshed_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    assert refreshed_item.reserved_quantity == initial_reserved + 2

    refreshed_req = db.query(EmergencyRequest).filter(EmergencyRequest.id == req_id).first()
    assert refreshed_req.quantity_fulfilled == 2
    assert refreshed_req.status == "partially_approved"
    db.close()

    # 6. Check updated GET /api/emergency-requests reflects partial fulfillment and remaining needed
    res_hosp1 = client.get("/api/emergency-requests?facility_id=1&role=hospital_staff")
    assert res_hosp1.status_code == 200
    matching_hosp1 = [r for r in res_hosp1.json() if r["request_id"] == req_code][0]
    assert matching_hosp1["quantity_fulfilled"] == 2
    assert matching_hosp1["remaining_needed"] == 2
    assert matching_hosp1["status"] == "partially_approved"
