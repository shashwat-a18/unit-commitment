#!/bin/bash

# GitHub Pages Deployment Verification Script
# This script checks if your project is ready for GitHub Pages deployment

echo "🚀 GitHub Pages Deployment Verification"
echo "======================================="

# Check if required files exist
echo "📁 Checking required files..."

if [ -f "index.html" ]; then
    echo "✅ index.html found"
else
    echo "❌ index.html missing - required for GitHub Pages"
    exit 1
fi

if [ -f "app.js" ]; then
    echo "✅ app.js found"
else
    echo "❌ app.js missing"
    exit 1
fi

if [ -f "styles.css" ]; then
    echo "✅ styles.css found"
else
    echo "❌ styles.css missing"
    exit 1
fi

if [ -f "_config.yml" ]; then
    echo "✅ _config.yml found (GitHub Pages config)"
else
    echo "⚠️  _config.yml missing (optional but recommended)"
fi

# Check HTML structure
echo ""
echo "🔍 Checking HTML structure..."
if grep -q "<!DOCTYPE html>" index.html; then
    echo "✅ Valid HTML5 doctype"
else
    echo "❌ Missing HTML5 doctype"
fi

if grep -q "charset.*UTF-8" index.html; then
    echo "✅ UTF-8 charset specified"
else
    echo "⚠️  UTF-8 charset not found"
fi

# Check CDN dependencies
echo ""
echo "🌐 Checking CDN dependencies..."
if grep -q "cdn.jsdelivr.net/npm/chart.js" index.html; then
    echo "✅ Chart.js CDN linked"
else
    echo "❌ Chart.js CDN missing"
fi

if grep -q "cdnjs.cloudflare.com.*font-awesome" index.html; then
    echo "✅ Font Awesome CDN linked"
else
    echo "⚠️  Font Awesome CDN not found"
fi

# Check for relative paths (good for GitHub Pages)
echo ""
echo "📂 Checking file references..."
if grep -q 'src="app.js"' index.html; then
    echo "✅ Relative path to app.js"
else
    echo "❌ app.js not properly linked"
fi

if grep -q 'href="styles.css"' index.html; then
    echo "✅ Relative path to styles.css"
else
    echo "❌ styles.css not properly linked"
fi

# Check JavaScript syntax (basic check)
echo ""
echo "🔧 Basic JavaScript syntax check..."
if node -c app.js 2>/dev/null; then
    echo "✅ JavaScript syntax appears valid"
else
    echo "⚠️  JavaScript syntax check failed (install Node.js for full validation)"
fi

echo ""
echo "🎉 Deployment verification complete!"
echo ""
echo "📋 Next steps:"
echo "1. Initialize git repository: git init"
echo "2. Add files: git add ."
echo "3. Commit: git commit -m 'Initial commit'"
echo "4. Create GitHub repository and push"
echo "5. Enable GitHub Pages in repository settings"
echo ""
echo "📖 For detailed instructions, see README.md GitHub Pages section"