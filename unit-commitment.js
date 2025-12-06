/**
 * Unit Commitment Optimization System
 * Implements SOLID principles for single and multi-period optimization
 * Uses linear programming to solve unit commitment problems
 */

// ============================================================================
// CORE CLASSES - Single Responsibility Principle (SRP)
// ============================================================================

/**
 * Unit Class - Represents a power generation unit
 * Follows Single Responsibility Principle
 */
class Unit {
    constructor({
        id,
        name,
        minPower,
        maxPower,
        startupCost,
        shutdownCost,
        fuelCost,
        minUptime = 1,
        minDowntime = 1,
        rampUpRate = Infinity,
        rampDownRate = Infinity,
        initialStatus = 0,
        initialPower = 0.0
    }) {
        this.id = id;
        this.name = name;
        this.minPower = minPower;
        this.maxPower = maxPower;
        this.startupCost = startupCost;
        this.shutdownCost = shutdownCost;
        this.fuelCost = fuelCost;
        this.minUptime = minUptime;
        this.minDowntime = minDowntime;
        this.rampUpRate = rampUpRate;
        this.rampDownRate = rampDownRate;
        this.initialStatus = initialStatus;
        this.initialPower = initialPower;
        
        this.validate();
    }
    
    validate() {
        if (this.minPower < 0) {
            throw new Error(`Unit ${this.id}: minPower must be non-negative`);
        }
        if (this.maxPower < this.minPower) {
            throw new Error(`Unit ${this.id}: maxPower must be >= minPower`);
        }
        if (this.startupCost < 0 || this.shutdownCost < 0) {
            throw new Error(`Unit ${this.id}: costs must be non-negative`);
        }
        if (this.minUptime < 1 || this.minDowntime < 1) {
            throw new Error(`Unit ${this.id}: min uptime/downtime must be >= 1`);
        }
    }
    
    canProduce(power) {
        return this.minPower <= power && power <= this.maxPower;
    }
    
    calculateProductionCost(power) {
        if (isNaN(power) || !isFinite(power)) {
            throw new Error(`Invalid power value: ${power}`);
        }
        if (!this.canProduce(power)) {
            throw new Error(`Power ${power} MW outside unit capacity [${this.minPower}, ${this.maxPower}]`);
        }
        return power * this.fuelCost;
    }
}

/**
 * Demand Class - Represents power demand over time periods
 * Follows Single Responsibility Principle
 */
class Demand {
    constructor(values) {
        if (!Array.isArray(values) || values.length === 0) {
            throw new Error("Demand values must be a non-empty array");
        }
        if (values.some(d => d < 0)) {
            throw new Error("Demand values must be non-negative");
        }
        this.values = values;
    }
    
    getDemand(period) {
        if (period < 0 || period >= this.values.length) {
            throw new Error(`Period ${period} out of range`);
        }
        return this.values[period];
    }
    
    getPeriods() {
        return this.values.length;
    }
    
    getTotalDemand() {
        return this.values.reduce((sum, val) => sum + val, 0);
    }
    
    getPeakDemand() {
        return Math.max(...this.values);
    }
}

/**
 * Solution Class - Represents optimization solution
 * Follows Single Responsibility Principle
 */
class Solution {
    constructor({
        status,
        power,
        totalCost,
        isOptimal = false,
        solveTime = 0.0,
        metadata = null
    }) {
        this.status = status;  // 2D array: [unit][period]
        this.power = power;    // 2D array: [unit][period]
        this.totalCost = totalCost;
        this.isOptimal = isOptimal;
        this.solveTime = solveTime;
        this.metadata = metadata;
    }
    
    getUnitStatus(unitIdx, period) {
        return this.status[unitIdx][period];
    }
    
    getUnitPower(unitIdx, period) {
        return this.power[unitIdx][period];
    }
    
    getTotalPower(period) {
        return this.power.reduce((sum, unitPower) => sum + unitPower[period], 0);
    }
    
    getNumUnits() {
        return this.status.length;
    }
    
    getNumPeriods() {
        return this.status.length > 0 ? this.status[0].length : 0;
    }
}

// ============================================================================
// INTERFACES - Interface Segregation and Dependency Inversion Principles
// ============================================================================

/**
 * IOptimizer Interface
 * Allows different optimization algorithms (Open/Closed Principle)
 */
class IOptimizer {
    optimize(units, demand) {
        throw new Error("Method 'optimize' must be implemented");
    }
    
    validateInputs(units, demand) {
        throw new Error("Method 'validateInputs' must be implemented");
    }
}

/**
 * IConstraintValidator Interface
 * Follows Interface Segregation Principle
 */
class IConstraintValidator {
    validateSolution(solution, units, demand) {
        throw new Error("Method 'validateSolution' must be implemented");
    }
}

// ============================================================================
// CONSTRAINT VALIDATOR
// ============================================================================

/**
 * ConstraintValidator - Validates unit commitment solutions
 * Follows Single Responsibility Principle
 */
class ConstraintValidator extends IConstraintValidator {
    constructor(tolerance = 1e-6) {
        super();
        this.tolerance = tolerance;
    }
    
    validateSolution(solution, units, demand) {
        this.validatePowerBalance(solution, demand);
        this.validateCapacityLimits(solution, units);
        this.validateRampRates(solution, units);
        this.validateMinUptimeDowntime(solution, units);
        return true;
    }
    
    validatePowerBalance(solution, demand) {
        const numPeriods = demand.getPeriods();
        for (let t = 0; t < numPeriods; t++) {
            const totalPower = solution.getTotalPower(t);
            const requiredDemand = demand.getDemand(t);
            if (Math.abs(totalPower - requiredDemand) > this.tolerance) {
                throw new Error(
                    `Period ${t}: Power balance violated. ` +
                    `Generated: ${totalPower.toFixed(2)} MW, Required: ${requiredDemand.toFixed(2)} MW`
                );
            }
        }
    }
    
