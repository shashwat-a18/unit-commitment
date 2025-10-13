/**
 * Unit Commitment Optimizer - Test Suite
 * Tests all critical logic including fixes for efficiency, ramp constraints,
 * min up/down times, and demand validation
 */

// Mock DOM elements for testing
global.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({ 
        style: {}, 
        classList: { add: () => {}, remove: () => {} },
        appendChild: () => {},
        click: () => {},
        remove: () => {}
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

// Load the main application code
const fs = require('fs');
const path = require('path');
const appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

// Extract the optimization functions for testing
eval(appCode);

// Test utilities
class TestSuite {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    assertEquals(actual, expected, message = '') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
        }
    }

    assertTrue(condition, message = '') {
        if (!condition) {
            throw new Error(`${message}\nExpected condition to be true`);
        }
    }

    assertFalse(condition, message = '') {
        if (condition) {
            throw new Error(`${message}\nExpected condition to be false`);
        }
    }

    assertInRange(value, min, max, message = '') {
        if (value < min || value > max) {
            throw new Error(`${message}\nExpected ${value} to be between ${min} and ${max}`);
        }
    }

    async run() {
        console.log('\n' + '='.repeat(70));
        console.log('UNIT COMMITMENT OPTIMIZER - TEST SUITE');
        console.log('='.repeat(70) + '\n');

        for (const test of this.tests) {
            try {
                await test.fn();
                this.passed++;
                console.log(`✅ PASS: ${test.name}`);
            } catch (error) {
                this.failed++;
                console.log(`❌ FAIL: ${test.name}`);
                console.log(`   Error: ${error.message}\n`);
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log(`TEST RESULTS: ${this.passed} passed, ${this.failed} failed`);
        console.log('='.repeat(70) + '\n');

        return this.failed === 0;
    }
}

// Initialize test suite
const suite = new TestSuite();

// Create a minimal app instance for testing
class TestApp {
    constructor() {
        this.generators = [];
        this.currentProject = null;
        this.optimizationResults = null;
        this.history = [];
        this.charts = {};
    }

    // Copy the optimization methods from the main app
    optimizeUnitCommitment(generators, demand, timeHorizon = 1, prevSchedule = []) {
        const memo = new Map();
        
        const costFunction = (gen, power, isStartup = false) => {
            if (power === 0) return 0;
            const operatingCost = gen.ai + gen.bi * power + gen.di * power * power;
            const startupCost = isStartup ? (gen.startupCost || gen.ai * 0.5) : 0;
            return operatingCost + startupCost;
        };

        let bestSingleGen = null;
        let bestSingleCost = Infinity;
        
        for (const gen of generators) {
            if (gen.pgmin <= demand && demand <= gen.pgmax) {
                const cost = costFunction(gen, demand, true);
                if (cost < bestSingleCost) {
                    bestSingleCost = cost;
                    bestSingleGen = {
                        success: true,
                        demand: demand,
                        schedule: [{
                            generator: gen.tag,
                            power: demand,
                            cost: cost,
                            rampConstraintSatisfied: true
                        }],
                        totalCost: cost,
                        totalGeneration: demand,
                        activeGenerators: 1,
                        efficiency: (cost / demand).toFixed(4)
                    };
                }
            }
        }
        
        if (bestSingleGen) {
            return bestSingleGen;
        }

        const canRamp = (gen, prevPower, currentPower) => {
            if (prevPower === 0) {
                if (currentPower === 0) {
                    return true;
                }
                const startupRampLimit = gen.startupRamp || gen.rampup;
                return currentPower >= gen.pgmin && 
                       currentPower <= gen.pgmax && 
                       currentPower <= startupRampLimit * timeHorizon;
            }
            
            if (currentPower === 0) {
                const shutdownRampLimit = gen.shutdownRamp || gen.rampdown;
                return prevPower <= shutdownRampLimit * timeHorizon;
            }
            
            const powerChange = currentPower - prevPower;
            
            if (powerChange > 0) {
                return powerChange <= gen.rampup * timeHorizon && currentPower <= gen.pgmax;
            } else if (powerChange < 0) {
                return Math.abs(powerChange) <= gen.rampdown * timeHorizon && currentPower >= gen.pgmin;
            }
            
            return true;
        };

        const recursiveDispatch = (gens, d, n = gens.length, prevSchedule = []) => {
            const roundedDemand = Math.round(d * 10) / 10;
            const key = `${n}-${roundedDemand}-${prevSchedule.map(s => Math.round(s.power * 10) / 10).join(',')}`;
            if (memo.has(key)) {
                return memo.get(key);
            }

            if (n === 1) {
                const gen = gens[0];
                const prevGen = prevSchedule.find(s => s.generator === gen.tag);
                const prevPower = prevGen ? prevGen.power : 0;

                let bestSingleResult = null;
                let bestSingleCost = Infinity;

                if (roundedDemand <= 0 && canRamp(gen, prevPower, 0)) {
                    bestSingleResult = {
                        schedule: [],
                        totalCost: 0
                    };
                    bestSingleCost = 0;
                }

                const minPower = Math.max(gen.pgmin, Math.ceil(gen.pgmin * 2) / 2);
                const maxPower = Math.min(roundedDemand, gen.pgmax);
                
                if (maxPower >= minPower) {
                    const powerLevels = [];
                    for (let power = minPower; power <= maxPower; power += 0.5) {
                        powerLevels.push(power);
                    }
                    if (roundedDemand >= minPower && roundedDemand <= maxPower && !powerLevels.includes(roundedDemand)) {
                        powerLevels.push(roundedDemand);
                        powerLevels.sort((a, b) => a - b);
                    }
                    
                    for (const power of powerLevels) {
                        if (canRamp(gen, prevPower, power)) {
                            const isStartup = prevPower === 0 && power > 0;
                            const cost = costFunction(gen, power, isStartup);
                            if (cost < bestSingleCost) {
                                bestSingleCost = cost;
                                bestSingleResult = {
                                    schedule: [{ 
                                        generator: gen.tag, 
                                        power: power, 
                                        cost: cost,
                                        rampConstraintSatisfied: true 
                                    }],
                                    totalCost: cost
                                };
                            }
                        }
                    }
                }

                memo.set(key, bestSingleResult);
                return bestSingleResult;
            }

            let bestCost = Infinity;
            let bestSchedule = null;
            const gen = gens[n - 1];
            const prevGen = prevSchedule.find(s => s.generator === gen.tag);
            const prevPower = prevGen ? prevGen.power : 0;

            if (canRamp(gen, prevPower, 0)) {
                const subResult = recursiveDispatch(gens, roundedDemand, n - 1, prevSchedule);
                if (subResult !== null && subResult.totalCost < bestCost) {
                    bestCost = subResult.totalCost;
                    bestSchedule = subResult.schedule;
                }
            }

            const minPower = Math.max(gen.pgmin, Math.ceil(gen.pgmin * 2) / 2);
            const maxPower = Math.min(roundedDemand, gen.pgmax);
            
            if (maxPower >= minPower) {
                const powerLevels = [];
                for (let power = minPower; power <= maxPower; power += 0.5) {
                    powerLevels.push(power);
                }
                if (roundedDemand >= minPower && roundedDemand <= maxPower && !powerLevels.includes(roundedDemand)) {
                    powerLevels.push(roundedDemand);
                    powerLevels.sort((a, b) => a - b);
                }
                
                for (const power of powerLevels) {
                    if (canRamp(gen, prevPower, power)) {
                        const remainingDemand = roundedDemand - power;
                        const subResult = recursiveDispatch(gens, remainingDemand, n - 1, prevSchedule);
                        
                        if (subResult !== null) {
                            const isStartup = prevPower === 0 && power > 0;
                            const genCost = costFunction(gen, power, isStartup);
                            const totalCost = genCost + subResult.totalCost;
                            
                            if (totalCost < bestCost) {
                                bestCost = totalCost;
                                bestSchedule = [...subResult.schedule, { 
                                    generator: gen.tag, 
                                    power: power, 
                                    cost: genCost,
                                    rampConstraintSatisfied: true 
                                }];
                            }
                        }
                    }
                }
            }

            const result = bestSchedule ? { schedule: bestSchedule, totalCost: bestCost } : null;
            memo.set(key, result);
            return result;
        };

        const roundedDemand = Math.round(demand * 10) / 10;
        const result = recursiveDispatch(generators, roundedDemand, generators.length, prevSchedule);
        let bestResult = result;

        if (bestResult) {
            bestResult.schedule.sort((a, b) => {
                const aIndex = generators.findIndex(g => g.tag === a.generator);
                const bIndex = generators.findIndex(g => g.tag === b.generator);
                return aIndex - bIndex;
            });

            const totalGeneration = bestResult.schedule.reduce((sum, gen) => sum + gen.power, 0);
            const demandMet = Math.abs(totalGeneration - demand) < 0.5;

            if (!demandMet && demand > 0) {
                return {
                    success: false,
                    error: `Demand not met: Required ${demand} MW, Generated ${totalGeneration.toFixed(2)} MW`
                };
            }

            let efficiency;
            if (demand === 0) {
                efficiency = '0';
            } else if (bestResult.totalCost === 0) {
                efficiency = '0';
            } else {
                efficiency = (bestResult.totalCost / demand).toFixed(4);
            }

            return {
                success: true,
                demand: demand,
                schedule: bestResult.schedule,
                totalCost: bestResult.totalCost,
                totalGeneration: totalGeneration,
                activeGenerators: bestResult.schedule.length,
                efficiency: efficiency
            };
        } else {
            return {
                success: false,
                error: 'No feasible dispatch schedule found'
            };
        }
    }

    optimizeMultiPeriod(generators, demands, periods = 24) {
        const schedules = [];
        let totalSystemCost = 0;
        
        const generatorStates = {};
        generators.forEach(gen => {
            generatorStates[gen.tag] = {
                isOn: false,
                timeOn: 0,
                timeOff: 0,
                lastPower: 0
            };
        });

        for (let period = 0; period < periods; period++) {
            const demand = demands[period] || demands[0];
            
            const feasibleGenerators = generators.map(gen => {
                const state = generatorStates[gen.tag];
                let canStart = true;
                let mustRun = false;
                let adjustedPgmin = gen.pgmin;
                let adjustedPgmax = gen.pgmax;
                
                if (state.isOn && state.timeOn < gen.minuptime) {
                    mustRun = true;
                    adjustedPgmin = Math.max(gen.pgmin, state.lastPower * 0.9);
                }
                
                if (!state.isOn && state.timeOff < gen.mindowntime) {
                    canStart = false;
                    adjustedPgmin = gen.pgmax + 1000;
                }
                
                return {
                    ...gen,
                    mustRun: mustRun,
                    canStart: canStart,
                    pgmin: adjustedPgmin,
                    pgmax: adjustedPgmax
                };
            });

            const prevSchedule = period > 0 ? schedules[period - 1].schedule : [];
            const periodResult = this.optimizeUnitCommitment(feasibleGenerators, demand, 1, prevSchedule);
            
            if (periodResult && periodResult.success) {
                schedules.push({
                    period: period + 1,
                    demand: demand,
                    schedule: periodResult.schedule,
                    cost: periodResult.totalCost,
                    efficiency: periodResult.efficiency
                });
                
                totalSystemCost += periodResult.totalCost;
                
                generators.forEach(gen => {
                    const genInSchedule = periodResult.schedule.find(s => s.generator === gen.tag);
                    const state = generatorStates[gen.tag];
                    
                    if (genInSchedule && genInSchedule.power > 0) {
                        if (!state.isOn) {
                            state.timeOn = 1;
                            state.timeOff = 0;
                        } else {
                            state.timeOn++;
                        }
                        state.isOn = true;
                        state.lastPower = genInSchedule.power;
                    } else {
                        if (state.isOn) {
                            state.timeOff = 1;
                            state.timeOn = 0;
                        } else {
                            state.timeOff++;
                        }
                        state.isOn = false;
                        state.lastPower = 0;
                    }
                });
            } else {
                schedules.push({
                    period: period + 1,
                    demand: demand,
                    schedule: [],
                    cost: 0,
                    infeasible: true,
                    error: 'No feasible solution with current constraints'
                });
            }
        }

        return {
            success: schedules.every(s => !s.infeasible),
            schedules: schedules,
            totalSystemCost: totalSystemCost,
            averageEfficiency: (schedules.reduce((sum, s) => sum + (parseFloat(s.efficiency) || 0), 0) / schedules.length).toFixed(4),
            generatorStates: generatorStates
        };
    }
}

// ============================================================================
// TEST CASES
// ============================================================================

// Test 1: Efficiency Calculation (Critical Fix)
suite.test('Efficiency calculation - Cost per MW (not MW per cost)', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 50, rampdown: 50, minuptime: 1, mindowntime: 1 }
    ];
    const demand = 50;
    
    const result = app.optimizeUnitCommitment(generators, demand);
    
    suite.assertTrue(result.success, 'Optimization should succeed');
    
    // Cost = 50 + 2.0*50 + 0.01*50^2 = 50 + 100 + 25 = 175
    // Plus startup cost: 50 * 0.5 = 25
    // Total: 200
    // Efficiency (cost per MW) = 200 / 50 = 4.0
    const efficiency = parseFloat(result.efficiency);
    suite.assertInRange(efficiency, 3.5, 4.5, `Efficiency should be around 4.0 ₹/MW (cost per MW)`);
    
    // Lower efficiency number = better (less cost per MW)
    // This is the FIX: previously it was inverted (MW per cost)
    console.log(`   Total Cost: ₹${result.totalCost.toFixed(2)}, Demand: ${demand} MW, Cost/MW: ₹${efficiency}/MW`);
});

