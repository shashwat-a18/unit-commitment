"""
Unit Module - Represents a power generation unit with its characteristics.
Follows Single Responsibility Principle (SRP).
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Unit:
    """
    Represents a power generation unit with its operational characteristics.
    
    Attributes:
        id: Unique identifier for the unit
        name: Human-readable name
        min_power: Minimum power output (MW)
        max_power: Maximum power output (MW)
        startup_cost: Cost to start up the unit ($)
        shutdown_cost: Cost to shut down the unit ($)
        fuel_cost: Fuel cost per MWh ($/MWh)
        min_uptime: Minimum continuous operating time (hours)
        min_downtime: Minimum continuous shutdown time (hours)
        ramp_up_rate: Maximum rate of power increase (MW/hour)
        ramp_down_rate: Maximum rate of power decrease (MW/hour)
        initial_status: Initial operating status (1=on, 0=off)
        initial_power: Initial power output (MW)
    """
    id: int
    name: str
    min_power: float
    max_power: float
    startup_cost: float
    shutdown_cost: float
    fuel_cost: float
    min_uptime: int = 1
    min_downtime: int = 1
    ramp_up_rate: float = float('inf')
    ramp_down_rate: float = float('inf')
    initial_status: int = 0
    initial_power: float = 0.0
    
    def __post_init__(self):
        """Validate unit parameters."""
        if self.min_power < 0:
            raise ValueError(f"Unit {self.id}: min_power must be non-negative")
        if self.max_power < self.min_power:
            raise ValueError(f"Unit {self.id}: max_power must be >= min_power")
        if self.startup_cost < 0 or self.shutdown_cost < 0:
            raise ValueError(f"Unit {self.id}: costs must be non-negative")
        if self.min_uptime < 1 or self.min_downtime < 1:
            raise ValueError(f"Unit {self.id}: min uptime/downtime must be >= 1")
    
    def can_produce(self, power: float) -> bool:
        """Check if the unit can produce the specified power output."""
        return self.min_power <= power <= self.max_power
    
    def calculate_production_cost(self, power: float) -> float:
        """Calculate the cost of producing specified power."""
        if not self.can_produce(power):
            raise ValueError(f"Power {power} MW outside unit capacity")
        return power * self.fuel_cost