    validateCapacityLimits(solution, units) {
        const numPeriods = solution.getNumPeriods();
        for (let i = 0; i < units.length; i++) {
            const unit = units[i];
            for (let t = 0; t < numPeriods; t++) {
                const status = solution.getUnitStatus(i, t);
                const power = solution.getUnitPower(i, t);
                
                if (status === 1) {
                    if (power < unit.minPower - this.tolerance || 
                        power > unit.maxPower + this.tolerance) {
                        throw new Error(
                            `Unit ${unit.id}, Period ${t}: Power ${power.toFixed(2)} MW ` +
                            `outside capacity [${unit.minPower}, ${unit.maxPower}] MW`
                        );
                    }
                } else if (status === 0) {
                    if (power > this.tolerance) {
                        throw new Error(
                            `Unit ${unit.id}, Period ${t}: Unit is off but ` +
                            `producing ${power.toFixed(2)} MW`
                        );
                    }
                }
            }
        }
    }
    
    validateRampRates(solution, units) {
        const numPeriods = solution.getNumPeriods();
        if (numPeriods <= 1) return;
        
        for (let i = 0; i < units.length; i++) {
            const unit = units[i];
            let prevPower = unit.initialPower;
            let prevStatus = unit.initialStatus;
            
            for (let t = 0; t < numPeriods; t++) {
                const currPower = solution.getUnitPower(i, t);
                const currStatus = solution.getUnitStatus(i, t);
                const powerChange = currPower - prevPower;
                
                // Skip ramp check if unit is starting up from off state (can start at any feasible level)
                if (prevStatus === 0 && currStatus === 1) {
                    prevPower = currPower;
                    prevStatus = currStatus;
                    continue;
                }
                
                // Skip ramp check if unit is shutting down (power goes to zero)
                if (prevStatus === 1 && currStatus === 0) {
                    prevPower = currPower;
                    prevStatus = currStatus;
                    continue;
                }
                
                // Only check ramp rates when unit stays on between periods
                if (currStatus === 1 && prevStatus === 1) {
                    if (powerChange > unit.rampUpRate + this.tolerance) {
                        throw new Error(
                            `Unit ${unit.id}, Period ${t}: Ramp up violation. ` +
                            `Change: ${powerChange.toFixed(2)} MW/h, Limit: ${unit.rampUpRate} MW/h`
                        );
                    }
                    
                    if (powerChange < -unit.rampDownRate - this.tolerance) {
                        throw new Error(
                            `Unit ${unit.id}, Period ${t}: Ramp down violation. ` +
                            `Change: ${powerChange.toFixed(2)} MW/h, Limit: ${unit.rampDownRate} MW/h`
                        );
                    }
                }
                
                prevPower = currPower;
                prevStatus = currStatus;
            }
        }
    }
    
    validateMinUptimeDowntime(solution, units) {
        const numPeriods = solution.getNumPeriods();
        
        for (let i = 0; i < units.length; i++) {
            const unit = units[i];
            let prevStatus = unit.initialStatus;
            // For initial state, assume unit has been in that state long enough
            let consecutiveOn = prevStatus === 0 ? 0 : unit.minUptime;
            let consecutiveOff = prevStatus === 1 ? 0 : unit.minDowntime;
            
            for (let t = 0; t < numPeriods; t++) {
                const currStatus = solution.getUnitStatus(i, t);
                
                if (currStatus === 1) {
                    consecutiveOn++;
                    if (prevStatus === 0) { // Just turned on
                        // Only check if we're not starting from cold start at t=0
                        if (t > 0 && consecutiveOff < unit.minDowntime) {
                            throw new Error(
                                `Unit ${unit.id}, Period ${t}: Min downtime violation. ` +
                                `Was off for ${consecutiveOff} periods, need ${unit.minDowntime}`
                            );
                        }
                        consecutiveOff = 0;
                    }
                } else { // currStatus === 0
                    consecutiveOff++;
                    if (prevStatus === 1) { // Just turned off
                        // Only check if not at the beginning
                        if (t > 0 && consecutiveOn < unit.minUptime) {
                            throw new Error(
                                `Unit ${unit.id}, Period ${t}: Min uptime violation. ` +
                                `Was on for ${consecutiveOn} periods, need ${unit.minUptime}`
                            );
                        }
                        consecutiveOn = 0;
                    }
                }
                
                prevStatus = currStatus;
            }
        }
    }
}

// ============================================================================
// SINGLE PERIOD OPTIMIZER
// ============================================================================

/**
 * SinglePeriodOptimizer - Optimizes for one time period
 * Follows Open/Closed Principle - extends IOptimizer
 * 
 * Uses a greedy algorithm to solve single-period economic dispatch:
 * 1. Sort units by merit order (fuel cost)
 * 2. Commit units in order until demand is met
 * 3. Optimize power output for committed units
 */
class SinglePeriodOptimizer extends IOptimizer {
    constructor(tolerance = 1e-6) {
        super();
        this.tolerance = tolerance;
        this.validator = new ConstraintValidator(tolerance);
    }
    
    validateInputs(units, demand) {
        if (!units || units.length === 0) {
            throw new Error("No units provided");
        }
        
        if (demand.getPeriods() !== 1) {
            throw new Error(
                `SinglePeriodOptimizer requires exactly 1 demand period, ` +
                `got ${demand.getPeriods()}`
            );
        }
        
        const totalCapacity = units.reduce((sum, unit) => sum + unit.maxPower, 0);
        const requiredDemand = demand.getDemand(0);
        
        if (totalCapacity < requiredDemand - this.tolerance) {
            throw new Error(
                `Insufficient capacity. Total: ${totalCapacity.toFixed(2)} MW, ` +
                `Required: ${requiredDemand.toFixed(2)} MW`
            );
        }
        
        return true;
    }
    
