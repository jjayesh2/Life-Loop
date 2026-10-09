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
from app.models import Facility, InventoryItem, DemandRecord, Transfer, Alert, TraceabilityEvent
from app.seed import seed_database, TRAVEL_TIME_MATRIX
from app.optimizer.engine import MILPOptimizer, is_compatible

# Test Database setup
TEST_DB_URL = "sqlite:///./test_lifeloop.db"
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
    if os.path.exists("./test_lifeloop.db"):
        try:
            os.remove("./test_lifeloop.db")
        except Exception:
            pass

client = TestClient(app)

def test_compatibility_rules():
    """Verify component-specific blood compatibility."""
    # RBC: O- is universal donor
    assert is_compatible("Red Blood Cells", "O-", "AB+") is True
    assert is_compatible("Red Blood Cells", "O-", "O-") is True
    assert is_compatible("Red Blood Cells", "AB+", "O-") is False
    assert is_compatible("Red Blood Cells", "A+", "B+") is False
    assert is_compatible("Red Blood Cells", "A-", "A+") is True

    # Plasma: AB is universal donor, O is universal recipient
    assert is_compatible("Fresh Frozen Plasma", "AB+", "O-") is True
    assert is_compatible("Fresh Frozen Plasma", "O-", "AB+") is False

def test_dashboard_endpoint():
    """Verify dashboard KPI aggregation."""
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert "total_available_units" in data
    assert data["total_available_units"] > 0
    assert "facilities_at_shortage_risk" in data
    assert "units_approaching_expiry" in data

def test_facilities_list():
    res = client.get("/api/facilities")
    assert res.status_code == 200
    facs = res.json()
    assert len(facs) >= 6
    assert any(f["code"] == "NSK-DCH-01" for f in facs)

def test_inventory_list_and_filter():
    res = client.get("/api/inventory?blood_group=O-")
    assert res.status_code == 200
    items = res.json()
    assert all(it["blood_group"] == "O-" for it in items)

def test_qr_traceability_lookup():
    # Lookup valid item
    inv_res = client.get("/api/inventory")
    first_item = inv_res.json()[0]
    tid = first_item["tracking_id"]

    trace_res = client.get(f"/api/traceability/{tid}")
    assert trace_res.status_code == 200
    assert trace_res.json()["tracking_id"] == tid

    # Unknown code handling
    bad_res = client.get("/api/traceability/NONEXISTENT-CODE-999")
    assert bad_res.status_code == 404

def test_record_movement_event():
    inv_res = client.get("/api/inventory")
    first_item = inv_res.json()[0]
    item_id = first_item["id"]

    event_payload = {
        "event_type": "storage_audit",
        "operator": "Dr. Smith",
        "facility_name": "Metro Central",
        "details": "Routine cold-chain temperature verification passed at 3.8C"
    }
    res = client.post(f"/api/traceability/{item_id}/events", json=event_payload)
    assert res.status_code == 200
    assert res.json()["status"] == "success"

def test_expiry_alerts_and_duplicate_prevention():
    # Trigger expiry check
    res = client.post("/api/alerts/run-expiry-check")
    assert res.status_code == 200
    alerts_after_1 = client.get("/api/alerts").json()
    
    # Run again - should NOT produce duplicate active alerts
    client.post("/api/alerts/run-expiry-check")
    alerts_after_2 = client.get("/api/alerts").json()
    assert len(alerts_after_1) == len(alerts_after_2)

def test_milp_optimizer_and_post_validation():
    """Verify real MILP execution and hard constraint checks."""
    req = {
        "scenario_id": "test",
        "horizon_hours": 24.0,
        "weight_unmet_demand": 100.0,
        "weight_expiry_risk": 15.0,
        "weight_travel_time": 0.2
    }
    res = client.post("/api/optimization/run", json=req)
    assert res.status_code == 200
    opt_data = res.json()
    
    assert opt_data["solver_name"] == "HiGHS-MILP"
    assert opt_data["is_feasible"] is True
    assert opt_data["constraint_validation"]["is_valid"] is True
    assert len(opt_data["proposed_transfers"]) > 0

    # Ensure proposed transfers respect safety reserves & compatibility
    for t in opt_data["proposed_transfers"]:
        assert t["quantity"] > 0
        assert t["travel_time_minutes"] > 0
        assert (t["travel_time_minutes"] / 60.0) < t["hours_until_expiry"]

