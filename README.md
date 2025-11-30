# ⚡ E-Solver

> **Economic Load Dispatch & Unit Commitment Optimization Tool for Power Systems**

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/demo-live-brightgreen.svg)](https://shashwat-a18.github.io/unit-commitment)

E-Solver is a modern web application that solves the **Unit Commitment (UC)** and **Economic Load Dispatch (ELD)** problems in power systems. It uses dynamic programming with memoization to find the optimal generator scheduling that minimizes total operating cost while meeting demand constraints.

---

## ��� About This Project

This is a **group research project** developed as part of our college curriculum in **Semester 7 of B.Tech**. 

### Team Contributions

| Role | Contributor |
|------|-------------|
| **Coding & Development** | Shashwat ([@shashwat-a18](https://github.com/shashwat-a18)) |
| **Concept & Implementation** | Shashwat |
| **Research & Documentation** | Team Members |

> ��� The complete coding and concept implementation was handled by **Shashwat**.

---

## ��� Table of Contents

- [About This Project](#-about-this-project)
- [Features](#-features)
- [Demo](#-demo)
- [Quick Start](#-quick-start)
- [Algorithm](#-algorithm)
- [Usage Guide](#-usage-guide)
- [API Reference](#-api-reference)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Functionality
- **FLAC-based Merit Order** - Ranks generators by Full Load Average Cost for optimal dispatch
- **Dynamic Programming Optimization** - Efficient algorithm with memoization for large-scale problems
- **Multi-Period Scheduling** - Supports 24-hour scheduling with ramp rate constraints
- **Constraint Handling** - Minimum/maximum power limits, ramp-up/down rates, min uptime/downtime

### Visualizations
- ��� **Bar Charts** - Generator FLAC rankings and cost breakdowns
- ��� **Line Charts** - Load demand vs generation, cost trends
- ��� **Doughnut Charts** - Power distribution and efficiency gauges
- ��� **Radar Charts** - Generator utilization analysis
- ��� **Smooth Animations** - 29 CSS keyframes, elastic/bounce effects

### User Experience
- ��� **Modern UI** - Clean, responsive design with 70+ transitions
- ��� **Data Persistence** - Save/load projects with localStorage
- ��� **CSV Import/Export** - Bulk import generator data
- ��� **Mobile Friendly** - Works on all device sizes

---

## ��� Demo

**Live Demo:** [https://shashwat-a18.github.io/unit-commitment](https://shashwat-a18.github.io/unit-commitment)

### Quick Example
```
Generator G1: 10-100 MW, Cost = 50 + 2.5P + 0.01P²
Generator G2: 20-150 MW, Cost = 40 + 3.0P + 0.008P²
Generator G3: 15-80 MW,  Cost = 60 + 2.0P + 0.012P²

Demand: 150 MW

Result: G3 (80 MW) + G1 (70 MW) = ₹625.80
```

---

## ��� Quick Start

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

## ��� Algorithm

### Cost Function
The operating cost of a generator is modeled as a quadratic function:

**C(P) = Aᵢ + Bᵢ × P + Dᵢ × P²**

Where:
- **Aᵢ** = Fixed cost (₹) - fuel startup, maintenance
- **Bᵢ** = Linear cost coefficient (₹/MW)
- **Dᵢ** = Quadratic cost coefficient (₹/MW²)
- **P** = Power output (MW)

### Full Load Average Cost (FLAC)
Generators are ranked by FLAC for merit order dispatch:

**FLAC = Aᵢ/Pₘₐₓ + Bᵢ + Dᵢ × Pₘₐₓ**

Lower FLAC = Higher priority for dispatch.

### Optimization Algorithm
```
1. Sort generators by FLAC (ascending)
2. Use dynamic programming to find optimal power levels
3. Apply constraints:
   - Pgmin ≤ P ≤ Pgmax
   - Ramp-up/down limits (multi-period)
   - Minimum up/down time
4. Return minimum cost schedule
```

---

## ��� Usage Guide

### 1. Define Generators

| Parameter | Description | Unit |
|-----------|-------------|------|
| `Tag` | Generator identifier | - |
| `Pgmin` | Minimum power output | MW |
| `Pgmax` | Maximum power output | MW |
| `Ai` | Fixed cost coefficient | ₹ |
| `Bi` | Linear cost coefficient | ₹/MW |
| `Di` | Quadratic cost coefficient | ₹/MW² |
| `Ramp Up` | Maximum ramp-up rate | MW/hr |
| `Ramp Down` | Maximum ramp-down rate | MW/hr |

### 2. Run Optimization
1. Enter generator parameters
2. Specify demand (MW)
3. Click "Optimize"
4. View results and charts

### 3. CSV Import Format
```csv
Tag,Pgmin,Pgmax,Ai,Bi,Di
G1,10,100,50,2.5,0.01
G2,20,150,40,3.0,0.008
G3,15,80,60,2.0,0.012
```

---

## ��� API Reference

### UnitCommitmentApp Class

```javascript
// Initialize the application
const app = new UnitCommitmentApp();

// Configuration available at
UnitCommitmentApp.CONFIG = {
    DEMAND_TOLERANCE_PERCENT: 0.005,  // 0.5% tolerance
    DEMAND_TOLERANCE_MIN_MW: 1.0,     // Minimum 1 MW
    POWER_STEP_SIZE: 1.0,             // 1 MW resolution
    MAX_GENERATORS: 10,               // Maximum generators
    ANIMATION_DURATION: 1500,         // Chart animations (ms)
};
```

---

## ��� Testing

### Run Test Suite
```bash
node test.js
```

### Test Results (15/15 Passing)
| Test | Expected | Status |
|------|----------|--------|
| FLAC Order | G3 < G1 < G2 | ✅ |
| System Range | 10-330 MW | ✅ |
| 50 MW Optimization | G3 at 50 MW = ₹220 | ✅ |
| 150 MW Optimization | G3+G1 = ₹625.80 | ✅ |
| 250 MW Optimization | G3+G1+G2 = ₹1,059 | ✅ |
| 330 MW Max Capacity | All generators | ✅ |
| Over Capacity (400 MW) | Rejected | ✅ |
| Zero Demand | Handled | ✅ |

---

## ��� Project Structure

```
e-solver/
├── index.html          # Main HTML file (285 lines)
├── app.js              # Core application logic (3,500+ lines)
│   ├── UnitCommitmentApp class
│   ├── CONFIG constants
│   ├── Optimization algorithms
│   ├── Chart creation methods
│   └── Event handlers
├── styles.css          # CSS with animations (1,800+ lines)
│   ├── 29 @keyframes animations
│   ├── 17 CSS variables
│   └── Responsive breakpoints
├── test.js             # Comprehensive test suite
├── _config.yml         # GitHub Pages config
└── README.md           # Documentation
```

---

## ���️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| JavaScript | ES6+ | Core logic |
| Chart.js | 4.4.0 | Visualizations |
| Font Awesome | 6.4.0 | Icons |
| Google Fonts | Inter | Typography |
| GitHub Pages | - | Hosting |

---

## ��� Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## ��� License

This project is licensed under the MIT License.

---

## ���‍��� Developer

**Shashwat** - [@shashwat-a18](https://github.com/shashwat-a18)

*Complete coding and concept implementation by Shashwat as part of B.Tech Semester 7 Research Project.*

---

<p align="center">
  <strong>��� B.Tech Semester 7 Research Project</strong><br>
  Made with ⚡ by E-Solver Team
</p>