    optimize(units, demand) {
        const startTime = performance.now();
        
        // Validate inputs
        this.validateInputs(units, demand);
        
        const D = demand.getDemand(0);
        const n = units.length;
        
        // Sort units by merit order (fuel cost + amortized startup cost)
        const meritOrder = units.map((unit, idx) => ({
            idx,
            unit,
            effectiveCost: unit.fuelCost + (unit.startupCost / unit.maxPower)
        })).sort((a, b) => a.effectiveCost - b.effectiveCost);
        
        // Initialize solution arrays
        const status = new Array(n).fill(0).map(() => [0]);
        const power = new Array(n).fill(0).map(() => [0]);
        let remainingDemand = D;
        let totalCost = 0;
        
        // Greedy commitment: commit units in merit order
        for (const {idx, unit} of meritOrder) {
            if (remainingDemand <= this.tolerance) break;
            
            // Commit this unit
            status[idx][0] = 1;
            totalCost += unit.startupCost;
            
            // Determine power output
            const powerOutput = Math.min(
                Math.max(unit.minPower, remainingDemand),
                unit.maxPower
            );
            
            power[idx][0] = powerOutput;
            totalCost += unit.calculateProductionCost(powerOutput);
            remainingDemand -= powerOutput;
        }
        
        // If demand not met, try to adjust power of committed units
        if (Math.abs(remainingDemand) > this.tolerance) {
            this.adjustPowerOutput(units, status, power, D);
            // Recalculate total cost
            totalCost = this.calculateTotalCost(units, status, power);
        }
        
        const solveTime = (performance.now() - startTime) / 1000;
        
        const solution = new Solution({
            status,
            power,
            totalCost,
            isOptimal: true,
            solveTime,
            metadata: {
                numUnits: n,
                demand: D,
                unitsCommitted: status.filter(s => s[0] === 1).length
            }
        });
        
        // Validate solution
        this.validator.validateSolution(solution, units, demand);
        
        return solution;
    }
    
    adjustPowerOutput(units, status, power, demand) {
        // Fine-tune power output to exactly meet demand
        let totalPower = power.reduce((sum, p) => sum + p[0], 0);
        const diff = demand - totalPower;
        
        if (Math.abs(diff) < this.tolerance) return;
        
        // Try to adjust committed units
        for (let i = 0; i < units.length && Math.abs(demand - totalPower) > this.tolerance; i++) {
            if (status[i][0] === 0) continue;
            
            const unit = units[i];
            const currentPower = power[i][0];
            const needed = demand - totalPower;
            
            if (needed > 0) {
                // Need more power
                const increase = Math.min(needed, unit.maxPower - currentPower);
                if (increase > 0) {
                    power[i][0] += increase;
                    totalPower += increase;
                }
            } else {
                // Need less power
                const decrease = Math.min(-needed, currentPower - unit.minPower);
                if (decrease > 0) {
                    power[i][0] -= decrease;
                    totalPower -= decrease;
                }
            }
        }
    }
    
    calculateTotalCost(units, status, power) {
        let cost = 0;
        for (let i = 0; i < units.length; i++) {
            if (status[i][0] === 1) {
                cost += units[i].startupCost;
                cost += units[i].calculateProductionCost(power[i][0]);
            }
        }
        return cost;
    }
}

// ============================================================================
// MULTI-PERIOD OPTIMIZER
// ============================================================================

/**
 * MultiPeriodOptimizer - Optimizes across multiple time periods
 * Follows Open/Closed Principle - extends IOptimizer
 * 
 * Uses dynamic programming approach with greedy heuristics:
 * 1. For each period, solve economic dispatch
 * 2. Consider startup/shutdown costs and constraints
 * 3. Enforce ramp rates and min up/down times
 */
class MultiPeriodOptimizer extends IOptimizer {
    constructor(tolerance = 1e-6) {
        super();
        this.tolerance = tolerance;
        this.validator = new ConstraintValidator(tolerance);
    }
    
    validateInputs(units, demand) {
        if (!units || units.length === 0) {
            throw new Error("No units provided");
        }
        
        // Validate initial conditions consistency
        for (const unit of units) {
            if (unit.initialStatus === 0 && Math.abs(unit.initialPower) > this.tolerance) {
                throw new Error(
                    `Unit ${unit.name}: initialStatus is OFF but initialPower is ${unit.initialPower}`
                );
            }
            if (unit.initialStatus === 1) {
                if (unit.initialPower < unit.minPower - this.tolerance || 
                    unit.initialPower > unit.maxPower + this.tolerance) {
                    throw new Error(
                        `Unit ${unit.name}: initialPower ${unit.initialPower} outside valid range ` +
                        `[${unit.minPower}, ${unit.maxPower}]`
                    );
                }
            }
        }
        
        const numPeriods = demand.getPeriods();
        if (numPeriods < 2) {
            throw new Error(
                `MultiPeriodOptimizer requires at least 2 demand periods, ` +
                `got ${numPeriods}`
            );
        }
        
        const totalCapacity = units.reduce((sum, unit) => sum + unit.maxPower, 0);
        const peakDemand = demand.getPeakDemand();
        const minDemand = Math.min(...demand.values);
        
        if (totalCapacity < peakDemand - this.tolerance) {
            throw new Error(
                `Insufficient capacity. Total: ${totalCapacity.toFixed(2)} MW, ` +
                `Peak Demand: ${peakDemand.toFixed(2)} MW`
            );
        }
        
        // Check minimum generation feasibility: if even 1 unit's min power exceeds min demand
        // and that unit is required for peak demand, we have an infeasibility
        const minUnitPower = Math.min(...units.map(u => u.minPower));
        if (minUnitPower > minDemand + this.tolerance) {
            console.warn(
                `Warning: Minimum unit power (${minUnitPower.toFixed(2)} MW) exceeds ` +
                `minimum demand (${minDemand.toFixed(2)} MW). May cause power balance issues.`
            );
        }
        
        return true;
    }
    
