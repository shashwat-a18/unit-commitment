# E-Solver

**Economic Load Dispatch & Unit Commitment Optimization Tool for Power Systems**

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/demo-live-brightgreen.svg)](https://shashwat-a18.github.io/unit-commitment)

E-Solver is a web application that solves the **Unit Commitment (UC)** and **Economic Load Dispatch (ELD)** problems in power systems. It uses dynamic programming with memoization to find the optimal generator scheduling that minimizes total operating cost while meeting demand constraints across multiple time periods.

---

## About This Project

This is a **group research project** developed as part of our college curriculum in **Semester 7 of B.Tech**.

### Team Contributions

| Role | Contributor |
|------|-------------|
| **Conceptualization** | Team Members |
| **Coding & Development** | Shashwat ([@shashwat-a18](https://github.com/shashwat-a18)) |
| **Implementation** | Shashwat |
| **Research & Documentation** | Team Members |

---

## Table of Contents

- [About This Project](#about-this-project)
- [Features](#features)
- [Demo](#demo)
- [Quick Start](#quick-start)
- [Algorithm](#algorithm)
- [Multi-Period Optimization](#multi-period-optimization)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Functionality
- **FLAC-based Merit Order** - Ranks generators by Full Load Average Cost for optimal dispatch
- **Dynamic Programming Optimization** - Efficient algorithm with memoization for large-scale problems
- **Multi-Period Scheduling** - Supports 24-hour scheduling with hourly demand profiles
- **Constraint Handling** - Minimum/maximum power limits, ramp-up/down rates, min uptime/downtime

### Multi-Period Capabilities
- **24-Hour Load Profile** - Define hourly demand for complete day scheduling
- **Ramp Rate Constraints** - Limits power change between consecutive hours
- **Minimum Up/Down Time** - Enforces generator operational constraints
- **Start-up/Shut-down Costs** - Considers transition costs in optimization
- **Period-by-Period Results** - Detailed breakdown of each time period

### Visualizations
- **Bar Charts** - Generator FLAC rankings and cost breakdowns
- **Line Charts** - Load demand vs generation over time, cost trends
- **Doughnut Charts** - Power distribution and efficiency gauges
- **Radar Charts** - Generator utilization analysis
- **Time Series Charts** - Multi-period scheduling visualization

### User Experience
- **Responsive UI** - Clean design with smooth transitions
- **Data Persistence** - Save/load projects with localStorage
- **CSV Import/Export** - Bulk import generator data and load profiles
- **Mobile Friendly** - Works on all device sizes

---

## Demo

**Live Demo:** [https://shashwat-a18.github.io/unit-commitment](https://shashwat-a18.github.io/unit-commitment)

### Quick Example (Single Period)
```
Generator G1: 10-100 MW, Cost = 50 + 2.5P + 0.01P²
Generator G2: 20-150 MW, Cost = 40 + 3.0P + 0.008P²
Generator G3: 15-80 MW,  Cost = 60 + 2.0P + 0.012P²

Demand: 150 MW

Result: G3 (80 MW) + G1 (70 MW) = Rs. 625.80
```

### Multi-Period Example
```
24-Hour Load Profile:
Hour 1-6:   100 MW (Off-peak)
Hour 7-18:  200 MW (Peak)
Hour 19-24: 150 MW (Evening)

Result: Optimal scheduling with ramp constraints
Total Daily Cost: Rs. 15,240.50
```

---

## Quick Start

### Option 1: GitHub Pages (No Installation)
Visit the [live demo](https://shashwat-a18.github.io/unit-commitment) directly.

### Option 2: Local Development
```bash
# Clone the repository
git clone https://github.com/shashwat-a18/unit-commitment.git
cd unit-commitment

# Start a local server
python -m http.server 8080

# Open in browser
# http://localhost:8080
```

### Option 3: Direct File
Simply open `index.html` in any modern web browser.

---

## Algorithm

### Cost Function
The operating cost of a generator is modeled as a quadratic function:

**C(P) = Ai + Bi * P + Di * P²**

Where:
- **Ai** = Fixed cost (Rs.) - fuel startup, maintenance
- **Bi** = Linear cost coefficient (Rs./MW)
- **Di** = Quadratic cost coefficient (Rs./MW²)
- **P** = Power output (MW)

### Full Load Average Cost (FLAC)
Generators are ranked by FLAC for merit order dispatch:

**FLAC = Ai/Pmax + Bi + Di * Pmax**

Lower FLAC = Higher priority for dispatch.

### Single Period Optimization
```
1. Sort generators by FLAC (ascending)
2. Use dynamic programming to find optimal power levels
3. Apply constraints: Pgmin <= P <= Pgmax
4. Return minimum cost schedule
```

---

## Multi-Period Optimization

### Problem Formulation
The multi-period unit commitment problem minimizes total cost over T time periods:

**Minimize: Sum over t=1 to T of [Sum over i=1 to N of (Ci(Pi,t) * Ui,t + SUi * Si,t + SDi * Di,t)]**

Subject to:
- **Power Balance:** Sum of Pi,t * Ui,t = Dt for all t
- **Generation Limits:** Pgmin,i * Ui,t <= Pi,t <= Pgmax,i * Ui,t
- **Ramp Up:** Pi,t - Pi,t-1 <= RUi
- **Ramp Down:** Pi,t-1 - Pi,t <= RDi
- **Minimum Up Time:** Sum of Ui,k for k=t to t+MUTi-1 >= MUTi * Si,t
- **Minimum Down Time:** Sum of (1-Ui,k) for k=t to t+MDTi-1 >= MDTi * Di,t

### Algorithm Steps
```
1. Initialize 24-hour demand profile
2. For each time period t:
   a. Apply ramp constraints from period t-1
   b. Check minimum up/down time constraints
   c. Solve economic dispatch for feasible generators
   d. Add start-up/shut-down costs if state changed
3. Return optimal schedule with total cost
```

### Ramp Rate Handling
```
Available Range at time t:
  Min: max(Pgmin, P(t-1) - RampDown)
  Max: min(Pgmax, P(t-1) + RampUp)
```

---

## Usage Guide

### 1. Define Generators

| Parameter | Description | Unit |
|-----------|-------------|------|
| Tag | Generator identifier | - |
| Pgmin | Minimum power output | MW |
| Pgmax | Maximum power output | MW |
| Ai | Fixed cost coefficient | Rs. |
| Bi | Linear cost coefficient | Rs./MW |
| Di | Quadratic cost coefficient | Rs./MW² |
| Ramp Up | Maximum ramp-up rate | MW/hr |
| Ramp Down | Maximum ramp-down rate | MW/hr |
| Min Up Time | Minimum hours ON | hours |
| Min Down Time | Minimum hours OFF | hours |
| Start-up Cost | Cost to start generator | Rs. |
| Shut-down Cost | Cost to stop generator | Rs. |

### 2. Define Load Profile (Multi-Period)

| Hour | Demand (MW) |
|------|-------------|
| 1 | 100 |
| 2 | 95 |
| ... | ... |
| 24 | 110 |

### 3. Run Optimization
1. Enter generator parameters
2. Choose single-period or multi-period mode
3. Specify demand or load profile
4. Click "Optimize"
5. View results and charts

### 4. CSV Import Format

**Generators:**
```csv
Tag,Pgmin,Pgmax,Ai,Bi,Di,RampUp,RampDown
G1,10,100,50,2.5,0.01,20,20
G2,20,150,40,3.0,0.008,25,25
G3,15,80,60,2.0,0.012,15,15
```

**Load Profile:**
```csv
Hour,Demand
1,100
2,95
3,90
...
24,110
```

---

## API Reference

### UnitCommitmentApp Class

```javascript
// Initialize the application
const app = new UnitCommitmentApp();

// Configuration
UnitCommitmentApp.CONFIG = {
    DEMAND_TOLERANCE_PERCENT: 0.005,  // 0.5% tolerance
    DEMAND_TOLERANCE_MIN_MW: 1.0,     // Minimum 1 MW
    POWER_STEP_SIZE: 1.0,             // 1 MW resolution
    MAX_GENERATORS: 10,               // Maximum generators
    MAX_TIME_PERIODS: 24,             // Maximum hours
    ANIMATION_DURATION: 1500,         // Chart animations (ms)
};
```

### Key Methods
- `optimizeSinglePeriod(demand)` - Single period economic dispatch
- `optimizeMultiPeriod(loadProfile)` - Multi-period unit commitment
- `calculateFLAC(generator)` - Compute Full Load Average Cost
- `applyRampConstraints(prevPower, generator)` - Get feasible power range

---

## Testing

### Run Test Suite
```bash
node test.js
```

### Test Results (15/15 Passing)

| Test | Expected | Status |
|------|----------|--------|
| FLAC Order | G3 < G1 < G2 | Pass |
| System Range | 10-330 MW | Pass |
| 50 MW Optimization | G3 at 50 MW | Pass |
| 150 MW Optimization | G3+G1 | Pass |
| 250 MW Optimization | G3+G1+G2 | Pass |
| 330 MW Max Capacity | All generators | Pass |
| Over Capacity (400 MW) | Rejected | Pass |
| Zero Demand | Handled | Pass |
| Ramp Constraints | Applied correctly | Pass |
| Multi-Period Continuity | Verified | Pass |

---

## Project Structure

```
e-solver/
├── index.html          # Main HTML file
├── app.js              # Core application logic (3,500+ lines)
│   ├── UnitCommitmentApp class
│   ├── CONFIG constants
│   ├── Single-period optimization
│   ├── Multi-period optimization
│   ├── Chart creation methods
│   └── Event handlers
├── styles.css          # CSS with animations
├── test.js             # Comprehensive test suite
├── _config.yml         # GitHub Pages config
└── README.md           # Documentation
```

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| JavaScript | ES6+ | Core logic |
| Chart.js | 4.4.0 | Visualizations |
| Font Awesome | 6.4.0 | Icons |
| Google Fonts | Inter | Typography |
| GitHub Pages | - | Hosting |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/improvement`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

## Developer

**Shashwat** - [@shashwat-a18](https://github.com/shashwat-a18)

Coding and development by Shashwat as part of B.Tech Semester 7 Research Project.

---

<p align="center">
  <strong>B.Tech Semester 7 Research Project</strong><br>
  E-Solver Team
</p>