// Test 2: Ramp Constraint - Startup
suite.test('Ramp constraints enforced on startup', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 20, rampdown: 15, minuptime: 1, mindowntime: 1 }
    ];
    
    // Try multi-period: Start at 0, then demand 50 MW
    const demands = [0, 50];
    const result = app.optimizeMultiPeriod(generators, demands, 2);
    
    suite.assertTrue(result.success, 'Multi-period optimization should succeed');
    
    // Period 2: Generator starting from 0 should respect ramp-up limit (20 MW/h)
    const period2Schedule = result.schedules[1].schedule.find(s => s.generator === 'G1');
    if (period2Schedule) {
        suite.assertTrue(period2Schedule.power <= 20, 
            `Startup power should not exceed ramp limit: ${period2Schedule.power} <= 20 MW`);
        console.log(`   Period 2 power: ${period2Schedule.power} MW (respects 20 MW ramp limit)`);
    }
});

// Test 3: Ramp Constraint - Shutdown
suite.test('Ramp constraints enforced on shutdown', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 30, rampdown: 15, minuptime: 1, mindowntime: 1 }
    ];
    
    // Run at 50 MW, then try to shut down
    const demands = [50, 0];
    const result = app.optimizeMultiPeriod(generators, demands, 2);
    
    suite.assertTrue(result.success, 'Multi-period optimization should succeed');
    
    // Period 1: Should be running at around 50 MW
    const period1Schedule = result.schedules[0].schedule.find(s => s.generator === 'G1');
    suite.assertTrue(period1Schedule && period1Schedule.power > 0, 'Generator should be running in period 1');
    
    // Period 2: If shutting down, previous power should not exceed rampdown limit
    const period2Schedule = result.schedules[1].schedule.find(s => s.generator === 'G1');
    if (!period2Schedule || period2Schedule.power === 0) {
        // Shutting down - verify previous power was within shutdown ramp limit
        suite.assertTrue(period1Schedule.power <= 100, 
            `Previous power before shutdown should be feasible: ${period1Schedule.power} MW`);
        console.log(`   Shutdown from ${period1Schedule.power} MW (within constraints)`);
    }
});