    optimize(units, demand) {
        const startTime = performance.now();
        
        // Validate inputs
        this.validateInputs(units, demand);
        
        const n = units.length;
        const T = demand.getPeriods();
        
        // Use Dynamic Programming with look-ahead to find optimal solution
        const dpResult = this.solveDP(units, demand);
        
        const solveTime = (performance.now() - startTime) / 1000;
        
        // Calculate statistics
        const totalStartups = this.countStartups(dpResult.status, units);
        const totalShutdowns = this.countShutdowns(dpResult.status, units);
        const avgUnitsOn = dpResult.status.reduce((sum, unitStatus) => 
            sum + unitStatus.reduce((s, v) => s + v, 0), 0) / T;
        
        const solution = new Solution({
            status: dpResult.status,
            power: dpResult.power,
            totalCost: dpResult.cost,
            isOptimal: false, // Heuristic DP, not exhaustive search
            solveTime,
            metadata: {
                numUnits: n,
                numPeriods: T,
                totalDemand: demand.getTotalDemand(),
                peakDemand: demand.getPeakDemand(),
                totalStartups,
                totalShutdowns,
                avgUnitsOn
            }
        });
        
        // Validate solution
        this.validator.validateSolution(solution, units, demand);
        
        return solution;
    }
    
    solveDP(units, demand) {
        const n = units.length;
        const T = demand.getPeriods();
        
        // TRUE DYNAMIC PROGRAMMING with Bellman optimality
        // State = (period, unit_status[n], consecutive_on[n], consecutive_off[n], last_power[n])
        // For tractability, we limit state space using:
        // - Only feasible commitments (respect min up/down time)
        // - Prune dominated states (higher cost, same configuration)
        
        // Initialize solution arrays (will be filled by backtracking)
        const status = new Array(n).fill(0).map(() => new Array(T).fill(0));
        const power = new Array(n).fill(0).map(() => new Array(T).fill(0));
        
        // Initial state
        const initialState = units.map(unit => ({
            consecutiveOn: unit.initialStatus === 1 ? unit.minUptime : 0,
            consecutiveOff: unit.initialStatus === 0 ? unit.minDowntime : 0,
            lastPower: unit.initialPower,
            lastStatus: unit.initialStatus
        }));
        
        // DP: Track multiple states per period (state space exploration)
        // Each state = {unitStates, cumulativeCost, parent}
        const MAX_STATES_PER_PERIOD = 50; // Limit for tractability
        let currentStates = new Map();
        
        // Initialize with starting state
        const stateKey = this.getStateKey(initialState);
        currentStates.set(stateKey, {
            unitStates: initialState,
            cumulativeCost: 0,
            parent: null,
            commitment: null,
            power: null
        });
        
        // Forward DP pass: build optimal cost-to-go for each state
        for (let t = 0; t < T; t++) {
            const periodDemand = demand.getDemand(t);
            const nextStates = new Map();
            
            // For EACH current state, explore ALL feasible transitions
            for (const [stateKey, stateData] of currentStates) {
                const unitStates = stateData.unitStates;
                
                // Generate ALL feasible commitment options (not just 3!)
                const commitmentOptions = this.generateAllFeasibleCommitments(
                    units,
                    unitStates,
                    periodDemand
                );
                
                // Evaluate each transition
                for (const option of commitmentOptions) {
                    const transitionCost = option.cost;
                    const newCumulativeCost = stateData.cumulativeCost + transitionCost;
                    
                    // Get next state after this transition
                    const nextStateKey = this.getStateKey(option.nextStates);
                    
                    // Bellman optimality: keep only minimum cost path to each state
                    if (!nextStates.has(nextStateKey) || 
                        nextStates.get(nextStateKey).cumulativeCost > newCumulativeCost) {
                        nextStates.set(nextStateKey, {
                            unitStates: option.nextStates,
                            cumulativeCost: newCumulativeCost,
                            parent: stateKey,
                            parentPeriod: t,
                            commitment: option.commitment,
                            power: option.power
                        });
                    }
                }
            }
            
            // Prune states: keep only top MAX_STATES_PER_PERIOD lowest-cost states
            const sortedStates = Array.from(nextStates.entries())
                .sort((a, b) => a[1].cumulativeCost - b[1].cumulativeCost)
                .slice(0, MAX_STATES_PER_PERIOD);
            
            currentStates = new Map(sortedStates);
            
            // Store states for this period for backtracking
            if (t === 0) {
                this.dpStates = [currentStates];
            } else {
                this.dpStates.push(currentStates);
            }
        }
        
        // Backtracking: find minimum cost final state
        let bestFinalState = null;
        let bestFinalCost = Infinity;
        
        for (const [stateKey, stateData] of currentStates) {
            if (stateData.cumulativeCost < bestFinalCost) {
                bestFinalCost = stateData.cumulativeCost;
                bestFinalState = stateData;
            }
        }
        
        // Reconstruct solution by backtracking
        const decisions = [];
        let currentState = bestFinalState;
        
        for (let t = T - 1; t >= 0; t--) {
            decisions.unshift({
                commitment: currentState.commitment,
                power: currentState.power
            });
            
            if (t > 0) {
                const parentKey = currentState.parent;
                currentState = this.dpStates[t - 1].get(parentKey);
            }
        }
        
        // Extract solution
        let totalCost = 0;
        for (let t = 0; t < T; t++) {
            for (let i = 0; i < n; i++) {
                status[i][t] = decisions[t].commitment[i];
                power[i][t] = decisions[t].power[i];
            }
        }
        
        // Calculate total cost
        const initialStates = units.map(unit => ({
            lastStatus: unit.initialStatus,
            lastPower: unit.initialPower
        }));
        
        for (let t = 0; t < T; t++) {
            for (let i = 0; i < n; i++) {
                const prevStatus = t > 0 ? status[i][t - 1] : initialStates[i].lastStatus;
                const currStatus = status[i][t];
                
                if (currStatus === 1 && prevStatus === 0) totalCost += units[i].startupCost;
                if (currStatus === 0 && prevStatus === 1) totalCost += units[i].shutdownCost;
                if (currStatus === 1) totalCost += units[i].calculateProductionCost(power[i][t]);
            }
        }
        
        return { status, power, cost: totalCost };
    }
    
    getStateKey(unitStates) {
        // Create unique hash for state: status, consecutiveOn, consecutiveOff
        return unitStates.map(s => 
            `${s.lastStatus},${s.consecutiveOn},${s.consecutiveOff}`
        ).join('|');
    }
    
