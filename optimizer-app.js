/**
 * Application Logic for Unit Commitment Optimizer
 * Handles UI interactions and connects to the optimization engine
 */

// State management
let currentOptimizerType = 'single'; // 'single' or 'multi'
let unitCount = 0;
let singlePeriodSolution = null;
let multiPeriodSolution = null;
let currentUnits = null;
let currentDemand = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    addDefaultUnits();
});

function initializeEventListeners() {
    // Step 1 buttons
    document.getElementById('addUnitBtn').addEventListener('click', addUnit);
    document.getElementById('saveUnitsBtn').addEventListener('click', saveUnitsAndProceed);
    document.getElementById('loadExampleBtn').addEventListener('click', loadExample);
    
    // Step 2 buttons
    document.getElementById('singlePeriodBtn').addEventListener('click', () => {
        selectOptimizerType('single');
    });
    document.getElementById('multiPeriodBtn').addEventListener('click', () => {
        selectOptimizerType('multi');
    });
    document.getElementById('backToStep1').addEventListener('click', () => {
        showStep(1);
    });
    document.getElementById('proceedToStep3').addEventListener('click', () => {
        showStep(3);
        updateDemandInputForType();
    });
    
    // Step 3 buttons
    document.getElementById('backToStep2').addEventListener('click', () => {
        showStep(2);
    });
    document.getElementById('optimizeBtn').addEventListener('click', runOptimization);
    
    // Step 4 buttons
    document.getElementById('backToStep3').addEventListener('click', () => {
        showStep(3);
    });
    document.getElementById('startOver').addEventListener('click', () => {
        location.reload();
    });
}

