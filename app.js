// Unit Commitment Optimizer
// Modern JavaScript application for power system optimization

class UnitCommitmentApp {
    constructor() {
        this.generators = [];
        this.currentProject = null;
        this.optimizationResults = null;
        this.history = this.loadHistory();
        this.charts = {};
        this.animationSettings = {
            duration: 1000,
            easing: 'easeInOutQuart'
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSavedProject();
        this.updateUI();
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Generator Management
        document.getElementById('create-generators-btn').addEventListener('click', () => this.createGeneratorForms());
        document.getElementById('save-generators-btn').addEventListener('click', () => this.saveGenerators());
        
        // Quick Actions
        document.getElementById('load-example-btn').addEventListener('click', () => this.loadExample());
        document.getElementById('import-csv-btn').addEventListener('click', () => this.triggerCSVImport());
        document.getElementById('download-template-btn').addEventListener('click', () => this.downloadTemplate());
        document.getElementById('clear-all-btn').addEventListener('click', () => this.clearAll());
        
        // CSV Import
        document.getElementById('csv-file-input').addEventListener('change', (e) => this.handleCSVImport(e));
        
        // Optimization
        document.getElementById('optimize-btn').addEventListener('click', () => this.runOptimization());
        document.getElementById('demand-input').addEventListener('input', (e) => this.validateDemand(e.target.value));
        
        // Multi-period Optimization
        document.getElementById('multiperiod-optimize-btn').addEventListener('click', () => this.runMultiPeriodOptimization());
        document.getElementById('demand-pattern').addEventListener('change', (e) => this.handleDemandPatternChange(e.target.value));
        
        // History Management
        document.getElementById('export-history-btn').addEventListener('click', () => this.exportHistory());
        document.getElementById('clear-history-btn').addEventListener('click', () => this.clearHistory());
        
        // Animation and Visualization Controls
        document.getElementById('animate-results-btn').addEventListener('click', () => this.animateResults());
        document.getElementById('compare-scenarios-btn').addEventListener('click', () => this.compareScenarios());
        document.getElementById('export-charts-btn').addEventListener('click', () => this.exportCharts());
    }

    // Tab Management
    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Update tab-specific content
        if (tabName === 'optimization') {
            this.updateOptimizationTab();
        } else if (tabName === 'results') {
            this.updateResultsTab();
            this.createAdvancedVisualizations();
        } else if (tabName === 'history') {
            this.updateHistoryTab();
        }
        
        // Add tab transition animation
        const activeTab = document.getElementById(`${tabName}-tab`);
        activeTab.style.opacity = '0';
        activeTab.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            activeTab.style.transition = 'all 0.4s ease';
            activeTab.style.opacity = '1';
            activeTab.style.transform = 'translateY(0)';
        }, 50);
    }

    highlightOptimizationSection() {
        const demandSection = this.safeGetElement('demand-input');
        const optimizeBtn = this.safeGetElement('optimize-btn');
        
        if (demandSection) {
            // Add highlighting animation
            demandSection.style.boxShadow = '0 0 15px rgba(37, 99, 235, 0.5)';
            demandSection.focus();
            
            // Remove highlight after animation
            setTimeout(() => {
                demandSection.style.boxShadow = '';
            }, 3000);
        }
        
        if (optimizeBtn && !optimizeBtn.disabled) {
            // Pulse effect on optimize button
            optimizeBtn.classList.add('btn-pulse');
            setTimeout(() => {
                optimizeBtn.classList.remove('btn-pulse');
            }, 3000);
        }
    }

    highlightResultsSection() {
        const resultsSection = this.safeGetElement('optimization-results');
        if (resultsSection) {
            // Add highlighting animation to results
            resultsSection.style.boxShadow = '0 0 20px rgba(5, 150, 105, 0.3)';
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Remove highlight after animation
            setTimeout(() => {
                resultsSection.style.boxShadow = '';
            }, 4000);
        }
    }

    showOptimizationHelp() {
        if (!this.currentProject) return;
        
        const helpMessage = `
            <div class="optimization-help-content">
                <h4><i class="fas fa-lightbulb"></i> Optimization Tips:</h4>
                <ul>
                    <li><strong>Valid demand range:</strong> ${this.currentProject.minLoad.toFixed(2)} - ${this.currentProject.maxLoad.toFixed(2)} MW</li>
                    <li><strong>Total capacity:</strong> ${this.currentProject.maxLoad.toFixed(2)} MW available</li>
                    <li><strong>Minimum load:</strong> At least ${this.currentProject.minLoad.toFixed(2)} MW required</li>
                </ul>
                <p>Try adjusting your demand value or generator parameters.</p>
                <button onclick="this.parentElement.parentElement.remove()" class="btn-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Display help inline
        const demandInput = this.safeGetElement('demand-input');
        if (demandInput) {
            const demandSection = demandInput.parentElement;
            let helpDiv = document.getElementById('optimization-help');
            if (!helpDiv) {
                helpDiv = document.createElement('div');
                helpDiv.id = 'optimization-help';
                helpDiv.className = 'optimization-help';
                helpDiv.innerHTML = helpMessage;
                demandSection.appendChild(helpDiv);
                
                // Auto-remove after 15 seconds
                setTimeout(() => {
                    if (helpDiv.parentNode) {
                        helpDiv.remove();
                    }
                }, 15000);
            }
        }
    }

    // Generator Management
    createGeneratorForms() {
        const numGenerators = parseInt(document.getElementById('num-generators').value);
        const container = document.getElementById('generator-forms-container');
        
        if (numGenerators < 1 || numGenerators > 10) {
            this.showToast('Please enter a valid number of generators (1-10)', 'error');
            return;
        }

        // Clear any existing errors
        this.clearFieldErrors();
        
        container.innerHTML = '';
        
        // Create forms with staggered animation
        for (let i = 1; i <= numGenerators; i++) {
            setTimeout(() => {
                const formDiv = document.createElement('div');
                formDiv.className = 'generator-form';
                formDiv.innerHTML = `
                    <h4><i class="fas fa-cog"></i> Generator ${i} Parameters</h4>
                    <div class="generator-fields">
                        <div class="form-group">
                            <label for="gen_${i}_tag">Tag:</label>
                            <input type="text" id="gen_${i}_tag" value="G${i}" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="gen_${i}_pgmin">Pgmin (MW):</label>
                            <input type="number" id="gen_${i}_pgmin" step="0.1" min="0" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="gen_${i}_pgmax">Pgmax (MW):</label>
                            <input type="number" id="gen_${i}_pgmax" step="0.1" min="0" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="gen_${i}_ai">Ai (₹):</label>
                            <input type="number" id="gen_${i}_ai" step="0.01" min="0" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="gen_${i}_bi">Bi (₹/MW):</label>
                            <input type="number" id="gen_${i}_bi" step="0.01" min="0" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="gen_${i}_di">Di (₹/MW²):</label>
                            <input type="number" id="gen_${i}_di" step="0.0001" min="0" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="gen_${i}_rampup">Ramp Up (MW/h):</label>
                            <input type="number" id="gen_${i}_rampup" step="0.1" min="0" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="gen_${i}_rampdown">Ramp Down (MW/h):</label>
                            <input type="number" id="gen_${i}_rampdown" step="0.1" min="0" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="gen_${i}_minuptime">Min Up Time (h):</label>
                            <input type="number" id="gen_${i}_minuptime" step="1" min="1" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="gen_${i}_mindowntime">Min Down Time (h):</label>
                            <input type="number" id="gen_${i}_mindowntime" step="1" min="1" class="form-input" required>
                        </div>
                    </div>
                `;
                container.appendChild(formDiv);
                
                // Add intelligent default values
                this.setDefaultValues(i);
                
                // Add input event listeners for real-time validation
                this.addFormValidation(i);
            }, i * 100); // Stagger animation by 100ms
        }
        
        setTimeout(() => {
            document.getElementById('save-section').style.display = 'block';
            document.getElementById('save-section').classList.add('animate-fadeIn');
        }, (numGenerators + 1) * 100);
        
        this.showToast(`Creating ${numGenerators} generator forms...`, 'success');
    }

    saveGenerators() {
        const numGenerators = parseInt(document.getElementById('num-generators').value);
        const questionNo = parseInt(document.getElementById('question-number').value);
        const generators = [];

        // Collect and validate generator data
        for (let i = 1; i <= numGenerators; i++) {
            const tag = document.getElementById(`gen_${i}_tag`).value;
            const pgmin = parseFloat(document.getElementById(`gen_${i}_pgmin`).value);
            const pgmax = parseFloat(document.getElementById(`gen_${i}_pgmax`).value);
            const ai = parseFloat(document.getElementById(`gen_${i}_ai`).value);
            const bi = parseFloat(document.getElementById(`gen_${i}_bi`).value);
            const di = parseFloat(document.getElementById(`gen_${i}_di`).value);
            const rampup = parseFloat(document.getElementById(`gen_${i}_rampup`).value);
            const rampdown = parseFloat(document.getElementById(`gen_${i}_rampdown`).value);
            const minuptime = parseFloat(document.getElementById(`gen_${i}_minuptime`).value);
            const mindowntime = parseFloat(document.getElementById(`gen_${i}_mindowntime`).value);

            // Enhanced validation with specific error feedback
            const errors = [];
            
            if (!tag || tag.trim() === '') {
                errors.push('Generator tag is required');
                this.highlightFieldError(`gen_${i}_tag`);
            }
            
            if (isNaN(pgmin) || pgmin < 0) {
                errors.push('Pgmin must be a positive number');
                this.highlightFieldError(`gen_${i}_pgmin`);
            }
            
            if (isNaN(pgmax) || pgmax <= 0) {
                errors.push('Pgmax must be a positive number');
                this.highlightFieldError(`gen_${i}_pgmax`);
            }
            
            if (isNaN(ai) || ai < 0) {
                errors.push('Fixed cost (Ai) must be non-negative');
                this.highlightFieldError(`gen_${i}_ai`);
            }
            
            if (isNaN(bi) || bi < 0) {
                errors.push('Variable cost (Bi) must be non-negative');
                this.highlightFieldError(`gen_${i}_bi`);
            }
            
            if (isNaN(di) || di < 0) {
                errors.push('Quadratic cost (Di) must be non-negative');
                this.highlightFieldError(`gen_${i}_di`);
            }
            
            if (isNaN(rampup) || rampup <= 0) {
                errors.push('Ramp up rate must be positive');
                this.highlightFieldError(`gen_${i}_rampup`);
            }
            
            if (isNaN(rampdown) || rampdown <= 0) {
                errors.push('Ramp down rate must be positive');
                this.highlightFieldError(`gen_${i}_rampdown`);
            }
            
            if (isNaN(minuptime) || minuptime < 1) {
                errors.push('Minimum up time must be at least 1 hour');
                this.highlightFieldError(`gen_${i}_minuptime`);
            }
            
            if (isNaN(mindowntime) || mindowntime < 1) {
                errors.push('Minimum down time must be at least 1 hour');
                this.highlightFieldError(`gen_${i}_mindowntime`);
            }
            
            if (errors.length > 0) {
                this.showValidationErrors(`Generator ${i}`, errors);
                return;
            }

            if (pgmin >= pgmax) {
                this.showToast(`Generator ${i}: Pgmin must be less than Pgmax`, 'error');
                return;
            }

            if (rampup <= 0 || rampdown <= 0) {
                this.showToast(`Generator ${i}: Ramp rates must be positive`, 'error');
                return;
            }

            if (minuptime < 1 || mindowntime < 1) {
                this.showToast(`Generator ${i}: Minimum times must be at least 1 hour`, 'error');
                return;
            }

            generators.push({ tag, pgmin, pgmax, ai, bi, di, rampup, rampdown, minuptime, mindowntime });
        }

        // Calculate FLAC and sort
        const processedGenerators = generators.map(gen => {
            const flac = gen.ai / gen.pgmax + gen.bi + gen.di * gen.pgmax;
            return { ...gen, flac };
        }).sort((a, b) => a.flac - b.flac);

        // Update application state
        this.generators = processedGenerators;
        this.currentProject = {
            questionNo,
            generators: processedGenerators,
            timestamp: new Date().toISOString(),
            minLoad: Math.min(...processedGenerators.map(g => g.pgmin)),
            maxLoad: processedGenerators.reduce((sum, g) => sum + g.pgmax, 0)
        };

        // Save to localStorage
        this.saveProject();
        this.addToHistory();
        this.updateUI();

        this.showToast('Generators saved successfully! Proceeding to optimization...', 'success');
        
        // Create FLAC visualization
        this.createFLACChart();
        
        // Auto-proceed to optimization tab with smooth transition
        setTimeout(() => {
            this.switchTab('optimization');
            this.highlightOptimizationSection();
        }, 1500);
    }

    // Optimization Engine
    runOptimization() {
        const demand = parseFloat(document.getElementById('demand-input').value);
        
        if (!this.currentProject || this.generators.length === 0) {
            this.showToast('Please create and save generators first', 'error');
            return;
        }

        if (isNaN(demand) || demand <= 0) {
            this.showToast('Please enter a valid demand value', 'error');
            return;
        }

        if (demand < this.currentProject.minLoad || demand > this.currentProject.maxLoad) {
            this.showToast(`Demand must be between ${this.currentProject.minLoad.toFixed(2)} MW and ${this.currentProject.maxLoad.toFixed(2)} MW`, 'error');
            return;
        }

        this.showLoading(true);
        
        // Run optimization in a setTimeout to allow UI to update
        setTimeout(() => {
            try {
                const result = this.optimizeUnitCommitment(this.generators, demand);
                this.optimizationResults = result;
                this.updateOptimizationResults(result);
                this.showLoading(false);
                
                if (result.success) {
                    this.showToast(`Optimization completed! Total cost: ₹${result.totalCost.toFixed(2)}, Efficiency: ${result.efficiency} MW/₹`, 'success');
                    this.createOptimizationCharts(result);
                    
                    // Smooth transition to results with delay for user to see the success message
                    setTimeout(() => {
                        this.switchTab('results');
                        this.highlightResultsSection();
                    }, 2000);
                } else {
                    this.showToast('No feasible solution found. Please check your demand value and generator constraints.', 'error');
                    this.showOptimizationHelp();
                }
            } catch (error) {
                console.error('Optimization error:', error);
                this.showLoading(false);
                this.showToast('Optimization failed. Please check your data.', 'error');
            }
        }, 100);
    }

    handleDemandPatternChange(pattern) {
        const customInput = document.getElementById('custom-demand-input');
        if (pattern === 'custom') {
            customInput.style.display = 'block';
        } else {
            customInput.style.display = 'none';
        }
    }

    generateDemandPattern(pattern, periods, baseDemand) {
        const demands = [];
        
        switch (pattern) {
            case 'constant':
                for (let i = 0; i < periods; i++) {
                    demands.push(baseDemand);
                }
                break;
                
            case 'daily':
                // Typical daily load pattern (percentage of peak)
                const dailyPattern = [
                    0.6, 0.55, 0.5, 0.48, 0.5, 0.6, 0.75, 0.9,  // 0-7
                    0.95, 0.9, 0.85, 0.88, 0.92, 0.9, 0.85, 0.88, // 8-15
                    0.95, 1.0, 0.98, 0.92, 0.85, 0.8, 0.75, 0.65  // 16-23
                ];
                for (let i = 0; i < periods; i++) {
                    const hourIndex = i % 24;
                    demands.push(baseDemand * dailyPattern[hourIndex]);
                }
                break;
                
            case 'custom':
                const customValues = document.getElementById('demand-values').value;
                const parsed = customValues.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
                if (parsed.length === 0) {
                    this.showToast('Please enter valid demand values', 'error');
                    return null;
                }
                for (let i = 0; i < periods; i++) {
                    demands.push(parsed[i % parsed.length]);
                }
                break;
        }
        
        return demands;
    }

    runMultiPeriodOptimization() {
        if (this.generators.length === 0) {
            this.showToast('Please add generators first', 'error');
            return;
        }

        const periods = parseInt(document.getElementById('periods-input').value);
        const pattern = document.getElementById('demand-pattern').value;
        const baseDemand = parseFloat(document.getElementById('demand-input').value) || 100;
        
        const demands = this.generateDemandPattern(pattern, periods, baseDemand);
        if (!demands) return;

        this.showLoading(true, 'Running multi-period optimization...');
        
        setTimeout(() => {
            try {
                const result = this.optimizeMultiPeriod(this.generators, demands, periods);
                
                if (result && result.success) {
                    this.displayMultiPeriodResults(result);
                    this.createMultiPeriodCharts(result);
                    this.showToast(`Multi-period optimization completed! Average efficiency: ${result.averageEfficiency} MW/₹`, 'success');
                } else {
                    this.showToast('Multi-period optimization failed. Check constraints and demands.', 'error');
                }
            } catch (error) {
                console.error('Multi-period optimization error:', error);
                this.showToast('Optimization failed. Please check your data.', 'error');
            }
            this.showLoading(false);
        }, 200);
    }

    optimizeUnitCommitment(generators, demand, timeHorizon = 1) {
        const memo = new Map();
        
        const costFunction = (gen, power, isStartup = false) => {
            if (power === 0) return 0;
            // Base operating cost: ai (fixed) + bi * power (variable) + di * power^2 (quadratic)
            const operatingCost = gen.ai + gen.bi * power + gen.di * power * power;
            // Add startup cost if generator is starting up
            const startupCost = isStartup ? (gen.startupCost || gen.ai * 0.1) : 0;
            return operatingCost + startupCost;
        };

        // Check if generator can ramp from previous power to current power
        const canRamp = (gen, prevPower, currentPower) => {
            const powerChange = Math.abs(currentPower - prevPower);
            const maxRamp = Math.min(gen.rampup, gen.rampdown) * timeHorizon;
            return powerChange <= maxRamp;
        };

        const recursiveDispatch = (gens, d, n = gens.length, prevSchedule = []) => {
            const key = `${n}-${d}-${prevSchedule.map(s => s.power).join(',')}`;
            if (memo.has(key)) {
                return memo.get(key);
            }

            if (n === 1) {
                const gen = gens[0];
                const prevGen = prevSchedule.find(s => s.generator === gen.tag);
                const prevPower = prevGen ? prevGen.power : 0;

                // Try different power levels within constraints
                let bestSingleResult = null;
                let bestSingleCost = Infinity;

                // First try not using this generator (power = 0)
                if (d <= 0 && canRamp(gen, prevPower, 0)) {
                    bestSingleResult = {
                        schedule: [],
                        totalCost: 0
                    };
                    bestSingleCost = 0;
                }

                // Then try using the generator at valid power levels
                const minPower = Math.max(gen.pgmin, Math.ceil(gen.pgmin * 2) / 2); // Round up to nearest 0.5
                const maxPower = Math.min(d, gen.pgmax);
                
                if (maxPower >= minPower) {
                    for (let power = minPower; power <= maxPower; power += 0.5) {
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

            // Try not using this generator (power = 0)
            if (canRamp(gen, prevPower, 0)) {
                const subResult = recursiveDispatch(gens, d, n - 1, prevSchedule);
                if (subResult !== null && subResult.totalCost < bestCost) {
                    bestCost = subResult.totalCost;
                    bestSchedule = subResult.schedule;
                }
            }

            // Try using this generator at valid power levels
            const minPower = Math.max(gen.pgmin, Math.ceil(gen.pgmin * 2) / 2); // Round up to nearest 0.5
            const maxPower = Math.min(d, gen.pgmax);
            
            if (maxPower >= minPower) {
                for (let power = minPower; power <= maxPower; power += 0.5) {
                    if (canRamp(gen, prevPower, power)) {
                        const remainingDemand = d - power;
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

        // Try with all generators (they'll be filtered internally based on demand)
        const result = recursiveDispatch(generators, demand);
        let bestResult = result;

        if (bestResult) {
            // Sort schedule by generator order and add summary
            bestResult.schedule.sort((a, b) => {
                const aIndex = generators.findIndex(g => g.tag === a.generator);
                const bIndex = generators.findIndex(g => g.tag === b.generator);
                return aIndex - bIndex;
            });

            // Validate that demand is met
            const totalGeneration = bestResult.schedule.reduce((sum, gen) => sum + gen.power, 0);
            const demandMet = Math.abs(totalGeneration - demand) < 0.01; // Allow small floating point errors

            if (!demandMet && demand > 0) {
                return {
                    success: false,
                    error: `Demand not met: Required ${demand} MW, Generated ${totalGeneration.toFixed(2)} MW`
                };
            }

            // Calculate efficiency properly - avoid division by zero
            let efficiency;
            if (bestResult.totalCost === 0) {
                efficiency = demand === 0 ? '∞' : '0'; // Infinity symbol if no cost, 0 if impossible
            } else {
                // Efficiency = MW delivered per ₹ cost
                efficiency = (demand / bestResult.totalCost).toFixed(4);
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

    // Multi-period optimization with minimum up/down time constraints
    optimizeMultiPeriod(generators, demands, periods = 24) {
        const schedules = [];
        let totalSystemCost = 0;
        
        // Track generator states for minimum up/down time constraints
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
            const demand = demands[period] || demands[0]; // Use first demand if not enough periods
            
            // Apply minimum up/down time constraints
            const feasibleGenerators = generators.map(gen => {
                const state = generatorStates[gen.tag];
                let canStart = true;
                let mustRun = false;
                
                // If generator is on and hasn't met minimum up time
                if (state.isOn && state.timeOn < gen.minuptime) {
                    mustRun = true; // Must keep running
                }
                
                // If generator is off and hasn't met minimum down time
                if (!state.isOn && state.timeOff < gen.mindowntime) {
                    canStart = false; // Cannot start yet
                }
                
                return {
                    ...gen,
                    mustRun: mustRun,
                    canStart: canStart,
                    pgmin: mustRun ? Math.max(gen.pgmin, state.lastPower) : (canStart ? gen.pgmin : gen.pgmax + 1) // Make infeasible if can't start
                };
            });

            const periodResult = this.optimizeUnitCommitment(feasibleGenerators, demand, 1);
            
            if (periodResult && periodResult.success) {
                schedules.push({
                    period: period + 1,
                    demand: demand,
                    schedule: periodResult.schedule,
                    cost: periodResult.totalCost,
                    efficiency: periodResult.efficiency
                });
                
                totalSystemCost += periodResult.totalCost;
                
                // Update generator states
                generators.forEach(gen => {
                    const genInSchedule = periodResult.schedule.find(s => s.generator === gen.tag);
                    const state = generatorStates[gen.tag];
                    
                    if (genInSchedule && genInSchedule.power > 0) {
                        if (!state.isOn) {
                            // Generator is starting up
                            state.timeOn = 1;
                            state.timeOff = 0;
                        } else {
                            // Generator continues running
                            state.timeOn++;
                        }
                        state.isOn = true;
                        state.lastPower = genInSchedule.power;
                    } else {
                        if (state.isOn) {
                            // Generator is shutting down
                            state.timeOff = 1;
                            state.timeOn = 0;
                        } else {
                            // Generator continues offline
                            state.timeOff++;
                        }
                        state.isOn = false;
                        state.lastPower = 0;
                    }
                });
            } else {
                // No feasible solution for this period
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

    // UI Update Methods
    updateUI() {
        this.updateGeneratorSummary();
        this.updateOptimizationTab();
    }

    updateGeneratorSummary() {
        const container = document.getElementById('generator-summary');
        
        if (!this.currentProject || this.generators.length === 0) {
            container.innerHTML = '<p class="no-data">No generators loaded. Please create generators first.</p>';
            return;
        }

        const generatorList = this.generators.map((gen, index) => {
            const maxFLAC = Math.max(...this.generators.map(g => g.flac));
            const flacPercentage = ((maxFLAC - gen.flac) / maxFLAC * 100).toFixed(1);
            
            return `
                <div class="generator-item" style="animation-delay: ${index * 0.1}s">
                    <div class="generator-info">
                        <span class="generator-tag">${gen.tag}</span>
                        <div class="generator-stats">
                            ${gen.pgmin}MW - ${gen.pgmax}MW
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${flacPercentage}%" 
                                     data-tooltip="Efficiency: ${flacPercentage}%"></div>
                            </div>
                        </div>
                    </div>
                    <span class="flac-badge">FLAC: ${gen.flac.toFixed(4)}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="generator-list">
                ${generatorList}
            </div>
            <div class="demand-range mt-2">
                <strong>System Capacity:</strong><br>
                Min Load: ${this.currentProject.minLoad.toFixed(2)} MW<br>
                Max Load: ${this.currentProject.maxLoad.toFixed(2)} MW
            </div>
        `;
    }

    updateOptimizationTab() {
        const optimizeBtn = this.safeGetElement('optimize-btn');
        const multiPeriodBtn = this.safeGetElement('multiperiod-optimize-btn');
        const demandRange = this.safeGetElement('demand-range');
        
        if (this.currentProject) {
            if (optimizeBtn) optimizeBtn.disabled = false;
            if (multiPeriodBtn) multiPeriodBtn.disabled = false;
            if (demandRange) {
                demandRange.innerHTML = `
                    <i class="fas fa-info-circle"></i>
                    Valid range: ${this.currentProject.minLoad.toFixed(2)} - ${this.currentProject.maxLoad.toFixed(2)} MW
                `;
            }
        } else {
            if (optimizeBtn) optimizeBtn.disabled = true;
            if (multiPeriodBtn) multiPeriodBtn.disabled = true;
            if (demandRange) {
                demandRange.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No generators loaded';
            }
        }
    }

    updateOptimizationResults(result) {
        const container = document.getElementById('optimization-results');
        
        if (result.success) {
            const scheduleRows = result.schedule.map((item, index) => {
                const powerPercentage = ((item.power / result.demand) * 100).toFixed(1);
                return `
                    <tr class="animate-slideInLeft" style="animation-delay: ${index * 0.1}s">
                        <td>
                            <span class="generator-tag">${item.generator}</span>
                        </td>
                        <td>
                            <span class="animated-counter" data-target="${item.power.toFixed(2)}">${item.power.toFixed(2)}</span> MW
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${powerPercentage}%"></div>
                            </div>
                        </td>
                        <td class="animated-counter" data-target="${item.cost.toFixed(2)}">₹${item.cost.toFixed(2)}</td>
                        <td>${powerPercentage}%</td>
                    </tr>
                `;
            }).join('');

            container.innerHTML = `
                <div class="results-grid">
                    <div class="result-card success">
                        <div class="result-header">
                            <i class="fas fa-check-circle"></i>
                            <h3>Optimization Successful</h3>
                        </div>
                        <div class="result-stats">
                            <p><strong>Total Cost:</strong> ₹${result.totalCost.toFixed(2)}</p>
                            <p><strong>Demand:</strong> ${result.demand} MW</p>
                            <p><strong>Active Generators:</strong> ${result.activeGenerators}</p>
                            <p><strong>Efficiency:</strong> ${result.efficiency} MW/₹</p>
                        </div>
                    </div>
                </div>
                <div class="card mt-2">
                    <h3><i class="fas fa-table"></i> Dispatch Schedule</h3>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Generator</th>
                                <th>Power Output</th>
                                <th>Cost</th>
                                <th>Load Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${scheduleRows}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="result-card error">
                    <div class="result-header">
                        <i class="fas fa-times-circle"></i>
                        <h3>Optimization Failed</h3>
                    </div>
                    <p>${result.error}</p>
                </div>
            `;
        }
    }

    updateResultsTab() {
        const container = document.getElementById('detailed-results-container');
        
        if (!this.optimizationResults) {
            container.innerHTML = '<p class="no-data">Run optimization to see detailed results here.</p>';
            return;
        }

        if (this.optimizationResults.success) {
            // Create detailed analysis
            const generators = this.optimizationResults.schedule;
            const analysis = this.analyzeResults(this.optimizationResults);
            
            container.innerHTML = `
                <div class="results-grid">
                    <div class="card">
                        <h3><i class="fas fa-chart-pie"></i> Cost Breakdown</h3>
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Generator</th>
                                    <th>Fixed Cost (Ai)</th>
                                    <th>Variable Cost</th>
                                    <th>Quadratic Cost</th>
                                    <th>Total Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generators.map(gen => {
                                    const genData = this.generators.find(g => g.tag === gen.generator);
                                    const fixedCost = genData.ai;
                                    const varCost = genData.bi * gen.power;
                                    const quadCost = genData.di * gen.power * gen.power;
                                    return `
                                        <tr>
                                            <td>${gen.generator}</td>
                                            <td>₹${fixedCost.toFixed(2)}</td>
                                            <td>₹${varCost.toFixed(2)}</td>
                                            <td>₹${quadCost.toFixed(2)}</td>
                                            <td>₹${gen.cost.toFixed(2)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="card">
                        <h3><i class="fas fa-analytics"></i> Performance Analysis</h3>
                        <div class="analysis-grid">
                            <p><strong>Most Economical Generator:</strong> ${analysis.mostEconomical}</p>
                            <p><strong>Highest Load Generator:</strong> ${analysis.highestLoad}</p>
                            <p><strong>Average Cost per MW:</strong> ₹${analysis.avgCostPerMW}</p>
                            <p><strong>System Utilization:</strong> ${analysis.utilization}%</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="result-card error">
                    <div class="result-header">
                        <i class="fas fa-times-circle"></i>
                        <h3>No Valid Results</h3>
                    </div>
                    <p>The last optimization did not produce valid results.</p>
                </div>
            `;
        }
    }

    analyzeResults(results) {
        if (!results.success) return null;

        const schedule = results.schedule;
        const mostEconomical = schedule.reduce((min, gen) => 
            (gen.cost / gen.power) < (min.cost / min.power) ? gen : min
        );
        
        const highestLoad = schedule.reduce((max, gen) => 
            gen.power > max.power ? gen : max
        );

        const totalCapacity = this.generators.reduce((sum, gen) => sum + gen.pgmax, 0);
        const usedCapacity = schedule.reduce((sum, gen) => sum + gen.power, 0);

        return {
            mostEconomical: mostEconomical.generator,
            highestLoad: highestLoad.generator,
            avgCostPerMW: (results.totalCost / results.demand).toFixed(2),
            utilization: ((usedCapacity / totalCapacity) * 100).toFixed(1)
        };
    }

    displayMultiPeriodResults(result) {
        const container = document.getElementById('multiperiod-results');
        container.style.display = 'block';
        
        if (result.success) {
            const scheduleTable = result.schedules.map((period, index) => {
                const status = period.infeasible ? 
                    '<span class="status-error">Infeasible</span>' : 
                    '<span class="status-success">Optimal</span>';
                
                const generatorList = period.schedule.length > 0 ? 
                    period.schedule.map(gen => `${gen.generator}: ${gen.power.toFixed(1)}MW`).join(', ') :
                    'No generators dispatched';
                    
                return `
                    <tr style="animation-delay: ${index * 0.05}s" class="animate-slideInLeft">
                        <td>Period ${period.period}</td>
                        <td>${period.demand.toFixed(1)} MW</td>
                        <td>${status}</td>
                        <td>₹${period.cost.toFixed(2)}</td>
                        <td>${period.efficiency || 0} MW/₹</td>
                        <td class="generator-list">${generatorList}</td>
                    </tr>
                `;
            }).join('');

            container.innerHTML = `
                <div class="results-grid">
                    <div class="result-card success">
                        <div class="result-header">
                            <i class="fas fa-history"></i>
                            <h3>Multi-Period Optimization Results</h3>
                        </div>
                        <div class="result-stats">
                            <p><strong>Total System Cost:</strong> ₹${result.totalSystemCost.toFixed(2)}</p>
                            <p><strong>Periods:</strong> ${result.schedules.length}</p>
                            <p><strong>Average Efficiency:</strong> ${result.averageEfficiency} MW/₹</p>
                            <p><strong>Feasible Periods:</strong> ${result.schedules.filter(s => !s.infeasible).length}</p>
                        </div>
                    </div>
                </div>
                
                <div class="card mt-2">
                    <h3><i class="fas fa-table"></i> Period-by-Period Schedule</h3>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Period</th>
                                    <th>Demand</th>
                                    <th>Status</th>
                                    <th>Cost</th>
                                    <th>Efficiency</th>
                                    <th>Generator Schedule</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${scheduleTable}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="card mt-2">
                    <h3><i class="fas fa-cog"></i> Generator Status Summary</h3>
                    <div class="generator-states">
                        ${Object.entries(result.generatorStates).map(([tag, state]) => `
                            <div class="generator-state-item">
                                <span class="generator-tag">${tag}</span>
                                <span class="state-info">
                                    ${state.isOn ? 
                                        `<i class="fas fa-power-off text-success"></i> ON (${state.timeOn}h)` : 
                                        `<i class="fas fa-power-off text-muted"></i> OFF (${state.timeOff}h)`
                                    }
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="result-card error">
                    <div class="result-header">
                        <i class="fas fa-times-circle"></i>
                        <h3>Multi-Period Optimization Failed</h3>
                    </div>
                    <p>No feasible solution found for the given constraints and demand pattern.</p>
                </div>
            `;
        }
    }

    createMultiPeriodCharts(result) {
        // Create charts for multi-period results visualization
        this.createTimeSeriesChart(result);
        this.createCostAnalysisChart(result);
        this.createGeneratorUtilizationChart(result);
    }

    createTimeSeriesChart(result) {
        const ctx = document.getElementById('power-distribution-chart');
        if (!ctx) return;
        
        const periods = result.schedules.map(s => `P${s.period}`);
        const demands = result.schedules.map(s => s.demand);
        const costs = result.schedules.map(s => s.cost);
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: periods,
                datasets: [{
                    label: 'Demand (MW)',
                    data: demands,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    yAxisID: 'y'
                }, {
                    label: 'Cost (₹)',
                    data: costs,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Multi-Period Demand and Cost Trends'
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Power (MW)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Cost (₹)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                },
                animation: {
                    duration: 2000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    createCostAnalysisChart(result) {
        // Additional chart creation can be added here
        console.log('Cost analysis chart created for', result.schedules.length, 'periods');
    }

    createGeneratorUtilizationChart(result) {
        // Additional chart creation can be added here
        console.log('Generator utilization chart created');
    }

    updateHistoryTab() {
        const container = document.getElementById('history-container');
        
        if (this.history.length === 0) {
            container.innerHTML = '<p class="no-data">No project history found.</p>';
            return;
        }

        const historyItems = this.history.map((project, index) => `
            <div class="card">
                <h3>
                    <i class="fas fa-project-diagram"></i>
                    Question ${project.questionNo}
                    <small style="font-weight: 400; color: var(--text-secondary);">
                        ${new Date(project.timestamp).toLocaleString()}
                    </small>
                </h3>
                <p><strong>Generators:</strong> ${project.generators.length}</p>
                <p><strong>Load Range:</strong> ${project.minLoad.toFixed(2)} - ${project.maxLoad.toFixed(2)} MW</p>
                <div class="mt-2">
                    <button class="btn btn-secondary btn-sm" onclick="app.loadProject(${index})">
                        <i class="fas fa-upload"></i> Load Project
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteProject(${index})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = historyItems;
    }

    // Utility Methods
    validateDemand(value) {
        const demand = parseFloat(value);
        const demandInput = document.getElementById('demand-input');
        
        if (!this.currentProject) return;
        
        if (isNaN(demand) || demand < this.currentProject.minLoad || demand > this.currentProject.maxLoad) {
            demandInput.style.borderColor = 'var(--danger-color)';
        } else {
            demandInput.style.borderColor = 'var(--border)';
        }
    }

    highlightFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = 'var(--danger-color)';
            field.style.boxShadow = '0 0 5px rgba(220, 38, 38, 0.3)';
            
            // Add shake animation
            field.classList.add('field-error');
            setTimeout(() => {
                field.classList.remove('field-error');
            }, 500);
        }
    }

    showValidationErrors(context, errors) {
        const errorList = errors.map(error => `• ${error}`).join('\n');
        this.showToast(`${context} has errors:\n${errorList}`, 'error');
        
        // Also show inline error summary
        this.displayInlineErrors(context, errors);
    }

    displayInlineErrors(context, errors) {
        // Create or update error display
        let errorDiv = document.getElementById('validation-errors');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'validation-errors';
            errorDiv.className = 'validation-errors';
            
            const container = document.getElementById('generator-forms-container');
            if (container) {
                container.parentNode.insertBefore(errorDiv, container);
            }
        }
        
        errorDiv.innerHTML = `
            <div class="error-summary">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>${context}:</strong>
                <ul>
                    ${errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
                <button onclick="this.parentElement.parentElement.remove()" class="btn-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }

    clearFieldErrors() {
        // Clear all field error styling
        document.querySelectorAll('.form-input').forEach(input => {
            input.style.borderColor = '';
            input.style.boxShadow = '';
        });
        
        // Remove error display
        const errorDiv = document.getElementById('validation-errors');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    setDefaultValues(generatorIndex) {
        // Set intelligent default values based on typical power system parameters
        const baseCapacity = 50 + (generatorIndex * 25); // Increasing capacity for each generator
        
        setTimeout(() => {
            const pgminEl = document.getElementById(`gen_${generatorIndex}_pgmin`);
            const pgmaxEl = document.getElementById(`gen_${generatorIndex}_pgmax`);
            const aiEl = document.getElementById(`gen_${generatorIndex}_ai`);
            const biEl = document.getElementById(`gen_${generatorIndex}_bi`);
            const diEl = document.getElementById(`gen_${generatorIndex}_di`);
            const rampupEl = document.getElementById(`gen_${generatorIndex}_rampup`);
            const rampdownEl = document.getElementById(`gen_${generatorIndex}_rampdown`);
            const minuptimeEl = document.getElementById(`gen_${generatorIndex}_minuptime`);
            const mindowntimeEl = document.getElementById(`gen_${generatorIndex}_mindowntime`);
            
            if (pgminEl && !pgminEl.value) pgminEl.value = Math.max(10, baseCapacity * 0.2);
            if (pgmaxEl && !pgmaxEl.value) pgmaxEl.value = baseCapacity;
            if (aiEl && !aiEl.value) aiEl.value = 30 + (generatorIndex * 10); // Higher fixed cost for larger units
            if (biEl && !biEl.value) biEl.value = (2.0 + generatorIndex * 0.3).toFixed(2); // Increasing variable cost
            if (diEl && !diEl.value) diEl.value = (0.01 - generatorIndex * 0.001).toFixed(4); // Decreasing quadratic cost
            if (rampupEl && !rampupEl.value) rampupEl.value = baseCapacity * 0.3; // 30% of capacity per hour
            if (rampdownEl && !rampdownEl.value) rampdownEl.value = baseCapacity * 0.25; // 25% of capacity per hour
            if (minuptimeEl && !minuptimeEl.value) minuptimeEl.value = Math.max(1, Math.floor(generatorIndex / 2) + 1);
            if (mindowntimeEl && !mindowntimeEl.value) mindowntimeEl.value = 1;
        }, 50);
    }

    loadExample() {
        const exampleData = [
            { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.5, di: 0.01, rampup: 15, rampdown: 12, minuptime: 2, mindowntime: 1 },
            { tag: 'G2', pgmin: 20, pgmax: 150, ai: 40, bi: 3.0, di: 0.008, rampup: 25, rampdown: 20, minuptime: 3, mindowntime: 2 },
            { tag: 'G3', pgmin: 15, pgmax: 80, ai: 60, bi: 2.0, di: 0.012, rampup: 20, rampdown: 18, minuptime: 2, mindowntime: 1 }
        ];

        document.getElementById('num-generators').value = 3;
        document.getElementById('question-number').value = 1;
        this.createGeneratorForms();

        setTimeout(() => {
            exampleData.forEach((gen, i) => {
                document.getElementById(`gen_${i+1}_tag`).value = gen.tag;
                document.getElementById(`gen_${i+1}_pgmin`).value = gen.pgmin;
                document.getElementById(`gen_${i+1}_pgmax`).value = gen.pgmax;
                document.getElementById(`gen_${i+1}_ai`).value = gen.ai;
                document.getElementById(`gen_${i+1}_bi`).value = gen.bi;
                document.getElementById(`gen_${i+1}_di`).value = gen.di;
                document.getElementById(`gen_${i+1}_rampup`).value = gen.rampup;
                document.getElementById(`gen_${i+1}_rampdown`).value = gen.rampdown;
                document.getElementById(`gen_${i+1}_minuptime`).value = gen.minuptime;
                document.getElementById(`gen_${i+1}_mindowntime`).value = gen.mindowntime;
            });
            this.showToast('Example data with advanced parameters loaded successfully!', 'success');
        }, 100);
    }

    triggerCSVImport() {
        document.getElementById('csv-file-input').click();
    }

    handleCSVImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n');
                const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
                
                // Find required columns
                const requiredCols = ['tag', 'pgmin', 'pgmax', 'ai', 'bi', 'di'];
                const optionalCols = ['rampup', 'rampdown', 'minuptime', 'mindowntime'];
                const colIndices = {};
                
                requiredCols.forEach(col => {
                    const index = headers.findIndex(h => h.includes(col));
                    if (index === -1) {
                        throw new Error(`Missing required column: ${col}`);
                    }
                    colIndices[col] = index;
                });
                
                // Find optional columns
                optionalCols.forEach(col => {
                    const index = headers.findIndex(h => h.includes(col));
                    if (index !== -1) {
                        colIndices[col] = index;
                    }
                });

                const generators = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    const values = line.split(',');
                    const generator = {
                        tag: values[colIndices.tag].trim(),
                        pgmin: parseFloat(values[colIndices.pgmin]),
                        pgmax: parseFloat(values[colIndices.pgmax]),
                        ai: parseFloat(values[colIndices.ai]),
                        bi: parseFloat(values[colIndices.bi]),
                        di: parseFloat(values[colIndices.di])
                    };
                    
                    // Add optional advanced parameters with defaults
                    generator.rampup = colIndices.rampup !== undefined ? 
                        parseFloat(values[colIndices.rampup]) : generator.pgmax * 0.5;
                    generator.rampdown = colIndices.rampdown !== undefined ? 
                        parseFloat(values[colIndices.rampdown]) : generator.pgmax * 0.5;
                    generator.minuptime = colIndices.minuptime !== undefined ? 
                        parseFloat(values[colIndices.minuptime]) : 1;
                    generator.mindowntime = colIndices.mindowntime !== undefined ? 
                        parseFloat(values[colIndices.mindowntime]) : 1;
                    
                    generators.push(generator);
                }

                // Update form
                document.getElementById('num-generators').value = generators.length;
                this.createGeneratorForms();

                setTimeout(() => {
                    generators.forEach((gen, i) => {
                        document.getElementById(`gen_${i+1}_tag`).value = gen.tag;
                        document.getElementById(`gen_${i+1}_pgmin`).value = gen.pgmin;
                        document.getElementById(`gen_${i+1}_pgmax`).value = gen.pgmax;
                        document.getElementById(`gen_${i+1}_ai`).value = gen.ai;
                        document.getElementById(`gen_${i+1}_bi`).value = gen.bi;
                        document.getElementById(`gen_${i+1}_di`).value = gen.di;
                        document.getElementById(`gen_${i+1}_rampup`).value = gen.rampup;
                        document.getElementById(`gen_${i+1}_rampdown`).value = gen.rampdown;
                        document.getElementById(`gen_${i+1}_minuptime`).value = gen.minuptime;
                        document.getElementById(`gen_${i+1}_mindowntime`).value = gen.mindowntime;
                    });
                    
                    const hasAdvanced = generators.some(gen => 
                        gen.rampup !== undefined || gen.rampdown !== undefined || 
                        gen.minuptime !== undefined || gen.mindowntime !== undefined
                    );
                    
                    this.showToast(`Imported ${generators.length} generators from CSV${hasAdvanced ? ' with advanced parameters' : ''}`, 'success');
                }, 100);

            } catch (error) {
                console.error('CSV import error:', error);
                this.showToast('Failed to import CSV: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    downloadTemplate() {
        const template = `Tag,Pgmin,Pgmax,Ai,Bi,Di,Rampup,Rampdown,Minuptime,Mindowntime