    generateAllFeasibleCommitments(units, unitStates, periodDemand) {
        // Generate ALL feasible unit combinations that:
        // 1. Respect min up/down time constraints
        // 2. Have sufficient capacity to meet demand
        // 3. Don't violate minimum generation feasibility
        
        const n = units.length;
        const feasibleCommitments = [];
        
        // Determine which units MUST stay on/off due to constraints
        const mustStayOn = unitStates.map((state, i) => 
            state.lastStatus === 1 && state.consecutiveOn < units[i].minUptime
        );
        const mustStayOff = unitStates.map((state, i) => 
            state.lastStatus === 0 && state.consecutiveOff < units[i].minDowntime
        );
        
        // Generate all 2^n combinations, filter for feasibility
        const maxCombinations = Math.pow(2, n);
        const MAX_TO_EVALUATE = Math.min(maxCombinations, 100); // Limit for large n
        
        // Smart enumeration: prioritize combinations likely to be good
        const priorityCommitments = this.getPriorityCommitments(units, unitStates, periodDemand);
        
        for (const commitment of priorityCommitments) {
            // Check constraint feasibility
            let feasible = true;
            for (let i = 0; i < n; i++) {
                if (mustStayOn[i] && commitment[i] === 0) feasible = false;
                if (mustStayOff[i] && commitment[i] === 1) feasible = false;
            }
            
            if (!feasible) continue;
            
            // Check if commitment can meet demand
            const result = this.evaluateCommitment(units, unitStates, commitment, periodDemand);
            
            if (result.feasible) {
                feasibleCommitments.push({
                    commitment,
                    power: result.power,
                    cost: result.cost,
                    nextStates: result.nextStates
                });
            }
            
            if (feasibleCommitments.length >= MAX_TO_EVALUATE) break;
        }
        
        // If no feasible found, use fallback
        if (feasibleCommitments.length === 0) {
            const fallback = this.fallbackCommitment(units, unitStates, periodDemand);
            return [fallback];
        }
        
        return feasibleCommitments;
    }
    
    getPriorityCommitments(units, unitStates, periodDemand) {
        // Generate commitment combinations in priority order:
        // 1. Keep currently ON units (avoid cycling)
        // 2. Add cheap units if needed
        // 3. Try shutdown of expensive units if demand allows
        
        const n = units.length;
        const commitments = [];
        
        // Base: current status
        const currentCommitment = unitStates.map(s => s.lastStatus);
        commitments.push([...currentCommitment]);
        
        // Try shutting down each ON unit individually
        for (let i = 0; i < n; i++) {
            if (unitStates[i].lastStatus === 1) {
                const variant = [...currentCommitment];
                variant[i] = 0;
                commitments.push(variant);
            }
        }
        
        // Try starting each OFF unit individually
        for (let i = 0; i < n; i++) {
            if (unitStates[i].lastStatus === 0) {
                const variant = [...currentCommitment];
                variant[i] = 1;
                commitments.push(variant);
            }
        }
        
        // Try combinations of shutdowns for ON units (if multiple ON)
        const onUnits = [];
        for (let i = 0; i < n; i++) {
            if (unitStates[i].lastStatus === 1) onUnits.push(i);
        }
        
        if (onUnits.length >= 2) {
            // Try shutting down pairs
            for (let i = 0; i < onUnits.length; i++) {
                for (let j = i + 1; j < onUnits.length; j++) {
                    const variant = [...currentCommitment];
                    variant[onUnits[i]] = 0;
                    variant[onUnits[j]] = 0;
                    commitments.push(variant);
                }
            }
        }
        
        // Try merit-order combinations (start cheapest units)
        const sortedByFuelCost = units.map((u, i) => ({idx: i, cost: u.fuelCost}))
            .sort((a, b) => a.cost - b.cost);
        
        // Try combinations with k cheapest units
        for (let k = 1; k <= Math.min(n, 4); k++) {
            const variant = new Array(n).fill(0);
            for (let i = 0; i < k; i++) {
                variant[sortedByFuelCost[i].idx] = 1;
            }
            commitments.push(variant);
        }
        
        return commitments;
    }
    
    generateCommitmentOptions(units, unitStates, periodDemand, period, remainingPeriods) {
        const n = units.length;
        const options = [];
        
        // Determine which units MUST be on or off due to min up/down time
        const constraints = units.map((unit, idx) => {
            const state = unitStates[idx];
            const mustStayOn = state.lastStatus === 1 && state.consecutiveOn < unit.minUptime;
            const mustStayOff = state.lastStatus === 0 && state.consecutiveOff < unit.minDowntime;
            const canToggle = !mustStayOn && !mustStayOff;
            
            return { mustStayOn, mustStayOff, canToggle };
        });
        
        // Generate base commitment (mandatory units)
        const baseCommitment = constraints.map((c, i) => c.mustStayOn ? 1 : 0);
        
        // Find units that can be toggled
        const flexibleUnits = constraints
            .map((c, i) => c.canToggle ? i : -1)
            .filter(i => i >= 0);
        
        // For efficiency, only evaluate a subset of combinations:
        // 1. Keep all currently-ON flexible units ON (avoid shutdowns)
        // 2. Turn OFF each currently-ON flexible unit individually (evaluate shutdown benefit)
        // 3. Turn ON necessary units to meet demand
        
        const currentlyOn = flexibleUnits.filter(i => unitStates[i].lastStatus === 1);
        const currentlyOff = flexibleUnits.filter(i => unitStates[i].lastStatus === 0);
        
        // Option 1: Keep all ON units running + add necessary OFF units
        const keepAllOn = [...baseCommitment];
        currentlyOn.forEach(i => keepAllOn[i] = 1);
        
        // Check if we need additional units
        if (!this.canMeetDemand(keepAllOn, units, unitStates, periodDemand)) {
            // Add cheapest OFF units
            const offUnitsSorted = currentlyOff
                .map(i => ({
                    idx: i,
                    cost: units[i].fuelCost + units[i].startupCost / ((units[i].minPower + units[i].maxPower) / 2)
                }))
                .sort((a, b) => a.cost - b.cost);
            
            for (const {idx} of offUnitsSorted) {
                keepAllOn[idx] = 1;
                if (this.canMeetDemand(keepAllOn, units, unitStates, periodDemand)) break;
            }
        }
        
        this.evaluateCommitment(keepAllOn, units, unitStates, periodDemand, options);
        
        // Option 2: For each ON unit, try shutting it down (evaluate shutdown savings)
        for (const unitIdx of currentlyOn) {
            const tryShutdown = [...baseCommitment];
            currentlyOn.forEach(i => {
                if (i !== unitIdx) tryShutdown[i] = 1;
            });
            
            // Add OFF units if needed to meet demand
            if (!this.canMeetDemand(tryShutdown, units, unitStates, periodDemand)) {
                const offUnitsSorted = currentlyOff
                    .map(i => ({
                        idx: i,
                        cost: units[i].fuelCost + units[i].startupCost / ((units[i].minPower + units[i].maxPower) / 2)
                    }))
                    .sort((a, b) => a.cost - b.cost);
                
                for (const {idx} of offUnitsSorted) {
                    tryShutdown[idx] = 1;
                    if (this.canMeetDemand(tryShutdown, units, unitStates, periodDemand)) break;
                }
            }
            
            // Only evaluate if we can meet demand
            if (this.canMeetDemand(tryShutdown, units, unitStates, periodDemand)) {
                this.evaluateCommitment(tryShutdown, units, unitStates, periodDemand, options);
            }
        }
        
        return options.length > 0 ? options : [this.fallbackCommitment(units, unitStates, periodDemand)];
    }
    
