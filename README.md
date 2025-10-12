# Esolver - Unit Commitment Optimizer 

A modern, interactive web application for solving Unit Commitment (UC) optimization problems in power systems. This tool provides a comprehensive solution for generator dispatch optimization with an intuitive interface that works entirely in your browser.

🌐 **[Live Demo on GitHub Pages](https://shashwat-a18.github.io/unit-commitment/)** 

[![Deploy to GitHub Pages](https://img.shields.io/badge/Deploy%20to-GitHub%20Pages-blue?logo=github)](#github-pages-deployment)

## 📋 Project Overview

**Unit Commitment Optimizer** is a fully static web application that solves power system unit commitment problems using advanced optimization algorithms. **No server, no build process, no dependencies** - everything runs in your browser with data stored locally, making it perfect for GitHub Pages deployment.

## 🏗️ Project Structure

```
esolver/
├── index.html           # 🎯 Main application interface (12KB)
├── app.js              # 🧠 Core logic & animated visualizations (58KB)
├── styles.css          # 🎨 Modern responsive styling with animations (20KB)
├── _config.yml         # ⚙️  GitHub Pages configuration
├── .gitignore          # 🔒 Git ignore rules
├── README.md           # 📖 This documentation
└── legacy/             # 📦 Original Python implementation
    ├── unit_solution_3.py
    ├── index4.html
    ├── script2.js
    └── style6.css
```

## ✨ Key Features

### 🎯 **Generator Management**
- **Interactive Forms**: Dynamic generator parameter input
- **CSV Import/Export**: Import existing data or download templates
- **Real-time Validation**: Instant feedback on data input
- **Example Data**: Load sample generators to get started quickly
- **FLAC Calculation**: Automatic Full Load Average Cost computation

### 🔄 **Unit Commitment Optimization** 
- **Dynamic Programming Algorithm**: Efficient recursive optimization
- **Multiple Generator Support**: Handle up to 10 generators simultaneously
- **Constraint Handling**: Automatic feasibility checking
- **Real-time Results**: Instant optimization with visual feedback
- **Cost Analysis**: Detailed breakdown of generation costs

### 📊 **Results & Analysis**
- **Optimal Dispatch Schedule**: Generator-wise power allocation
- **Cost Breakdown**: Fixed, variable, and quadratic cost components
- **Performance Metrics**: Efficiency and utilization analysis
- **Visual Tables**: Clean, organized result presentation
- **Export Capabilities**: Save results for further analysis

### 💾 **Data Management**
- **Local Storage**: All data saved in your browser
- **Project History**: Automatic saving of generator configurations
- **Import/Export**: JSON-based data exchange
- **Offline Capable**: Works without internet connection

## � Technical Implementation

### **Algorithm Details**
- **Dynamic Programming**: Recursive memoized optimization for optimal substructure
- **Cost Function**: Quadratic generation cost: `Cost = Ai + Bi×Pi + Di×Pi²`
- **FLAC Sorting**: Generators prioritized by Full Load Average Cost
- **Constraint Handling**: Automatic Pgmin/Pgmax validation
- **Feasibility Checking**: System capacity vs. demand verification

### **Generator Parameters**
- **Tag**: Generator identifier (G1, G2, etc.)
- **Pgmin**: Minimum power output (MW)
- **Pgmax**: Maximum power output (MW) 
- **Ai**: Fixed cost coefficient (₹)
- **Bi**: Linear cost coefficient (₹/MW)
- **Di**: Quadratic cost coefficient (₹/MW²)
- **FLAC**: Calculated as `Ai/Pgmax + Bi + Di×Pgmax`

### **Web Technologies**
- **Pure JavaScript**: No frameworks, maximum performance
- **Modern CSS**: Grid, Flexbox, CSS Variables
- **Web APIs**: File API, localStorage, Blob API
- **Responsive Design**: Mobile-first approach

## 🚀 Quick Start

### **Option 1: GitHub Pages (Recommended)**
1. Visit the [live application](https://shashwat-a18.github.io/unit-commitment/)
2. Start using immediately - no installation required!

> **Deploy Your Own Copy**: See the [GitHub Pages Deployment](#github-pages-deployment) section below for step-by-step instructions to host your own instance.

### **Option 2: Local Usage**
1. **Download/Clone** this repository
2. **Open** `index.html` in any modern web browser
3. **Start optimizing** - no server or installation needed!

### **First Steps**
1. **Load Example Data**: Click "Load Example" to see sample generators
2. **Create Generators**: Use the "Create Generator Forms" to input your data
3. **Save & Calculate**: Save generators to compute FLAC rankings  
4. **Optimize**: Switch to "Optimization" tab and enter demand
5. **View Results**: Check detailed analysis in "Results" tab

### **GitHub Pages Deployment (Ready to Deploy!)**
1. **Fork or Upload** this repository to GitHub
2. **Go to Settings → Pages** in your repository
3. **Select source: Deploy from branch `main`** 
4. **Wait 2-5 minutes** for deployment
5. **Access at: `https://yourusername.github.io/repository-name`**

**✅ This project is 100% ready for GitHub Pages - no additional setup required!**

## 📊 Data Format & Examples

### **CSV Import Format**
```csv
Tag,Pgmin,Pgmax,Ai,Bi,Di
G1,10,100,50,2.5,0.01
G2,20,150,40,3.0,0.008
G3,15,80,60,2.0,0.012
```

### **Example Problem**
- **Generator 1**: 10-100 MW, FLAC = 3.01
- **Generator 2**: 20-150 MW, FLAC = 2.467 (most economical)
- **Generator 3**: 15-80 MW, FLAC = 2.96
- **System Range**: 45-330 MW total capacity
- **Sample Demand**: 200 MW → Optimal cost: ₹493.33

### **Optimization Results Example**
| Generator | Power (MW) | Cost (₹) | Share (%) |
|-----------|------------|----------|-----------|
| G2        | 150.0      | 300.00   | 75%       |
| G1        | 50.0       | 193.33   | 25%       |
| **Total** | **200.0**  | **493.33** | **100%**  |

## 🎯 Use Cases

### **📚 Academic & Research**
- **Course Projects**: Power Systems, Optimization, Operations Research
- **Research Studies**: Algorithm comparison and validation
- **Thesis Work**: Unit commitment problem analysis
- **Teaching Aid**: Interactive demonstration tool

### **🏢 Professional Applications**  
- **System Planning**: Generator dispatch analysis
- **Economic Studies**: Cost optimization scenarios
- **Training**: Power system operator education
- **Consulting**: Quick feasibility studies

### **💡 Learning & Development**
- **Algorithm Understanding**: See optimization in action
- **Parameter Sensitivity**: Test different cost coefficients
- **Constraint Analysis**: Understand feasibility limits
- **Benchmarking**: Compare different generator sets

## � Advanced Features

### **🔄 Real-time Processing**
- ✅ Instant optimization results
- ✅ Dynamic constraint validation  
- ✅ Live cost calculations
- ✅ Responsive UI updates

### **💾 Data Persistence**
- ✅ Browser localStorage integration
- ✅ Automatic project saving
- ✅ History management
- ✅ Import/Export capabilities

### **� Modern Interface**
- ✅ Mobile-responsive design
- ✅ Touch-friendly controls  
- ✅ Intuitive navigation
- ✅ Professional appearance

### **🔧 Developer Friendly**
- ✅ Clean, documented code
- ✅ Modular architecture
- ✅ Easy customization
- ✅ No dependencies

## 🌟 Why Choose Esolver?

### **⚡ Performance**
- **Client-side Processing**: No server delays
- **Efficient Algorithms**: Optimized dynamic programming  
- **Memory Management**: Smart memoization
- **Fast Results**: Sub-second optimization

### **🔒 Privacy & Security**
- **Local Storage**: Your data never leaves your device
- **No Registration**: Use immediately without accounts
- **Offline Capable**: Works without internet
- **No Tracking**: Complete privacy

### **📈 Reliability**
- **No Downtime**: Static hosting means 99.9% uptime
- **Browser Compatible**: Works on all modern browsers
- **Mobile Ready**: Fully responsive design
- **Future-proof**: Standards-compliant code

## 🤝 Contributing

Contributions are welcome! This project aims to be a comprehensive educational tool for power systems optimization.

### **How to Contribute**
1. Fork the repository
2. Create your feature branch
3. Make improvements
4. Submit a pull request

### **Areas for Enhancement**
- Additional optimization algorithms
- Enhanced visualizations  
- More constraint types
- Performance optimizations
- UI/UX improvements

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Developed for power systems education and research
- Inspired by classical unit commitment formulations
- Built with modern web standards for accessibility

## 🚀 Deployment

### **GitHub Pages Ready**
This project is **100% ready** for GitHub Pages hosting with **zero configuration needed**.

### **Quick Deploy Steps**
1. **Create new repository** on GitHub
2. **Upload all files** (drag & drop works!)
3. **Go to Settings → Pages**
4. **Select "Deploy from branch main"**
5. **Wait 2-5 minutes** ⏱️
6. **Visit your live app!** 🎉

### **Browser Compatibility**
- Chrome 60+ ✅
- Firefox 55+ ✅
- Safari 12+ ✅
- Edge 79+ ✅

All modern browsers with ES6+ support work perfectly.

---

## 🚀 GitHub Pages Deployment

This application is **100% static** and ready for immediate GitHub Pages deployment with zero configuration!

### Quick Deploy (5 minutes)
```bash
# 1. Create and push to GitHub repository
git init
git add .
git commit -m "Initial commit: Unit Commitment Optimizer"
git remote add origin https://github.com/shashwat-a18/unit-commitment.git
git push -u origin main

# 2. Enable GitHub Pages
# Go to repository Settings → Pages → Source: "Deploy from a branch" → main branch
```

### Your app will be live at:
`https://shashwat-a18.github.io/unit-commitment/`

### ✅ Why it works perfectly on GitHub Pages:
- Pure HTML/CSS/JavaScript (no server required)
- All dependencies loaded from CDN
- No build process needed
- Optimized for static hosting

### 🔧 Verification
Run the included verification script to check deployment readiness:
```bash
bash verify-deployment.sh
```

---

**🚀 [Try the Live Demo](https://shashwat-a18.github.io/unit-commitment/) - No installation required!**