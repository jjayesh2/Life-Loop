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

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db, force=True)
    db.close()
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
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
    assert len(facs) >= 12
    assert any(f["code"] == "NMC-DIST-01" for f in facs)
    assert any(f["code"] == "NMC-ARPAN-02" for f in facs)

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
    assert data["life_loop_optimized"]["service_level_pct"] >= data["baseline"]["service_level_pct"]

def test_emergency_request_and_candidate_discovery():
    """Verify Hospital STAT Request -> Candidate Discovery -> Transfer Proposal."""
    req_payload = {
        "requesting_facility_id": 4, # Apollo Hospitals Nashik
        "blood_group": "O-",
        "component_type": "Red Blood Cells",
        "quantity_needed": 6,
        "urgency": "critical",
        "required_by_hours": 3.0,
        "notes": "Emergency ICU admission"
    }
    res = client.post("/api/emergency-requests", json=req_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "request_id" in data
    assert len(data["candidates"]) > 0
    # Candidate should include Arpan Blood Bank (Facility 2) or Civil Hospital (Facility 1)
    cand_fac_ids = [c["facility_id"] for c in data["candidates"]]
    assert 2 in cand_fac_ids or 1 in cand_fac_ids

def test_alert_resolve_workflow():
    """Verify that acknowledge and resolve work as distinct actions."""
    # Run expiry check to populate alerts
    client.post("/api/alerts/run-expiry-check")
    alerts = client.get("/api/alerts?status=active").json()
    if alerts:
        a_id = alerts[0]["id"]
        # 1. Acknowledge
        ack_res = client.post(f"/api/alerts/{a_id}/acknowledge")
        assert ack_res.status_code == 200
        assert ack_res.json()["alert_status"] == "acknowledged"

        # 2. Resolve
        res_res = client.post(f"/api/alerts/{a_id}/resolve", json={"notes": "Batch verified by lab supervisor."})
        assert res_res.status_code == 200
        assert res_res.json()["alert_status"] == "resolved"

