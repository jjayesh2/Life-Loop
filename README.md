# LIFE-LOOP

### Intelligent Blood Supply Chain Optimization & Emergency Coordination Platform
**Tagline:** *Every Unit Matters. Every Minute Counts.*

> **DEMO ENVIRONMENT NOTICE:** This application operates on synthetic, deterministic clinical logistics demonstration data. It is an operations-research decision support prototype and does not provide certified medical or transfusion authorization.

---

## 1. Executive Summary & Product Vision

Blood components are perishable, life-critical assets with asymmetric shelf lives (Platelets: ~5–7 days, Red Blood Cells: ~35–42 days, Plasma: frozen up to 1 year). In metropolitan healthcare networks, inventory is frequently misallocated: regional blood centers or community clinics sit on near-expiry surplus while level-1 trauma centers face emergency deficits during mass casualty surges.

**LIFE-LOOP** bridges this divide by combining:
1. **Mathematical Optimization:** A real Mixed-Integer Linear Programming (MILP) engine powered by the state-of-the-art **HiGHS** solver, calculating inter-facility redistribution dispatches that minimize unmet critical demand and expiry waste while strictly respecting road transit times, hospital safety reserves, and component-specific immunohematology rules.
2. **End-to-End Unit Traceability:** Individual blood unit and batch tracking with unique QR-code labels (ISBT-128 equivalent software mock), cold-chain parameter tracking, and verifiable custody movement logs.
3. **Proactive Expiry Alerts:** Deterministic, multi-tier notification surveillance ($t \le 72\text{h}$ Warning, $t \le 24\text{h}$ Urgent, $t \le 0\text{h}$ Auto-Quarantine) with duplicate alert suppression and instant on-demand evaluation.
4. **Live Emergency Simulator:** Dynamic injection of mass-casualty trauma surges, highway traffic closures, facility outages, and donation drive supplies with real-time WebSocket synchronization and automated re-optimization.
5. **Chain of Custody Manifests:** Verifiable, printable transfer manifests with courier sign-off blocks, QR barcodes, and clinical disclaimer watermarks.

---

## 2. Architecture & Technology Stack

```
                                  LIFE-LOOP ARCHITECTURE
  
       [ FRONTEND ]                                      [ BACKEND ]
  React 18 + TypeScript                              FastAPI (Python 3.13)
  Vite + Tailwind CSS                                Pydantic Schemas
  Lucide Icons + Recharts                            SQLAlchemy ORM + SQLite
  Leaflet Map + OpenStreetMap                        WebSockets (Live Stream)
           │                                                    │
           ├── REST API Calls (/api/...) ───────────────────────┤
           ├── WebSocket Connection (/ws/scenarios/live) ───────┤
           │                                                    │
                                                         [ OPTIMIZER ]
                                                    HiGHS MILP Solver Engine
                                                    (via SciPy & highspy)
                                                    Post-Solution Hard Validator
```

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, Leaflet, React-Leaflet.
* **Backend:** FastAPI, Python 3.13, Pydantic v2, SQLAlchemy, Uvicorn, WebSockets.
* **Optimization:** SciPy HiGHS MILP Solver (`scipy.optimize.milp` & `highspy`), formulating integer decision variables with exact branch-and-bound solving.
* **Database:** SQLite with idempotent deterministic seeder populating 7 metropolitan facilities, 20 varied blood batches, expiries, and patient demands.

---

## 3. Mathematical Optimization (MILP Formulation)

The optimization engine avoids greedy heuristics in favor of a true Mixed-Integer Linear Program.

### Decision Variables
* $X_{c} \in \mathbb{Z}_{\ge 0}$: Integer units transferred for eligible candidate $c$ (moving donor item $k$ from facility $i$ to fulfill demand $d$ at destination $j$).
* $U_{d} \in \mathbb{Z}_{\ge 0}$: Remaining unmet demand units for clinical order $d$.

### Objective Function
$$\min \sum_{c} \left( W_{\text{travel}} \cdot T_{ij} + W_{\text{mismatch}} \cdot \mathbb{I}_{\text{non-identical}} - \frac{W_{\text{expiry}}}{\max(H_{\text{exp}}, 1.0)} \right) X_{c} + \sum_{d} \left( W_{\text{unmet}} \cdot \mu_{\text{urgency}} \right) U_{d}$$

