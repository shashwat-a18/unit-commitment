"""
Optimizer Interface - Defines the contract for optimization algorithms.
Follows Interface Segregation Principle (ISP) and Dependency Inversion Principle (DIP).
"""
from abc import ABC, abstractmethod
from typing import List
from src.core.unit import Unit
from src.core.demand import Demand
from src.core.solution import Solution


class IOptimizer(ABC):
    """
    Interface for unit commitment optimization algorithms.
    
    Different optimization algorithms can implement this interface,
    allowing for easy substitution (Open/Closed Principle).
    """
    
    @abstractmethod
    def optimize(self, units: List[Unit], demand: Demand) -> Solution:
        """
        Solve the unit commitment problem.
        
        Args:
            units: List of available generation units
            demand: Power demand over time periods
            
        Returns:
            Solution object containing optimal unit commitment and dispatch
        """
        pass
    
    @abstractmethod
    def validate_inputs(self, units: List[Unit], demand: Demand) -> bool:
        """
        Validate that the inputs are feasible for optimization.
        
        Args:
            units: List of available generation units
            demand: Power demand over time periods
            
        Returns:
            True if inputs are valid, raises exception otherwise
        """
        pass


class IConstraintValidator(ABC):
    """
    Interface for validating constraints in solutions.
    Separate interface following Interface Segregation Principle.
    """
    
    @abstractmethod
    def validate_solution(self, solution: Solution, units: List[Unit], 
                         demand: Demand) -> bool:
        """
        Validate that a solution satisfies all constraints.
        
        Args:
            solution: Proposed solution to validate
            units: List of generation units
            demand: Power demand requirements
            
        Returns:
            True if solution is valid, raises exception otherwise
        """
        pass