function showStep(stepNumber) {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step${i}`);
        if (step) step.style.display = 'none';
    }
    
    // Show requested step
    const step = document.getElementById(`step${stepNumber}`);
    if (step) {
        step.style.display = 'block';
        step.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function saveUnitsAndProceed() {
    try {
        const units = collectUnits();
        if (units.length === 0) {
            alert('⚠️ Please add at least one generation unit');
            return;
        }
        
        // Validate all units have valid data
        for (const unit of units) {
            if (isNaN(unit.minPower) || isNaN(unit.maxPower) || unit.maxPower <= 0) {
                alert('⚠️ Please fill in all unit parameters correctly');
                return;
            }
        }
        
        showStep(2);
    } catch (error) {
        alert('⚠️ Error: ' + error.message);
    }
}

function selectOptimizerType(type) {
    currentOptimizerType = type;
    
    // Update button states
    const singleBtn = document.getElementById('singlePeriodBtn');
    const multiBtn = document.getElementById('multiPeriodBtn');
    
    if (type === 'single') {
        singleBtn.classList.add('active');
        multiBtn.classList.remove('active');
        document.getElementById('singlePeriodInfo').style.display = 'block';
        document.getElementById('multiPeriodInfo').style.display = 'none';
    } else {
        multiBtn.classList.add('active');
        singleBtn.classList.remove('active');
        document.getElementById('singlePeriodInfo').style.display = 'none';
        document.getElementById('multiPeriodInfo').style.display = 'block';
    }
}

function updateDemandInputForType() {
    const demandInput = document.getElementById('demandInput');
    const demandLabel = document.getElementById('demandLabel');
    const demandHint = document.getElementById('demandHint');
    const demandInstructions = document.getElementById('demandInstructions');
    
    if (currentOptimizerType === 'single') {
        demandLabel.textContent = 'Demand Value (MW):';
        demandInput.placeholder = 'e.g., 250';
        demandHint.textContent = 'Enter a single demand value in MW';
        demandInstructions.textContent = 'Enter the required power demand for the single time period';
    } else {
        demandLabel.textContent = 'Demand Values (MW, comma-separated):';
        demandInput.placeholder = 'e.g., 250, 300, 280, 320, 350, 300';
        demandHint.textContent = 'Enter multiple demand values separated by commas for each time period';
        demandInstructions.textContent = 'Enter the required power demand for each time period (comma-separated)';
    }
    
    // Clear previous value
    demandInput.value = '';
}

function addUnit() {
    unitCount++;
    const container = document.getElementById('unitsContainer');
    
    const unitDiv = document.createElement('div');
    unitDiv.className = 'unit-input';
    unitDiv.id = `unit-${unitCount}`;
    
    unitDiv.innerHTML = `
        <div class="unit-header">
            <h4>Unit ${unitCount}</h4>
            <button class="remove-unit" onclick="removeUnit(${unitCount})">Remove</button>
        </div>
        <div class="input-grid">
            <div class="input-field">
                <label>Name</label>
                <input type="text" class="unit-name" value="Unit ${unitCount}">
            </div>
            <div class="input-field">
                <label>Min Power (MW)</label>
                <input type="number" class="unit-min-power" value="50" min="0">
            </div>
            <div class="input-field">
                <label>Max Power (MW)</label>
                <input type="number" class="unit-max-power" value="200" min="0">
            </div>
            <div class="input-field">
                <label>Startup Cost ($)</label>
                <input type="number" class="unit-startup-cost" value="1000" min="0">
            </div>
            <div class="input-field">
                <label>Shutdown Cost ($)</label>
                <input type="number" class="unit-shutdown-cost" value="500" min="0">
            </div>
            <div class="input-field">
                <label>Fuel Cost ($/MWh)</label>
                <input type="number" class="unit-fuel-cost" value="30" min="0" step="0.1">
            </div>
            <div class="input-field">
                <label>Min Uptime (hrs)</label>
                <input type="number" class="unit-min-uptime" value="2" min="1">
            </div>
            <div class="input-field">
                <label>Min Downtime (hrs)</label>
                <input type="number" class="unit-min-downtime" value="2" min="1">
            </div>
            <div class="input-field">
                <label>Ramp Up (MW/h)</label>
                <input type="number" class="unit-ramp-up" value="100" min="0">
            </div>
            <div class="input-field">
                <label>Ramp Down (MW/h)</label>
                <input type="number" class="unit-ramp-down" value="100" min="0">
            </div>
        </div>
    `;
    
    container.appendChild(unitDiv);
}

function removeUnit(id) {
    const unitDiv = document.getElementById(`unit-${id}`);
    if (unitDiv) {
        unitDiv.remove();
    }
}

function addDefaultUnits() {
    // Add 3 default units
    addUnit();
    addUnit();
    addUnit();
    
    // Set example demand
    document.getElementById('demandInput').value = '150';
}

function loadExample() {
    // Clear existing units
    document.getElementById('unitsContainer').innerHTML = '';
    unitCount = 0;
    
    // Add example units
    addUnit();
    const unit1 = document.getElementById('unit-1');
    unit1.querySelector('.unit-min-power').value = 50;
    unit1.querySelector('.unit-max-power').value = 200;
    unit1.querySelector('.unit-fuel-cost').value = 25;
    unit1.querySelector('.unit-startup-cost').value = 1000;
    unit1.querySelector('.unit-shutdown-cost').value = 500;
    
    addUnit();
    const unit2 = document.getElementById('unit-2');
    unit2.querySelector('.unit-min-power').value = 40;
    unit2.querySelector('.unit-max-power').value = 150;
    unit2.querySelector('.unit-fuel-cost').value = 30;
    unit2.querySelector('.unit-startup-cost').value = 800;
    unit2.querySelector('.unit-shutdown-cost').value = 400;
    
    addUnit();
    const unit3 = document.getElementById('unit-3');
    unit3.querySelector('.unit-min-power').value = 30;
    unit3.querySelector('.unit-max-power').value = 100;
    unit3.querySelector('.unit-fuel-cost').value = 35;
    unit3.querySelector('.unit-startup-cost').value = 600;
    unit3.querySelector('.unit-shutdown-cost').value = 300;
    
    alert('✓ Example units loaded! Click "Save & Continue" to proceed.');
}

function collectUnits() {
    const units = [];
    const unitDivs = document.querySelectorAll('.unit-input');
    
    unitDivs.forEach((div, index) => {
        const unit = new window.UnitCommitment.Unit({
            id: index + 1,
            name: div.querySelector('.unit-name').value,
            minPower: parseFloat(div.querySelector('.unit-min-power').value),
            maxPower: parseFloat(div.querySelector('.unit-max-power').value),
            startupCost: parseFloat(div.querySelector('.unit-startup-cost').value),
            shutdownCost: parseFloat(div.querySelector('.unit-shutdown-cost').value),
            fuelCost: parseFloat(div.querySelector('.unit-fuel-cost').value),
            minUptime: parseInt(div.querySelector('.unit-min-uptime').value),
            minDowntime: parseInt(div.querySelector('.unit-min-downtime').value),
            rampUpRate: parseFloat(div.querySelector('.unit-ramp-up').value),
            rampDownRate: parseFloat(div.querySelector('.unit-ramp-down').value),
            initialStatus: 0,
            initialPower: 0
        });
        units.push(unit);
    });
    
    return units;
}

function collectDemand() {
    const demandInput = document.getElementById('demandInput').value;
    const demandValues = demandInput.split(',').map(v => parseFloat(v.trim()));
    
    if (demandValues.some(isNaN)) {
        throw new Error('Invalid demand values. Please enter numbers separated by commas.');
    }
    
    return new window.UnitCommitment.Demand(demandValues);
}

function runOptimization() {
    try {
        // Collect input data
        currentUnits = collectUnits();
        currentDemand = collectDemand();
        
        if (currentUnits.length === 0) {
            throw new Error('Please add at least one unit');
        }
        
        // Run optimization based on selected type
        if (currentOptimizerType === 'single') {
            const optimizer = new window.UnitCommitment.SinglePeriodOptimizer();
            singlePeriodSolution = optimizer.optimize(currentUnits, currentDemand);
            
            // Display single period results
            displaySinglePeriodResults(singlePeriodSolution, currentUnits, currentDemand);
            document.getElementById('singlePeriodResults').style.display = 'block';
            document.getElementById('multiPeriodResults').style.display = 'none';
        } else {
            const optimizer = new window.UnitCommitment.MultiPeriodOptimizer();
            multiPeriodSolution = optimizer.optimize(currentUnits, currentDemand);
            
            // Display multi-period results
            displayMultiPeriodResults(multiPeriodSolution, currentUnits, currentDemand);
            document.getElementById('multiPeriodResults').style.display = 'block';
            document.getElementById('singlePeriodResults').style.display = 'none';
        }
        
        // Show step 4 (results)
        showStep(4);
        
    } catch (error) {
        console.error('Optimization error:', error);
        console.error('Error stack:', error.stack);
        displayError(error.message);
    }
}



function displaySinglePeriodResults(solution, units, demand) {
    // Hide multi-period results, show single-period
    document.getElementById('multiPeriodResults').style.display = 'none';
    document.getElementById('singlePeriodResults').style.display = 'block';
    
    const metadata = solution.metadata;
    const D = demand.getDemand(0);
    
    // Summary
    document.getElementById('singleSummary').innerHTML = `
        <div class="result-summary">
            <div class="result-item">
                <strong>Total Cost</strong>
                <span>$${solution.totalCost.toFixed(2)}</span>
            </div>
            <div class="result-item">
                <strong>Demand</strong>
                <span>${D.toFixed(2)} MW</span>
            </div>
            <div class="result-item">
                <strong>Units Committed</strong>
                <span>${metadata.unitsOn} of ${units.length}</span>
            </div>
            <div class="result-item">
                <strong>Solve Time</strong>
                <span>${(solution.solveTime * 1000).toFixed(2)} ms</span>
            </div>
            <div class="result-item">
                <strong>Solution Type</strong>
                <span class="success-badge">${solution.isOptimal ? 'Optimal' : 'Feasible'}</span>
            </div>
            <div class="result-item">
                <strong>Algorithm</strong>
                <span>Greedy Merit Order</span>
            </div>
        </div>
    `;
    
    // Unit commitment decision
    let scheduleHTML = '<table class="schedule-table"><thead><tr>';
    scheduleHTML += '<th>Unit</th><th>Status</th><th>Power Output</th><th>Capacity</th><th>Utilization</th><th>Fuel Cost</th></tr></thead><tbody>';
    
    for (let i = 0; i < units.length; i++) {
        const status = solution.getUnitStatus(i, 0);
        const power = solution.getUnitPower(i, 0);
        const utilization = status === 1 ? ((power / units[i].maxPower) * 100).toFixed(1) : 0;
        const statusClass = status === 1 ? 'status-on' : 'status-off';
        const statusText = status === 1 ? '✓ ON' : '✗ OFF';
        
        scheduleHTML += `<tr>
            <td><strong>${units[i].name}</strong></td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${power.toFixed(2)} MW</td>
            <td>${units[i].minPower}-${units[i].maxPower} MW</td>
            <td>${utilization}%</td>
            <td>$${units[i].fuelCost}/MWh</td>
        </tr>`;
    }
    
    scheduleHTML += '</tbody></table>';
    document.getElementById('singleSchedule').innerHTML = scheduleHTML;
    
    // Cost analysis
    let startupCost = 0;
    let productionCost = 0;
    
    for (let i = 0; i < units.length; i++) {
        const status = solution.getUnitStatus(i, 0);
        const power = solution.getUnitPower(i, 0);
        if (status === 1) {
            startupCost += units[i].startupCost;
            productionCost += units[i].fuelCost * power;
        }
    }
    
    document.getElementById('singleCost').innerHTML = `
        <div class="cost-item">
            <span>💵 Startup Costs:</span>
            <span>$${startupCost.toFixed(2)}</span>
        </div>
        <div class="cost-item">
            <span>⚡ Production Costs:</span>
            <span>$${productionCost.toFixed(2)}</span>
        </div>
        <div class="cost-item total">
            <span>💰 Total Cost:</span>
            <span>$${solution.totalCost.toFixed(2)}</span>
        </div>
        <div class="result-summary" style="margin-top: 20px;">
            <div class="result-item">
                <strong>Cost per MWh</strong>
                <span>$${(solution.totalCost / D).toFixed(2)}</span>
            </div>
            <div class="result-item">
                <strong>Startup %</strong>
                <span>${((startupCost / solution.totalCost) * 100).toFixed(1)}%</span>
            </div>
            <div class="result-item">
                <strong>Production %</strong>
                <span>${((productionCost / solution.totalCost) * 100).toFixed(1)}%</span>
            </div>
        </div>
    `;
    
    // Economic dispatch details
    let dispatchHTML = '<table class="schedule-table"><thead><tr>';
    dispatchHTML += '<th>Unit</th><th>Marginal Cost</th><th>Output</th><th>Production Cost</th><th>Merit Order</th></tr></thead><tbody>';
    
    const meritOrder = units.map((u, idx) => ({
        idx,
        unit: u,
        effectiveCost: u.fuelCost + (u.startupCost / u.maxPower)
    })).sort((a, b) => a.effectiveCost - b.effectiveCost);
    
    meritOrder.forEach((item, rank) => {
        const status = solution.getUnitStatus(item.idx, 0);
        const power = solution.getUnitPower(item.idx, 0);
        const prodCost = status === 1 ? item.unit.fuelCost * power : 0;
        
        dispatchHTML += `<tr>
            <td><strong>${item.unit.name}</strong></td>
            <td>$${item.unit.fuelCost}/MWh</td>
            <td>${power.toFixed(2)} MW</td>
            <td>$${prodCost.toFixed(2)}</td>
            <td>${rank + 1}${rank === 0 ? ' (Best)' : ''}</td>
        </tr>`;
    });
    
    dispatchHTML += '</tbody></table>';
    document.getElementById('singleDispatch').innerHTML = dispatchHTML;
    
    document.getElementById('singlePeriodResults').scrollIntoView({ behavior: 'smooth' });
}

function displayMultiPeriodResults(solution, units, demand) {
    // Hide single-period results, show multi-period
    document.getElementById('singlePeriodResults').style.display = 'none';
    document.getElementById('multiPeriodResults').style.display = 'block';
    
    const metadata = solution.metadata;
    const numPeriods = solution.getNumPeriods();
    
    // Summary
    document.getElementById('multiSummary').innerHTML = `
        <div class="result-summary">
            <div class="result-item">
                <strong>Total Cost</strong>
                <span>$${solution.totalCost.toFixed(2)}</span>
            </div>
            <div class="result-item">
                <strong>Time Periods</strong>
                <span>${numPeriods} hours</span>
            </div>
            <div class="result-item">
                <strong>Total Demand</strong>
                <span>${metadata.totalDemand.toFixed(2)} MW</span>
            </div>
            <div class="result-item">
                <strong>Peak Demand</strong>
                <span>${metadata.peakDemand.toFixed(2)} MW</span>
            </div>
            <div class="result-item">
                <strong>Avg Units Online</strong>
                <span>${metadata.avgUnitsOn.toFixed(2)}</span>
            </div>
            <div class="result-item">
                <strong>Solve Time</strong>
                <span>${(solution.solveTime * 1000).toFixed(2)} ms</span>
            </div>
            <div class="result-item">
                <strong>Solution Type</strong>
                <span class="success-badge">${solution.isOptimal ? 'Optimal' : 'Heuristic'}</span>
            </div>
            <div class="result-item">
                <strong>Algorithm</strong>
                <span>Dynamic Programming</span>
            </div>
        </div>
    `;
    
    // Schedule over time
    let scheduleHTML = '<div class="schedule-table"><table><thead><tr>';
    scheduleHTML += '<th>Unit</th>';
    for (let t = 0; t < numPeriods; t++) {
        scheduleHTML += `<th>Period ${t + 1}<br><small>${demand.getDemand(t)} MW</small></th>`;
    }
    scheduleHTML += '</tr></thead><tbody>';
    
    for (let i = 0; i < units.length; i++) {
        scheduleHTML += `<tr><td><strong>${units[i].name}</strong></td>`;
        for (let t = 0; t < numPeriods; t++) {
            const status = solution.getUnitStatus(i, t);
            const power = solution.getUnitPower(i, t);
            const statusClass = status === 1 ? 'status-on' : 'status-off';
            const statusText = status === 1 ? 'ON' : 'OFF';
            scheduleHTML += `<td><span class="${statusClass}">${statusText}</span><br>${power.toFixed(1)} MW</td>`;
        }
        scheduleHTML += '</tr>';
    }
    
    scheduleHTML += '</tbody></table></div>';
    document.getElementById('multiSchedule').innerHTML = scheduleHTML;
    
    // Cost analysis
    document.getElementById('multiCost').innerHTML = generateMultiPeriodCostBreakdown(solution, units);
    
    // Operational statistics
    document.getElementById('multiStats').innerHTML = generateOperationalStats(solution, units, demand);
    
    // Load following analysis
    document.getElementById('multiLoadFollow').innerHTML = generateLoadFollowingAnalysis(solution, units, demand);
    
    document.getElementById('multiPeriodResults').scrollIntoView({ behavior: 'smooth' });
}

function generateMultiPeriodCostBreakdown(solution, units) {
    const numPeriods = solution.getNumPeriods();
    let startupCost = 0;
    let shutdownCost = 0;
    let productionCost = 0;
    const periodCosts = [];
    
    for (let t = 0; t < numPeriods; t++) {
        let periodCost = 0;
        
        for (let i = 0; i < units.length; i++) {
            const status = solution.getUnitStatus(i, t);
            const power = solution.getUnitPower(i, t);
            const prevStatus = t === 0 ? units[i].initialStatus : solution.getUnitStatus(i, t - 1);
            
            // Startup cost
            if (status === 1 && prevStatus === 0) {
                startupCost += units[i].startupCost;
                periodCost += units[i].startupCost;
            }
            
            // Shutdown cost
            if (status === 0 && prevStatus === 1) {
                shutdownCost += units[i].shutdownCost;
                periodCost += units[i].shutdownCost;
            }
            
            // Production cost
            if (status === 1) {
                const cost = units[i].fuelCost * power;
                productionCost += cost;
                periodCost += cost;
            }
        }
        
        periodCosts.push(periodCost);
    }
    
    let html = `
        <div class="result-summary">
            <div class="result-item">
                <strong>Startup Costs</strong>
                <span>$${startupCost.toFixed(2)}</span>
            </div>
            <div class="result-item">
                <strong>Shutdown Costs</strong>
                <span>$${shutdownCost.toFixed(2)}</span>
            </div>
            <div class="result-item">
                <strong>Production Costs</strong>
                <span>$${productionCost.toFixed(2)}</span>
            </div>
            <div class="result-item">
                <strong>Total Cost</strong>
                <span>$${solution.totalCost.toFixed(2)}</span>
            </div>
            <div class="result-item">
                <strong>Avg Cost/Period</strong>
                <span>$${(solution.totalCost / numPeriods).toFixed(2)}</span>
            </div>
            <div class="result-item">
                <strong>Cost per MWh</strong>
                <span>$${(solution.totalCost / solution.metadata.totalDemand).toFixed(2)}</span>
            </div>
        </div>
        
        <h4 style="margin-top: 20px; color: #667eea;">Cost by Period</h4>
        <table class="schedule-table">
            <thead><tr><th>Period</th><th>Cost</th><th>% of Total</th></tr></thead>
            <tbody>
    `;
    
    periodCosts.forEach((cost, t) => {
        const pct = (cost / solution.totalCost) * 100;
        html += `<tr>
            <td>Period ${t + 1}</td>
            <td>$${cost.toFixed(2)}</td>
            <td>${pct.toFixed(1)}%</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    return html;
}