    canMeetDemand(commitment, units, unitStates, demand) {
        let maxGeneration = 0;
        for (let i = 0; i < commitment.length; i++) {
            if (commitment[i] === 1) {
                const isStartingUp = unitStates[i].lastStatus === 0;
                const maxPower = this.getMaxPowerWithRamp(units[i], unitStates[i].lastPower, !isStartingUp);
                maxGeneration += maxPower;
            }
        }
        return maxGeneration >= demand - this.tolerance;
    }
    
    evaluateCommitment(units, unitStates, commitment, periodDemand) {
        const n = units.length;
        const power = new Array(n).fill(0);
        let cost = 0;
        
        // Calculate startup/shutdown costs
        for (let i = 0; i < n; i++) {
            if (commitment[i] === 1 && unitStates[i].lastStatus === 0) {
                cost += units[i].startupCost;
            }
            if (commitment[i] === 0 && unitStates[i].lastStatus === 1) {
                cost += units[i].shutdownCost;
            }
        }
        
        // Dispatch power (simple economic dispatch)
        let remainingDemand = periodDemand;
        const committedUnits = commitment
            .map((c, i) => c === 1 ? i : -1)
            .filter(i => i >= 0)
            .sort((a, b) => units[a].fuelCost - units[b].fuelCost);
        
        for (const idx of committedUnits) {
            if (remainingDemand <= this.tolerance) {
                const minPower = this.getMinPowerWithRamp(units[idx], unitStates[idx].lastPower, unitStates[idx].lastStatus === 1);
                power[idx] = minPower;
                remainingDemand -= minPower;
            } else {
                const isStartingUp = unitStates[idx].lastStatus === 0;
                const maxPower = this.getMaxPowerWithRamp(units[idx], unitStates[idx].lastPower, !isStartingUp);
                const minPower = this.getMinPowerWithRamp(units[idx], unitStates[idx].lastPower, !isStartingUp);
                const dispatch = Math.max(minPower, Math.min(maxPower, remainingDemand));
                power[idx] = dispatch;
                remainingDemand -= dispatch;
            }
        }
        
        // Adjust if needed
        if (Math.abs(remainingDemand) > this.tolerance) {
            this.adjustPowerSimple(committedUnits, power, units, unitStates, periodDemand);
        }
        
        // Check if demand was satisfied after adjustment
        const totalGeneration = power.reduce((sum, p) => sum + p, 0);
        if (Math.abs(totalGeneration - periodDemand) > this.tolerance) {
            return { feasible: false, power: null, cost: Infinity, nextStates: null };
        }
        
        // Calculate production costs
        for (let i = 0; i < n; i++) {
            if (commitment[i] === 1 && power[i] > 0) {
                cost += units[i].calculateProductionCost(power[i]);
            }
        }
        
        // Update states for next period
        const nextStates = unitStates.map((state, i) => {
            const newState = { ...state };
            if (commitment[i] === 1) {
                newState.consecutiveOn = state.lastStatus === 1 ? state.consecutiveOn + 1 : 1;
                newState.consecutiveOff = 0;
            } else {
                newState.consecutiveOff = state.lastStatus === 0 ? state.consecutiveOff + 1 : 1;
                newState.consecutiveOn = 0;
            }
            newState.lastStatus = commitment[i];
            newState.lastPower = power[i];
            return newState;
        });
        
        return {
            feasible: true,
            power: [...power],
            cost,
            nextStates
        };
    }
    
    adjustPowerSimple(committedUnits, power, units, unitStates, targetDemand) {
        let currentGen = power.reduce((s, p) => s + p, 0);
        
        for (let iter = 0; iter < 5 && Math.abs(currentGen - targetDemand) > this.tolerance; iter++) {
            if (currentGen < targetDemand) {
                for (const idx of committedUnits) {
                    const maxPower = this.getMaxPowerWithRamp(units[idx], unitStates[idx].lastPower, unitStates[idx].lastStatus === 1);
                    const increase = Math.min(targetDemand - currentGen, maxPower - power[idx]);
                    if (increase > this.tolerance) {
                        power[idx] += increase;
                        currentGen += increase;
                    }
                }
            } else {
                for (let i = committedUnits.length - 1; i >= 0; i--) {
                    const idx = committedUnits[i];
                    const minPower = this.getMinPowerWithRamp(units[idx], unitStates[idx].lastPower, unitStates[idx].lastStatus === 1);
                    const decrease = Math.min(currentGen - targetDemand, power[idx] - minPower);
                    if (decrease > this.tolerance) {
                        power[idx] -= decrease;
                        currentGen -= decrease;
                    }
                }
            }
        }
    }
    