Where:
* $T_{ij}$: Road transit travel time in minutes between facility $i$ and $j$.
* $H_{\text{exp}}$: Remaining shelf life hours before unit expiration.
* $\mu_{\text{urgency}}$: Clinical urgency multiplier ($3.0$ for critical trauma, $1.5$ for urgent surgical, $1.0$ for routine).
* $W_{\text{unmet}} = 100.0, W_{\text{expiry}} = 15.0, W_{\text{travel}} = 0.2$ (configurable via UI sliders).

### Hard Constraints
1. **Demand Satisfaction:** $\sum_{c \in \mathcal{C}(d)} X_{c} + U_{d} = D_{d} \quad \forall d \in \text{Demands}$
2. **Item Batch Capacity:** $\sum_{c \in \mathcal{C}(k)} X_{c} \le Q_{k} \quad \forall k \in \text{Eligible Batches}$
3. **Mandatory Hospital Safety Reserves:** Available stock at facility $i$ minus total outgoing transfers must remain $\ge R_{i}$ (Safety Reserve Units).
4. **Immunohematology Compatibility:** Transfers are restricted to clinically validated blood group compatibility:
   * **Red Blood Cells:** Recipient O- (O- only); O+ (O-, O+); A- (O-, A-); A+ (O-, O+, A-, A+); B- (O-, B-); B+ (O-, O+, B-, B+); AB- (O-, A-, B-, AB-); AB+ (Universal recipient).
   * **Fresh Frozen Plasma & Cryoprecipitate:** Inverse compatibility (AB is universal donor; O is universal recipient).
5. **Shelf-Life & Transit Feasibility:** A transfer is strictly prohibited if travel time $T_{ij} / 60 \ge H_{\text{exp}}$ or if travel time exceeds the clinical deadline.
6. **Post-Solution Validation:** Independent programmatic verification rejecting any solution violating non-negativity, capacity limits, safety reserves, or compatibility.

---

## 4. Key Application Modules

| Module | Features & Capabilities |
| :--- | :--- |
| **1. Command Center** | Live operational overview, KPI cards (Available, Reserved, Shortage Risk, Expiring, Transfers), embedded Leaflet map, blood group & component charts, quick shortage and expiry tables. |
| **2. Blood Inventory** | Full CRUD for tracked units, multi-criteria filtering (group, component, status, facility), detail drawer, CSV export, CSV import with format validation, low-stock & expiry indicators. |
| **3. QR Traceability** | Unique QR code generator, camera barcode scanning simulator, manual ID search, blood bag sticker print view, appendable chain-of-custody movement logs. |
| **4. Expiry Alerts** | Multi-tier thresholds (&le;72h warning, &le;24h urgent, &le;0h expired), **"Run Expiry Check Now"** instant evaluator for demo judges, alert acknowledgement with audit logging. |
| **5. Demand & Forecasts**| 14-day EWMA (Exponential Weighted Moving Average) actuals vs. forecast Recharts graph with 95% confidence intervals, facility coverage hours and stockout vulnerability indicators. |
| **6. Network Map** | Interactive Leaflet OpenStreetMap displaying 7 metropolitan facilities, status pins (Red for deficit, Teal for hubs), transfer routes, and facility inspection drawer. |
| **7. Optimization Engine**| Live HiGHS solver execution, objective weight sliders, solver runtime (sub-second), constraint validation checklist, explainable rationale cards for every proposed transfer. |
| **8. Emergency Simulator**| Live scenario injector: Trauma Surge (+O- RBC), Highway Closure (delay multiplier), Mobile Donation Influx (+units), Storage Cooler Alarm; live WebSocket push; re-optimization preview. |
| **9. Transfer Management**| Stage-gate workflow: **Proposed &rarr; Approved &rarr; Dispatched &rarr; Received &rarr; Reconciled**, rejection with logged reason, official printable Manifest with chain of custody sign-off blocks. |
| **10. Analytics & Impact** | Side-by-side empirical comparison of **Baseline (No Redistribution)** vs. **Life-Loop (MILP)**: service level percentage, shortage mitigation percentage, waste reduction percentage. |
| **11. Audit Trail** | Immutable audit log of all system transactions (optimizations, alerts, approvals, movements) with CSV export. |
| **12. Settings & Controls**| Configurable shelf-life thresholds, hospital reserve requirements, travel matrix inspection, and a one-click **"Reset Demo Environment"** button. |
| **AI Operations Copilot**| Side-drawer decision support assistant answering logistics queries (shortages, expiring batches, transfer rationales, baseline impact). |

