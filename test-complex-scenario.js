// Test with complex 6-period scenario with different unit characteristics
const { Unit, Demand, SinglePeriodOptimizer, MultiPeriodOptimizer, ConstraintValidator } = require('./unit-commitment.js');

console.log('='.repeat(80));
console.log('COMPLEX SCENARIO TEST - 3 Units, 6 Periods');
console.log('='.repeat(80));

// Define units with diverse characteristics
const units = [
    new Unit({
        id: 1,
        name: 'Unit 1',
        minPower: 100,
        maxPower: 400,
        startupCost: 5000,
        shutdownCost: 2000,
        fuelCost: 22,
        minUptime: 3,
        minDowntime: 2,
        rampUp: 150,
        rampDown: 150,
        initialStatus: 0
    }),
    new Unit({
        id: 2,
        name: 'Unit 2',
        minPower: 50,
        maxPower: 200,
        startupCost: 2000,
        shutdownCost: 1000,
        fuelCost: 30,
        minUptime: 2,
        minDowntime: 2,
        rampUp: 100,
        rampDown: 100,
        initialStatus: 0
    }),
    new Unit({
        id: 3,
        name: 'Unit 3',
        minPower: 40,
        maxPower: 120,
        startupCost: 500,
        shutdownCost: 200,
        fuelCost: 45,
        minUptime: 1,
        minDowntime: 1,
        rampUp: 80,
        rampDown: 80,
        initialStatus: 0
    })
];

// 6-hour demand profile
const demandValues = [220, 310, 480, 510, 350, 240];
const demand = new Demand(demandValues);

console.log('\n📋 Unit Characteristics:');
units.forEach(unit => {
    console.log(`  ${unit.name}: ${unit.minPower}-${unit.maxPower} MW, $${unit.fuelCost}/MWh, Startup: $${unit.startupCost}, Shutdown: $${unit.shutdownCost}`);
});

console.log('\n📊 Demand Profile:');
demandValues.forEach((d, i) => {
    console.log(`  Hour ${i + 1}: ${d} MW`);
});
console.log(`  Total: ${demand.getTotalDemand()} MW over ${demand.getPeriods()} hours`);

// Test Multi-Period Optimization
console.log('\n' + '='.repeat(80));
console.log('MULTI-PERIOD OPTIMIZATION');
console.log('='.repeat(80));

const multiOptimizer = new MultiPeriodOptimizer();
const multiResult = multiOptimizer.optimize(units, demand);

// Calculate cost breakdown from the solution
let totalStartupCost = 0;
let totalShutdownCost = 0;
let totalProductionCost = 0;

for (let t = 0; t < demand.getPeriods(); t++) {
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        const currentStatus = multiResult.status[i][t];
        const currentPower = multiResult.power[i][t];
        const prevStatus = t > 0 ? multiResult.status[i][t - 1] : unit.initialStatus;
        
        // Startup cost
        if (currentStatus === 1 && prevStatus === 0) {
            totalStartupCost += unit.startupCost;
        }
        
        // Shutdown cost
        if (currentStatus === 0 && prevStatus === 1) {
            totalShutdownCost += unit.shutdownCost;
        }
        
        // Production cost
        if (currentStatus === 1) {
            totalProductionCost += currentPower * unit.fuelCost;
        }
    }
}

console.log('\n💰 Cost Breakdown:');
console.log(`  Startup Costs:    $${totalStartupCost.toFixed(2)}`);
console.log(`  Shutdown Costs:   $${totalShutdownCost.toFixed(2)}`);
console.log(`  Production Costs: $${totalProductionCost.toFixed(2)}`);
console.log(`  ─────────────────────────────────`);
console.log(`  TOTAL COST:       $${multiResult.totalCost.toFixed(2)}`);
console.log(`  Calculated Total: $${(totalStartupCost + totalShutdownCost + totalProductionCost).toFixed(2)}`);

console.log('\n🕐 Unit Commitment Schedule:');
console.log('  Period  | Demand | ' + units.map(u => u.name.padEnd(12)).join(' | '));
console.log('  ────────┼────────┼' + units.map(() => '────────────').join('─┼'));
for (let t = 0; t < demand.getPeriods(); t++) {
    const statusRow = units.map((unit, idx) => {
        const status = multiResult.status[idx][t];
        const power = multiResult.power[idx][t];
        if (status === 1) {
            return `ON  ${power.toFixed(1)} MW`.padEnd(12);
        } else {
            return 'OFF         ';
        }
    });
    console.log(`  Hour ${t + 1}  | ${demand.getDemand(t)} MW | ${statusRow.join(' | ')}`);
}

console.log('\n⚙️ Operational Statistics:');
console.log(`  Total Startups:  ${multiResult.metadata.totalStartups}`);
console.log(`  Total Shutdowns: ${multiResult.metadata.totalShutdowns}`);
console.log(`  Avg Units Online: ${multiResult.metadata.avgUnitsOn.toFixed(2)}`);

// Validate the solution
console.log('\n✅ Constraint Validation:');
const validator = new ConstraintValidator();
const validation = validator.validateSolution(multiResult, units, demand);
console.log(`  Power Balance: ${validation.powerBalance ? '✓ PASS' : '✗ FAIL'}`);
console.log(`  Capacity Limits: ${validation.capacityLimits ? '✓ PASS' : '✗ FAIL'}`);
console.log(`  Ramp Rates: ${validation.rampRates ? '✓ PASS' : '✗ FAIL'}`);
console.log(`  Min Up/Downtime: ${validation.minUpDowntime ? '✓ PASS' : '✗ FAIL'}`);
console.log(`  Overall: ${validation.valid ? '✓ ALL CONSTRAINTS SATISFIED' : '✗ CONSTRAINT VIOLATIONS FOUND'}`);

if (!validation.valid && validation.violations && validation.violations.length > 0) {
    console.log('\n⚠️ Violations:');
    validation.violations.forEach(v => console.log(`  - ${v}`));
}

console.log('\n' + '='.repeat(80));
console.log('TEST COMPLETE');
console.log('='.repeat(80));