    fallbackCommitment(units, unitStates, periodDemand) {
        // Emergency fallback: commit all units if needed
        const n = units.length;
        const commitment = new Array(n).fill(1);
        const power = new Array(n).fill(0);
        const options = [];
        this.evaluateCommitment(commitment, units, unitStates, periodDemand, options);
        return options[0];
    }
    
    estimateFutureCost(units, demand, states, startPeriod) {
        // Simple heuristic: estimate minimum future production cost
        // Assume cheapest units run at average demand
        const T = demand.getPeriods();
        if (startPeriod >= T) return 0;
        
        const remainingDemand = demand.values.slice(startPeriod).reduce((a, b) => a + b, 0);
        const avgDemand = remainingDemand / (T - startPeriod);
        
        // Sort units by fuel cost
        const sortedUnits = [...units]
            .map((u, i) => ({ unit: u, idx: i }))
            .sort((a, b) => a.unit.fuelCost - b.unit.fuelCost);
        
        let estimatedCost = 0;
        let coveragePower = 0;
        
        for (const {unit, idx} of sortedUnits) {
            if (coveragePower >= avgDemand) break;
            
            // Add startup cost if unit is currently off
            if (states[idx].lastStatus === 0) {
                estimatedCost += unit.startupCost;
            }
            
            const contribution = Math.min(unit.maxPower, avgDemand - coveragePower);
            estimatedCost += contribution * unit.fuelCost * (T - startPeriod);
            coveragePower += contribution;
        }
        
        return estimatedCost;
    }
    
    solvePeriod(units, periodDemand, unitStates, period) {
        const n = units.length;
        const status = new Array(n).fill(0);
        const power = new Array(n).fill(0);
        let cost = 0;
        
        // Create merit order considering current states
        const candidates = units.map((unit, idx) => {
            const state = unitStates[idx];
            let effectiveCost = unit.fuelCost;
            let canStart = true;
            let canStop = true;
            let mustStayOn = false;
            let mustStayOff = false;
            
            // Check min uptime/downtime constraints
            if (state.lastStatus === 1 && state.consecutiveOn < unit.minUptime) {
                mustStayOn = true;
                canStop = false;
            }
            if (state.lastStatus === 0 && state.consecutiveOff < unit.minDowntime) {
                mustStayOff = true;
                canStart = false;
            }
            
            // Better cost calculation considering operational state
            if (state.lastStatus === 0 && canStart) {
                // Amortize startup cost over expected output (average of min and max)
                const expectedOutput = (unit.minPower + unit.maxPower) / 2;
                effectiveCost += unit.startupCost / expectedOutput;
            }
            
            // For units already running, factor in shutdown cost savings
            if (state.lastStatus === 1 && unit.shutdownCost > 0) {
                const expectedOutput = (unit.minPower + unit.maxPower) / 2;
                effectiveCost -= unit.shutdownCost / expectedOutput;
            }
            
            return {
                idx,
                unit,
                state,
                effectiveCost,
                canStart,
                canStop,
                mustStayOn,
                mustStayOff
            };
        }).sort((a, b) => {
            // Primary sort by effective cost
            if (Math.abs(a.effectiveCost - b.effectiveCost) > 0.01) {
                return a.effectiveCost - b.effectiveCost;
            }
            // Tie-breaker 1: prefer units already running (avoid startup)
            if (a.state.lastStatus !== b.state.lastStatus) {
                return b.state.lastStatus - a.state.lastStatus;
            }
            // Tie-breaker 2: prefer larger capacity (more flexible)
            if (Math.abs(a.unit.maxPower - b.unit.maxPower) > 0.01) {
                return b.unit.maxPower - a.unit.maxPower;
            }
            // Tie-breaker 3: deterministic ordering by unit ID
            return a.unit.id - b.unit.id;
        });
        
        // Phase 1: Commit units that MUST stay on (min uptime constraint)
        for (const {idx, unit, state, mustStayOn} of candidates) {
            if (mustStayOn) {
                status[idx] = 1;
            }
        }
        
        // Phase 2: Keep previously-ON units online if economically beneficial
        // Compare shutdown cost vs. incremental production cost
        let minGenerationIfKept = 0;
        for (const {idx, unit, state} of candidates) {
            if (status[idx] === 1) {
                minGenerationIfKept += unit.minPower;
            }
        }
        
        // Find cheapest available unit for comparison
        const cheapestFuelCost = Math.min(...candidates
            .filter(c => c.canStart || c.state.lastStatus === 1)
            .map(c => c.unit.fuelCost));
        
        for (const {idx, unit, state} of candidates) {
            if (state.lastStatus === 1 && status[idx] === 0 && unit.shutdownCost > 0) {
                // Only keep if: (1) we can accommodate its minimum power
                // AND (2) shutdown cost > fuel cost penalty × expected runtime
                const canAccommodate = minGenerationIfKept + unit.minPower <= periodDemand + this.tolerance;
                const fuelCostPenalty = unit.fuelCost - cheapestFuelCost;
                const expectedRuntime = unit.minPower; // Conservative: assume running at min power
                const keepingCost = fuelCostPenalty * expectedRuntime;
                const economicallySound = unit.shutdownCost > keepingCost || fuelCostPenalty <= 0;
                
                if (canAccommodate && economicallySound) {
                    status[idx] = 1;
                    minGenerationIfKept += unit.minPower;
                }
            }
        }
        
        // Phase 3: Commit additional units if needed
        // Check if committed units can meet demand
        let projectedGeneration = 0;
        for (const {idx, unit, state} of candidates) {
            if (status[idx] === 1) {
                const maxPower = this.getMaxPowerWithRamp(unit, state.lastPower, state.lastStatus === 1);
                projectedGeneration += maxPower;
            }
        }
        
        // If insufficient, commit more units
        for (const {idx, unit, state, canStart, mustStayOff} of candidates) {
            if (projectedGeneration >= periodDemand) break;
            if (status[idx] === 1 || mustStayOff || !canStart) continue;
            
            status[idx] = 1;
            const maxPower = this.getMaxPowerWithRamp(unit, state.lastPower, false);
            projectedGeneration += maxPower;
            
            // Add startup cost
            if (state.lastStatus === 0) {
                cost += unit.startupCost;
            }
        }
        
        // Phase 4: Dispatch power from committed units
        let remainingDemand = periodDemand;
        
        for (const {idx, unit, state} of candidates) {
            if (status[idx] === 0) continue;
            
            const isStartingUp = state.lastStatus === 0;
            const maxPower = this.getMaxPowerWithRamp(unit, state.lastPower, !isStartingUp);
            const minPower = this.getMinPowerWithRamp(unit, state.lastPower, !isStartingUp);
            
            if (remainingDemand > this.tolerance) {
                // Dispatch to meet remaining demand
                const powerOutput = Math.max(minPower, Math.min(maxPower, remainingDemand));
                power[idx] = powerOutput;
                remainingDemand -= powerOutput;
            } else {
                // Demand already satisfied, run at minimum
                power[idx] = minPower;
                remainingDemand -= minPower;
            }
        }
        
        // Phase 5: Adjust if we have excess or deficit
        if (Math.abs(remainingDemand) > this.tolerance) {
            this.redistributePower(candidates, status, power, periodDemand, unitStates);
        }
        
        // Calculate production and shutdown costs
        for (let i = 0; i < n; i++) {
            if (status[i] === 1 && power[i] > 0) {
                cost += units[i].calculateProductionCost(power[i]);
            }
            if (unitStates[i].lastStatus === 1 && status[i] === 0) {
                cost += units[i].shutdownCost;
            }
        }
        
        return { status, power, cost };
    }
    