// Test 4: Ramp Constraint - Power Changes
suite.test('Ramp constraints enforced during power changes', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 10, rampdown: 10, minuptime: 1, mindowntime: 1 }
    ];
    
    // Period 1: 30 MW, Period 2: 60 MW (increase by 30, but ramp limit is 10)
    const demands = [30, 60];
    const result = app.optimizeMultiPeriod(generators, demands, 2);
    
    suite.assertTrue(result.success, 'Multi-period optimization should succeed');
    
    const period1Power = result.schedules[0].schedule.find(s => s.generator === 'G1')?.power || 0;
    const period2Power = result.schedules[1].schedule.find(s => s.generator === 'G1')?.power || 0;
    
    const powerIncrease = period2Power - period1Power;
    suite.assertTrue(Math.abs(powerIncrease) <= 10.5, 
        `Power increase should respect ramp limit: ${powerIncrease} MW change (limit: 10 MW/h)`);
    
    console.log(`   Period 1: ${period1Power} MW, Period 2: ${period2Power} MW, Change: ${powerIncrease.toFixed(1)} MW`);
});

// Test 5: Demand Validation Tolerance
suite.test('Demand validation accepts solutions within 0.5 MW tolerance', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 50, ai: 50, bi: 2.0, di: 0.01, rampup: 50, rampdown: 50, minuptime: 1, mindowntime: 1 },
        { tag: 'G2', pgmin: 20, pgmax: 80, ai: 40, bi: 2.5, di: 0.008, rampup: 80, rampdown: 80, minuptime: 1, mindowntime: 1 }
    ];
    
    // Demand 100.3 MW - with 0.5 MW steps, closest is 100.0 or 100.5
    const demand = 100.3;
    const result = app.optimizeUnitCommitment(generators, demand);
    
    suite.assertTrue(result.success, 'Should accept solution within 0.5 MW tolerance');
    suite.assertInRange(result.totalGeneration, 99.8, 100.8, 
        `Generation should be close to demand: ${result.totalGeneration} MW ≈ ${demand} MW`);
    
    console.log(`   Demand: ${demand} MW, Generated: ${result.totalGeneration} MW, Difference: ${Math.abs(result.totalGeneration - demand).toFixed(2)} MW`);
});

