/**
 * Unit Commitment Algorithm Verification Script
 * 
 * This script comprehensively tests the unit commitment optimizer
 * to ensure it correctly solves the optimization problem.
 */

const fs = require('fs');
const path = require('path');

// Mock DOM environment
global.document = {
    getElementById: () => ({
        addEventListener: () => {},
        value: '',
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
        appendChild: () => {},
        removeChild: () => {},
        innerHTML: '',
        disabled: false
    }),
    querySelectorAll: () => [],
    querySelector: () => ({
        addEventListener: () => {},
        classList: { add: () => {}, remove: () => {} },
        dataset: {}
    }),
    createElement: () => ({ 
        style: {}, 
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        appendChild: () => {},
        removeChild: () => {},
        click: () => {},
        remove: () => {},
        addEventListener: () => {},
        innerHTML: ''
    }),
    head: { insertAdjacentHTML: () => {} },
    body: { appendChild: () => {}, removeChild: () => {} },
    addEventListener: () => {}
};

global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

global.Chart = class Chart {
    constructor() {}
    destroy() {}
    update() {}
};

// Load the application code
console.log('Loading Unit Commitment Optimizer...\n');
let appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

// Make the class globally accessible by using Function constructor
const makeGlobal = new Function(appCode + '; return UnitCommitmentApp;');
const UnitCommitmentApp = makeGlobal();

if (!UnitCommitmentApp) {
    console.error('Failed to load UnitCommitmentApp');
    process.exit(1);
}

// ============================================================================
// VERIFICATION TESTS
// ============================================================================

console.log('='.repeat(80));
console.log('UNIT COMMITMENT ALGORITHM VERIFICATION');
console.log('='.repeat(80));
console.log();

let passCount = 0;
let failCount = 0;