G1,10,100,50,2.5,0.01,15,12,2,1
G2,20,150,40,3.0,0.008,25,20,3,2
G3,15,80,60,2.0,0.012,20,18,2,1`;

        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generator_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Enhanced template with ramp rates and minimum times downloaded!', 'success');
    }

    clearAll() {
        if (confirm('Are you sure you want to clear all generator data?')) {
            document.getElementById('generator-forms-container').innerHTML = '';
            document.getElementById('save-section').style.display = 'none';
            document.getElementById('question-number').value = 1;
            document.getElementById('num-generators').value = 3;
            
            this.generators = [];
            this.currentProject = null;
            this.optimizationResults = null;
            
            localStorage.removeItem('uc_optimizer_current_project');
            this.updateUI();
            this.showToast('All data cleared', 'success');
        }
    }

    // Data Management
    saveProject() {
        if (this.currentProject) {
            localStorage.setItem('uc_optimizer_current_project', JSON.stringify(this.currentProject));
        }
    }

    loadSavedProject() {
        const saved = localStorage.getItem('uc_optimizer_current_project');
        if (saved) {
            try {
                this.currentProject = JSON.parse(saved);
                this.generators = this.currentProject.generators;
            } catch (error) {
                console.error('Failed to load saved project:', error);
            }
        }
    }

    loadProject(index) {
        if (index >= 0 && index < this.history.length) {
            this.currentProject = { ...this.history[index] };
            this.generators = this.currentProject.generators;
            this.saveProject();
            this.updateUI();
            this.switchTab('generator');
            this.showToast('Project loaded successfully!', 'success');
        }
    }

    deleteProject(index) {
        if (confirm('Are you sure you want to delete this project?')) {
            this.history.splice(index, 1);
            this.saveHistory();
            this.updateHistoryTab();
            this.showToast('Project deleted', 'success');
        }
    }

    addToHistory() {
        if (this.currentProject) {
            // Remove if already exists (update)
            const existingIndex = this.history.findIndex(p => 
                p.questionNo === this.currentProject.questionNo
            );
            
            if (existingIndex >= 0) {
                this.history[existingIndex] = { ...this.currentProject };
            } else {
                this.history.unshift({ ...this.currentProject });
            }
            
            // Keep only last 20 projects
            if (this.history.length > 20) {
                this.history = this.history.slice(0, 20);
            }
            
            this.saveHistory();
        }
    }

    saveHistory() {
        localStorage.setItem('uc_optimizer_history', JSON.stringify(this.history));
    }

    loadHistory() {
        const saved = localStorage.getItem('uc_optimizer_history');
        return saved ? JSON.parse(saved) : [];
    }

    exportHistory() {
        if (this.history.length === 0) {
            this.showToast('No history to export', 'warning');
            return;
        }

        const data = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            projects: this.history
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uc_optimizer_history_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('History exported successfully!', 'success');
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all project history? This cannot be undone.')) {
            this.history = [];
            this.saveHistory();
            this.updateHistoryTab();
            this.showToast('History cleared', 'success');
        }
    }

    // Chart and Visualization Methods
    createFLACChart() {
        const container = document.getElementById('flac-chart-container');
        const canvas = document.getElementById('flac-chart');
        
        if (!this.generators || this.generators.length === 0) return;
        
        container.style.display = 'block';
        container.classList.add('animate-slideInLeft');
        
        // Destroy existing chart
        if (this.charts.flac) {
            this.charts.flac.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        this.charts.flac = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.generators.map(gen => gen.tag),
                datasets: [{
                    label: 'FLAC (₹/MW)',
                    data: this.generators.map(gen => gen.flac),
                    backgroundColor: this.generators.map((_, i) => 
                        `hsla(${200 + i * 30}, 70%, 60%, 0.8)`
                    ),
                    borderColor: this.generators.map((_, i) => 
                        `hsla(${200 + i * 30}, 70%, 50%, 1)`
                    ),
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Generator Efficiency Ranking (Lower FLAC = Better)',
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'FLAC (₹/MW)'
                        }
                    }
                },
                animation: {
                    delay: (context) => context.dataIndex * 200,
                    duration: 1000,
                    easing: 'easeOutBounce'
                }
            }
        });
    }

    createOptimizationCharts(result) {
        // Show visualization sections
        const vizSection = this.safeGetElement('optimization-visualization');
        if (vizSection) {
            vizSection.style.display = 'grid';
            vizSection.classList.add('animate-fadeIn');
        }
        
        // Create power distribution pie chart
        this.createPowerDistributionChart(result);
        
        // Create cost breakdown chart
        this.createCostBreakdownChart(result);
        
        // Enable result dashboard controls
        const animateBtn = this.safeGetElement('animate-results-btn');
        const compareBtn = this.safeGetElement('compare-scenarios-btn');
        const exportBtn = this.safeGetElement('export-charts-btn');
        
        if (animateBtn) animateBtn.disabled = false;
        if (compareBtn) compareBtn.disabled = false;
        if (exportBtn) exportBtn.disabled = false;
    }

    createPowerDistributionChart(result) {
        const canvas = this.safeGetElement('power-distribution-chart');
        if (!canvas) return;
        
        if (this.charts.powerDistribution) {
            this.charts.powerDistribution.destroy();
        }
        
        try {
            const ctx = canvas.getContext('2d');
        this.charts.powerDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: result.schedule.map(item => item.generator),
                datasets: [{
                    data: result.schedule.map(item => item.power),
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                    ],
                    borderWidth: 3,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `Power Distribution for ${result.demand} MW Demand`,
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: {
                        position: 'bottom'
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 2000,
                    easing: 'easeInOutQuart'
                }
            }
        });
        } catch (error) {
            console.error('Error creating power distribution chart:', error);
        }
    }

    createCostBreakdownChart(result) {
        const canvas = this.safeGetElement('cost-breakdown-chart');
        if (!canvas) return;
        
        if (this.charts.costBreakdown) {
            this.charts.costBreakdown.destroy();
        }
        
        try {
        
        // Calculate cost components for each generator
        const costData = result.schedule.map(item => {
            const gen = this.generators.find(g => g.tag === item.generator);
            return {
                generator: item.generator,
                fixed: gen.ai,
                variable: gen.bi * item.power,
                quadratic: gen.di * item.power * item.power,
                total: item.cost
            };
        });
        
        const ctx = canvas.getContext('2d');
        this.charts.costBreakdown = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: costData.map(item => item.generator),
                datasets: [
                    {
                        label: 'Fixed Cost (Ai)',
                        data: costData.map(item => item.fixed),
                        backgroundColor: '#FF6384',
                        stack: 'Stack 0'
                    },
                    {
                        label: 'Variable Cost (Bi×Pi)',
                        data: costData.map(item => item.variable),
                        backgroundColor: '#36A2EB',
                        stack: 'Stack 0'
                    },
                    {
                        label: 'Quadratic Cost (Di×Pi²)',
                        data: costData.map(item => item.quadratic),
                        backgroundColor: '#FFCE56',
                        stack: 'Stack 0'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Cost Component Breakdown',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    x: { stacked: true },
                    y: { 
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Cost (₹)'
                        }
                    }
                },
                animation: {
                    delay: (context) => context.dataIndex * 300,
                    duration: 1500,
                    easing: 'easeOutElastic'
                }
            }
        });
        } catch (error) {
            console.error('Error creating cost breakdown chart:', error);
        }
    }

    createAdvancedVisualizations() {
        if (!this.optimizationResults || !this.optimizationResults.success) return;
        
        const container = document.getElementById('advanced-visualizations');
        container.style.display = 'grid';
        container.classList.add('animate-fadeIn');
        
        // Create efficiency gauge
        this.createEfficiencyGauge();
        
        // Create load distribution area chart
        this.createLoadDistributionChart();
        
        // Create cost trend analysis
        this.createCostTrendChart();
        
        // Create utilization radar chart
        this.createUtilizationChart();
    }

    createEfficiencyGauge() {
        const canvas = document.getElementById('efficiency-gauge');
        const efficiency = parseFloat(this.optimizationResults.efficiency);
        
        if (this.charts.efficiency) {
            this.charts.efficiency.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        this.charts.efficiency = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [efficiency, 100 - efficiency],
                    backgroundColor: ['#4CAF50', '#E0E0E0'],
                    borderWidth: 0,
                    circumference: Math.PI,
                    rotation: Math.PI
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                animation: {
                    animateRotate: true,
                    duration: 2000
                }
            },
            plugins: [{
                afterDraw: (chart) => {
                    const { ctx, chartArea } = chart;
                    ctx.save();
                    ctx.font = 'bold 24px Inter';
                    ctx.fillStyle = '#333';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${efficiency}%`, 
                        chartArea.left + chartArea.width / 2, 
                        chartArea.top + chartArea.height / 2 + 10);
                    ctx.font = '12px Inter';
                    ctx.fillText('Efficiency', 
                        chartArea.left + chartArea.width / 2, 
                        chartArea.top + chartArea.height / 2 + 30);
                    ctx.restore();
                }
            }]
        });
    }

    // Animation Control Methods
    animateResults() {
        const btn = document.getElementById('animate-results-btn');
        const icon = btn.querySelector('i');
        
        if (btn.textContent.includes('Play')) {
            btn.innerHTML = '<i class="fas fa-pause"></i> Pause Animation';
            this.startResultAnimation();
        } else {
            btn.innerHTML = '<i class="fas fa-play"></i> Play Animation';
            this.stopResultAnimation();
        }
    }

    startResultAnimation() {
        // Animate all visible charts
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.canvas && chart.canvas.offsetParent) {
                chart.update('active');
            }
        });
        
        // Animate result cards
        document.querySelectorAll('.result-card').forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('animate-pulse');
            }, index * 200);
        });
        
        // Animate generator items
        document.querySelectorAll('.generator-item').forEach((item, index) => {
            setTimeout(() => {
                item.style.transform = 'translateX(10px)';
                setTimeout(() => {
                    item.style.transform = 'translateX(0)';
                }, 300);
            }, index * 100);
        });
    }

    stopResultAnimation() {
        document.querySelectorAll('.result-card').forEach(card => {
            card.classList.remove('animate-pulse');
        });
    }

    compareScenarios() {
        // Implementation for scenario comparison
        this.showToast('Scenario comparison feature coming soon!', 'warning');
    }

    exportCharts() {
        let chartCount = 0;
        
        Object.entries(this.charts).forEach(([name, chart]) => {
            if (chart && chart.canvas) {
                const imageData = chart.canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = imageData;
                link.download = `${name}_chart.png`;
                link.click();
                chartCount++;
            }
        });
        
        if (chartCount > 0) {
            this.showToast(`Exported ${chartCount} charts as PNG files`, 'success');
        } else {
            this.showToast('No charts available to export', 'warning');
        }
    }

    createLoadDistributionChart() {
        const canvas = document.getElementById('load-distribution-chart');
        
        if (this.charts.loadDistribution) {
            this.charts.loadDistribution.destroy();
        }
        
        if (!this.optimizationResults || !this.optimizationResults.success) return;
        
        const ctx = canvas.getContext('2d');
        const schedule = this.optimizationResults.schedule;
        
        this.charts.loadDistribution = new Chart(ctx, {
            type: 'line',
            data: {
                labels: schedule.map(item => item.generator),
                datasets: [{
                    label: 'Power Output (MW)',
                    data: schedule.map(item => item.power),
                    borderColor: '#36A2EB',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Generator Load Distribution',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Power (MW)'
                        }
                    }
                },
                animation: {
                    delay: (context) => context.dataIndex * 100,
                    duration: 1500,
                    easing: 'easeOutCubic'
                }
            }
        });
    }

    createCostTrendChart() {
        const canvas = document.getElementById('cost-trend-chart');
        
        if (this.charts.costTrend) {
            this.charts.costTrend.destroy();
        }
        
        if (!this.optimizationResults || !this.optimizationResults.success) return;
        
        const ctx = canvas.getContext('2d');
        const schedule = this.optimizationResults.schedule;
        
        // Calculate cumulative cost
        let cumulativeCost = 0;
        const costTrendData = schedule.map(item => {
            cumulativeCost += item.cost;
            return cumulativeCost;
        });
        
        this.charts.costTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: schedule.map(item => item.generator),
                datasets: [{
                    label: 'Cumulative Cost (₹)',
                    data: costTrendData,
                    borderColor: '#FF6384',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    fill: true,
                    stepped: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Cumulative Cost Trend',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Cost (₹)'
                        }
                    }
                },
                animation: {
                    delay: (context) => context.dataIndex * 150,
                    duration: 2000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    createUtilizationChart() {
        const canvas = document.getElementById('utilization-chart');
        
        if (this.charts.utilization) {
            this.charts.utilization.destroy();
        }
        
        if (!this.optimizationResults || !this.optimizationResults.success) return;
        
        const ctx = canvas.getContext('2d');
        const schedule = this.optimizationResults.schedule;
        
        // Calculate utilization percentage for each generator
        const utilizationData = schedule.map(item => {
            const gen = this.generators.find(g => g.tag === item.generator);
            return ((item.power / gen.pgmax) * 100).toFixed(1);
        });
        
        this.charts.utilization = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: schedule.map(item => item.generator),
                datasets: [{
                    label: 'Utilization %',
                    data: utilizationData,
                    borderColor: '#FFCE56',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: '#FFCE56',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Generator Utilization Radar',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 25,
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                animation: {
                    duration: 2000,
                    easing: 'easeOutElastic'
                }
            }
        });
    }

    // Form Validation with Visual Feedback
    addFormValidation(generatorIndex) {
        const inputs = ['pgmin', 'pgmax', 'ai', 'bi', 'di'];
        
        inputs.forEach(field => {
            const input = document.getElementById(`gen_${generatorIndex}_${field}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    this.validateInput(e.target, field);
                });
                
                input.addEventListener('focus', (e) => {
                    e.target.style.boxShadow = '0 0 10px rgba(37, 99, 235, 0.3)';
                });
                
                input.addEventListener('blur', (e) => {
                    e.target.style.boxShadow = '';
                });
            }
        });
    }

    validateInput(input, fieldType) {
        const value = parseFloat(input.value);
        let isValid = true;
        
        if (isNaN(value) || value < 0) {
            isValid = false;
        }
        
        // Special validation for Pgmin vs Pgmax
        if (fieldType === 'pgmin' || fieldType === 'pgmax') {
            const generatorIndex = input.id.split('_')[1];
            const pgmin = parseFloat(document.getElementById(`gen_${generatorIndex}_pgmin`).value);
            const pgmax = parseFloat(document.getElementById(`gen_${generatorIndex}_pgmax`).value);
            
            if (!isNaN(pgmin) && !isNaN(pgmax) && pgmin >= pgmax) {
                isValid = false;
            }
        }
        
        // Visual feedback
        if (isValid) {
            input.style.borderColor = '#4CAF50';
            input.style.backgroundColor = 'rgba(76, 175, 80, 0.05)';
        } else {
            input.style.borderColor = '#f44336';
            input.style.backgroundColor = 'rgba(244, 67, 54, 0.05)';
        }
    }

    // Animated Counter for Numbers
    animateCounter(element, start, end, duration = 1000) {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                current = end;
                clearInterval(timer);
            }
            element.textContent = current.toFixed(2);
        }, 16);
    }

    // UI Helper Methods
    // Utility method for safe element access
    safeGetElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with id '${id}' not found`);
        }
        return element;
    }

    showLoading(show, message = 'Loading...') {
        const overlay = this.safeGetElement('loading-overlay');
        if (!overlay) return;
        
        const messageEl = overlay.querySelector('.loading-message');
        
        if (show) {
            if (messageEl) messageEl.textContent = message;
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle'
        }[type] || 'fas fa-info-circle';
        
        toast.innerHTML = `
            <i class="${icon}"></i>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new UnitCommitmentApp();
});

// Add some CSS classes for better styling
document.head.insertAdjacentHTML('beforeend', `
<style>
.btn-sm {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
}
.analysis-grid {
    display: grid;
    gap: 0.5rem;
}
.analysis-grid p {
    margin: 0;
    padding: 0.5rem;
    background: var(--background);
    border-radius: 4px;
    font-size: 0.875rem;
}
</style>
`);