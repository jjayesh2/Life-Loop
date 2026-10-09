# LIFE-LOOP — NASHIK BLOOD REDISTRIBUTION PLATFORM

### Intelligent Blood Supply Chain Optimization & Emergency Redistribution
**Tagline:** *Every Unit Matters. Every Minute Counts.*  
**Deployment Region:** Nashik City & District, Maharashtra, India (Center: 19.9975° N, 73.7898° E)

> **DEMO ENVIRONMENT NOTICE:** This application operates on public verified healthcare facility directories sourced from the Government of Maharashtra (`nashik.gov.in`) and the National Health Mission's `e-RaktKosh` portal (`eraktkosh.mohfw.gov.in`). Clinical inventory quantities are synthetic, deterministic demonstration stock. It is an operations-research decision support platform and does not replace statutory clinical transfusion protocols.

---

## 1. Executive Summary & Product Vision

Blood components are perishable, life-critical assets with asymmetric shelf lives (Platelets: ~5 days at 20–24°C, Packed Red Blood Cells: ~35–42 days at 2–6°C, Fresh Frozen Plasma: frozen up to 1 year at &le;-18°C). In metropolitan and district healthcare ecosystems like **Nashik**, supply is frequently misallocated: blood banks sit on near-expiry stock while major trauma centers (e.g., Apollo Hospitals Panchavati, District Civil Hospital) face severe emergency shortages during highway pileups along the Mumbai-Nashik Expressway (NH-3) or Pune-Nashik Highway (NH-50).

**LIFE-LOOP** bridges this divide by delivering:
1. **Real Public Data with Verified Provenance:** 12 verified healthcare nodes across Nashik City and District, with an explicit distinction between **7 Live Connected Demo Facilities** and **5 Public Directory Listings** (sourced directly from `nashik.gov.in` and `e-RaktKosh`).
2. **1-Click Judge Demo Role Switcher:** Instant role switching directly in the top navigation bar between:
   * **Network Administrator** (Nashik District Health Lead)
   * **Hospital Staff** (Dr. Smita Patil, Apollo Hospitals Panchavati)
   * **Hospital Staff** (Dr. Anand More, District Civil Hospital)
   * **Blood Bank Officer** (Dr. Milind Deshmukh, Arpan Blood Bank & Component Centre)
   * **Blood Bank Administrator** (Sunita Joshi, Jankalyan Raktpedhi Canada Corner)
   * **Delivery Couriers** (Suresh Shinde - Refrigerated Van `MH-15-EG-4402`, Ganesh Pawar - Medical Rapid Bike `MH-15-BT-8910`)
3. **End-to-End Emergency Blood Request Workflow:**
   $$\text{Hospital Requisition} \longrightarrow \text{Algorithmic Ranking} \longrightarrow \text{1-Click Reservation} \longrightarrow \text{Driver Dispatch} \longrightarrow \text{Transit Tracking} \longrightarrow \text{Delivery Reconciliation}$$
4. **Cold-Chain IoT Sensor Monitoring & Judge Excursion Trigger:** Real-time temperature readout (2°C–6°C for PRBC) with an interactive **"Simulate Temperature Spike (+11.5°C)"** button triggering audio siren alarms, browser speech announcements, and automatic regulatory audit logging.
5. **Smart Browser Audio & Speech Synthesis:** Web Audio synthesizer (success chimes, alert pings, emergency sirens) and browser Web Speech (`window.speechSynthesis`) with Indian English accent preference and persistent Mute / Sound FX / Voice toggles.
6. **Mathematical Optimization (MILP):** True Mixed-Integer Linear Programming powered by **HiGHS** factoring component-specific immunohematology compatibility (ABO/Rh for PRBC, inverse rules for Plasma), road transit times, and mandatory hospital safety reserves.
7. **Nashik Interactive Map:** Leaflet OpenStreetMap zero-credential fallback (with Mappls integration compliance), centered on Nashik (`19.9975, 73.7898`), displaying animated courier routes, live vehicle pins, and filters for connected vs public directory facilities.
8. **Nashik Incident Simulator:** 4 deterministic real-world local scenarios (Mumbai-Nashik Highway Vilholi pileup, Dwarka Circle traffic gridlock, Arpan cooler compressor failure, and Bytco Hospital voluntary blood drive).