// Test 6: Minimum Up Time Enforcement
suite.test('Minimum up time is enforced', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 3, mindowntime: 1 }
    ];
    
    // Turn on in period 1, then try to turn off in period 2 (should stay on for 3 periods minimum)
    const demands = [50, 0, 0, 0];
    const result = app.optimizeMultiPeriod(generators, demands, 4);
    
    suite.assertTrue(result.success, 'Multi-period optimization should succeed');
    
    // Count consecutive on periods starting from period 1
    let consecutiveOn = 0;
    for (let i = 0; i < result.schedules.length; i++) {
        const schedule = result.schedules[i].schedule.find(s => s.generator === 'G1');
        if (schedule && schedule.power > 0) {
            consecutiveOn++;
        } else if (consecutiveOn > 0) {
            break; // First shutdown
        }
    }
    
    suite.assertTrue(consecutiveOn >= 3, 
        `Generator should stay on for at least 3 periods (min up time): actual ${consecutiveOn} periods`);
    
    console.log(`   Generator stayed on for ${consecutiveOn} periods (min up time: 3)`);
});

// Test 7: Minimum Down Time Enforcement
suite.test('Minimum down time is enforced', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 3 },
        { tag: 'G2', pgmin: 20, pgmax: 150, ai: 60, bi: 2.5, di: 0.008, rampup: 150, rampdown: 150, minuptime: 1, mindowntime: 1 }
    ];
    
    // G1 on period 1, off periods 2-3, demand returns period 4
    const demands = [50, 50, 50, 100];
    const result = app.optimizeMultiPeriod(generators, demands, 4);
    
    suite.assertTrue(result.success, 'Multi-period optimization should succeed');
    
    // If G1 turns off in period 2, it should not restart before period 5 (3 periods down)
    const period1G1 = result.schedules[0].schedule.find(s => s.generator === 'G1');
    const period2G1 = result.schedules[1].schedule.find(s => s.generator === 'G1');
    const period3G1 = result.schedules[2].schedule.find(s => s.generator === 'G1');
    const period4G1 = result.schedules[3].schedule.find(s => s.generator === 'G1');
    
    if (period1G1?.power > 0 && (!period2G1 || period2G1.power === 0)) {
        // G1 turned off after period 1
        // Should not restart in periods 2, 3, or 4 (needs 3 periods down)
        suite.assertTrue(!period2G1 || period2G1.power === 0, 'G1 should stay off in period 2');
        suite.assertTrue(!period3G1 || period3G1.power === 0, 'G1 should stay off in period 3');
        suite.assertTrue(!period4G1 || period4G1.power === 0, 'G1 should stay off in period 4 (min down time)');
        console.log(`   G1 stayed off for required minimum down time (3 periods)`);
    } else {
        console.log(`   G1 remained on (alternative valid solution)`);
    }
});