function generateOperationalStats(solution, units, demand) {
    const numPeriods = solution.getNumPeriods();
    const metadata = solution.metadata;
    
    // Calculate unit-specific statistics
    const unitStats = units.map((unit, i) => {
        let periodsOn = 0;
        let totalEnergy = 0;
        let maxPower = 0;
        let minPower = Infinity;
        
        for (let t = 0; t < numPeriods; t++) {
            const status = solution.getUnitStatus(i, t);
            const power = solution.getUnitPower(i, t);
            
            if (status === 1) {
                periodsOn++;
                totalEnergy += power;
                maxPower = Math.max(maxPower, power);
                if (power > 0) minPower = Math.min(minPower, power);
            }
        }
        
        return {
            name: unit.name,
            periodsOn,
            capacityFactor: ((totalEnergy / (unit.maxPower * numPeriods)) * 100).toFixed(1),
            avgPower: periodsOn > 0 ? (totalEnergy / periodsOn).toFixed(2) : 0,
            maxPower: maxPower.toFixed(2),
            minPower: minPower === Infinity ? 0 : minPower.toFixed(2)
        };
    });
    
    let html = `
        <div class="result-summary">
            <div class="result-item">
                <strong>Total Startups</strong>
                <span>${metadata.totalStartups}</span>
            </div>
            <div class="result-item">
                <strong>Total Shutdowns</strong>
                <span>${metadata.totalShutdowns}</span>
            </div>
            <div class="result-item">
                <strong>Cycling Events</strong>
                <span>${metadata.totalStartups + metadata.totalShutdowns}</span>
            </div>
        </div>
        
        <h4 style="margin-top: 20px; color: #667eea;">Unit-Specific Statistics</h4>
        <table class="schedule-table">
            <thead><tr>
                <th>Unit</th>
                <th>Periods Online</th>
                <th>Capacity Factor</th>
                <th>Avg Output</th>
                <th>Min Output</th>
                <th>Max Output</th>
            </tr></thead>
            <tbody>
    `;
    
    unitStats.forEach(stat => {
        html += `<tr>
            <td><strong>${stat.name}</strong></td>
            <td>${stat.periodsOn} / ${numPeriods}</td>
            <td>${stat.capacityFactor}%</td>
            <td>${stat.avgPower} MW</td>
            <td>${stat.minPower} MW</td>
            <td>${stat.maxPower} MW</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    return html;
}

function generateLoadFollowingAnalysis(solution, units, demand) {
    const numPeriods = solution.getNumPeriods();
    
    let html = `
        <table class="schedule-table">
            <thead><tr>
                <th>Period</th>
                <th>Demand</th>
                <th>Generation</th>
                <th>Difference</th>
                <th>Units Online</th>
                <th>Reserve Margin</th>
            </tr></thead>
            <tbody>
    `;
    
    for (let t = 0; t < numPeriods; t++) {
        const reqDemand = demand.getDemand(t);
        const generation = solution.getTotalPower(t);
        const difference = generation - reqDemand;
        
        let unitsOnline = 0;
        let totalCapacity = 0;
        
        for (let i = 0; i < units.length; i++) {
            const status = solution.getUnitStatus(i, t);
            if (status === 1) {
                unitsOnline++;
                totalCapacity += units[i].maxPower;
            }
        }
        
        const reserveMargin = ((totalCapacity - reqDemand) / reqDemand * 100).toFixed(1);
        const balanceClass = Math.abs(difference) < 0.01 ? 'status-on' : 'status-off';
        
        html += `<tr>
            <td>Period ${t + 1}</td>
            <td>${reqDemand.toFixed(2)} MW</td>
            <td>${generation.toFixed(2)} MW</td>
            <td><span class="${balanceClass}">${difference.toFixed(2)} MW</span></td>
            <td>${unitsOnline}</td>
            <td>${reserveMargin}%</td>
        </tr>`;
    }
    
    html += '</tbody></table>';
    
    // Add demand variation analysis
    const demands = [];
    for (let t = 0; t < numPeriods; t++) {
        demands.push(demand.getDemand(t));
    }
    const minDemand = Math.min(...demands);
    const maxDemand = Math.max(...demands);
    const avgDemand = demands.reduce((a, b) => a + b, 0) / numPeriods;
    const demandRange = maxDemand - minDemand;
    
    html += `
        <div class="result-summary" style="margin-top: 20px;">
            <div class="result-item">
                <strong>Min Demand</strong>
                <span>${minDemand.toFixed(2)} MW</span>
            </div>
            <div class="result-item">
                <strong>Max Demand</strong>
                <span>${maxDemand.toFixed(2)} MW</span>
            </div>
            <div class="result-item">
                <strong>Avg Demand</strong>
                <span>${avgDemand.toFixed(2)} MW</span>
            </div>
            <div class="result-item">
                <strong>Demand Range</strong>
                <span>${demandRange.toFixed(2)} MW</span>
            </div>
            <div class="result-item">
                <strong>Load Factor</strong>
                <span>${((avgDemand / maxDemand) * 100).toFixed(1)}%</span>
            </div>
        </div>
    `;
    
    return html;
}

function displayError(message) {
    // Show error message
    alert(`⚠️ Error: ${message}`);
    
    // Also log to console
    console.error('Error:', message);
    
    // Stay on current step
}
