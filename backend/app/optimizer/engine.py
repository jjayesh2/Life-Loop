import time
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from scipy.optimize import milp, LinearConstraint

# Component-specific compatibility rules:
# Keys are (component_type, recipient_blood_group) -> List[donor_blood_group]
RBC_COMPATIBILITY = {
    "O-": ["O-"],
    "O+": ["O-", "O+"],
    "A-": ["O-", "A-"],
    "A+": ["O-", "O+", "A-", "A+"],
    "B-": ["O-", "B-"],
    "B+": ["O-", "O+", "B-", "B+"],
    "AB-": ["O-", "A-", "B-", "AB-"],
    "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]
}

# In plasma, AB is universal donor, O is universal recipient
PLASMA_COMPATIBILITY = {
    "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
    "O+": ["O+", "A+", "B+", "AB+"],
    "A-": ["A-", "A+", "AB-", "AB+"],
    "A+": ["A+", "AB+"],
    "B-": ["B-", "B+", "AB-", "AB+"],
    "B+": ["B+", "AB+"],
    "AB-": ["AB-", "AB+"],
    "AB+": ["AB+"]
}

PLATELET_COMPATIBILITY = {
    "O-": ["O-", "O+"],
    "O+": ["O+", "O-"],
    "A-": ["A-", "O-", "A+"],
    "A+": ["A+", "A-", "O+", "O-"],
    "B-": ["B-", "O-", "B+"],
    "B+": ["B+", "B-", "O+", "O-"],
    "AB-": ["AB-", "A-", "B-", "O-"],
    "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"]
}

def is_compatible(component: str, donor_group: str, recipient_group: str) -> bool:
    if donor_group == recipient_group:
        return True
    c_lower = component.lower()
    if "plasma" in c_lower or "cryo" in c_lower:
        allowed = PLASMA_COMPATIBILITY.get(recipient_group, [recipient_group])
        return donor_group in allowed
    elif "platelet" in c_lower:
        allowed = PLATELET_COMPATIBILITY.get(recipient_group, [recipient_group])
        return donor_group in allowed
    elif "red" in c_lower or "rbc" in c_lower or "whole" in c_lower:
        allowed = RBC_COMPATIBILITY.get(recipient_group, [recipient_group])
        return donor_group in allowed
    return donor_group == recipient_group