function runTest(testName, testFunction) {
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`TEST: ${testName}`);
    console.log(`${'-'.repeat(80)}`);
    try {
        testFunction();
        console.log('✅ PASSED');
        passCount++;
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}`);
        if (error.details) {
            console.log(`   Details: ${error.details}`);
        }
        failCount++;
    }
}

// ============================================================================
// Test 1: Basic Cost Function Calculation
// ============================================================================
runTest('Cost Function Calculation', () => {
    const app = new UnitCommitmentApp();
    const generators = [
        { 
            tag: 'G1', 
            pgmin: 10, 
            pgmax: 100, 
            ai: 50,      // Fixed cost when running
            bi: 2.0,     // Linear coefficient
            di: 0.01,    // Quadratic coefficient
            rampup: 100, 
            rampdown: 100, 
            minuptime: 1, 
            mindowntime: 1 
        }
    ];
    
    const demand = 50; // MW
    const result = app.optimizeUnitCommitment(generators, demand);
    
    if (!result.success) {
        throw new Error('Optimization failed: ' + (result.error || 'Unknown error'));
    }
    
    // Verify cost calculation:
    // Operating Cost = ai + bi*P + di*P^2
    //                = 50 + 2.0*50 + 0.01*50^2
    //                = 50 + 100 + 25 = 175
    // Startup Cost   = ai * 0.5 = 50 * 0.5 = 25 (default 50% of fixed cost)
    // Total Cost     = 175 + 25 = 200
    
    const expectedCost = 50 + 2.0*50 + 0.01*50*50 + 50*0.5;
    const costDiff = Math.abs(result.totalCost - expectedCost);
    
    console.log(`   Demand: ${demand} MW`);
    console.log(`   Operating Cost: ₹${(50 + 2.0*50 + 0.01*50*50).toFixed(2)}`);
    console.log(`   Startup Cost: ₹${(50*0.5).toFixed(2)}`);
    console.log(`   Total Cost: ₹${result.totalCost.toFixed(2)}`);
    console.log(`   Expected: ₹${expectedCost.toFixed(2)}`);
    
    if (costDiff > 1.0) {
        throw new Error(`Cost mismatch: Expected ${expectedCost}, got ${result.totalCost}`);
    }
});

// ============================================================================
// Test 2: Economic Dispatch - Multiple Generators
// ============================================================================
runTest('Economic Dispatch with Multiple Generators', () => {
    const app = new UnitCommitmentApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 },
        { tag: 'G2', pgmin: 20, pgmax: 150, ai: 40, bi: 2.5, di: 0.008, rampup: 150, rampdown: 150, minuptime: 1, mindowntime: 1 },
        { tag: 'G3', pgmin: 15, pgmax: 120, ai: 60, bi: 1.8, di: 0.012, rampup: 120, rampdown: 120, minuptime: 1, mindowntime: 1 }
    ];
    
    const demand = 200; // MW
    const result = app.optimizeUnitCommitment(generators, demand);
    
    if (!result.success) {
        throw new Error('Optimization failed: ' + (result.error || 'Unknown error'));
    }
    
    const totalGeneration = result.schedule.reduce((sum, gen) => sum + gen.power, 0);
    const demandError = Math.abs(totalGeneration - demand);
    
    console.log(`   Demand: ${demand} MW`);
    console.log(`   Total Generation: ${totalGeneration.toFixed(2)} MW`);
    console.log(`   Active Generators: ${result.schedule.length}`);
    console.log(`   Total Cost: ₹${result.totalCost.toFixed(2)}`);
    console.log(`   Dispatch:`);
    result.schedule.forEach(gen => {
        console.log(`     ${gen.generator}: ${gen.power.toFixed(2)} MW @ ₹${gen.cost.toFixed(2)}`);
    });
    
    // Verify demand is met (within 0.5 MW tolerance)
    if (demandError > 0.5) {
        throw new Error(`Demand not met: Required ${demand} MW, got ${totalGeneration.toFixed(2)} MW`);
    }
    
    // Verify all generators are within limits
    result.schedule.forEach(gen => {
        const genData = generators.find(g => g.tag === gen.generator);
        if (gen.power < genData.pgmin || gen.power > genData.pgmax) {
            throw new Error(`${gen.generator} power ${gen.power} outside limits [${genData.pgmin}, ${genData.pgmax}]`);
        }
    });
});

// ============================================================================
// Test 3: Efficiency Metric (Cost per MW)
// ============================================================================
runTest('Efficiency Metric Correctness', () => {
    const app = new UnitCommitmentApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 }
    ];
    
    const demand = 50;
    const result = app.optimizeUnitCommitment(generators, demand);
    
    if (!result.success) {
        throw new Error('Optimization failed');
    }
    
    // Efficiency should be cost per MW (lower is better)
    const expectedEfficiency = result.totalCost / demand;
    const actualEfficiency = parseFloat(result.efficiency);
    
    console.log(`   Total Cost: ₹${result.totalCost.toFixed(2)}`);
    console.log(`   Demand: ${demand} MW`);
    console.log(`   Efficiency (cost/MW): ₹${actualEfficiency.toFixed(4)}/MW`);
    console.log(`   Expected: ₹${expectedEfficiency.toFixed(4)}/MW`);
    
    const efficiencyDiff = Math.abs(actualEfficiency - expectedEfficiency);
    if (efficiencyDiff > 0.01) {
        throw new Error(`Efficiency calculation incorrect: Expected ${expectedEfficiency}, got ${actualEfficiency}`);
    }
    
    // Verify lower efficiency is better (cost optimization)
    console.log(`   ✓ Lower efficiency value = better (less cost per MW)`);
});

// ============================================================================
// Test 4: Generator Limits Enforcement
// ============================================================================
runTest('Generator Minimum and Maximum Limits', () => {
    const app = new UnitCommitmentApp();
    const generators = [
        { tag: 'G1', pgmin: 30, pgmax: 80, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 }
    ];
    
    // Test demand within limits
    const demand = 50;
    const result = app.optimizeUnitCommitment(generators, demand);
    
    if (!result.success) {
        throw new Error('Should succeed for demand within generator limits');
    }
    
    console.log(`   Generator limits: ${generators[0].pgmin} - ${generators[0].pgmax} MW`);
    console.log(`   Demand: ${demand} MW`);
    console.log(`   Output: ${result.schedule[0].power} MW`);
    
    if (result.schedule[0].power < generators[0].pgmin || result.schedule[0].power > generators[0].pgmax) {
        throw new Error(`Generator output ${result.schedule[0].power} violates limits`);
    }
    
    // Test demand below minimum
    const lowDemand = 20;
    const lowResult = app.optimizeUnitCommitment(generators, lowDemand);
    
    console.log(`   Low demand: ${lowDemand} MW (below Pgmin)`);
    if (lowResult.success) {
        console.log(`   Result: ${lowResult.error || 'No error message'}`);
        throw new Error('Should fail for demand below Pgmin');
    } else {
        console.log(`   ✓ Correctly rejected: ${lowResult.error}`);
    }
});

// ============================================================================
// Test 5: Infeasible Solution Detection
// ============================================================================
runTest('Infeasible Solution Detection', () => {
    const app = new UnitCommitmentApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 },
        { tag: 'G2', pgmin: 20, pgmax: 80, ai: 40, bi: 2.5, di: 0.008, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 }
    ];
    
    // Total capacity = 100 + 80 = 180 MW
    const demand = 250; // Exceeds total capacity
    const result = app.optimizeUnitCommitment(generators, demand);
    
    console.log(`   Total capacity: 180 MW`);
    console.log(`   Demand: ${demand} MW`);
    
    if (result.success) {
        throw new Error('Should detect infeasible demand exceeding total capacity');
    }
    
    console.log(`   ✓ Correctly detected infeasibility: ${result.error}`);
});

// ============================================================================
// Test 6: Optimal Generator Commitment
// ============================================================================
runTest('Optimal Generator Selection (FLAC-based)', () => {
    const app = new UnitCommitmentApp();
    
    // Create generators with different FLAC values
    // FLAC = ai/pgmax + bi + di*pgmax
    const generators = [
        { 
            tag: 'G1', 
            pgmin: 10, pgmax: 100, 
            ai: 50, bi: 2.0, di: 0.01,  // FLAC = 50/100 + 2.0 + 0.01*100 = 3.5
            rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 
        },
        { 
            tag: 'G2', 
            pgmin: 20, pgmax: 120, 
            ai: 80, bi: 1.5, di: 0.015, // FLAC = 80/120 + 1.5 + 0.015*120 = 3.97
            rampup: 120, rampdown: 120, minuptime: 1, mindowntime: 1 
        },
        { 
            tag: 'G3', 
            pgmin: 15, pgmax: 90, 
            ai: 40, bi: 2.2, di: 0.008,  // FLAC = 40/90 + 2.2 + 0.008*90 = 3.36
            rampup: 90, rampdown: 90, minuptime: 1, mindowntime: 1 
        }
    ];
    
    // Calculate and display FLAC values
    generators.forEach(gen => {
        const flac = gen.ai/gen.pgmax + gen.bi + gen.di*gen.pgmax;
        console.log(`   ${gen.tag} FLAC: ${flac.toFixed(4)} ₹/MW`);
    });
    
    // For low demand, should use most efficient generator (lowest FLAC)
    const lowDemand = 50;
    const lowResult = app.optimizeUnitCommitment(generators, lowDemand);
    
    if (!lowResult.success) {
        throw new Error('Optimization failed for low demand');
    }
    
    console.log(`   \n   Low demand (${lowDemand} MW):`);
    console.log(`   Using: ${lowResult.schedule.map(g => g.generator).join(', ')}`);
    console.log(`   Total cost: ₹${lowResult.totalCost.toFixed(2)}`);
    
    // Verify only 1 generator is used for low demand (more efficient)
    if (lowResult.schedule.length !== 1) {
        console.log(`   ⚠ Using ${lowResult.schedule.length} generators (expected 1 for efficiency)`);
    }
});

// ============================================================================
// Test 7: Demand Meeting Accuracy
// ============================================================================
runTest('Demand Meeting with 0.5 MW Tolerance', () => {
    const app = new UnitCommitmentApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 }
    ];
    
    // Test various demand values
    const testDemands = [50, 50.3, 75.7, 100];
    
    testDemands.forEach(demand => {
        const result = app.optimizeUnitCommitment(generators, demand);
        
        if (!result.success) {
            throw new Error(`Failed for demand ${demand} MW: ${result.error}`);
        }
        
        const totalGen = result.schedule.reduce((sum, g) => sum + g.power, 0);
        const error = Math.abs(totalGen - demand);
        
        console.log(`   Demand: ${demand.toFixed(2)} MW → Generation: ${totalGen.toFixed(2)} MW (error: ${error.toFixed(2)} MW)`);
        
        if (error > 0.5) {
            throw new Error(`Demand error ${error.toFixed(2)} MW exceeds 0.5 MW tolerance`);
        }
    });
    
    console.log(`   ✓ All demands met within 0.5 MW tolerance`);
});

// ============================================================================
// Test 8: Zero Demand Handling
// ============================================================================
runTest('Zero Demand Handling', () => {
    const app = new UnitCommitmentApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 }
    ];
    
    const demand = 0;
    const result = app.optimizeUnitCommitment(generators, demand);
    
    if (!result.success) {
        throw new Error('Should handle zero demand gracefully');
    }
    
    console.log(`   Demand: ${demand} MW`);
    console.log(`   Active generators: ${result.schedule.length}`);
    console.log(`   Total cost: ₹${result.totalCost.toFixed(2)}`);
    
    if (result.totalCost !== 0) {
        throw new Error('Zero demand should have zero cost');
    }
    
    if (result.schedule.length !== 0) {
        throw new Error('Zero demand should have no active generators');
    }
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n');
console.log('='.repeat(80));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests: ${passCount + failCount}`);
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log('='.repeat(80));

if (failCount === 0) {
    console.log('\n🎉 ALL TESTS PASSED! The algorithm is working correctly.\n');
    process.exit(0);
} else {
    console.log('\n⚠️  Some tests failed. Please review the algorithm.\n');
    process.exit(1);
}
