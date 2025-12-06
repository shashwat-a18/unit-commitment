"""
Multi-Period Unit Commitment Optimizer.
Optimizes unit commitment across multiple time periods using mixed-integer linear programming.
Follows Open/Closed Principle (OCP) - extends IOptimizer without modifying it.
"""
import time
from typing import List
from pulp import LpProblem, LpMinimize, LpVariable, LpBinary, lpSum, LpStatus, value

from src.core.unit import Unit
from src.core.demand import Demand
from src.core.solution import Solution
from src.interfaces.optimizer import IOptimizer
from src.validators.constraint_validator import ConstraintValidator


class MultiPeriodOptimizer(IOptimizer):
    """
    Optimizes unit commitment across multiple time periods.
    
    This optimizer solves the full unit commitment problem considering:
    - Temporal coupling through minimum up/down time constraints
    - Ramp rate limits between consecutive periods
    - Startup and shutdown costs
    - Economic dispatch for each period
    
    Decision Variables:
        - u[i,t]: Binary variable (1 if unit i is on at time t, 0 otherwise)
        - p[i,t]: Continuous variable (power output of unit i at time t in MW)
        - v[i,t]: Binary variable (1 if unit i starts up at time t, 0 otherwise)
        - w[i,t]: Binary variable (1 if unit i shuts down at time t, 0 otherwise)
    
    Objective:
        Minimize: Sum over all units and time periods of:
            - startup_cost * v[i,t]
            - shutdown_cost * w[i,t]
            - fuel_cost * p[i,t]
    
    Constraints:
        - Power balance: For each period t, sum of p[i,t] = demand[t]
        - Capacity limits: u[i,t] * min_power <= p[i,t] <= u[i,t] * max_power
        - Startup/shutdown logic: v[i,t] - w[i,t] = u[i,t] - u[i,t-1]
        - Minimum uptime: Once started, must stay on for min_uptime periods
        - Minimum downtime: Once stopped, must stay off for min_downtime periods
        - Ramp rates: |p[i,t] - p[i,t-1]| <= ramp_limit
    """
    
    def __init__(self, tolerance: float = 1e-6):
        """
        Initialize the multi-period optimizer.
        
        Args:
            tolerance: Numerical tolerance for comparisons
        """
        self.tolerance = tolerance
        self.validator = ConstraintValidator()
    
    def validate_inputs(self, units: List[Unit], demand: Demand) -> bool:
        """Validate that the inputs are feasible for optimization."""
        if not units:
            raise ValueError("No units provided")
        
        num_periods = demand.get_periods()
        if num_periods < 2:
            raise ValueError(
                f"MultiPeriodOptimizer requires at least 2 demand periods, "
                f"got {num_periods}"
            )
        
        # Check if total capacity can meet peak demand
        total_capacity = sum(unit.max_power for unit in units)
        peak_demand = demand.get_peak_demand()
        
        if total_capacity < peak_demand - self.tolerance:
            raise ValueError(
                f"Insufficient capacity. Total: {total_capacity:.2f} MW, "
                f"Peak Demand: {peak_demand:.2f} MW"
            )
        
        return True
    
    def optimize(self, units: List[Unit], demand: Demand) -> Solution:
        """
        Solve the multi-period unit commitment problem.
        
        Args:
            units: List of available generation units
            demand: Power demand over multiple time periods
            
        Returns:
            Solution object containing optimal unit commitment and dispatch
        """
        start_time = time.time()
        
        # Validate inputs
        self.validate_inputs(units, demand)
        
        n = len(units)  # Number of units
        T = demand.get_periods()  # Number of time periods
        
        # Create the optimization problem
        problem = LpProblem("Multi_Period_Unit_Commitment", LpMinimize)
        
        # Decision variables
        # u[i,t]: Binary - 1 if unit i is on at time t
        u = [[LpVariable(f"u_{i}_{t}", cat=LpBinary) 
              for t in range(T)] for i in range(n)]
        
        # p[i,t]: Continuous - power output of unit i at time t
        p = [[LpVariable(f"p_{i}_{t}", lowBound=0, upBound=units[i].max_power) 
              for t in range(T)] for i in range(n)]
        
        # v[i,t]: Binary - 1 if unit i starts up at time t
        v = [[LpVariable(f"v_{i}_{t}", cat=LpBinary) 
              for t in range(T)] for i in range(n)]
        
        # w[i,t]: Binary - 1 if unit i shuts down at time t
        w = [[LpVariable(f"w_{i}_{t}", cat=LpBinary) 
              for t in range(T)] for i in range(n)]
        
        # ===== OBJECTIVE FUNCTION =====
        # Minimize total cost = startup costs + shutdown costs + production costs
        startup_costs = lpSum([
            units[i].startup_cost * v[i][t]
            for i in range(n) for t in range(T)
        ])
        
        shutdown_costs = lpSum([
            units[i].shutdown_cost * w[i][t]
            for i in range(n) for t in range(T)
        ])
        
        production_costs = lpSum([
            units[i].fuel_cost * p[i][t]
            for i in range(n) for t in range(T)
        ])
        
        problem += startup_costs + shutdown_costs + production_costs
        
        # ===== CONSTRAINTS =====
        
        # 1. Power balance: Total generation must meet demand in each period
        for t in range(T):
            problem += (
                lpSum([p[i][t] for i in range(n)]) == demand.get_demand(t),
                f"Power_Balance_{t}"
            )
        
        # 2. Capacity limits for each unit in each period
        for i in range(n):
            for t in range(T):
                # Minimum power when unit is on
                problem += (
                    p[i][t] >= units[i].min_power * u[i][t],
                    f"Min_Power_{i}_{t}"
                )
                
                # Maximum power when unit is on
                problem += (
                    p[i][t] <= units[i].max_power * u[i][t],
                    f"Max_Power_{i}_{t}"
                )
        
        # 3. Startup and shutdown logic
        for i in range(n):
            for t in range(T):
                if t == 0:
                    # Initial period: compare with initial status
                    problem += (
                        v[i][t] - w[i][t] == u[i][t] - units[i].initial_status,
                        f"Startup_Shutdown_{i}_{t}"
                    )
                else:
                    # Subsequent periods: compare with previous period
                    problem += (
                        v[i][t] - w[i][t] == u[i][t] - u[i][t-1],
                        f"Startup_Shutdown_{i}_{t}"
                    )
        
        # 4. Minimum uptime constraints
        for i in range(n):
            min_up = units[i].min_uptime
            for t in range(T):
                # If unit starts up at time t, it must stay on for min_uptime periods
                if t + min_up <= T:
                    problem += (
                        lpSum([u[i][tau] for tau in range(t, t + min_up)]) >= min_up * v[i][t],
                        f"Min_Uptime_{i}_{t}"
                    )
        
        # 5. Minimum downtime constraints
        for i in range(n):
            min_down = units[i].min_downtime
            for t in range(T):
                # If unit shuts down at time t, it must stay off for min_downtime periods
                if t + min_down <= T:
                    problem += (
                        lpSum([1 - u[i][tau] for tau in range(t, t + min_down)]) >= min_down * w[i][t],
                        f"Min_Downtime_{i}_{t}"
                    )
        
        # 6. Ramp rate constraints
        for i in range(n):
            if units[i].ramp_up_rate < float('inf') or units[i].ramp_down_rate < float('inf'):
                for t in range(T):
                    if t == 0:
                        # Ramp from initial power
                        prev_power = units[i].initial_power
                    else:
                        prev_power = p[i][t-1]
                    
                    # Ramp up limit
                    if units[i].ramp_up_rate < float('inf'):
                        problem += (
                            p[i][t] - prev_power <= units[i].ramp_up_rate,
                            f"Ramp_Up_{i}_{t}"
                        )
                    
                    # Ramp down limit
                    if units[i].ramp_down_rate < float('inf'):
                        problem += (
                            prev_power - p[i][t] <= units[i].ramp_down_rate,
                            f"Ramp_Down_{i}_{t}"
                        )
        
        # Solve the problem
        problem.solve()
        
        # Extract solution
        status_solution = [[int(value(u[i][t])) for t in range(T)] for i in range(n)]
        power_solution = [[float(value(p[i][t])) for t in range(T)] for i in range(n)]
        total_cost = float(value(problem.objective))
        is_optimal = LpStatus[problem.status] == 'Optimal'
        
        solve_time = time.time() - start_time
        
        # Calculate additional statistics
        total_startups = sum(int(value(v[i][t])) for i in range(n) for t in range(T))
        total_shutdowns = sum(int(value(w[i][t])) for i in range(n) for t in range(T))
        avg_units_on = sum(status_solution[i][t] for i in range(n) for t in range(T)) / T
        
        solution = Solution(
            status=status_solution,
            power=power_solution,
            total_cost=total_cost,
            is_optimal=is_optimal,
            solve_time=solve_time,
            metadata={
                'solver_status': LpStatus[problem.status],
                'num_units': n,
                'num_periods': T,
                'total_demand': demand.get_total_demand(),
                'peak_demand': demand.get_peak_demand(),
                'total_startups': total_startups,
                'total_shutdowns': total_shutdowns,
                'avg_units_on': avg_units_on
            }
        )
        
        # Validate the solution
        self.validator.validate_solution(solution, units, demand)
        
        return solution