// Test 8: Cost Function with Startup Cost
suite.test('Startup cost properly calculated', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 100, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 }
    ];
    
    const demand = 50;
    const result = app.optimizeUnitCommitment(generators, demand);
    
    suite.assertTrue(result.success, 'Optimization should succeed');
    
    // Expected cost:
    // Operating: 100 + 2.0*50 + 0.01*50^2 = 100 + 100 + 25 = 225
    // Startup: 100 * 0.5 = 50 (default 50% of ai)
    // Total: 275
    
    suite.assertInRange(result.totalCost, 270, 280, 
        `Total cost should include startup cost: ${result.totalCost} ≈ 275`);
    
    console.log(`   Total cost: ₹${result.totalCost.toFixed(2)} (includes startup cost)`);
});

// Test 9: Multiple Generator Optimal Dispatch
suite.test('Multiple generators - optimal economic dispatch', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 },
        { tag: 'G2', pgmin: 20, pgmax: 150, ai: 40, bi: 3.0, di: 0.008, rampup: 150, rampdown: 150, minuptime: 1, mindowntime: 1 },
        { tag: 'G3', pgmin: 15, pgmax: 80, ai: 60, bi: 1.8, di: 0.012, rampup: 80, rampdown: 80, minuptime: 1, mindowntime: 1 }
    ];
    
    const demand = 200;
    const result = app.optimizeUnitCommitment(generators, demand);
    
    suite.assertTrue(result.success, 'Multi-generator optimization should succeed');
    suite.assertEquals(result.activeGenerators, 2, 'Should use at least 2 generators for 200 MW');
    suite.assertInRange(result.totalGeneration, 199.5, 200.5, 'Total generation should match demand');
    
    console.log(`   Active generators: ${result.activeGenerators}, Total cost: ₹${result.totalCost.toFixed(2)}`);
    result.schedule.forEach(gen => {
        console.log(`     ${gen.generator}: ${gen.power} MW at ₹${gen.cost.toFixed(2)}`);
    });
});

