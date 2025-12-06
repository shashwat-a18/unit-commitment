"""
Solution Module - Represents the optimization solution.
Follows Single Responsibility Principle (SRP).
"""
from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class Solution:
    """
    Represents a unit commitment solution.
    
    Attributes:
        status: Unit on/off status [unit][period] (1=on, 0=off)
        power: Power output [unit][period] (MW)
        total_cost: Total cost of the solution ($)
        is_optimal: Whether the solution is proven optimal
        solve_time: Time taken to solve (seconds)
        metadata: Additional solver information
    """
    status: List[List[int]]
    power: List[List[float]]
    total_cost: float
    is_optimal: bool = False
    solve_time: float = 0.0
    metadata: Optional[Dict] = None
    
    def get_unit_status(self, unit_idx: int, period: int) -> int:
        """Get the status of a unit at a specific period."""
        return self.status[unit_idx][period]
    
    def get_unit_power(self, unit_idx: int, period: int) -> float:
        """Get the power output of a unit at a specific period."""
        return self.power[unit_idx][period]
    
    def get_total_power(self, period: int) -> float:
        """Get the total power output at a specific period."""
        return sum(self.power[i][period] for i in range(len(self.power)))
    
    def get_num_units(self) -> int:
        """Get the number of units in the solution."""
        return len(self.status)
    
    def get_num_periods(self) -> int:
        """Get the number of time periods in the solution."""
        return len(self.status[0]) if self.status else 0