---

## 2. Verified Nashik Data Provenance & Directory Distinction

All 12 facilities in Life-Loop are authentic healthcare institutions operating in Nashik District, Maharashtra:

| Facility Name | Category | Status in Life-Loop | Location / Zone | Verified Source |
| :--- | :--- | :--- | :--- | :--- |
| **District Civil Hospital & Blood Centre** | Hospital & Blood Bank | **Live Connected** (20 reserve) | Shalimar / CBS, Trimbak Road | [nashik.gov.in](https://nashik.gov.in/en/public-utilities/hospitals/) |
| **Arpan Blood Bank & Component Centre** | Blood Bank (Major Hub) | **Live Connected** (15 reserve) | Patel Plaza, Old Agra Road | [e-RaktKosh](https://eraktkosh.mohfw.gov.in/) |
| **Jankalyan Raktpedhi Nashik** | Blood Bank (Major Hub) | **Live Connected** (15 reserve) | Vise Mala, Canada Corner | [e-RaktKosh](https://eraktkosh.mohfw.gov.in/) |
| **Apollo Hospitals Nashik** | Super Speciality Hospital | **Live Connected** (12 reserve) | Panchavati, Swaminarayan Nagar | [nashik.gov.in](https://nashik.gov.in/en/public-utilities/hospitals/) |
| **Wockhardt Hospitals Nashik** | Multi-Speciality Hospital | **Live Connected** (10 reserve) | Mumbai Naka, Wadala Naka | [nashik.gov.in](https://nashik.gov.in/en/public-utilities/hospitals/) |
| **Dr. Vasantrao Pawar Medical College (MVP)** | Hospital & Blood Bank | **Live Connected** (15 reserve) | Vasantdada Nagar, Adgaon | [e-RaktKosh](https://eraktkosh.mohfw.gov.in/) |
| **NMC Bytco Multi-specialty Hospital** | Municipal Hospital | **Live Connected** (10 reserve) | Nashik-Pune Road, Nashik Road | [nashik.gov.in](https://nashik.gov.in/en/public-utilities/hospitals/) |
| **NMC Dr. Zakir Hussain Municipal Hospital** | Municipal Hospital | *Public Directory* (Gov Verified) | Kathada, Old Nashik | [nashik.gov.in](https://nashik.gov.in/en/public-utilities/hospitals/) |
| **Sahyadri Super Speciality Hospital** | Super Speciality Hospital | *Public Directory* (Gov Verified) | Wadala Road, Mumbai Naka | [nashik.gov.in](https://nashik.gov.in/en/public-utilities/hospitals/) |
| **HCG Manavata Cancer Centre** | Oncology & Transfusion Centre | *Public Directory* (Gov Verified) | Mumbai Naka, Old Agra Road | [nashik.gov.in](https://nashik.gov.in/en/public-utilities/hospitals/) |
| **Nashik Red Cross Blood Bank** | Voluntary Blood Centre | *Public Directory* (Gov Verified) | Red Cross Marg, Ashok Stambh | [e-RaktKosh](https://eraktkosh.mohfw.gov.in/) |
| **Sub-District Hospital Malegaon** | Sub-District Hospital | *Public Directory* (Gov Verified) | Camp Road, Malegaon, Nashik | [nashik.gov.in](https://nashik.gov.in/en/public-utilities/hospitals/) |

* **Connected Facilities (7):** Feature live bi-directional APIs, automated stock reservation, driver assignment, and real-time sensor streams.
* **Public Directory Listings (5):** Display official telephone numbers, addresses, and external government verification links for regional reference and manual escalation.

### Live e-RaktKosh Integration (28-node network)

On top of the 12 seed facilities, the seeder ingests the **complete live e-RaktKosh register for Nashik District** (snapshot `2026-10-09 17:45`), sourced from the Ministry of Health & Family Welfare public portal ([eraktkosh.mohfw.gov.in](https://eraktkosh.mohfw.gov.in/)).

| Artefact | File | Contents |
| :--- | :--- | :--- |
| Live centre register | `backend/data/nashik_blood_centres.csv` | 20 licensed blood centres with category, contact phone/email, last-updated timestamp |
| Live stock snapshot | `backend/data/nashik_blood_stock_long.csv` | 490 rows (centre × component × group) of real **Units Available** |
| Ingestion module | `backend/app/real_data.py` | `seed_real_data()` — merges centres, stock, contacts, travel matrix |

**What the model now contains after seeding:**

* **28 facilities** (12 seed + 16 additional live e-RaktKosh blood banks with IDs `103`–`120`) across Nashik city, Sinnar, Igatpuri, Deolali and Malegaon.
* **20 facilities** marked `Live verified (e-RaktKosh 2026-10-09)` with real phone numbers and emails scraped from the register (e.g. Shree Sainath Blood Centre → `9022340171`, Arpan Blood Bank → `nandkishor@arpanbloodbank.org`).
* **299 inventory items** totalling **8,237 units**, of which **278 rows / 8,012 units** carry the provenance label `e-RaktKosh live 2026-10-09`.
* **6 real components**: Red Blood Cells, Fresh Frozen Plasma, Platelets, Cryoprecipitate, Cryo Poor Plasma, Whole Blood (e-RaktKosh naming normalised via `REAL_COMPONENT_MAP`, e.g. *Packed Red Blood Cells* → `Red Blood Cells`, *Plasma* → `Fresh Frozen Plasma`).
* **756 travel-matrix pairs / 755 distance pairs** — the 7×7 hand-verified city matrix is extended to all 28 nodes by great-circle haversine distance at a 28 km/h cold-chain average, preserving the original verified values.
* **299 chain-of-custody events**, one per real unit, authored by operator `e-RaktKosh Live Feed`.

**Provenance in the UI:** the Inventory page renders a green `live` badge next to any batch ingested from the e-RaktKosh feed; un-badged rows are explicitly labelled `Demo stock — simulated`. Traceability lookup works by either the `LL-NSK-…` tracking ID or the `ERK-…` batch reference.

**Re-ingesting the live feed:** replace the two CSVs in `backend/data/` and force a reseed:
```powershell
curl -X POST http://127.0.0.1:8000/api/scenarios/reset
```

> **Disclosure:** unit *quantities*, blood groups, and component types are the real published figures. Collection timestamps and therefore expiry windows are derived deterministically per-batch (max 73 h age) because e-RaktKosh does not expose per-unit collection dates. GPS coordinates for centres outside Nashik city are district-level approximations.

---

## 3. Architecture & Technology Stack

```
                              LIFE-LOOP NASHIK SYSTEM ARCHITECTURE
  
       [ FRONTEND ]                                                    [ BACKEND ]
  React 18 + TypeScript                                            FastAPI (Python 3.13)
  Vite + Tailwind CSS                                              Pydantic v2 Models & Schemas
  Lucide Icons + Recharts                                          SQLAlchemy ORM + SQLite
  Leaflet Map + OpenStreetMap                                      WebSockets Live Incident Stream
  Web Audio API + Speech Synthesis                                 Idempotent Deterministic Seeder
           │                                                                  │
           ├── REST API Calls (/api/...) ─────────────────────────────────────┤
           ├── Real-Time WebSocket (/ws/scenarios/live) ──────────────────────┤
           │                                                                  │
  [ DEMO ROLES CONTEXT ]                                             [ OPTIMIZATION ENGINE ]
  Admin / Hospital / Bank / Driver                                   HiGHS MILP Solver (highspy / SciPy)
  Sound & Voice Controllers                                          Exact Branch-and-Bound Optimizer
```

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, Leaflet, React-Leaflet, Web Audio API, Web Speech API (`SpeechSynthesisUtterance`).
* **Backend:** FastAPI, Python 3.13, Pydantic v2, SQLAlchemy, Uvicorn, WebSockets.
* **Mathematical Solvers:** `highspy` (HiGHS 1.15.1) and `scipy.optimize.milp` with post-solution constraint verification.
* **Database:** SQLite (`backend/lifeloop.db`) with relational tables for Facilities, Users, Drivers, InventoryItems, EmergencyBloodRequests, Transfers, Alerts, TraceabilityEvents, and AuditLogs.

---

## 4. End-to-End Emergency Workflow

The platform provides a closed-loop clinical and logistic pipeline:

```
1. Hospital Requisition
   └─ Staff submits: Blood Group (e.g. O-), Component (PRBC), Quantity (2 units), Urgency (Critical STAT).
   └─ Audio Alert chime plays & speech synthesis announces request in Indian English.
   
2. Multi-Facility Algorithmic Search
   └─ Evaluates all connected Nashik facilities.
   └─ Enforces component-specific immunohematology rules (O- is universal for RBC; AB is universal for Plasma).
   └─ Factors real Nashik road distances (km) and travel times (mins).
   └─ Protects source safety reserves (will not deplete donor bank below statutory limit).
   └─ Produces ranked recommendations with explainable AI rationales.

3. 1-Click Stock Reservation & Courier Assignment
   └─ Approving a recommendation atomically reserves stock in the database.
   └─ Auto-assigns nearest available Nashik courier (Suresh Shinde / Ganesh Pawar).
   └─ Generates Transfer consignment `TX-NSK-...`.

4. Driver Console (Mobile Optimized)
   └─ Driver receives pending mission offer with pickup / dropoff navigation details.
   └─ Driver clicks "Accept Assignment".
   └─ Driver confirms pickup: status transitions to "Dispatched" / "In Transit".
   └─ Cold-box IoT temperature sensor activates (2°C–6°C).

5. Cold-Chain Monitoring & Judge Demonstration Spike
   └─ Real-time temperature readout displayed on map, transfers page, and driver console.
   └─ Judge clicks "Simulate Temperature Spike (+11.5°C)":
      • Backend immediately flags `temperature_status: critical`.
      • Audio alarm siren pulses.
      • Browser speaks: "Warning! Simulated cold chain excursion detected on transfer..."
      • Emergency alert logged with required protocol actions.

6. Delivery Receipt & Atomic Reconciliation
   └─ Hospital emergency nurse confirms receipt and physical handover.
   └─ Transfer marked "Delivered".
   └─ Inventory reconciled atomically: reserved stock deducted from donor and added to receiving facility.
   └─ Official chain-of-custody transfer manifest printable with verification watermark.
```

---

## 5. Local Setup & Execution Guide

### Prerequisites
* Python 3.10+ (Tested on Python 3.13.2)
* Node.js v18+ (Tested on Node.js v22.20.0 with npm 10.9.3)

### Installation

1. **Clone repository & navigate to folder:**
   ```powershell
   cd "c:\Users\Jayesh Jadhav\Desktop\HACKATHONS\Life-Loop"
   ```

2. **Install Python backend dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

3. **Install Frontend dependencies:**
   ```powershell
   cd frontend
   npm install
   cd ..
   ```

### Running the Application

#### Option A: Unified Full-Stack Mode (Single Port 8000)
Build the frontend once and let FastAPI serve both the REST API and the interactive UI:
```powershell
cd frontend
npm run build
cd ..
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
Open your browser at: **`http://localhost:8000`**

#### Option B: Dual Development Mode (With Hot Reload)
* **Terminal 1 (Backend API & WebSockets):**
  ```powershell
  python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
  ```
* **Terminal 2 (Vite Frontend):**
  ```powershell
  cd frontend
  npm run dev
  ```
Open your browser at: **`http://localhost:5173`**

---

## 6. Automated Testing Verification

Run the comprehensive automated test suite covering all 13 core modules:
```powershell
python -m pytest backend/tests/test_backend.py -v
```

### Verified Test Results (13/13 Passed)
```
backend/tests/test_backend.py::test_compatibility_rules PASSED
backend/tests/test_backend.py::test_dashboard_endpoint PASSED
backend/tests/test_backend.py::test_facilities_list PASSED
backend/tests/test_backend.py::test_inventory_list_and_filter PASSED
backend/tests/test_backend.py::test_qr_traceability_lookup PASSED
backend/tests/test_backend.py::test_record_movement_event PASSED
backend/tests/test_backend.py::test_expiry_alerts_and_duplicate_prevention PASSED
backend/tests/test_backend.py::test_milp_optimizer_and_post_validation PASSED
backend/tests/test_backend.py::test_transfer_lifecycle PASSED
backend/tests/test_backend.py::test_simulation_event_and_reoptimization PASSED
backend/tests/test_backend.py::test_baseline_vs_optimized_impact PASSED
backend/tests/test_backend.py::test_auth_and_demo_users PASSED
backend/tests/test_backend.py::test_emergency_request_end_to_end PASSED

======================= 13 passed in 2.42s =======================
```

---

## 7. Step-by-Step Demonstration Walkthrough for Hackathon Judges

1. **Top Navbar & Demo Role Switcher:**
   * Observe the **Role Switcher** in the top right. Click it to view the 7 pre-seeded personas.
   * Toggle the **Sound FX** (`Volume2`) and **Voice Announcements** (`Mic`) buttons. Notice that voice announcements use Indian English speech synthesis.
2. **Command Center:**
   * View live Nashik network KPIs: 225 Available Units, 7 Connected Facilities, 5 Public Directory listings, and active emergency requisitions.
   * Inspect the stock by blood group and component distribution charts.
3. **Emergency Blood Requisition (Hospital Staff Role):**
   * Click the red **"STAT Request"** button in the navbar or navigate to **Hospital Requisition**.
   * Submit an emergency request for 2 units of **O- Negative PRBC** at **Apollo Hospitals Nashik**.
   * Listen to the emergency siren audio cue and spoken voice alert.
   * View the ranked source recommendations: **Arpan Blood Bank** and **District Civil Hospital** are scored and ranked with exact transit ETA (14 mins) and explainable AI rationale.
   * Click **"Approve & Dispatch"** on Arpan Blood Bank. Stock is reserved atomically and a courier is assigned.
4. **Courier Dispatch Console (Driver Role):**
   * Use the demo switcher to select **Suresh Shinde (Driver)**, or click **Courier Dispatch** in the sidebar.
   * Observe the active mission card showing pickup at Arpan Blood Bank and delivery to Apollo Hospitals.
   * Click **"Confirm Pickup & Seal Box"**. The transfer transitions to **In Transit**, and cold box BLE sensors begin logging.
5. **Cold-Chain Excursion Simulation (Judge Demo Trigger):**
   * On the active transit card, click 🚨 **"Simulate Temp Spike (+11.5°C)"**.
   * The audio alarm siren sounds, browser speaks the emergency excursion warning aloud, and the temperature badge blinks red.
   * The temperature excursion is logged permanently in the traceability audit trail.
6. **Delivery Confirmation & Atomic Reconciliation:**
   * Click **"Confirm Delivery at Hospital"**.
   * A pleasant success chime sounds, the transfer transitions to **Delivered**, and units are atomically credited to Apollo Hospitals' inventory.
7. **Nashik Network Map:**
   * Navigate to **Network Map**. Verify the center is Nashik (`19.9975, 73.7898`).
   * Toggle between **"Connected Facilities (7)"** and **"All Public Directory (12)"**.
   * Inspect the transit route polylines and animated courier vehicle pin with live temperature readout.
8. **Nashik Emergency Simulator:**
   * Navigate to **Emergency Simulator**. Test the 4 realistic Nashik scenarios:
     1. **Mumbai-Nashik Highway (NH-3) Vilholi Pileup** (Surge demand of 6 units O-).
     2. **Dwarka Circle Peak Traffic Gridlock** (3.5x delay on NH-50 corridor).
     3. **Arpan Blood Bank Chiller Failure** (Emergency evacuation of 14 PRBC units).
     4. **Bytco Hospital Voluntary Mega Drive** (+20 fresh units).
   * Observe the real-time HiGHS MILP re-optimization solving in <0.05 seconds and re-routing dispatches.
9. **Official Transfer Manifest:**
   * Navigate to **Transfer & Cold-Chain**. Click **"View Manifest"** on any transfer to preview the official Chain of Custody document complete with barcodes, driver signatures, and compliance disclaimers.

---

## 8. Compliance & Ethical Boundaries

* **No Protected Health Information (PHI):** QR codes encode opaque identifiers (e.g., `LL-NSK-OPOS-A71C`) without individual patient names or sensitive medical records.
* **Verified Public Provenance:** Facility coordinates and official contact information are sourced directly from authorized government portals (`nashik.gov.in`, `e-RaktKosh`).
* **Clinical Safety Protocols:** Life-Loop is an algorithmic logistics decision support system. Final cross-matching and transfusion authorizations must be performed by certified clinical technologists.
