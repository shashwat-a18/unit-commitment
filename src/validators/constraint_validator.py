"""
Constraint Validator - Validates unit commitment solutions.
Follows Single Responsibility Principle (SRP).
"""
from typing import List
from src.core.unit import Unit
from src.core.demand import Demand
from src.core.solution import Solution
from src.interfaces.optimizer import IConstraintValidator


class ConstraintValidator(IConstraintValidator):
    """
    Validates that unit commitment solutions satisfy all constraints.
    """
    
    def validate_solution(self, solution: Solution, units: List[Unit], 
                         demand: Demand) -> bool:
        """Validate that a solution satisfies all constraints."""
        self._validate_power_balance(solution, demand)
        self._validate_capacity_limits(solution, units)
        self._validate_ramp_rates(solution, units)
        self._validate_min_uptime_downtime(solution, units)
        return True
    
    def _validate_power_balance(self, solution: Solution, demand: Demand):
        """Ensure power generation meets demand in each period."""
        num_periods = demand.get_periods()
        for t in range(num_periods):
            total_power = solution.get_total_power(t)
            required_demand = demand.get_demand(t)
            if abs(total_power - required_demand) > 1e-6:
                raise ValueError(
                    f"Period {t}: Power balance violated. "
                    f"Generated: {total_power:.2f} MW, Required: {required_demand:.2f} MW"
                )
    
    def _validate_capacity_limits(self, solution: Solution, units: List[Unit]):
        """Ensure each unit operates within its capacity limits."""
        num_periods = solution.get_num_periods()
        for i, unit in enumerate(units):
            for t in range(num_periods):
                status = solution.get_unit_status(i, t)
                power = solution.get_unit_power(i, t)
                
                if status == 1:
                    if power < unit.min_power - 1e-6 or power > unit.max_power + 1e-6:
                        raise ValueError(
                            f"Unit {unit.id}, Period {t}: Power {power:.2f} MW "
                            f"outside capacity [{unit.min_power}, {unit.max_power}] MW"
                        )
                elif status == 0:
                    if power > 1e-6:
                        raise ValueError(
                            f"Unit {unit.id}, Period {t}: Unit is off but "
                            f"producing {power:.2f} MW"
                        )
    
    def _validate_ramp_rates(self, solution: Solution, units: List[Unit]):
        """Ensure ramp rate constraints are satisfied."""
        num_periods = solution.get_num_periods()
        if num_periods <= 1:
            return
        
        for i, unit in enumerate(units):
            # Check initial ramp if unit starts with power
            prev_power = unit.initial_power
            
            for t in range(num_periods):
                curr_power = solution.get_unit_power(i, t)
                power_change = curr_power - prev_power
                
                if power_change > unit.ramp_up_rate + 1e-6:
                    raise ValueError(
                        f"Unit {unit.id}, Period {t}: Ramp up violation. "
                        f"Change: {power_change:.2f} MW/h, Limit: {unit.ramp_up_rate} MW/h"
                    )
                
                if power_change < -unit.ramp_down_rate - 1e-6:
                    raise ValueError(
                        f"Unit {unit.id}, Period {t}: Ramp down violation. "
                        f"Change: {power_change:.2f} MW/h, Limit: {unit.ramp_down_rate} MW/h"
                    )
                
                prev_power = curr_power
    
    def _validate_min_uptime_downtime(self, solution: Solution, units: List[Unit]):
        """Ensure minimum uptime and downtime constraints are satisfied."""
        num_periods = solution.get_num_periods()
        
        for i, unit in enumerate(units):
            prev_status = unit.initial_status
            consecutive_on = 0 if prev_status == 0 else 1
            consecutive_off = 0 if prev_status == 1 else 1
            
            for t in range(num_periods):
                curr_status = solution.get_unit_status(i, t)
                
                if curr_status == 1:
                    consecutive_on += 1
                    if prev_status == 0:  # Just turned on
                        if consecutive_off < unit.min_downtime:
                            raise ValueError(
                                f"Unit {unit.id}, Period {t}: Min downtime violation. "
                                f"Was off for {consecutive_off} periods, need {unit.min_downtime}"
                            )
                        consecutive_off = 0
                else:  # curr_status == 0
                    consecutive_off += 1
                    if prev_status == 1:  # Just turned off
                        if consecutive_on < unit.min_uptime:
                            raise ValueError(
                                f"Unit {unit.id}, Period {t}: Min uptime violation. "
                                f"Was on for {consecutive_on} periods, need {unit.min_uptime}"
                            )
                        consecutive_on = 0
                
                prev_status = curr_status