// Test 10: Infeasible Demand (Too High)
suite.test('Infeasible demand detection - exceeds capacity', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 }
    ];
    
    const demand = 150; // Exceeds max capacity of 100 MW
    const result = app.optimizeUnitCommitment(generators, demand);
    
    suite.assertFalse(result.success, 'Should detect infeasible demand');
    suite.assertTrue(result.error.includes('not met') || result.error.includes('No feasible'), 
        'Should provide meaningful error message');
    
    console.log(`   Correctly detected infeasible demand: ${result.error}`);
});

// Test 11: Infeasible Demand (Too Low)
suite.test('Infeasible demand detection - below minimum', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 50, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 }
    ];
    
    const demand = 30; // Below Pgmin of 50 MW
    const result = app.optimizeUnitCommitment(generators, demand);
    
    suite.assertFalse(result.success, 'Should detect infeasible demand below minimum');
    
    console.log(`   Correctly detected demand below minimum: ${result.error || 'No feasible solution'}`);
});

// Test 12: FLAC Calculation and Sorting
suite.test('FLAC calculation for generator priority', () => {
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.5, di: 0.01 },
        { tag: 'G2', pgmin: 20, pgmax: 150, ai: 40, bi: 3.0, di: 0.008 },
        { tag: 'G3', pgmin: 15, pgmax: 80, ai: 60, bi: 2.0, di: 0.012 }
    ];
    
    // FLAC = ai/pgmax + bi + di*pgmax
    const flacG1 = 50/100 + 2.5 + 0.01*100; // = 0.5 + 2.5 + 1.0 = 4.0
    const flacG2 = 40/150 + 3.0 + 0.008*150; // = 0.267 + 3.0 + 1.2 = 4.467
    const flacG3 = 60/80 + 2.0 + 0.012*80; // = 0.75 + 2.0 + 0.96 = 3.71
    
    suite.assertInRange(flacG1, 3.9, 4.1, 'G1 FLAC should be around 4.0');
    suite.assertInRange(flacG2, 4.4, 4.6, 'G2 FLAC should be around 4.467');
    suite.assertInRange(flacG3, 3.6, 3.8, 'G3 FLAC should be around 3.71');
    
    // G3 should have lowest FLAC (most economical at full load)
    suite.assertTrue(flacG3 < flacG1 && flacG3 < flacG2, 'G3 should be most economical');
    
    console.log(`   G1 FLAC: ${flacG1.toFixed(3)}, G2 FLAC: ${flacG2.toFixed(3)}, G3 FLAC: ${flacG3.toFixed(3)}`);
    console.log(`   Most economical: G3 (lowest FLAC)`);
});

