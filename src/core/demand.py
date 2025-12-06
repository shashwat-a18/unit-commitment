"""
Demand Module - Represents power demand over time periods.
Follows Single Responsibility Principle (SRP).
"""
from typing import List
from dataclasses import dataclass


@dataclass
class Demand:
    """
    Represents power demand for time periods.
    
    Attributes:
        values: List of demand values (MW) for each time period
    """
    values: List[float]
    
    def __post_init__(self):
        """Validate demand data."""
        if not self.values:
            raise ValueError("Demand values cannot be empty")
        if any(d < 0 for d in self.values):
            raise ValueError("Demand values must be non-negative")
    
    def get_demand(self, period: int) -> float:
        """Get demand for a specific period."""
        if not 0 <= period < len(self.values):
            raise IndexError(f"Period {period} out of range")
        return self.values[period]
    
    def get_periods(self) -> int:
        """Get the number of time periods."""
        return len(self.values)
    
    def get_total_demand(self) -> float:
        """Get the total demand across all periods."""
        return sum(self.values)
    
    def get_peak_demand(self) -> float:
        """Get the peak demand value."""
        return max(self.values)