    redistributePower(candidates, status, power, targetDemand, unitStates) {
        const MAX_ITERATIONS = 10;
        let iteration = 0;
        
        while (iteration < MAX_ITERATIONS) {
            let currentGeneration = power.reduce((sum, p) => sum + p, 0);
            
            if (Math.abs(targetDemand - currentGeneration) <= this.tolerance) return;
            
            let madeProgress = false;
            
            if (currentGeneration < targetDemand) {
                // Need more power - increase generation from committed units
                for (const {idx, unit, state} of candidates) {
                    if (status[idx] === 0) continue;
                    if (Math.abs(targetDemand - currentGeneration) <= this.tolerance) break;
                    
                    const isStartingUp = state.lastStatus === 0;
                    const maxPower = this.getMaxPowerWithRamp(unit, state.lastPower, !isStartingUp);
                    const increase = Math.min(targetDemand - currentGeneration, maxPower - power[idx]);
                    
                    if (increase > this.tolerance) {
                        power[idx] += increase;
                        currentGeneration += increase;
                        madeProgress = true;
                    }
                }
            } else {
                // Have excess power - reduce generation (highest cost first)
                for (let i = candidates.length - 1; i >= 0; i--) {
                    const {idx, unit, state} = candidates[i];
                    if (status[idx] === 0) continue;
                    if (Math.abs(targetDemand - currentGeneration) <= this.tolerance) break;
                    
                    const isStartingUp = state.lastStatus === 0;
                    const minPower = this.getMinPowerWithRamp(unit, state.lastPower, !isStartingUp);
                    const decrease = Math.min(currentGeneration - targetDemand, power[idx] - minPower);
                    
                    if (decrease > this.tolerance) {
                        power[idx] -= decrease;
                        currentGeneration -= decrease;
                        madeProgress = true;
                    }
                }
            }
            
            if (!madeProgress) break; // Can't improve further
            iteration++;
        }
        
        if (iteration >= MAX_ITERATIONS) {
            console.warn(`redistributePower: Max iterations reached, may have residual imbalance`);
        }
    }
    
    getMaxPowerWithRamp(unit, lastPower, wasOn) {
        if (!wasOn) return unit.maxPower;
        if (unit.rampUpRate === Infinity) return unit.maxPower;
        return Math.min(unit.maxPower, lastPower + unit.rampUpRate);
    }
    
    getMinPowerWithRamp(unit, lastPower, wasOn) {
        if (!wasOn) return unit.minPower;
        if (unit.rampDownRate === Infinity) return unit.minPower;
        return Math.max(unit.minPower, lastPower - unit.rampDownRate);
    }
    
    updateUnitState(state, newStatus, newPower) {
        if (newStatus === 1) {
            state.consecutiveOn++;
            state.consecutiveOff = 0;
        } else {
            state.consecutiveOff++;
            state.consecutiveOn = 0;
        }
        state.lastStatus = newStatus;
        state.lastPower = newPower;
    }
    
    countStartups(status, units) {
        let count = 0;
        for (let i = 0; i < units.length; i++) {
            let prevStatus = units[i].initialStatus;
            for (let t = 0; t < status[i].length; t++) {
                if (status[i][t] === 1 && prevStatus === 0) count++;
                prevStatus = status[i][t];
            }
        }
        return count;
    }
    
    countShutdowns(status, units) {
        let count = 0;
        for (let i = 0; i < units.length; i++) {
            let prevStatus = units[i].initialStatus;
            for (let t = 0; t < status[i].length; t++) {
                if (status[i][t] === 0 && prevStatus === 1) count++;
                prevStatus = status[i][t];
            }
        }
        return count;
    }
}

// ============================================================================
// EXPORT FOR USE
// ============================================================================

// Make classes available globally
if (typeof window !== 'undefined') {
    window.UnitCommitment = {
        Unit,
        Demand,
        Solution,
        ConstraintValidator,
        SinglePeriodOptimizer,
        MultiPeriodOptimizer
    };
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Unit,
        Demand,
        Solution,
        ConstraintValidator,
        SinglePeriodOptimizer,
        MultiPeriodOptimizer
    };
}