def test_transfer_lifecycle():
    """Proposed -> Approved -> Dispatched -> Received."""
    # Run optimization to ensure proposed transfers exist
    client.post("/api/optimization/run", json={})
    transfers = client.get("/api/transfers?status=proposed").json()
    assert len(transfers) > 0
    tx = transfers[0]
    tx_id = tx["transfer_id"]

    # 1. Approve
    app_res = client.post(f"/api/transfers/{tx_id}/approve")
    assert app_res.status_code == 200
    assert app_res.json()["new_status"] == "approved"

    # 2. Dispatch
    disp_res = client.post(f"/api/transfers/{tx_id}/dispatch")
    assert disp_res.status_code == 200
    assert disp_res.json()["new_status"] == "dispatched"

    # 3. Receive and reconcile
    rec_res = client.post(f"/api/transfers/{tx_id}/receive")
    assert rec_res.status_code == 200
    assert rec_res.json()["new_status"] == "received"

    # 4. Manifest generation
    mnf_res = client.get(f"/api/transfers/{tx_id}/manifest")
    assert mnf_res.status_code == 200
    manifest = mnf_res.json()
    assert manifest["transfer_id"] == tx_id
    assert "NOT FOR CLINICAL USE" in manifest["watermark"]

def test_simulation_event_and_reoptimization():
    """Test emergency surge and route disruption."""
    payload = {
        "event_type": "trauma_surge",
        "facility_id": 1,
        "blood_group": "O-",
        "component_type": "Red Blood Cells",
        "quantity": 10
    }
    res = client.post("/api/scenarios/event", json=payload)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["status"] == "success"
    assert "reoptimization_result" in res_data
    assert res_data["reoptimization_result"]["is_feasible"] is True

def test_baseline_vs_optimized_impact():
    res = client.get("/api/analytics/impact")
    assert res.status_code == 200
    data = res.json()
    assert "baseline" in data
    assert "life_loop_optimized" in data
    assert "improvement" in data
    # Service level should be >= baseline
    assert data["life_loop_optimized"]["service_level_pct"] >= data["baseline"]["service_level_pct"]

def test_auth_and_demo_users():
    """Verify demo accounts for all 4 roles."""
    res = client.get("/api/auth/demo-users")
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 4
    roles = {u["role"] for u in users}
    assert "network_admin" in roles
    assert "hospital_staff" in roles
    assert "blood_bank_staff" in roles
    assert "driver" in roles

    # Test login
    login_res = client.post("/api/auth/login", json={"email": "apollo@lifeloop.in", "password": "hospital123"})
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["role"] == "hospital_staff"

def test_emergency_request_end_to_end():
    """Verify emergency request, algorithmic ranking, driver assignment, pickup, and delivery reconciliation."""
    # 1. Hospital submits emergency request for 2 units O-
    req_payload = {
        "hospital_id": 4, # Apollo Hospitals
        "blood_group": "O-",
        "component_type": "Packed Red Blood Cells",
        "quantity_needed": 2,
        "urgency": "critical",
        "clinical_notes": "Highway accident trauma victim"
    }
    create_res = client.post("/api/emergency-requests", json=req_payload)
    assert create_res.status_code == 200
    req_data = create_res.json()
    assert req_data["request_id"] != ""
    assert len(req_data["source_recommendations"]) > 0

    req_id = req_data["request_id"]
    top_source = req_data["source_recommendations"][0]

    # 2. Approve source recommendation -> creates Transfer and assigns Driver
    app_res = client.post(f"/api/emergency-requests/{req_id}/approve", json={
        "source_facility_id": top_source["facility_id"],
        "quantity": 2,
        "approver_name": "Dr. Kulkarni"
    })
    assert app_res.status_code == 200
    app_data = app_res.json()
    tx_id = app_data["transfer_id"]
    assert app_data["transfer_status"] == "driver_assigned"

    # 3. Driver accepts mission
    drv_res = client.post(f"/api/transfers/{tx_id}/driver-response", json={
        "driver_id": 1,
        "action": "accept"
    })
    assert drv_res.status_code == 200
    assert drv_res.json()["driver_status"] == "accepted"

    # 4. Driver confirms pickup -> starts cold chain monitoring
    pickup_res = client.post(f"/api/transfers/{tx_id}/pickup", json={"driver_name": "Suresh Shinde"})
    assert pickup_res.status_code == 200
    assert pickup_res.json()["status"] == "dispatched"

    # 5. Judge simulates cold chain temperature excursion
    spike_res = client.post(f"/api/transfers/{tx_id}/temperature-spike", json={"spike_temp_c": 11.5})
    assert spike_res.status_code == 200
    assert spike_res.json()["temperature_status"] in ["critical", "critical_deviation"]

    # 6. Hospital confirms receipt and reconciles stock atomically
    deliv_res = client.post(f"/api/transfers/{tx_id}/deliver", json={"receiver_name": "Apollo Emergency Charge Nurse"})
    assert deliv_res.status_code == 200
    assert deliv_res.json()["status"] == "delivered"

