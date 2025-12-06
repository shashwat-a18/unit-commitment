/**
 * Comprehensive Test Suite for Unit Commitment Optimizer
 * Tests with 5-6 generators for both single and multi-period optimizations
 */

const UnitCommitment = require('./unit-commitment.js');

console.log('='.repeat(80));
console.log('UNIT COMMITMENT OPTIMIZER - COMPREHENSIVE TEST SUITE');
console.log('Testing with 5-6 Generators');
console.log('='.repeat(80));
console.log();

// Test 1: Single Period with 5 Generators
function testSinglePeriod5Units() {
    console.log('TEST 1: SINGLE PERIOD OPTIMIZATION - 5 GENERATORS');
    console.log('-'.repeat(80));
    
    // Define 5 generators with varying characteristics
    const units = [
        new UnitCommitment.Unit({
            id: 'coal-1', name: 'Coal-1', minPower: 50, maxPower: 200,
            fuelCost: 25, startupCost: 500, shutdownCost: 200,
            rampUpRate: 100, rampDownRate: 100, minUptime: 2, minDowntime: 2,
            initialStatus: 1, initialPower: 0
        }),
        new UnitCommitment.Unit({
            id: 'gas-1', name: 'Gas-1', minPower: 40, maxPower: 150,
            fuelCost: 30, startupCost: 300, shutdownCost: 150,
            rampUpRate: 80, rampDownRate: 80, minUptime: 2, minDowntime: 2,
            initialStatus: 1, initialPower: 0
        }),
        new UnitCommitment.Unit({
            id: 'gas-2', name: 'Gas-2', minPower: 30, maxPower: 100,
            fuelCost: 35, startupCost: 200, shutdownCost: 100,
            rampUpRate: 60, rampDownRate: 60, minUptime: 1, minDowntime: 1,
            initialStatus: 1, initialPower: 0
        }),
        new UnitCommitment.Unit({
            id: 'hydro-1', name: 'Hydro-1', minPower: 20, maxPower: 80,
            fuelCost: 20, startupCost: 150, shutdownCost: 75,
            rampUpRate: 50, rampDownRate: 50, minUptime: 1, minDowntime: 1,
            initialStatus: 1, initialPower: 0
        }),
        new UnitCommitment.Unit({
            id: 'peaker-1', name: 'Peaker-1', minPower: 10, maxPower: 50,
            fuelCost: 50, startupCost: 100, shutdownCost: 50,
            rampUpRate: 40, rampDownRate: 40, minUptime: 1, minDowntime: 1,
            initialStatus: 1, initialPower: 0
        })
    ];
    
    // Demand: 320 MW
    const demand = new UnitCommitment.Demand([320]);
    
    // Expected: Based on merit order (fuel cost + startup/maxPower), optimizer commits:
    // Merit order: Hydro-1 (20+1.875=21.875), Coal-1 (25+2.5=27.5), Gas-1 (30+2=32)
    // Committed units: Hydro-1 (80 MW), Coal-1 (200 MW), Gas-1 (40 MW) = 320 MW
    // Expected cost: startup costs + production costs
    // Hydro-1: 80 MW @ 20 $/MWh = 1600, startup = 150
    // Coal-1: 200 MW @ 25 $/MWh = 5000, startup = 500
    // Gas-1: 40 MW @ 30 $/MWh = 1200, startup = 300
    // Expected Total: 1600 + 5000 + 1200 + 150 + 500 + 300 = 8,750
    
    const expectedCost = 8750;
    const expectedUnits = 3;
    const expectedPower = 320;
    
    const optimizer = new UnitCommitment.SinglePeriodOptimizer();
    const startTime = performance.now();
    const solution = optimizer.optimize(units, demand);
    const endTime = performance.now();
    
    console.log('Solution Details:');
    console.log(`  Units Committed: ${solution.metadata.unitsCommitted}`);
    console.log(`  Total Power Generated: ${solution.getTotalPower(0).toFixed(2)} MW`);
    console.log(`  Total Cost: $${solution.totalCost.toFixed(2)}`);
    console.log(`  Solve Time: ${(endTime - startTime).toFixed(2)}ms`);
    console.log();
    
    console.log('Unit-by-Unit Breakdown:');
    units.forEach((unit, i) => {
        const status = solution.getUnitStatus(i, 0);
        const power = solution.getUnitPower(i, 0);
        if (status === 1) {
            const prodCost = unit.fuelCost * power;
            console.log(`  ${unit.name}: ON, ${power.toFixed(2)} MW, Production: $${prodCost.toFixed(2)}, Startup: $${unit.startupCost}`);
        } else {
            console.log(`  ${unit.name}: OFF`);
        }
    });
    console.log();
    
    // Validation
    const validator = new UnitCommitment.ConstraintValidator();
    let violations = [];
    try {
        validator.validateSolution(solution, units, demand);
    } catch (error) {
        violations.push(error.message);
    }
    
    console.log('Expected vs Actual:');
    console.log(`  Units Committed - Expected: ${expectedUnits}, Actual: ${solution.metadata.unitsCommitted}, ${solution.metadata.unitsCommitted === expectedUnits ? '✓' : '✗'}`);
    console.log(`  Total Power - Expected: ${expectedPower} MW, Actual: ${solution.getTotalPower(0).toFixed(2)} MW, ${Math.abs(solution.getTotalPower(0) - expectedPower) < 0.01 ? '✓' : '✗'}`);
    console.log(`  Total Cost - Expected: ~$${expectedCost}, Actual: $${solution.totalCost.toFixed(2)}, ${Math.abs(solution.totalCost - expectedCost) < 1 ? '✓' : '✗'}`);
    console.log(`  Constraint Violations: ${violations.length === 0 ? 'None ✓' : violations.length + ' ✗'}`);
    
    if (violations.length > 0) {
        console.log('  Violations:', violations);
    }
    
    const testPassed = solution.metadata.unitsCommitted === expectedUnits &&
                       Math.abs(solution.getTotalPower(0) - expectedPower) < 0.01 &&
                       Math.abs(solution.totalCost - expectedCost) < 1 &&
                       violations.length === 0;
    
    console.log();
    console.log(`TEST 1 RESULT: ${testPassed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log('='.repeat(80));
    console.log();
    
    return testPassed;
}

// Test 2: Multi-Period with 6 Generators
function testMultiPeriod6Units() {
    console.log('TEST 2: MULTI-PERIOD OPTIMIZATION - 6 GENERATORS');
    console.log('-'.repeat(80));
    
    // Define 6 generators with varying characteristics
    const units = [
        new UnitCommitment.Unit({
            id: 'coal-1', name: 'Coal-1', minPower: 50, maxPower: 200,
            fuelCost: 25, startupCost: 500, shutdownCost: 250,
            rampUpRate: 100, rampDownRate: 100, minUptime: 3, minDowntime: 3,
            initialStatus: 0, initialPower: 0
        }),
        new UnitCommitment.Unit({
            id: 'coal-2', name: 'Coal-2', minPower: 45, maxPower: 180,
            fuelCost: 28, startupCost: 450, shutdownCost: 225,
            rampUpRate: 90, rampDownRate: 90, minUptime: 3, minDowntime: 3,
            initialStatus: 0, initialPower: 0
        }),
        new UnitCommitment.Unit({
            id: 'gas-1', name: 'Gas-1', minPower: 40, maxPower: 150,
            fuelCost: 30, startupCost: 300, shutdownCost: 150,
            rampUpRate: 80, rampDownRate: 80, minUptime: 2, minDowntime: 2,
            initialStatus: 0, initialPower: 0
        }),
        new UnitCommitment.Unit({
            id: 'gas-2', name: 'Gas-2', minPower: 30, maxPower: 100,
            fuelCost: 35, startupCost: 200, shutdownCost: 100,
            rampUpRate: 60, rampDownRate: 60, minUptime: 2, minDowntime: 2,
            initialStatus: 0, initialPower: 0
        }),
        new UnitCommitment.Unit({
            id: 'hydro-1', name: 'Hydro-1', minPower: 20, maxPower: 80,
            fuelCost: 20, startupCost: 150, shutdownCost: 75,
            rampUpRate: 50, rampDownRate: 50, minUptime: 1, minDowntime: 1,
            initialStatus: 0, initialPower: 0
        }),
        new UnitCommitment.Unit({
            id: 'peaker-1', name: 'Peaker-1', minPower: 10, maxPower: 50,
            fuelCost: 50, startupCost: 100, shutdownCost: 50,
            rampUpRate: 40, rampDownRate: 40, minUptime: 1, minDowntime: 1,
            initialStatus: 0, initialPower: 0
        })
    ];
    
    // Demand profile for 8 periods: varying from 200 to 500 MW
    const demandValues = [250, 300, 400, 450, 500, 400, 300, 250];
    const demand = new UnitCommitment.Demand(demandValues);
    
    // Expected results (approximate due to multi-period complexity):
    // Total demand across 8 periods: 2850 MW
    // Should use base units (Coal, Gas) for most periods, Hydro for flexibility
    // Expected cost: ~$70,000-$80,000 (startup + production costs)
    
    const expectedTotalDemand = demandValues.reduce((a, b) => a + b, 0);
    const expectedMinCost = 70000;
    const expectedMaxCost = 80000;
    
    const optimizer = new UnitCommitment.MultiPeriodOptimizer();
    const startTime = performance.now();
    const solution = optimizer.optimize(units, demand);
    const endTime = performance.now();
    
    console.log('Solution Summary:');
    console.log(`  Number of Periods: ${solution.getNumPeriods()}`);
    console.log(`  Total Demand: ${expectedTotalDemand} MW`);
    console.log(`  Total Generation: ${solution.metadata.totalDemand.toFixed(2)} MW`);
    console.log(`  Average Units Online: ${solution.metadata.avgUnitsOn.toFixed(2)}`);
    console.log(`  Total Cost: $${solution.totalCost.toFixed(2)}`);
    console.log(`  Total Startups: ${solution.metadata.totalStartups}`);
    console.log(`  Total Shutdowns: ${solution.metadata.totalShutdowns}`);
    console.log(`  Solve Time: ${(endTime - startTime).toFixed(2)}ms`);
    console.log();
    
    console.log('Period-by-Period Analysis:');
    for (let t = 0; t < solution.getNumPeriods(); t++) {
        const periodDemand = demand.getDemand(t);
        const periodGeneration = solution.getTotalPower(t);
        let unitsOn = 0;
        let activeUnits = [];
        
        units.forEach((unit, i) => {
            if (solution.getUnitStatus(i, t) === 1) {
                unitsOn++;
                activeUnits.push(`${unit.name}(${solution.getUnitPower(i, t).toFixed(0)}MW)`);
            }
        });
        
        console.log(`  Period ${t + 1}: Demand=${periodDemand}MW, Gen=${periodGeneration.toFixed(2)}MW, Units=${unitsOn}, Active=[${activeUnits.join(', ')}]`);
    }
    console.log();
    
    // Validation
    const validator = new UnitCommitment.ConstraintValidator();
    let violations = [];
    try {
        validator.validateSolution(solution, units, demand);
    } catch (error) {
        violations.push(error.message);
    }
    
    console.log('Expected vs Actual:');
    console.log(`  Total Generation - Expected: ${expectedTotalDemand} MW, Actual: ${solution.metadata.totalDemand.toFixed(2)} MW, ${Math.abs(solution.metadata.totalDemand - expectedTotalDemand) < 0.1 ? '✓' : '✗'}`);
    console.log(`  Cost Range - Expected: $${expectedMinCost}-$${expectedMaxCost}, Actual: $${solution.totalCost.toFixed(2)}, ${solution.totalCost >= expectedMinCost && solution.totalCost <= expectedMaxCost ? '✓' : '✗'}`);
    console.log(`  All Periods Balanced: ${violations.filter(v => v.includes('Power balance')).length === 0 ? '✓' : '✗'}`);
    console.log(`  Constraint Violations: ${violations.length === 0 ? 'None ✓' : violations.length + ' ✗'}`);
    
    if (violations.length > 0) {
        console.log('  First 5 Violations:', violations.slice(0, 5));
    }
    
    const testPassed = Math.abs(solution.metadata.totalDemand - expectedTotalDemand) < 0.1 &&
                       solution.totalCost >= expectedMinCost &&
                       solution.totalCost <= expectedMaxCost &&
                       violations.length === 0;
    
    console.log();
    console.log(`TEST 2 RESULT: ${testPassed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log('='.repeat(80));
    console.log();
    
    return testPassed;
}

// Run all tests
try {
    const test1Result = testSinglePeriod5Units();
    const test2Result = testMultiPeriod6Units();
    
    console.log('='.repeat(80));
    console.log('FINAL TEST SUMMARY');
    console.log('-'.repeat(80));
    console.log(`Test 1 (Single Period - 5 Units): ${test1Result ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`Test 2 (Multi-Period - 6 Units): ${test2Result ? '✓ PASSED' : '✗ FAILED'}`);
    console.log();
    console.log(`Overall: ${test1Result && test2Result ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
    console.log('='.repeat(80));
    
    process.exit(test1Result && test2Result ? 0 : 1);
} catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
}
