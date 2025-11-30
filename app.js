/**
 * E-Solver - Economic Load Dispatch & Unit Commitment Optimization Tool
 * 
 * @description A modern web application for power system optimization that solves
 *              the Unit Commitment (UC) and Economic Load Dispatch (ELD) problems.
 *              Uses dynamic programming with memoization for optimal generator scheduling.
 * 
 * @version 2.0.0
 * @author E-Solver Team
 * @license MIT
 * 
 * @features
 *   - Full Load Average Cost (FLAC) based merit order
 *   - Dynamic programming optimization algorithm
 *   - Multi-period scheduling with ramp constraints
 *   - Interactive Chart.js visualizations
 *   - Responsive design with smooth animations
 *   - Project save/load with localStorage
 *   - CSV import/export functionality
 * 
 * @algorithm
 *   Cost Function: C(P) = Ai + Bi*P + Di*P²
 *   Where: Ai = Fixed cost (₹)
 *          Bi = Linear cost coefficient (₹/MW)
 *          Di = Quadratic cost coefficient (₹/MW²)
 *          P  = Power output (MW)
 * 
 *   FLAC = Ai/Pgmax + Bi + Di*Pgmax (used for merit order ranking)
 */

class UnitCommitmentApp {
    // Configuration constants - centralized to avoid hardcoding
    static CONFIG = {
        // Generator limits
        MIN_GENERATORS: 1,
        MAX_GENERATORS: 10,
        
        // History settings
        MAX_HISTORY_ITEMS: 20,
        
        // Optimization settings
        DEMAND_TOLERANCE_PERCENT: 0.005, // 0.5% of demand
        DEMAND_TOLERANCE_MIN_MW: 1.0,    // Minimum 1.0 MW tolerance
        POWER_STEP_SIZE: 1.0,            // MW step for power level generation
        DEMAND_PRECISION: 1,              // Decimal places for demand rounding
        
        // Default generator parameters (for scaling)
        DEFAULT_BASE_CAPACITY: 50,
        DEFAULT_CAPACITY_INCREMENT: 25,
        DEFAULT_RAMP_UP_PERCENT: 0.3,    // 30% of capacity
        DEFAULT_RAMP_DOWN_PERCENT: 0.25, // 25% of capacity
        DEFAULT_STARTUP_COST_FACTOR: 0.5, // Factor of fixed cost (Ai)
        
        // UI timing (ms)
        TOAST_DURATION: 5000,
        TAB_TRANSITION_DELAY: 50,
        FORM_STAGGER_DELAY: 100,
        HIGHLIGHT_DURATION: 3000,
        ERROR_DISPLAY_DURATION: 15000,
        
        // Animation settings
        ANIMATION_DURATION: 1500,
        ANIMATION_EASING: 'easeOutElastic',
        CHART_ANIMATION_DELAY: 100,
        STAGGER_DELAY: 150,
        HOVER_ANIMATION_DURATION: 300,
        
        // Chart animation presets
        CHART_ANIMATIONS: {
            bar: { type: 'easeOutBounce', duration: 1500 },
            line: { type: 'easeInOutQuart', duration: 2000 },
            doughnut: { type: 'easeOutElastic', duration: 2000 },
            pie: { type: 'easeOutBack', duration: 1800 },
            radar: { type: 'easeOutQuart', duration: 1600 }
        },

        // Chart colors
        CHART_COLORS: [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
        ],
        
        // Daily load pattern (24 hours, percentage of peak)
        DAILY_LOAD_PATTERN: [
            0.6, 0.55, 0.5, 0.48, 0.5, 0.6, 0.75, 0.9,   // 0-7
            0.95, 0.9, 0.85, 0.88, 0.92, 0.9, 0.85, 0.88, // 8-15
            0.95, 1.0, 0.98, 0.92, 0.85, 0.8, 0.75, 0.65  // 16-23
        ],
        
        // Storage keys
        STORAGE_KEY_PROJECT: 'uc_optimizer_current_project',
        STORAGE_KEY_HISTORY: 'uc_optimizer_history',
        
        // App version
        VERSION: '2.0.0'
    };
    
    constructor() {
        this.generators = [];
        this.currentProject = null;
        this.optimizationResults = null;
        this.history = this.loadHistory();
        this.charts = {};
        this.animationSettings = {
            duration: UnitCommitmentApp.CONFIG.ANIMATION_DURATION,
            easing: UnitCommitmentApp.CONFIG.ANIMATION_EASING
        };
        
        this.init();
    }
    
