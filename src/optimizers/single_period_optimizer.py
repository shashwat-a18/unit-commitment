"""
Single Period Unit Commitment Optimizer.
Optimizes unit commitment for a single time period using linear programming.
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


class SinglePeriodOptimizer(IOptimizer):
    """
    Optimizes unit commitment for a single time period.
    
    This optimizer solves the economic dispatch problem for one time period,
    deciding which units to turn on and at what power level to minimize total cost.
    
    Decision Variables:
        - u[i]: Binary variable (1 if unit i is on, 0 otherwise)
        - p[i]: Continuous variable (power output of unit i in MW)
    
    Objective:
        Minimize: Sum of (startup_cost * u[i] + fuel_cost * p[i])
    
    Constraints:
        - Power balance: Sum of p[i] = demand
        - Capacity limits: u[i] * min_power <= p[i] <= u[i] * max_power
    """
    
    def __init__(self, tolerance: float = 1e-6):
        """
        Initialize the single period optimizer.
        
        Args:
            tolerance: Numerical tolerance for comparisons
        """
        self.tolerance = tolerance
        self.validator = ConstraintValidator()
    
    def validate_inputs(self, units: List[Unit], demand: Demand) -> bool:
        """Validate that the inputs are feasible for optimization."""
        if not units:
            raise ValueError("No units provided")
        
        if demand.get_periods() != 1:
            raise ValueError(
                f"SinglePeriodOptimizer requires exactly 1 demand period, "
                f"got {demand.get_periods()}"
            )
        
        # Check if total capacity can meet demand
        total_capacity = sum(unit.max_power for unit in units)
        required_demand = demand.get_demand(0)
        
        if total_capacity < required_demand - self.tolerance:
            raise ValueError(
                f"Insufficient capacity. Total: {total_capacity:.2f} MW, "
                f"Required: {required_demand:.2f} MW"
            )
        
        return True
    
    def optimize(self, units: List[Unit], demand: Demand) -> Solution:
        """
        Solve the single period unit commitment problem.
        
        Args:
            units: List of available generation units
            demand: Power demand (must have exactly 1 period)
            
        Returns:
            Solution object containing optimal unit commitment and dispatch
        """
        start_time = time.time()
        
        # Validate inputs
        self.validate_inputs(units, demand)
        
        # Get demand for the single period
        D = demand.get_demand(0)
        n = len(units)
        
        # Create the optimization problem
        problem = LpProblem("Single_Period_Unit_Commitment", LpMinimize)
        
        # Decision variables
        # u[i]: Binary variable (1 if unit i is on, 0 otherwise)
        u = [LpVariable(f"u_{i}", cat=LpBinary) for i in range(n)]
        
        # p[i]: Power output of unit i (MW)
        p = [LpVariable(f"p_{i}", lowBound=0, upBound=units[i].max_power) 
             for i in range(n)]
        
        # Objective function: Minimize total cost
        # Cost = startup cost + production cost
        startup_costs = lpSum([units[i].startup_cost * u[i] for i in range(n)])
        production_costs = lpSum([units[i].fuel_cost * p[i] for i in range(n)])
        problem += startup_costs + production_costs
        
        # Constraint 1: Power balance - total generation must meet demand
        problem += lpSum([p[i] for i in range(n)]) == D, "Power_Balance"
        
        # Constraint 2: Capacity limits for each unit
        for i in range(n):
            # Minimum power constraint when unit is on
            problem += p[i] >= units[i].min_power * u[i], f"Min_Power_{i}"
            
            # Maximum power constraint when unit is on
            problem += p[i] <= units[i].max_power * u[i], f"Max_Power_{i}"
        
        # Solve the problem
        problem.solve()
        
        # Extract solution
        status_solution = [[int(value(u[i]))] for i in range(n)]
        power_solution = [[float(value(p[i]))] for i in range(n)]
        total_cost = float(value(problem.objective))
        is_optimal = LpStatus[problem.status] == 'Optimal'
        
        solve_time = time.time() - start_time
        
        solution = Solution(
            status=status_solution,
            power=power_solution,
            total_cost=total_cost,
            is_optimal=is_optimal,
            solve_time=solve_time,
            metadata={
                'solver_status': LpStatus[problem.status],
                'num_units': n,
                'demand': D,
                'units_on': sum(status_solution[i][0] for i in range(n))
            }
        )
        
        # Validate the solution
        self.validator.validate_solution(solution, units, demand)
        
        return solution
