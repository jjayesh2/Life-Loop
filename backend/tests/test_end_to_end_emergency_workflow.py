import os
import sys
import pytest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app, ensure_schema_compatibility
from app.models import Facility, InventoryItem, DemandRecord, Transfer, EmergencyRequest, FacilityResponse, Driver
from app.seed import seed_database

TEST_DB_URL = "sqlite:///./test_e2e_emergency.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    ensure_schema_compatibility(test_engine)
    db = TestingSessionLocal()
    seed_database(db, force=True)
    db.close()
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_e2e_emergency.db"):
        try:
            os.remove("./test_e2e_emergency.db")
        except Exception:
            pass

client = TestClient(app)

def test_full_emergency_request_to_delivery_lifecycle():
    """
    Verifies the complete 10-step workflow:
    1. Hospital 1 creates request (10 units O- RBC) -> PENDING_RESPONSES.
    2. Hospital 4 and Blood Bank 2 see incoming request.
    3. Hospital 4 rejects -> reason saved, request remains active.
    4. Blood Bank 2 accepts 6 units -> stock atomically reserved, transfer created with ready_for_driver.
    5. Partial acceptance updates remaining shortage to 4.
    6. Over-reservation attempt is blocked with HTTP 400.
    7. Driver assigned to transfer -> status assigned.
    8. Driver confirms pickup -> in_transit.
    9. Driver confirms delivery -> delivered.
    10. Hospital confirms receipt -> completed.
    """
    # 1. Hospital 1 creates request for 10 units O- RBC
    create_payload = {
        "requesting_facility_id": 1,
        "blood_group": "O-",
        "component_type": "Red Blood Cells",
        "quantity_needed": 10,
        "urgency": "critical",
        "required_by_hours": 3,
        "delivery_destination": "District Hospital Emergency ICU",
        "notes": "Mass casualty highway collision"
    }
    res_create = client.post("/api/emergency-requests", json=create_payload)
    assert res_create.status_code == 200
    req_json = res_create.json()
    assert req_json["status"] == "success"
    req_code = req_json["request_id"]
    req_id = req_json["id"]
    assert req_json["request_status"] == "PENDING_RESPONSES"

    # 2. Peer Hospital (Facility 4) queries /api/emergency-requests
    res_hosp4 = client.get("/api/emergency-requests?facility_id=4&role=hospital_staff")
    assert res_hosp4.status_code == 200
    matching_hosp4 = [r for r in res_hosp4.json() if r["request_id"] == req_code][0]
    assert matching_hosp4["is_requester"] is False
    assert matching_hosp4["quantity_needed"] == 10
    assert matching_hosp4["remaining_shortage"] == 10

    # 3. Hospital 4 rejects the request with clinical reason
    res_reject = client.post(
        f"/api/emergency-requests/{req_code}/reject",
        json={"reason": "Stock reserved for planned pediatric cardiac surgeries"},
        headers={"X-Facility-Id": "4", "X-User-Role": "hospital_staff"}
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "success"

    # Verify request is STILL OPEN and not cancelled!
    res_check = client.get(f"/api/emergency-requests/{req_code}?facility_id=4")
    assert res_check.status_code == 200
    req_detail = res_check.json()
    assert req_detail["remaining_shortage"] == 10
    assert req_detail["my_response"]["response_type"] == "rejected"
    assert "cardiac" in req_detail["my_response"]["rejection_reason"]

    # 4. Blood Bank 2 (Arpan Blood Bank) checks available stock
    res_bb = client.get("/api/emergency-requests?facility_id=2&role=blood_bank_officer")
    assert res_bb.status_code == 200
    matching_bb = [r for r in res_bb.json() if r["request_id"] == req_code][0]
    assert matching_bb["is_eligible_supplier"] is True
    assert matching_bb["available_eligible_stock"] >= 6

    # 5. Blood Bank 2 accepts 6 units (partial fulfillment)
    res_accept = client.post(
        f"/api/emergency-requests/{req_code}/accept",
        json={"quantity": 6, "notes": "Approved 6 units from batch"},
        headers={"X-Facility-Id": "2", "X-User-Role": "blood_bank_officer"}
    )
    assert res_accept.status_code == 200
    acc_json = res_accept.json()
    assert acc_json["status"] == "success"
    assert acc_json["accepted_quantity"] == 6
    assert acc_json["remaining_shortage"] == 4
    transfer_id = acc_json["transfer_id"]

    # Verify atomic DB reservation
    db = TestingSessionLocal()
    trans = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
    assert trans is not None
    assert trans.quantity == 6
    assert trans.status == "ready_for_driver"
    assert trans.driver_status == "unassigned"

    refreshed_req = db.query(EmergencyRequest).filter(EmergencyRequest.id == req_id).first()
    assert refreshed_req.quantity_accepted == 6
    assert refreshed_req.quantity_reserved == 6
    assert refreshed_req.status == "PARTIALLY_FULFILLED"
    db.close()

    # 6. Over-reservation prevention: attempting to accept 5 units when only 4 remain must fail
    res_over = client.post(
        f"/api/emergency-requests/{req_code}/accept",
        json={"quantity": 5},
        headers={"X-Facility-Id": "3", "X-User-Role": "blood_bank_officer"}
    )
    assert res_over.status_code == 400
    assert "Remaining unaccepted shortage is only 4 units" in res_over.text

    # 7. Transportation Assignment: Assign driver to the transfer
    res_assign = client.post(f"/api/transfers/{transfer_id}/assign-driver?driver_id=1")
    assert res_assign.status_code == 200
    assert res_assign.json()["driver_id"] == 1
    assert res_assign.json()["driver_status"] == "assigned"

    # Driver 1 queries /api/transfers
    res_drv_tx = client.get("/api/transfers", headers={"X-User-Role": "driver", "X-User-Id": "1"})
    assert res_drv_tx.status_code == 200
    driver_tx_list = [t for t in res_drv_tx.json() if t["transfer_id"] == transfer_id]
    assert len(driver_tx_list) == 1
    assert driver_tx_list[0]["driver_status"] == "assigned"

    # Unassigned driver (ID 999) must NOT see this transfer
    res_unassigned = client.get("/api/transfers", headers={"X-User-Role": "driver", "X-User-Id": "999"})
    assert res_unassigned.status_code == 200
    assert len([t for t in res_unassigned.json() if t["transfer_id"] == transfer_id]) == 0

    # 8. Driver confirms pickup
    res_pickup = client.post(f"/api/transfers/{transfer_id}/driver-action?action=pickup")
    assert res_pickup.status_code == 200
    assert res_pickup.json()["driver_status"] == "in_transit"
    assert res_pickup.json()["transfer_status"] == "dispatched"

    # 9. Driver delivers cold box
    res_deliver = client.post(f"/api/transfers/{transfer_id}/driver-action?action=deliver")
    assert res_deliver.status_code == 200
    assert res_deliver.json()["driver_status"] == "delivered"

    # 10. Receiving Hospital confirms receipt
    res_confirm = client.post(
        f"/api/transfers/{transfer_id}/confirm-receipt",
        json={"confirmed_by": "Dr. Sunita Deshmukh, Chief Trauma Surgeon"}
    )
    assert res_confirm.status_code == 200
    assert res_confirm.json()["transfer_status"] == "received"

    # Verify inventory item is now at destination hospital
    db = TestingSessionLocal()
    trans_final = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
    assert trans_final.status == "received"
    assert trans_final.received_confirmed_by == "Dr. Sunita Deshmukh, Chief Trauma Surgeon"
    assert trans_final.inventory_item.facility_id == 1  # Reconciled into Hospital 1!
    db.close()