    // Destroy all charts to prevent memory leaks
    destroyAllCharts() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key] && typeof this.charts[key].destroy === 'function') {
                try {
                    this.charts[key].destroy();
                } catch (e) {
                    console.warn(`Failed to destroy chart ${key}:`, e);
                }
            }
        });
        this.charts = {};
    }

    // Create gradient for chart backgrounds
    createGradient(ctx, color1, color2, direction = 'vertical') {
        let gradient;
        if (direction === 'vertical') {
            gradient = ctx.createLinearGradient(0, 0, 0, 200);
        } else {
            gradient = ctx.createLinearGradient(0, 0, 200, 0);
        }
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    }

    // Animate number counters
    animateCounter(element, start, end, duration = 1500, prefix = '', suffix = '') {
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4); // easeOutQuart
            const current = start + (end - start) * easeProgress;
            element.textContent = prefix + current.toFixed(2) + suffix;
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    init() {
        this.setupEventListeners();
        this.loadSavedProject();
        this.updateUI();
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Navigation - use currentTarget to handle clicks on child elements (icons, spans)
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab));
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
        }, UnitCommitmentApp.CONFIG.TAB_TRANSITION_DELAY);
    }

    highlightOptimizationSection() {
        const demandSection = this.safeGetElement('demand-input');
        const optimizeBtn = this.safeGetElement('optimize-btn');
        const { HIGHLIGHT_DURATION } = UnitCommitmentApp.CONFIG;
        
        if (demandSection) {
            try {
                // Add highlighting animation
                demandSection.style.boxShadow = '0 0 15px rgba(37, 99, 235, 0.5)';
                demandSection.focus();
                
                // Remove highlight after animation
                setTimeout(() => {
                    if (demandSection && demandSection.style) {
                        demandSection.style.boxShadow = '';
                    }
                }, HIGHLIGHT_DURATION);
            } catch (error) {
                console.error('Error highlighting demand section:', error);
            }
        }
        
        if (optimizeBtn && !optimizeBtn.disabled) {
            try {
                // Pulse effect on optimize button
                optimizeBtn.classList.add('btn-pulse');
                setTimeout(() => {
                    if (optimizeBtn && optimizeBtn.classList) {
                        optimizeBtn.classList.remove('btn-pulse');
                    }
                }, HIGHLIGHT_DURATION);
            } catch (error) {
                console.error('Error highlighting optimize button:', error);
            }
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
            }, UnitCommitmentApp.CONFIG.HIGHLIGHT_DURATION + 1000);
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
                
                // Auto-remove after configured duration
                setTimeout(() => {
                    if (helpDiv.parentNode) {
                        helpDiv.remove();
                    }
                }, UnitCommitmentApp.CONFIG.ERROR_DISPLAY_DURATION);
            }
        }
    }

    // Generator Management
    createGeneratorForms() {
        const numGenerators = parseInt(document.getElementById('num-generators').value);
        const container = document.getElementById('generator-forms-container');
        const { MIN_GENERATORS, MAX_GENERATORS } = UnitCommitmentApp.CONFIG;
        
        if (numGenerators < MIN_GENERATORS || numGenerators > MAX_GENERATORS) {
            this.showToast(`Please enter a valid number of generators (${MIN_GENERATORS}-${MAX_GENERATORS})`, 'error');
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
            }, i * UnitCommitmentApp.CONFIG.FORM_STAGGER_DELAY);
        }
        
        setTimeout(() => {
            document.getElementById('save-section').style.display = 'block';
            document.getElementById('save-section').classList.add('animate-fadeIn');
        }, (numGenerators + 1) * UnitCommitmentApp.CONFIG.FORM_STAGGER_DELAY);
        
        this.showToast(`Creating ${numGenerators} generator forms...`, 'success');
    }

    saveGenerators() {
        const numGeneratorsElement = document.getElementById('num-generators');
        const questionNoElement = document.getElementById('question-number');
        
        if (!numGeneratorsElement || !questionNoElement) {
            this.showToast('Form elements not found', 'error');
            return;
        }
        
        const numGenerators = parseInt(numGeneratorsElement.value);
        const questionNo = parseInt(questionNoElement.value);
        
        if (isNaN(numGenerators) || numGenerators < 1 || isNaN(questionNo) || questionNo < 1) {
            this.showToast('Invalid number of generators or question number', 'error');
            return;
        }
        
        const generators = [];
        
        // For collecting all validation errors
        const allErrors = [];
        let hasErrors = false;

        // Collect and validate generator data
        for (let i = 1; i <= numGenerators; i++) {
            const tagElement = document.getElementById(`gen_${i}_tag`);
            if (!tagElement) {
                allErrors.push({ generator: `Generator ${i}`, errors: ['Form elements not found'] });
                hasErrors = true;
                continue;
            }
            
            const tag = tagElement.value;
            const pgmin = parseFloat(document.getElementById(`gen_${i}_pgmin`)?.value || '0');
            const pgmax = parseFloat(document.getElementById(`gen_${i}_pgmax`)?.value || '0');
            const ai = parseFloat(document.getElementById(`gen_${i}_ai`)?.value || '0');
            const bi = parseFloat(document.getElementById(`gen_${i}_bi`)?.value || '0');
            const di = parseFloat(document.getElementById(`gen_${i}_di`)?.value || '0');
            const rampup = parseFloat(document.getElementById(`gen_${i}_rampup`)?.value || '0');
            const rampdown = parseFloat(document.getElementById(`gen_${i}_rampdown`)?.value || '0');
            const minuptime = parseFloat(document.getElementById(`gen_${i}_minuptime`)?.value || '1');
            const mindowntime = parseFloat(document.getElementById(`gen_${i}_mindowntime`)?.value || '1');

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
            
            // Additional logical validation
            if (!isNaN(pgmin) && !isNaN(pgmax) && pgmin >= pgmax) {
                errors.push('Pgmin must be less than Pgmax');
            }
            
            // Collect errors for this generator
            if (errors.length > 0) {
                allErrors.push({ generator: `Generator ${i}`, errors: errors });
                hasErrors = true;
            } else {
                // Only add to generators array if no errors
                generators.push({ tag, pgmin, pgmax, ai, bi, di, rampup, rampdown, minuptime, mindowntime });
            }
        }

        // Display all collected errors at once
        if (hasErrors) {
            const errorMessages = allErrors.map(item => 
                `<strong>${item.generator}:</strong><ul>${item.errors.map(e => `<li>${e}</li>`).join('')}</ul>`
            ).join('');
            this.showValidationErrors('Validation Errors', [errorMessages]);
            return;
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
                    const efficiencyValue = parseFloat(result.efficiency);
                    this.showToast(`Optimization completed! Total cost: ₹${result.totalCost.toFixed(2)}, Cost per MW: ₹${efficiencyValue.toFixed(2)}/MW`, 'success');
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
                // Use daily load pattern from configuration
                const dailyPattern = UnitCommitmentApp.CONFIG.DAILY_LOAD_PATTERN;
                for (let i = 0; i < periods; i++) {
                    const hourIndex = i % 24;
                    demands.push(baseDemand * dailyPattern[hourIndex]);
                }
                break;
                
            case 'custom':
                const customValues = document.getElementById('demand-values').value;
                const parsed = customValues.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
                if (parsed.length === 0) {
                    this.showToast('Please enter valid demand values (comma-separated numbers)', 'error');
                    return null;
                }
                // Inform user if pattern will repeat
                if (parsed.length < periods) {
                    this.showToast(`Pattern will repeat: ${parsed.length} values for ${periods} periods`, 'warning');
                }
                for (let i = 0; i < periods; i++) {
                    demands.push(parsed[i % parsed.length]);
                }
                break;
                
            default:
                this.showToast('Unknown demand pattern type', 'error');
                return null;
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

        // Validate demands against system capacity
        const minSystemLoad = Math.min(...this.generators.map(g => g.pgmin));
        const maxSystemLoad = this.generators.reduce((sum, g) => sum + g.pgmax, 0);
        const maxDemand = Math.max(...demands);
        const minDemand = Math.min(...demands);

        if (maxDemand > maxSystemLoad) {
            this.showToast(`Peak demand (${maxDemand.toFixed(1)} MW) exceeds system capacity (${maxSystemLoad.toFixed(1)} MW)`, 'error');
            return;
        }

        this.showLoading(true, `Optimizing ${periods}-hour schedule with ${pattern} load pattern...`);
        
        setTimeout(() => {
            try {
                const result = this.optimizeMultiPeriod(this.generators, demands, periods);
                
                if (result && result.success) {
                    this.displayMultiPeriodResults(result);
                    this.createMultiPeriodCharts(result, demands);
                    document.getElementById('multiperiod-results').style.display = 'block';
                    this.showToast(`Multi-period optimization completed! Total cost: ₹${result.totalSystemCost.toFixed(2)}`, 'success');
                } else {
                    this.showToast('Multi-period optimization failed. Check generator constraints and load demands.', 'error');
                }
            } catch (error) {
                console.error('Multi-period optimization error:', error);
                this.showToast('Optimization failed. Please check your generator data and load pattern.', 'error');
            }
            this.showLoading(false);
        }, 300);
    }

    optimizeUnitCommitment(generators, demand, timeHorizon = 1, prevSchedule = []) {
        const memo = new Map();
        const { POWER_STEP_SIZE, DEMAND_TOLERANCE_PERCENT, DEMAND_TOLERANCE_MIN_MW, DEFAULT_STARTUP_COST_FACTOR } = UnitCommitmentApp.CONFIG;
        
        const costFunction = (gen, power, isStartup = false) => {
            if (power === 0) return 0;
            // Operating cost per period: ai (fixed when running) + bi * power + di * power^2
            const operatingCost = gen.ai + gen.bi * power + gen.di * power * power;
            // Startup cost: one-time cost when transitioning from off to on
            const startupCost = isStartup ? (gen.startupCost || gen.ai * DEFAULT_STARTUP_COST_FACTOR) : 0;
            return operatingCost + startupCost;
        };

        // Helper to get previous power for a generator
        const getPrevPower = (genTag) => {
            const prev = prevSchedule.find(s => s.generator === genTag);
            return prev ? prev.power : 0;
        };

        // Check if generator can ramp from previous power to current power
        const canRamp = (gen, prevPower, currentPower) => {
            // Staying off is always valid
            if (prevPower === 0 && currentPower === 0) {
                return true;
            }
            
            // Starting up from off state
            if (prevPower === 0 && currentPower > 0) {
                // Must respect startup ramp limit
                const startupRampLimit = gen.startupRamp || gen.rampup;
                const maxStartupPower = startupRampLimit * timeHorizon;
                return currentPower >= gen.pgmin && 
                       currentPower <= gen.pgmax && 
                       currentPower <= maxStartupPower;
            }
            
            // Shutting down (going to 0)
            if (prevPower > 0 && currentPower === 0) {
                // Must respect shutdown ramp limit (can only shut down if prev power is low enough)
                const shutdownRampLimit = gen.shutdownRamp || gen.rampdown;
                return prevPower <= shutdownRampLimit * timeHorizon;
            }
            
            // Power change between non-zero values
            const powerChange = currentPower - prevPower;
            
            if (powerChange > 0) {
                // Ramping up
                return powerChange <= gen.rampup * timeHorizon && currentPower <= gen.pgmax;
            } else if (powerChange < 0) {
                // Ramping down
                return Math.abs(powerChange) <= gen.rampdown * timeHorizon && currentPower >= gen.pgmin;
            }
            
            // No change - always valid
            return true;
        };

        // Generate valid power levels for a generator respecting constraints
        const generatePowerLevels = (gen, prevPower, maxNeeded, stepSize = POWER_STEP_SIZE) => {
            const levels = [];
            
            // Calculate ramp-constrained bounds
            let minAllowed = gen.pgmin;
            let maxAllowed = gen.pgmax;
            
            // Only apply ramp constraints if there's a previous schedule (multi-period)
            // For single-period cold-start, allow full operating range
            const hasPrevSchedule = prevSchedule && prevSchedule.length > 0;
            
            if (hasPrevSchedule && prevPower > 0) {
                // Already running - apply ramp limits
                minAllowed = Math.max(gen.pgmin, prevPower - gen.rampdown * timeHorizon);
                maxAllowed = Math.min(gen.pgmax, prevPower + gen.rampup * timeHorizon);
            } else if (hasPrevSchedule && prevPower === 0) {
                // Starting up from off state - apply startup ramp limit
                const startupLimit = gen.startupRamp || gen.rampup;
                maxAllowed = Math.min(gen.pgmax, startupLimit * timeHorizon);
            }
            // else: cold start (no prev schedule) - use full pgmin to pgmax range
            
            // Cap at what's needed
            maxAllowed = Math.min(maxAllowed, maxNeeded);
            
            // Only generate if there's a valid range
            if (maxAllowed >= minAllowed && minAllowed <= maxNeeded) {
                for (let p = minAllowed; p <= maxAllowed; p += stepSize) {
                    levels.push(Math.round(p * 10) / 10);
                }
                // Add exact max if not included
                if (!levels.includes(Math.round(maxAllowed * 10) / 10)) {
                    levels.push(Math.round(maxAllowed * 10) / 10);
                }
            }
            
            return levels;
        };

        const recursiveDispatch = (gens, d, n = gens.length) => {
            // Round demand to avoid floating point precision issues
            const roundedDemand = Math.round(d * 10) / 10;
            
            // Handle zero or negative demand
            if (roundedDemand <= 0) {
                // Check if all generators can shut down (respecting ramp limits)
                let canAllShutdown = true;
                for (const g of gens.slice(0, n)) {
                    const prevPower = getPrevPower(g.tag);
                    if (prevPower > 0 && !canRamp(g, prevPower, 0)) {
                        canAllShutdown = false;
                        break;
                    }
                    if (g.mustRun) {
                        canAllShutdown = false;
                        break;
                    }
                }
                if (canAllShutdown && roundedDemand <= 0) {
                    return { schedule: [], totalCost: 0 };
                }
            }
            
            const key = `${n}-${roundedDemand}`;
            if (memo.has(key)) {
                return memo.get(key);
            }

            if (n === 0) {
                // No generators left - only succeed if demand is zero
                const result = roundedDemand <= 0.5 ? { schedule: [], totalCost: 0 } : null;
                memo.set(key, result);
                return result;
            }

            if (n === 1) {
                const gen = gens[0];
                const prevPower = getPrevPower(gen.tag);
                let bestResult = null;
                let bestCost = Infinity;

                // Try not using this generator (if allowed and can ramp down)
                if (!gen.mustRun && canRamp(gen, prevPower, 0)) {
                    if (roundedDemand <= 0.5) {
                        bestResult = { schedule: [], totalCost: 0 };
                        bestCost = 0;
                    }
                }

                // Try using this generator at valid power levels
                const powerLevels = generatePowerLevels(gen, prevPower, roundedDemand, 1.0);
                
                for (const power of powerLevels) {
                    // Check if this power level approximately meets demand
                    if (Math.abs(power - roundedDemand) <= 0.5) {
                        const isStartup = prevPower === 0 && power > 0;
                        const cost = costFunction(gen, power, isStartup);
                        if (cost < bestCost) {
                            bestCost = cost;
                            bestResult = {
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

                memo.set(key, bestResult);
                return bestResult;
            }

            // Multiple generators - try combinations
            let bestCost = Infinity;
            let bestSchedule = null;
            const gen = gens[n - 1];
            const prevPower = getPrevPower(gen.tag);

            // Try NOT using this generator (if allowed)
            if (!gen.mustRun && canRamp(gen, prevPower, 0)) {
                const subResult = recursiveDispatch(gens, roundedDemand, n - 1);
                if (subResult !== null && subResult.totalCost < bestCost) {
                    bestCost = subResult.totalCost;
                    bestSchedule = subResult.schedule;
                }
            }

            // Try using this generator at valid power levels
            const powerLevels = generatePowerLevels(gen, prevPower, roundedDemand, 1.0);
            
            for (const power of powerLevels) {
                const remainingDemand = roundedDemand - power;
                const subResult = recursiveDispatch(gens, remainingDemand, n - 1);
                
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

            const result = bestSchedule ? { schedule: bestSchedule, totalCost: bestCost } : null;
            memo.set(key, result);
            return result;
        };

        // Handle zero demand case
        if (demand === 0) {
            // Check if all generators can be off
            let canAllBeOff = true;
            for (const gen of generators) {
                const prevPower = getPrevPower(gen.tag);
                if (gen.mustRun || (prevPower > 0 && !canRamp(gen, prevPower, 0))) {
                    canAllBeOff = false;
                    break;
                }
            }
            if (canAllBeOff) {
                return {
                    success: true,
                    demand: 0,
                    schedule: [],
                    totalCost: 0,
                    totalGeneration: 0,
                    activeGenerators: 0,
                    efficiency: '0.0000'
                };
            }
        }

        // Run recursive dispatch
        const roundedDemand = Math.round(demand * 10) / 10;
        const result = recursiveDispatch(generators, roundedDemand, generators.length);
        let bestResult = result;

        if (bestResult) {
            // Sort schedule by generator order
            bestResult.schedule.sort((a, b) => {
                const aIndex = generators.findIndex(g => g.tag === a.generator);
                const bIndex = generators.findIndex(g => g.tag === b.generator);
                return aIndex - bIndex;
            });

            // Validate demand is met (0.5% or 1.0 MW tolerance, whichever is larger)
            const totalGeneration = bestResult.schedule.reduce((sum, gen) => sum + gen.power, 0);
            const demandError = Math.abs(totalGeneration - demand);
            const tolerancePercent = demand * 0.005; // 0.5% of demand
            const tolerance = Math.max(tolerancePercent, 1.0); // At least 1.0 MW
            const demandMet = demandError <= tolerance;

            if (!demandMet && demand > 0) {
                console.warn(`Demand tolerance exceeded: Required ${demand} MW, Generated ${totalGeneration.toFixed(2)} MW`);
                return {
                    success: false,
                    error: `Demand not met: Required ${demand} MW, Generated ${totalGeneration.toFixed(2)} MW`
                };
            }

            // Calculate cost per MW (lower is better)
            let efficiency;
            if (demand === 0 || totalGeneration === 0) {
                efficiency = '0.0000';
            } else if (bestResult.totalCost === 0) {
                efficiency = '0.0000';
            } else {
                efficiency = (bestResult.totalCost / totalGeneration).toFixed(4);
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
                timeOff: gen.mindowntime || 1, // Start with min down time satisfied (can start immediately)
                lastPower: 0
            };
        });

        for (let period = 0; period < periods; period++) {
            const demand = demands[period] !== undefined ? demands[period] : demands[0];
            
            // Build list of feasible generators with adjusted constraints
            const feasibleGenerators = generators.map(gen => {
                const state = generatorStates[gen.tag];
                let mustRun = false;
                let canTurnOn = true;
                let adjustedPgmin = gen.pgmin;
                let adjustedPgmax = gen.pgmax;
                
                // MINIMUM UP TIME: If generator is on and hasn't met minimum up time, it MUST stay on
                if (state.isOn && state.timeOn < gen.minuptime) {
                    mustRun = true;
                    // Apply ramp limits from last power level
                    if (state.lastPower > 0) {
                        adjustedPgmin = Math.max(gen.pgmin, state.lastPower - gen.rampdown);
                        adjustedPgmax = Math.min(gen.pgmax, state.lastPower + gen.rampup);
                    }
                }
                
                // MINIMUM DOWN TIME: If generator is off and hasn't met minimum down time, it CANNOT start
                if (!state.isOn && state.timeOff < gen.mindowntime) {
                    canTurnOn = false;
                    // Mark generator as unavailable by setting invalid power range
                    adjustedPgmin = Infinity; // Clearly indicates unavailable
                    adjustedPgmax = 0;
                }
                
                // If generator was running, apply ramp constraints
                if (state.isOn && state.lastPower > 0 && !mustRun) {
                    adjustedPgmin = Math.max(gen.pgmin, state.lastPower - gen.rampdown);
                    adjustedPgmax = Math.min(gen.pgmax, state.lastPower + gen.rampup);
                }
                
                // If generator is starting up (was off), apply startup ramp
                if (!state.isOn && canTurnOn) {
                    const startupLimit = gen.startupRamp || gen.rampup;
                    adjustedPgmax = Math.min(gen.pgmax, startupLimit);
                }
                
                return {
                    ...gen,
                    mustRun: mustRun,
                    canTurnOn: canTurnOn,
                    pgmin: adjustedPgmin,
                    pgmax: adjustedPgmax,
                    originalPgmin: gen.pgmin,
                    originalPgmax: gen.pgmax
                };
            });

            // Get previous schedule for ramp constraint enforcement
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
        
        if (!container) {
            console.error('Optimization results container not found');
            return;
        }
        
        if (!result) {
            container.innerHTML = '<p class="no-data">No optimization result available.</p>';
            return;
        }
        
        if (result.success) {
            if (!result.schedule || result.schedule.length === 0) {
                container.innerHTML = '<p class="no-data">No generators in schedule.</p>';
                return;
            }
            
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
                            <p><strong>Cost per MW:</strong> ₹${result.efficiency}/MW</p>
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
                                    if (!genData) {
                                        return `
                                        <tr>
                                            <td>${gen.generator}</td>
                                            <td>N/A</td>
                                            <td>N/A</td>
                                            <td>N/A</td>
                                            <td>₹${gen.cost.toFixed(2)}</td>
                                        </tr>
                                        `;
                                    }
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
                            <p><strong>Most Economical Generator:</strong> ${analysis ? analysis.mostEconomical : 'N/A'}</p>
                            <p><strong>Highest Load Generator:</strong> ${analysis ? analysis.highestLoad : 'N/A'}</p>
                            <p><strong>Average Cost per MW:</strong> ₹${analysis ? analysis.avgCostPerMW : '0.00'}</p>
                            <p><strong>System Utilization:</strong> ${analysis ? analysis.utilization : '0.0'}%</p>
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
        
        // Handle empty schedule case
        if (!schedule || schedule.length === 0) {
            return {
                mostEconomical: 'N/A',
                highestLoad: 'N/A',
                avgCostPerMW: '0.00',
                utilization: '0.0'
            };
        }
        
        // Filter out generators with zero power to avoid division by zero
        const activeGenerators = schedule.filter(gen => gen.power > 0);
        
        if (activeGenerators.length === 0) {
            return {
                mostEconomical: 'N/A',
                highestLoad: 'N/A',
                avgCostPerMW: '0.00',
                utilization: '0.0'
            };
        }
        
        // Use explicit initial value to avoid edge cases
        const mostEconomical = activeGenerators.reduce((min, gen, index) => {
            if (index === 0) return gen;
            const minCostPerMW = min.power > 0 ? min.cost / min.power : Infinity;
            const genCostPerMW = gen.power > 0 ? gen.cost / gen.power : Infinity;
            return genCostPerMW < minCostPerMW ? gen : min;
        }, activeGenerators[0]);
        
        const highestLoad = activeGenerators.reduce((max, gen) => 
            gen.power > max.power ? gen : max
        );

        const totalCapacity = this.generators.reduce((sum, gen) => sum + gen.pgmax, 0);
        const usedCapacity = schedule.reduce((sum, gen) => sum + gen.power, 0);
        
        // Prevent division by zero
        const avgCostPerMW = results.demand > 0 ? (results.totalCost / results.demand).toFixed(2) : '0.00';
        const utilization = totalCapacity > 0 ? ((usedCapacity / totalCapacity) * 100).toFixed(1) : '0.0';

        return {
            mostEconomical: mostEconomical.generator,
            highestLoad: highestLoad.generator,
            avgCostPerMW: avgCostPerMW,
            utilization: utilization
        };
    }

    displayMultiPeriodResults(result) {
        const container = document.getElementById('multiperiod-results');
        
        if (result.success) {
            // Generate schedule visualization table
            const scheduleVisualization = this.generateScheduleVisualization(result);
            
            // Summary statistics
            const totalPower = result.schedules.reduce((sum, p) => sum + p.demand, 0);
            const avgCost = result.totalSystemCost / result.schedules.length;
            const feasiblePeriods = result.schedules.filter(s => !s.infeasible).length;
            
            document.getElementById('schedule-visualization').innerHTML = `
                <div class="results-summary">
                    <div class="summary-stats">
                        <div class="stat-item">
                            <h4>₹${result.totalSystemCost.toFixed(2)}</h4>
                            <p>Total System Cost</p>
                        </div>
                        <div class="stat-item">
                            <h4>${result.schedules.length}h</h4>
                            <p>Planning Horizon</p>
                        </div>
                        <div class="stat-item">
                            <h4>₹${avgCost.toFixed(2)}/h</h4>
                            <p>Average Hourly Cost</p>
                        </div>
                        <div class="stat-item">
                            <h4>${((feasiblePeriods / result.schedules.length) * 100).toFixed(1)}%</h4>
                            <p>Feasibility Rate</p>
                        </div>
                    </div>
                </div>
                
                <div class="schedule-table-container">
                    <h4><i class="fas fa-table"></i> Hourly Dispatch Schedule</h4>
                    <div class="table-responsive">
                        <table class="schedule-table">
                            <thead>
                                <tr>
                                    <th>Hour</th>
                                    <th>Load (MW)</th>
                                    <th>Status</th>
                                    ${this.generators.map(gen => `<th>${gen.tag}</th>`).join('')}
                                    <th>Total Gen</th>
                                    <th>Cost (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${scheduleVisualization}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="generator-timeline">
                    <h4><i class="fas fa-timeline"></i> Generator On/Off Schedule</h4>
                    ${this.createGeneratorTimeline(result)}
                </div>
            `;
            
            container.style.display = 'block';
            this.showToast(`Schedule generated for ${result.schedules.length} periods`, 'success');
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
            container.style.display = 'block';
        }
    }

    generateScheduleVisualization(result) {
        return result.schedules.map((period, index) => {
            const status = period.infeasible ? 
                '<span class="status-error"><i class="fas fa-times"></i> Infeasible</span>' : 
                '<span class="status-success"><i class="fas fa-check"></i> Optimal</span>';
            
            const totalGeneration = period.schedule.reduce((sum, gen) => sum + gen.power, 0);
            
            const generatorCells = this.generators.map(gen => {
                const genSchedule = period.schedule.find(s => s.generator === gen.tag);
                if (genSchedule && genSchedule.power > 0) {
                    return `<td class="gen-on">${genSchedule.power.toFixed(1)} MW</td>`;
                } else {
                    return `<td class="gen-off">OFF</td>`;
                }
            }).join('');
            
            return `
                <tr style="animation-delay: ${index * 0.05}s" class="schedule-row">
                    <td><strong>H${period.period}</strong></td>
                    <td>${period.demand.toFixed(1)} MW</td>
                    <td>${status}</td>
                    ${generatorCells}
                    <td><strong>${totalGeneration.toFixed(1)} MW</strong></td>
                    <td>₹${period.cost.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    createGeneratorTimeline(result) {
        const timeline = this.generators.map(gen => {
            const timelineBar = result.schedules.map((period, hour) => {
                const genSchedule = period.schedule.find(s => s.generator === gen.tag);
                const isOn = genSchedule && genSchedule.power > 0;
                const power = isOn ? genSchedule.power : 0;
                
                return `
                    <div class="timeline-hour ${isOn ? 'gen-on' : 'gen-off'}" 
                         title="Hour ${hour + 1}: ${isOn ? power.toFixed(1) + ' MW' : 'OFF'}"
                         data-hour="${hour + 1}" data-power="${power.toFixed(1)}">
                    </div>
                `;
            }).join('');
            
            const totalHours = result.schedules.length;
            const onHours = result.schedules.filter(p => {
                const genSchedule = p.schedule.find(s => s.generator === gen.tag);
                return genSchedule && genSchedule.power > 0;
            }).length;
            
            return `
                <div class="generator-timeline-row">
                    <div class="timeline-label">
                        <strong>${gen.tag}</strong>
                        <small>${onHours}/${totalHours}h ON</small>
                    </div>
                    <div class="timeline-bar">
                        ${timelineBar}
                    </div>
                </div>
            `;
        }).join('');
        
        return timeline;
    }

    createMultiPeriodCharts(result, demands) {
        // Create enhanced charts for multi-period results visualization
        this.createLoadGenerationChart(result, demands);
        this.createGeneratorStatusChart(result);
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
                    yAxisID: 'y',
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 3
                }, {
                    label: 'Cost (₹)',
                    data: costs,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.15)',
                    yAxisID: 'y1',
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointBackgroundColor: '#e74c3c',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Multi-Period Demand and Cost Trends',
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 14,
                        cornerRadius: 10,
                        mode: 'index',
                        intersect: false
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
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
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
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                animation: {
                    duration: 2500,
                    easing: 'easeOutElastic',
                    delay: (context) => context.dataIndex * 100
                },
                hover: {
                    animationDuration: 300
                },
                transitions: {
                    active: {
                        animation: {
                            duration: 300
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    createLoadGenerationChart(result, demands) {
        const ctx = document.getElementById('load-generation-chart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.loadGeneration) {
            this.charts.loadGeneration.destroy();
        }

        const hours = result.schedules.map((_, i) => i + 1);
        const loadData = result.schedules.map(p => p.demand);
        
        // Calculate generation by each generator for each hour
        const generatorDatasets = this.generators.map((gen, index) => {
            const colors = UnitCommitmentApp.CONFIG.CHART_COLORS;
            const color = colors[index % colors.length];
            
            const genData = result.schedules.map(period => {
                const genSchedule = period.schedule.find(s => s.generator === gen.tag);
                return genSchedule ? genSchedule.power : 0;
            });

            return {
                label: gen.tag,
                data: genData,
                backgroundColor: color + '80',
                borderColor: color,
                borderWidth: 3,
                fill: false,
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            };
        });

        this.charts.loadGeneration = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [
                    {
                        label: 'Load Demand',
                        data: loadData,
                        borderColor: '#2c3e50',
                        backgroundColor: 'rgba(44, 62, 80, 0.15)',
                        borderWidth: 4,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 6,
                        pointHoverRadius: 10,
                        pointBackgroundColor: '#2c3e50',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#2c3e50',
                        pointHoverBorderWidth: 3
                    },
                    ...generatorDatasets
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Hourly Load Demand vs Generator Output',
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 14,
                        cornerRadius: 10,
                        mode: 'index',
                        intersect: false,
                        animation: {
                            duration: 200
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Power (MW)'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Hour'
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                animation: {
                    duration: 2000,
                    easing: 'easeInOutQuart',
                    delay: (context) => context.datasetIndex * 300
                },
                hover: {
                    animationDuration: 300
                },
                transitions: {
                    active: {
                        animation: {
                            duration: 300
                        }
                    }
                }
            }
        });
    }

    createGeneratorStatusChart(result) {
        const ctx = document.getElementById('generator-status-chart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.generatorStatus) {
            this.charts.generatorStatus.destroy();
        }

        const hours = result.schedules.map((_, i) => i + 1);
        
        // Create stacked bar chart showing generator status (on/off/power level)
        const generatorDatasets = this.generators.map((gen, index) => {
            const colors = UnitCommitmentApp.CONFIG.CHART_COLORS;
            const color = colors[index % colors.length];
            
            const statusData = result.schedules.map(period => {
                const genSchedule = period.schedule.find(s => s.generator === gen.tag);
                return genSchedule && genSchedule.power > 0 ? 1 : 0; // 1 for ON, 0 for OFF
            });

            return {
                label: gen.tag,
                data: statusData,
                backgroundColor: color,
                borderColor: color,
                borderWidth: 1,
                categoryPercentage: 0.8,
                barPercentage: 0.9
            };
        });

        this.charts.generatorStatus = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hours,
                datasets: generatorDatasets
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Generator On/Off Status Timeline',
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 14,
                        cornerRadius: 10,
                        callbacks: {
                            label: function(context) {
                                const generatorName = context.dataset.label;
                                const hour = context.label;
                                const isOn = context.parsed.y === 1;
                                const period = result.schedules[context.dataIndex];
                                const genSchedule = period.schedule.find(s => s.generator === generatorName);
                                const power = genSchedule ? genSchedule.power : 0;
                                
                                return `${generatorName}: ${isOn ? `ON (${power.toFixed(1)} MW)` : 'OFF'}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: this.generators.length,
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                return value === 0 ? 'OFF' : (value === 1 ? 'ON' : '');
                            }
                        },
                        title: {
                            display: true,
                            text: 'Generator Status'
                        },
                        stacked: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Hour'
                        },
                        stacked: true,
                        grid: { display: false }
                    }
                },
                animation: {
                    delay: (context) => context.datasetIndex * 200 + context.dataIndex * 50,
                    duration: 1500,
                    easing: 'easeOutBounce',
                    y: {
                        from: (ctx) => ctx.chart.scales.y.getPixelForValue(0)
                    }
                },
                hover: {
                    animationDuration: 300
                },
                transitions: {
                    active: {
                        animation: {
                            duration: 300
                        }
                    }
                }
            }
        });
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
        
        if (!demandInput) return;
        
        if (!this.currentProject) {
            demandInput.style.borderColor = 'var(--warning-color)';
            return;
        }
        
        if (isNaN(demand)) {
            demandInput.style.borderColor = 'var(--danger-color)';
            demandInput.title = 'Please enter a valid number';
        } else if (demand < 0) {
            demandInput.style.borderColor = 'var(--danger-color)';
            demandInput.title = 'Demand cannot be negative';
        } else if (demand < this.currentProject.minLoad) {
            demandInput.style.borderColor = 'var(--danger-color)';
            demandInput.title = `Demand too low. Minimum: ${this.currentProject.minLoad.toFixed(2)} MW`;
        } else if (demand > this.currentProject.maxLoad) {
            demandInput.style.borderColor = 'var(--danger-color)';
            demandInput.title = `Demand too high. Maximum: ${this.currentProject.maxLoad.toFixed(2)} MW`;
        } else {
            demandInput.style.borderColor = 'var(--success-color)';
            demandInput.title = `Valid demand: ${demand} MW`;
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
        
        // Check if errors array contains HTML (for multiple generator errors)
        const errorContent = errors.length === 1 && errors[0].includes('<strong>') 
            ? errors[0]  // Already formatted HTML
            : `<ul>${errors.map(error => `<li>${error}</li>`).join('')}</ul>`;  // Simple list
        
        errorDiv.innerHTML = `
            <div class="error-summary">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>${context}:</strong>
                ${errorContent}
                <button onclick="this.parentElement.parentElement.remove()" class="btn-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Auto-remove after configured duration
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, UnitCommitmentApp.CONFIG.ERROR_DISPLAY_DURATION);
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
        const { DEFAULT_BASE_CAPACITY, DEFAULT_CAPACITY_INCREMENT, DEFAULT_RAMP_UP_PERCENT, DEFAULT_RAMP_DOWN_PERCENT } = UnitCommitmentApp.CONFIG;
        const baseCapacity = DEFAULT_BASE_CAPACITY + (generatorIndex * DEFAULT_CAPACITY_INCREMENT);
        
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
            if (aiEl && !aiEl.value) aiEl.value = 30 + (generatorIndex * 10);
            if (biEl && !biEl.value) biEl.value = (2.0 + generatorIndex * 0.3).toFixed(2);
            if (diEl && !diEl.value) diEl.value = (0.01 - generatorIndex * 0.001).toFixed(4);
            if (rampupEl && !rampupEl.value) rampupEl.value = Math.round(baseCapacity * DEFAULT_RAMP_UP_PERCENT);
            if (rampdownEl && !rampdownEl.value) rampdownEl.value = Math.round(baseCapacity * DEFAULT_RAMP_DOWN_PERCENT);
            if (minuptimeEl && !minuptimeEl.value) minuptimeEl.value = Math.max(1, Math.floor(generatorIndex / 2) + 1);
            if (mindowntimeEl && !mindowntimeEl.value) mindowntimeEl.value = 1;
        }, UnitCommitmentApp.CONFIG.TAB_TRANSITION_DELAY);
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
            
            // Save generators and set demand to a valid value within range
            this.saveGenerators();
            setTimeout(() => {
                // Calculate a sensible default demand (50% of capacity)
                if (this.currentProject) {
                    const midpointDemand = Math.round(
                        (this.currentProject.minLoad + this.currentProject.maxLoad) / 2
                    );
                    document.getElementById('demand-input').value = midpointDemand;
                    this.showToast(`Example loaded! Demand set to ${midpointDemand} MW. Click Optimization tab.`, 'success');
                } else {
                    document.getElementById('demand-input').value = 100;
                    this.showToast('Example loaded! Demand set to 100 MW. Click Optimization tab.', 'success');
                }
                this.switchTab('optimization');
            }, 500);
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
                const parseErrors = [];
                
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    try {
                        const values = line.split(',');
                        const generator = {
                            tag: values[colIndices.tag]?.trim() || `G${i}`,
                            pgmin: parseFloat(values[colIndices.pgmin]),
                            pgmax: parseFloat(values[colIndices.pgmax]),
                            ai: parseFloat(values[colIndices.ai]),
                            bi: parseFloat(values[colIndices.bi]),
                            di: parseFloat(values[colIndices.di])
                        };
                        
                        // Validate required numeric fields
                        if (isNaN(generator.pgmin) || isNaN(generator.pgmax) || 
                            isNaN(generator.ai) || isNaN(generator.bi) || isNaN(generator.di)) {
                            parseErrors.push(`Row ${i}: Invalid numeric values`);
                            continue;
                        }
                    
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
                    } catch (rowError) {
                        parseErrors.push(`Row ${i}: ${rowError.message}`);
                        continue;
                    }
                }
                
                if (generators.length === 0) {
                    throw new Error('No valid generators found in CSV');
                }
                
                if (parseErrors.length > 0) {
                    console.warn('CSV parse warnings:', parseErrors);
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
            
            // Clean up charts to prevent memory leaks
            this.destroyAllCharts();
            
            localStorage.removeItem(UnitCommitmentApp.CONFIG.STORAGE_KEY_PROJECT);
            this.updateUI();
            this.showToast('All data cleared', 'success');
        }
    }

    // Data Management
    saveProject() {
        if (this.currentProject) {
            try {
                localStorage.setItem(UnitCommitmentApp.CONFIG.STORAGE_KEY_PROJECT, JSON.stringify(this.currentProject));
            } catch (error) {
                console.error('Failed to save project:', error);
                this.showToast('Failed to save project to local storage', 'error');
            }
        }
    }

    loadSavedProject() {
        const saved = localStorage.getItem(UnitCommitmentApp.CONFIG.STORAGE_KEY_PROJECT);
        if (saved) {
            try {
                this.currentProject = JSON.parse(saved);
                this.generators = this.currentProject.generators || [];
            } catch (error) {
                console.error('Failed to load saved project:', error);
                localStorage.removeItem(UnitCommitmentApp.CONFIG.STORAGE_KEY_PROJECT);
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
            
            // Keep only last N projects (from config)
            const maxHistory = UnitCommitmentApp.CONFIG.MAX_HISTORY_ITEMS;
            if (this.history.length > maxHistory) {
                this.history = this.history.slice(0, maxHistory);
            }
            
            this.saveHistory();
        }
    }

    saveHistory() {
        try {
            localStorage.setItem(UnitCommitmentApp.CONFIG.STORAGE_KEY_HISTORY, JSON.stringify(this.history));
        } catch (error) {
            console.error('Failed to save history:', error);
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem(UnitCommitmentApp.CONFIG.STORAGE_KEY_HISTORY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Failed to load history:', error);
            return [];
        }
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
        
        if (!container || !canvas) {
            console.warn('FLAC chart elements not found');
            return;
        }
        
        if (!this.generators || this.generators.length === 0) return;
        
        container.style.display = 'block';
        container.classList.add('animate-slideInLeft');
        
        // Destroy existing chart
        if (this.charts.flac) {
            this.charts.flac.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Cannot get canvas context for FLAC chart');
            return;
        }
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
                    borderRadius: 8,
                    hoverBackgroundColor: this.generators.map((_, i) => 
                        `hsla(${200 + i * 30}, 85%, 55%, 1)`
                    ),
                    hoverBorderWidth: 3,
                    hoverBorderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Generator Efficiency Ranking (Lower FLAC = Better)',
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 20 }
                    },
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: true,
                        animation: {
                            duration: 200,
                            easing: 'easeOutQuart'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'FLAC (₹/MW)'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                animation: {
                    delay: (context) => context.dataIndex * 300,
                    duration: 1500,
                    easing: 'easeOutBounce',
                    y: {
                        from: (ctx) => ctx.chart.scales.y.getPixelForValue(0)
                    }
                },
                hover: {
                    animationDuration: 300
                },
                transitions: {
                    active: {
                        animation: {
                            duration: 300
                        }
                    }
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
        if (!ctx) {
            console.error('Cannot get canvas context for power distribution chart');
            return;
        }
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
                    borderWidth: 4,
                    borderColor: '#fff',
                    hoverOffset: 20,
                    hoverBorderWidth: 5,
                    hoverBorderColor: '#fff',
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                cutout: '55%',
                plugins: {
                    title: {
                        display: true,
                        text: `Power Distribution for ${result.demand} MW Demand`,
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 14,
                        cornerRadius: 10,
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${value} MW (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 2000,
                    easing: 'easeOutElastic',
                    delay: (context) => context.dataIndex * 200
                },
                hover: {
                    animationDuration: 400
                },
                transitions: {
                    active: {
                        animation: {
                            duration: 400
                        }
                    }
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
            if (!gen) {
                return {
                    generator: item.generator,
                    fixed: 0,
                    variable: 0,
                    quadratic: 0,
                    total: item.cost
                };
            }
            return {
                generator: item.generator,
                fixed: gen.ai,
                variable: gen.bi * item.power,
                quadratic: gen.di * item.power * item.power,
                total: item.cost
            };
        });
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Cannot get canvas context for cost breakdown chart');
            return;
        }
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
                        borderColor: '#2488d8',
                        borderWidth: 1,
                        borderRadius: 4,
                        stack: 'Stack 0'
                    },
                    {
                        label: 'Quadratic Cost (Di×Pi²)',
                        data: costData.map(item => item.quadratic),
                        backgroundColor: '#FFCE56',
                        borderColor: '#e6b94d',
                        borderWidth: 1,
                        borderRadius: 4,
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
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 14,
                        cornerRadius: 10,
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ₹${context.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: { 
                        stacked: true,
                        grid: { display: false }
                    },
                    y: { 
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Cost (₹)'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    }
                },
                animation: {
                    delay: (context) => context.datasetIndex * 500 + context.dataIndex * 150,
                    duration: 1500,
                    easing: 'easeOutElastic',
                    y: {
                        from: (ctx) => ctx.chart.scales.y.getPixelForValue(0)
                    }
                },
                hover: {
                    animationDuration: 300
                },
                transitions: {
                    active: {
                        animation: {
                            duration: 300
                        }
                    }
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
        if (!container) {
            console.warn('Advanced visualizations container not found');
            return;
        }
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
        if (!canvas) return;
        
        // Calculate system utilization (a true percentage metric)
        const analysis = this.analyzeResults(this.optimizationResults);
        const utilization = analysis ? parseFloat(analysis.utilization) : 0;
        
        if (this.charts.efficiency) {
            this.charts.efficiency.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        this.charts.efficiency = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [utilization, 100 - utilization],
                    backgroundColor: [
                        this.createGradient(ctx, '#4CAF50', '#8BC34A'),
                        '#E8E8E8'
                    ],
                    borderWidth: 0,
                    circumference: Math.PI,
                    rotation: Math.PI,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 2500,
                    easing: 'easeOutElastic'
                },
                hover: {
                    animationDuration: 300
                }
            },
            plugins: [{
                afterDraw: (chart) => {
                    const { ctx, chartArea } = chart;
                    ctx.save();
                    ctx.font = 'bold 24px Inter';
                    ctx.fillStyle = '#333';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${utilization}%`, 
                        chartArea.left + chartArea.width / 2, 
                        chartArea.top + chartArea.height / 2 + 10);
                    ctx.font = '12px Inter';
                    ctx.fillText('System Utilization', 
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
        // Animate all visible charts with staggered updates
        Object.values(this.charts).forEach((chart, index) => {
            if (chart && chart.canvas && chart.canvas.offsetParent) {
                setTimeout(() => {
                    chart.reset();
                    chart.update('active');
                }, index * 200);
            }
        });
        
        // Animate result cards with wave effect
        document.querySelectorAll('.result-card').forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('animate-pulse');
                card.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    card.style.transform = 'scale(1)';
                }, 300);
            }, index * 150);
        });
        
        // Animate generator items with slide effect
        document.querySelectorAll('.generator-item').forEach((item, index) => {
            setTimeout(() => {
                item.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                item.style.transform = 'translateX(15px) scale(1.02)';
                item.style.boxShadow = '0 4px 15px rgba(37, 99, 235, 0.2)';
                setTimeout(() => {
                    item.style.transform = 'translateX(0) scale(1)';
                    item.style.boxShadow = '';
                }, 400);
            }, index * 120);
        });

        // Animate chart containers
        document.querySelectorAll('.chart-container').forEach((container, index) => {
            setTimeout(() => {
                container.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                container.style.transform = 'scale(1.02)';
                container.style.boxShadow = '0 8px 30px rgba(37, 99, 235, 0.15)';
                setTimeout(() => {
                    container.style.transform = 'scale(1)';
                    container.style.boxShadow = '';
                }, 500);
            }, index * 250);
        });

        // Animate progress bars if they exist
        document.querySelectorAll('.progress-fill').forEach((bar, index) => {
            const width = bar.style.width;
            bar.style.width = '0';
            setTimeout(() => {
                bar.style.transition = 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
                bar.style.width = width;
            }, index * 200 + 300);
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
        if (!canvas) return;
        
        if (this.charts.loadDistribution) {
            this.charts.loadDistribution.destroy();
        }
        
        if (!this.optimizationResults || !this.optimizationResults.success) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const schedule = this.optimizationResults.schedule;
        if (!schedule || schedule.length === 0) return;
        
        this.charts.loadDistribution = new Chart(ctx, {
            type: 'line',
            data: {
                labels: schedule.map(item => item.generator),
                datasets: [{
                    label: 'Power Output (MW)',
                    data: schedule.map(item => item.power),
                    borderColor: '#36A2EB',
                    backgroundColor: 'rgba(54, 162, 235, 0.25)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 8,
                    pointHoverRadius: 12,
                    pointBackgroundColor: '#36A2EB',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 3,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#36A2EB',
                    pointHoverBorderWidth: 4,
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Generator Load Distribution',
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 14,
                        cornerRadius: 10,
                        displayColors: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Power (MW)'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                animation: {
                    delay: (context) => context.dataIndex * 200,
                    duration: 2000,
                    easing: 'easeOutElastic',
                    x: {
                        from: (ctx) => ctx.chart.scales.x.getPixelForValue(ctx.chart.scales.x.min)
                    },
                    y: {
                        from: (ctx) => ctx.chart.scales.y.getPixelForValue(0)
                    }
                },
                hover: {
                    animationDuration: 300
                },
                transitions: {
                    active: {
                        animation: {
                            duration: 300
                        }
                    }
                }
            }
        });
    }

    createCostTrendChart() {
        const canvas = document.getElementById('cost-trend-chart');
        if (!canvas) return;
        
        if (this.charts.costTrend) {
            this.charts.costTrend.destroy();
        }
        
        if (!this.optimizationResults || !this.optimizationResults.success) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const schedule = this.optimizationResults.schedule;
        if (!schedule || schedule.length === 0) return;
        
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
                    backgroundColor: 'rgba(255, 99, 132, 0.15)',
                    fill: true,
                    stepped: true,
                    borderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointBackgroundColor: '#FF6384',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#FF6384',
                    pointHoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Cumulative Cost Trend',
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 14,
                        cornerRadius: 10,
                        callbacks: {
                            label: (context) => `Cumulative Cost: ₹${context.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Cost (₹)'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                animation: {
                    delay: (context) => context.dataIndex * 250,
                    duration: 2000,
                    easing: 'easeOutQuart',
                    y: {
                        from: (ctx) => ctx.chart.scales.y.getPixelForValue(0)
                    }
                },
                hover: {
                    animationDuration: 300
                },
                transitions: {
                    active: {
                        animation: {
                            duration: 300
                        }
                    }
                }
            }
        });
    }

    createUtilizationChart() {
        const canvas = document.getElementById('utilization-chart');
        if (!canvas) return;
        
        if (this.charts.utilization) {
            this.charts.utilization.destroy();
        }
        
        if (!this.optimizationResults || !this.optimizationResults.success) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const schedule = this.optimizationResults.schedule;
        if (!schedule || schedule.length === 0) return;
        
        // Calculate utilization percentage for each generator
        const utilizationData = schedule.map(item => {
            const gen = this.generators.find(g => g.tag === item.generator);
            if (!gen || gen.pgmax === 0) return 0;
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
                    backgroundColor: 'rgba(255, 206, 86, 0.25)',
                    borderWidth: 3,
                    pointBackgroundColor: '#FFCE56',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 3,
                    pointRadius: 8,
                    pointHoverRadius: 12,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#FFCE56',
                    pointHoverBorderWidth: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Generator Utilization Radar',
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 15 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 14,
                        cornerRadius: 10,
                        callbacks: {
                            label: (context) => `Utilization: ${context.parsed.r}%`
                        }
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
                            },
                            font: { size: 11 },
                            backdropColor: 'transparent'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.08)',
                            circular: true
                        },
                        pointLabels: {
                            font: { size: 12, weight: 'bold' },
                            color: '#333'
                        },
                        angleLines: {
                            color: 'rgba(0,0,0,0.08)'
                        }
                    }
                },
                animation: {
                    duration: 2500,
                    easing: 'easeOutElastic',
                    delay: (context) => context.dataIndex * 150
                },
                hover: {
                    animationDuration: 300
                },
                transitions: {
                    active: {
                        animation: {
                            duration: 300
                        }
                    }
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
        if (!container) {
            console.warn('Toast container not found');
            return;
        }
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
            if (toast.parentNode) {
                toast.remove();
            }
        }, UnitCommitmentApp.CONFIG.TOAST_DURATION);
    }
    
    // Self-test method for validation
    static runTests() {
        console.log('=== Unit Commitment Optimizer Self-Test ===');
        console.log(`Version: ${UnitCommitmentApp.CONFIG.VERSION}`);
        
        const testResults = [];
        
        // Test 1: Create test generators
        const testGenerators = [
            { tag: 'G1', pgmin: 10, pgmax: 100, ai: 50, bi: 2.5, di: 0.01, rampup: 15, rampdown: 12, minuptime: 2, mindowntime: 1 },
            { tag: 'G2', pgmin: 20, pgmax: 150, ai: 40, bi: 3.0, di: 0.008, rampup: 25, rampdown: 20, minuptime: 3, mindowntime: 2 },
            { tag: 'G3', pgmin: 15, pgmax: 80, ai: 60, bi: 2.0, di: 0.012, rampup: 20, rampdown: 18, minuptime: 2, mindowntime: 1 }
        ];
        
        // Calculate FLAC for test generators
        const processedGenerators = testGenerators.map(gen => {
            const flac = gen.ai / gen.pgmax + gen.bi + gen.di * gen.pgmax;
            return { ...gen, flac };
        }).sort((a, b) => a.flac - b.flac);
        
        // Test 2: FLAC calculation
        // G2: 40/150 + 3.0 + 0.008*150 = 0.267 + 3.0 + 1.2 = 4.467
        // G1: 50/100 + 2.5 + 0.01*100 = 0.5 + 2.5 + 1.0 = 4.0
        // G3: 60/80 + 2.0 + 0.012*80 = 0.75 + 2.0 + 0.96 = 3.71
        const expectedOrder = ['G3', 'G1', 'G2']; // Lowest FLAC first
        const actualOrder = processedGenerators.map(g => g.tag);
        const flacTest = JSON.stringify(expectedOrder) === JSON.stringify(actualOrder);
        testResults.push({ name: 'FLAC Sorting', passed: flacTest, expected: expectedOrder, actual: actualOrder });
        
        // Test 3: Create mock app for optimization test
        const mockApp = {
            generators: processedGenerators,
            optimizeUnitCommitment: UnitCommitmentApp.prototype.optimizeUnitCommitment
        };
        
        // Bind the CONFIG to the mock
        Object.defineProperty(mockApp, 'CONFIG', { get: () => UnitCommitmentApp.CONFIG });
        
        // Test 4: Optimization with demand = 200 MW
        const demand = 200;
        const result = mockApp.optimizeUnitCommitment(processedGenerators, demand, 1, []);
        const optTest = result.success === true;
        testResults.push({ 
            name: 'Optimization Success (200 MW)', 
            passed: optTest,
            details: result.success ? `Total Cost: ₹${result.totalCost.toFixed(2)}, Gen: ${result.totalGeneration.toFixed(2)} MW` : result.error
        });
        
        // Test 5: Check total generation matches demand within tolerance
        if (result.success) {
            const tolerance = Math.max(demand * 0.005, 1.0);
            const demandMatch = Math.abs(result.totalGeneration - demand) <= tolerance;
            testResults.push({ 
                name: 'Demand Match', 
                passed: demandMatch,
                expected: `${demand} ± ${tolerance.toFixed(2)} MW`,
                actual: `${result.totalGeneration.toFixed(2)} MW`
            });
        }
        
        // Test 6: Min/Max demand validation
        const minLoad = Math.min(...processedGenerators.map(g => g.pgmin)); // 10 MW
        const maxLoad = processedGenerators.reduce((sum, g) => sum + g.pgmax, 0); // 330 MW
        const rangeTest = minLoad === 10 && maxLoad === 330;
        testResults.push({ name: 'System Range', passed: rangeTest, expected: '10-330 MW', actual: `${minLoad}-${maxLoad} MW` });
        
        // Test 7: Out of range demand (too high)
        const highDemandResult = mockApp.optimizeUnitCommitment(processedGenerators, 400, 1, []);
        const highDemandTest = highDemandResult.success === false;
        testResults.push({ name: 'High Demand Rejection', passed: highDemandTest });
        
        // Print results
        console.log('\n--- Test Results ---');
        testResults.forEach(test => {
            const status = test.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status}: ${test.name}`);
            if (test.expected !== undefined) console.log(`   Expected: ${test.expected}`);
            if (test.actual !== undefined) console.log(`   Actual: ${test.actual}`);
            if (test.details) console.log(`   Details: ${test.details}`);
        });
        
        const passCount = testResults.filter(t => t.passed).length;
        console.log(`\n=== ${passCount}/${testResults.length} tests passed ===`);
        
        return testResults;
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