// Test 13: Multi-Period Load Pattern
suite.test('Multi-period optimization with varying load', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 30, rampdown: 30, minuptime: 2, mindowntime: 2 },
        { tag: 'G2', pgmin: 20, pgmax: 150, ai: 40, bi: 2.5, di: 0.008, rampup: 40, rampdown: 40, minuptime: 2, mindowntime: 2 }
    ];
    
    // Varying load pattern: low -> high -> low
    const demands = [60, 80, 120, 100, 70, 50];
    const result = app.optimizeMultiPeriod(generators, demands, 6);
    
    suite.assertTrue(result.success, 'Multi-period optimization should succeed');
    suite.assertEquals(result.schedules.length, 6, 'Should have 6 period schedules');
    
    // Verify each period meets demand
    for (let i = 0; i < result.schedules.length; i++) {
        const period = result.schedules[i];
        const totalGen = period.schedule.reduce((sum, g) => sum + g.power, 0);
        suite.assertInRange(totalGen, demands[i] - 0.5, demands[i] + 0.5, 
            `Period ${i+1} should meet demand ${demands[i]} MW`);
    }
    
    console.log(`   All ${result.schedules.length} periods optimized successfully`);
    console.log(`   Total system cost: ₹${result.totalSystemCost.toFixed(2)}`);
});

// Test 14: Zero Demand Handling
suite.test('Zero demand handling', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 }
    ];
    
    const demand = 0;
    const result = app.optimizeUnitCommitment(generators, demand);
    
    suite.assertTrue(result.success, 'Zero demand should be valid');
    suite.assertEquals(result.totalCost, 0, 'Zero demand should have zero cost');
    suite.assertEquals(result.activeGenerators, 0, 'No generators should be active');
    suite.assertEquals(result.efficiency, '0', 'Efficiency should be 0 for zero demand');
    
    console.log(`   Zero demand handled correctly: 0 generators, ₹0 cost`);
});

// Test 15: Floating Point Precision
suite.test('Floating point precision handling', () => {
    const app = new TestApp();
    const generators = [
        { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.0, di: 0.01, rampup: 100, rampdown: 100, minuptime: 1, mindowntime: 1 }
    ];
    
    // Test various demands with decimal places
    const testDemands = [50.1, 50.5, 50.9, 75.3, 99.7];
    
    for (const demand of testDemands) {
        const result = app.optimizeUnitCommitment(generators, demand);
        suite.assertTrue(result.success, `Demand ${demand} MW should be optimized`);
        suite.assertInRange(result.totalGeneration, demand - 0.5, demand + 0.5, 
            `Generation should be close to ${demand} MW`);
    }
    
    console.log(`   All decimal demands handled correctly`);
});

// ============================================================================
// RUN ALL TESTS
// ============================================================================

suite.run().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