class MILPOptimizer:
    def __init__(
        self,
        facilities: List[Dict[str, Any]],
        inventory: List[Dict[str, Any]],
        demands: List[Dict[str, Any]],
        travel_time_matrix: Dict[Tuple[int, int], float],
        weights: Optional[Dict[str, float]] = None,
        now: Optional[datetime] = None
    ):
        self.facilities = {f["id"]: f for f in facilities}
        self.inventory = inventory
        self.demands = demands
        self.travel_time_matrix = travel_time_matrix
        self.now = now or datetime.now(timezone.utc).replace(tzinfo=None)
        
        # Default objective weights
        w = weights or {}
        self.w_unmet = w.get("unmet_demand", 100.0)
        self.w_expiry = w.get("expiry_risk", 15.0)
        self.w_travel = w.get("travel_time", 0.2)
        self.w_mismatch = w.get("type_mismatch_penalty", 5.0)  # prefer exact blood match when possible

    def solve(self) -> Dict[str, Any]:
        start_time = time.time()
        
        # 1. Filter eligible inventory:
        # Must be available, not quarantined, not expired, quantity > 0
        eligible_items = []
        for item in self.inventory:
            if item.get("status") != "available":
                continue
            qty = item.get("quantity", 0)
            if qty <= 0:
                continue
            exp = item.get("expiry_date")
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp.replace("Z", "+00:00")).replace(tzinfo=None)
            hours_to_exp = (exp - self.now).total_seconds() / 3600.0
            if hours_to_exp <= 0.5:
                # Expired or about to expire before transport
                continue
            item_copy = dict(item)
            item_copy["hours_to_expiry"] = hours_to_exp
            eligible_items.append(item_copy)

        # 2. Filter unmet demands
        active_demands = [d for d in self.demands if d.get("status") in ["unmet", "partially_fulfilled"] and d.get("quantity_needed", 0) > 0]
        
        if not eligible_items or not active_demands:
            runtime = time.time() - start_time
            return self._build_empty_result(runtime, "OPTIMAL_NO_ACTION_NEEDED")

        # 3. Build candidate transfer combinations:
        # item k at facility i -> demand d at facility j
        candidates = []
        for k_idx, item in enumerate(eligible_items):
            i = item["facility_id"]
            for d_idx, dem in enumerate(active_demands):
                j = dem["facility_id"]
                # Must be compatible component and blood group
                if item["component_type"] != dem["component_type"]:
                    continue
                if not is_compatible(item["component_type"], item["blood_group"], dem["blood_group"]):
                    continue
                
                # Transfers are strictly inter-facility (between distinct facilities)
                if i == j:
                    continue
                t_ij = self.travel_time_matrix.get((i, j), 35.0)
                
                # Arrival before expiry check
                if (t_ij / 60.0) >= item["hours_to_expiry"]:
                    continue
                # Arrival before demand deadline check
                deadline = dem.get("deadline_hours", 24.0)
                if (t_ij / 60.0) > deadline:
                    continue

                # Exact vs non-exact match penalty
                exact_match = (item["blood_group"] == dem["blood_group"])
                candidates.append({
                    "item_idx": k_idx,
                    "item": item,
                    "demand_idx": d_idx,
                    "demand": dem,
                    "origin_id": i,
                    "dest_id": j,
                    "travel_time": t_ij,
                    "exact_match": exact_match
                })

        num_candidates = len(candidates)
        num_demands = len(active_demands)
        num_items = len(eligible_items)

        if num_candidates == 0:
            runtime = time.time() - start_time
            return self._build_empty_result(runtime, "NO_FEASIBLE_TRANSFERS")

        # Decision Variables:
        # x_c: integer units transferred for candidate c (c = 0 .. num_candidates - 1)
        # u_d: integer unmet demand for demand d (d = 0 .. num_demands - 1)
        # Total variables: num_candidates + num_demands
        n_vars = num_candidates + num_demands
        
        # Objective vector c:
        # Minimize:
        # sum_c ( (w_travel * travel_time) + (w_mismatch if not exact) - (w_expiry / hours_to_expiry) ) * x_c
        # + sum_d (w_unmet * urgency_multiplier) * u_d
        c_obj = np.zeros(n_vars)
        for idx, cand in enumerate(candidates):
            t_ij = cand["travel_time"]
            mismatch_pen = 0.0 if cand["exact_match"] else self.w_mismatch
            # Prioritize moving items closer to expiry to avoid waste!
            # If hours_to_expiry is low, expiry bonus is higher (negative cost in min problem)
            expiry_bonus = self.w_expiry / max(cand["item"]["hours_to_expiry"], 1.0)
            c_obj[idx] = (self.w_travel * t_ij) + mismatch_pen - expiry_bonus

        for d_idx, dem in enumerate(active_demands):
            var_idx = num_candidates + d_idx
            urg = dem.get("urgency", "urgent").lower()
            urg_mult = 3.0 if urg == "critical" else (1.5 if urg == "urgent" else 1.0)
            c_obj[var_idx] = self.w_unmet * urg_mult

        # Variable Bounds:
        # 0 <= x_c <= min(item.quantity, demand.quantity_needed)
        # 0 <= u_d <= demand.quantity_needed
        integrality = np.ones(n_vars)  # All are integer variables
        
        # Build Linear Constraints:
        # 1. Demand balance for each demand d:
        # sum_{c with demand=d} x_c + u_d == demand.quantity_needed
        # 2. Item capacity for each item k:
        # sum_{c with item=k} x_c <= item.quantity
        # 3. Safety reserve for each facility i:
        # Total stock remaining at facility i >= facility.safety_reserve_units
        # i.e., sum_{k at facility i} item.quantity - sum_{c with origin=i and dest!=i} x_c >= safety_reserve
        # => sum_{c with origin=i and dest!=i} x_c <= sum_{k at i} item.quantity - safety_reserve

        rows = []
        b_l = []
        b_u = []

        # 1. Demand constraints:
        for d_idx, dem in enumerate(active_demands):
            row = np.zeros(n_vars)
            for c_idx, cand in enumerate(candidates):
                if cand["demand_idx"] == d_idx:
                    row[c_idx] = 1.0
            row[num_candidates + d_idx] = 1.0  # unmet variable u_d
            rows.append(row)
            needed = float(dem["quantity_needed"])
            b_l.append(needed)
            b_u.append(needed)

        # 2. Item capacity constraints:
        for k_idx, item in enumerate(eligible_items):
            row = np.zeros(n_vars)
            has_cand = False
            for c_idx, cand in enumerate(candidates):
                if cand["item_idx"] == k_idx:
                    row[c_idx] = 1.0
                    has_cand = True
            if has_cand:
                rows.append(row)
                b_l.append(0.0)
                b_u.append(float(item["quantity"]))

        # 3. Facility reserve constraints:
        for f_id, facility in self.facilities.items():
            reserve = float(facility.get("safety_reserve_units", 10))
            # Calculate total current inventory at facility f_id
            total_f_inventory = sum(item["quantity"] for item in eligible_items if item["facility_id"] == f_id)
            max_outflow = max(0.0, float(total_f_inventory) - reserve)

            row = np.zeros(n_vars)
            has_outflow = False
            for c_idx, cand in enumerate(candidates):
                # Outflow to other facilities only
                if cand["origin_id"] == f_id and cand["dest_id"] != f_id:
                    row[c_idx] = 1.0
                    has_outflow = True
            if has_outflow:
                rows.append(row)
                b_l.append(0.0)
                b_u.append(max_outflow)

        A = np.array(rows)
        b_l = np.array(b_l)
        b_u = np.array(b_u)
        constraints = LinearConstraint(A, b_l, b_u)

        # Solve with SciPy HiGHS MILP solver
        solver_res = milp(c=c_obj, integrality=integrality, constraints=constraints)
        runtime = time.time() - start_time

        if not solver_res.success:
            return {
                "run_id": f"RUN-{int(time.time())}",
                "solver_name": "HiGHS-MILP",
                "solver_status": solver_res.message,
                "is_feasible": False,
                "runtime_seconds": round(runtime, 4),
                "objective_value": None,
                "proposed_transfers": [],
                "unmet_demand_count": sum(d["quantity_needed"] for d in active_demands),
                "prevented_waste_units": 0,
                "total_travel_time_minutes": 0.0,
                "constraint_validation": {"is_valid": False, "violations": ["Solver could not find feasible integer solution"]},
                "baseline_comparison": self._compute_baseline(active_demands, eligible_items, []),
                "created_at": datetime.utcnow().isoformat()
            }

        # Extract solution
        sol_x = np.round(solver_res.x).astype(int)
        proposed_transfers = []
        total_travel_time = 0.0
        prevented_waste = 0

        for c_idx, cand in enumerate(candidates):
            units_transferred = int(sol_x[c_idx])
            if units_transferred > 0:
                item = cand["item"]
                dem = cand["demand"]
                origin_facility = self.facilities.get(cand["origin_id"], {})
                dest_facility = self.facilities.get(cand["dest_id"], {})
                t_ij = cand["travel_time"]
                total_travel_time += (t_ij * units_transferred)
                
                if item["hours_to_expiry"] < 72.0:
                    prevented_waste += units_transferred

                exp_str = (
                    f"Redistributed {units_transferred} unit(s) of {item['blood_group']} {item['component_type']} "
                    f"from {origin_facility.get('name', 'Origin')} to {dest_facility.get('name', 'Dest')}. "
                    f"Travel time is {int(t_ij)} min. "
                    f"Donor batch has {round(item['hours_to_expiry'], 1)}h remaining before expiry, "
                    f"preventing spoilage while fulfilling {dem.get('urgency', 'urgent')} patient demand."
                )

                proposed_transfers.append({
                    "origin_id": cand["origin_id"],
                    "origin_name": origin_facility.get("name", "Unknown Origin"),
                    "destination_id": cand["dest_id"],
                    "destination_name": dest_facility.get("name", "Unknown Destination"),
                    "item_id": item["id"],
                    "tracking_id": item["tracking_id"],
                    "blood_group": item["blood_group"],
                    "component_type": item["component_type"],
                    "quantity": units_transferred,
                    "travel_time_minutes": t_ij,
                    "hours_until_expiry": round(item["hours_to_expiry"], 1),
                    "explanation": exp_str
                })

        # Calculate remaining unmet demand
        unmet_count = 0
        for d_idx, dem in enumerate(active_demands):
            u_val = sol_x[num_candidates + d_idx]
            unmet_count += int(u_val)

        # Post-solution validation of hard constraints
        validation = self._validate_solution(proposed_transfers, eligible_items, active_demands)

        # Baseline comparison
        baseline_comp = self._compute_baseline(active_demands, eligible_items, proposed_transfers)

        return {
            "run_id": f"RUN-{int(time.time())}",
            "solver_name": "HiGHS-MILP",
            "solver_status": "Optimal",
            "is_feasible": True,
            "runtime_seconds": round(runtime, 4),
            "objective_value": round(float(solver_res.fun), 2),
            "proposed_transfers": proposed_transfers,
            "unmet_demand_count": unmet_count,
            "prevented_waste_units": prevented_waste,
            "total_travel_time_minutes": round(total_travel_time, 1),
            "constraint_validation": validation,
            "baseline_comparison": baseline_comp,
            "created_at": datetime.utcnow().isoformat()
        }

    def _validate_solution(
        self,
        transfers: List[Dict[str, Any]],
        items: List[Dict[str, Any]],
        demands: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Independent post-solution validation against all hard constraints."""
        violations = []
        
        # 1. Check item quantities not over-allocated
        item_qty_allocated = {}
        for t in transfers:
            item_id = t["item_id"]
            item_qty_allocated[item_id] = item_qty_allocated.get(item_id, 0) + t["quantity"]
        
        for item in items:
            allocated = item_qty_allocated.get(item["id"], 0)
            if allocated > item["quantity"]:
                violations.append(f"Over-allocated item {item['tracking_id']}: {allocated} > {item['quantity']}")

        # 2. Check travel time vs expiry
        for t in transfers:
            if (t["travel_time_minutes"] / 60.0) >= t["hours_until_expiry"]:
                violations.append(f"Transfer {t['tracking_id']} arrives after expiry! ({t['travel_time_minutes']}m >= {t['hours_until_expiry']}h)")

        # 3. Check facility safety reserves
        outflow_by_facility = {}
        for t in transfers:
            if t["origin_id"] != t["destination_id"]:
                outflow_by_facility[t["origin_id"]] = outflow_by_facility.get(t["origin_id"], 0) + t["quantity"]

        for f_id, facility in self.facilities.items():
            total_stock = sum(it["quantity"] for it in items if it["facility_id"] == f_id)
            outflow = outflow_by_facility.get(f_id, 0)
            remaining = total_stock - outflow
            reserve = facility.get("safety_reserve_units", 10)
            if remaining < reserve and outflow > 0:
                violations.append(f"Facility {facility['name']} reserve violated: remaining {remaining} < reserve {reserve}")

        # 4. Check compatibility
        for t in transfers:
            # find matching demand
            dest_demands = [d for d in demands if d["facility_id"] == t["destination_id"] and d["component_type"] == t["component_type"]]
            any_compat = any(is_compatible(t["component_type"], t["blood_group"], d["blood_group"]) for d in dest_demands)
            if not any_compat:
                violations.append(f"Transfer {t['blood_group']} {t['component_type']} is incompatible with recipient demands at facility {t['destination_id']}")

        return {
            "is_valid": len(violations) == 0,
            "violations": violations,
            "checks_run": [
                "No Over-allocation of inventory batches",
                "Expiry safety margin respected during transport",
                "Facility safety reserve thresholds strictly enforced",
                "Component-specific immunohematology compatibility validated"
            ]
        }

    def _compute_baseline(
        self,
        demands: List[Dict[str, Any]],
        items: List[Dict[str, Any]],
        transfers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculates baseline strategy ('No Redistribution / Local Only')
        vs optimized MILP redistribution.
        """
        total_demand = sum(d["quantity_needed"] for d in demands)
        
        # Baseline: each facility only uses its own local inventory
        baseline_unmet = 0
        baseline_expired_waste = 0
        for dem in demands:
            f_id = dem["facility_id"]
            local_stock = sum(
                it["quantity"] for it in items 
                if it["facility_id"] == f_id 
                and it["component_type"] == dem["component_type"]
                and is_compatible(it["component_type"], it["blood_group"], dem["blood_group"])
            )
            unmet = max(0, dem["quantity_needed"] - local_stock)
            baseline_unmet += unmet

        # Baseline expiring units that get wasted because local demand is zero
        for it in items:
            if it["hours_to_expiry"] <= 48.0:
                f_id = it["facility_id"]
                has_local_demand = any(
                    d["facility_id"] == f_id 
                    and d["component_type"] == it["component_type"]
                    for d in demands
                )
                if not has_local_demand:
                    baseline_expired_waste += it["quantity"]

        # Optimized metrics:
        optimized_transferred = sum(t["quantity"] for t in transfers)
        optimized_unmet = max(0, baseline_unmet - optimized_transferred)
        
        # Prevented waste: units moved before expiry
        units_moved_near_expiry = sum(t["quantity"] for t in transfers if t["hours_until_expiry"] <= 48.0)
        optimized_expired_waste = max(0, baseline_expired_waste - units_moved_near_expiry)

        service_level_baseline = round(((total_demand - baseline_unmet) / max(total_demand, 1)) * 100.0, 1)
        service_level_optimized = round(((total_demand - optimized_unmet) / max(total_demand, 1)) * 100.0, 1)

        unmet_reduction_pct = 0.0
        if baseline_unmet > 0:
            unmet_reduction_pct = round(((baseline_unmet - optimized_unmet) / baseline_unmet) * 100.0, 1)

        waste_reduction_pct = 0.0
        if baseline_expired_waste > 0:
            waste_reduction_pct = round(((baseline_expired_waste - optimized_expired_waste) / baseline_expired_waste) * 100.0, 1)

        return {
            "total_demand_units": total_demand,
            "baseline": {
                "name": "No Redistribution (Local-Only Stock)",
                "unmet_demand_units": baseline_unmet,
                "projected_expired_waste_units": baseline_expired_waste,
                "service_level_pct": service_level_baseline,
                "transfers_dispatched": 0,
                "units_moved": 0,
                "transport_time_minutes": 0.0
            },
            "life_loop_optimized": {
                "name": "Life-Loop MILP Optimal Redistribution",
                "unmet_demand_units": optimized_unmet,
                "projected_expired_waste_units": optimized_expired_waste,
                "service_level_pct": service_level_optimized,
                "transfers_dispatched": len(transfers),
                "units_moved": optimized_transferred,
                "transport_time_minutes": sum(t["travel_time_minutes"] * t["quantity"] for t in transfers)
            },
            "improvement": {
                "unmet_demand_reduction_pct": unmet_reduction_pct,
                "waste_reduction_pct": waste_reduction_pct,
                "service_level_gain_pct": round(service_level_optimized - service_level_baseline, 1)
            }
        }

    def _build_empty_result(self, runtime: float, status: str) -> Dict[str, Any]:
        return {
            "run_id": f"RUN-{int(time.time())}",
            "solver_name": "HiGHS-MILP",
            "solver_status": status,
            "is_feasible": True,
            "runtime_seconds": round(runtime, 4),
            "objective_value": 0.0,
            "proposed_transfers": [],
            "unmet_demand_count": sum(d.get("quantity_needed", 0) for d in self.demands),
            "prevented_waste_units": 0,
            "total_travel_time_minutes": 0.0,
            "constraint_validation": {"is_valid": True, "violations": []},
            "baseline_comparison": {
                "baseline": {"unmet_demand_units": 0, "projected_expired_waste_units": 0, "service_level_pct": 100.0},
                "life_loop_optimized": {"unmet_demand_units": 0, "projected_expired_waste_units": 0, "service_level_pct": 100.0},
                "improvement": {"unmet_demand_reduction_pct": 0.0, "waste_reduction_pct": 0.0}
            },
            "created_at": datetime.utcnow().isoformat()
        }