---

## 5. Local Setup & Execution Guide

### Prerequisites
* Python 3.10+ (Tested on Python 3.13.2)
* Node.js v18+ (Tested on Node.js v22.20.0 with npm 10.9.3)

### Installation

1. **Clone repository & navigate to folder:**
   ```powershell
   cd c:\Users\Jayesh Jadhav\Desktop\HACKATHONS\Life-Loop
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

You can run Life-Loop in either **Development Mode** (with hot reload) or **Unified Full-Stack Mode**:

#### Option A: Unified Full-Stack Mode (Single Command)
Build the frontend once and let FastAPI serve both the API and the interactive UI:
```powershell
cd frontend
npm run build
cd ..
python -m uvicorn backend.app.main:app --port 8000
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
Open your browser at: **`http://localhost:5173`** (API requests proxy automatically to `:8000`).

---

## 6. Automated Testing Verification

Run the comprehensive automated test suite:
```powershell
python -m pytest backend/tests/test_backend.py -v
```

### Verified Test Results
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

======================= 11 passed in 2.08s =======================
```

---

## 7. Step-by-Step Demonstration Walkthrough for Judges

1. **Command Center:** Observe the live dashboard KPIs (e.g. 210 available units, 2 shortage risk hospitals, 2 near-expiry units). Notice the Leaflet map showing participating hospital pins and active routes.
2. **Blood Inventory & QR Labels:** Navigate to **Blood Inventory**. Click the **"Label"** button on unit `LL-OPOS-202` to inspect and print the blood bag sticker featuring its QR code, blood group, cold-chain temp (4°C), and non-sensitive identifier.
3. **QR Traceability (Innovation A):** Navigate to **QR Traceability**. Enter `LL-OPOS-202` or click **"Simulate Camera Scan"**. View the unit's full chain-of-custody timeline. Click **"Log Movement Event"** to append a cold-chain verification audit log.
4. **Expiry Alerts (Innovation B):** Navigate to **Expiry Alerts**. Click **"Run Expiry Check Now"**. The deterministic engine immediately evaluates shelf lives, quarantines expired units, and generates alerts with countdown timers. Click **"Acknowledge Alert"** to record compliance.
5. **Demand Forecasting:** Navigate to **Demand & Forecasts**. Review the 14-day EWMA actual vs. forecast chart with 95% confidence intervals and facility coverage hours.
6. **MILP Optimization Engine (Core Innovation):** Navigate to **Optimization Engine**. Inspect the objective weights. Click **"Execute MILP Optimization"**. The HiGHS solver converges in under 0.05 seconds, displays the post-solution constraint validation checklist, and provides explainable rationale cards for every proposed redistribution.
7. **Emergency Simulator:** Navigate to **Emergency Simulator**. Select Metro Trauma Center and click **"Trigger Trauma Surge"** (+8 units O- RBC). Notice the live WebSocket broadcast and immediate automated re-optimization updating the transfer routes.
8. **Transfer Management & Manifests:** Navigate to **Transfer Management**. Approve a proposed transfer, click **"Dispatch Courier"**, and click **"View Manifest"** to open and print the official Chain-of-Custody Manifest complete with courier sign-off blocks and clinical disclaimer watermark.
9. **Analytics & Impact:** Navigate to **Analytics & Impact** to review the mathematically computed comparative table comparing the baseline (local stock only) with Life-Loop's MILP solution.
10. **Reset Demo:** Navigate to **Settings & Controls** and click **"Reset Demo Environment"** to restore the initial deterministic seed state.

---

## 8. Compliance & Ethical Boundaries

* **No Protected Health Information (PHI):** QR codes encode only opaque tracking URIs (e.g., `https://lifeloop.health/trace/LL-OPOS-202-E839`) without patient names, phone numbers, or medical records.
* **Clinical Safety Disclaimer:** The system strictly advises that automated redistribution recommendations must undergo authorized healthcare operator review before physical dispatch.
* **Deterministic Baseline:** All empirical calculations reflect real mathematical solver outputs rather than static percentages.
