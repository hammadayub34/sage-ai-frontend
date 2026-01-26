#!/bin/bash
# Replit Setup Script - Installs all dependencies and prepares the project

echo "=========================================="
echo "🚀 MQTT OT Network - Replit Setup"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: main.py not found. Make sure you're in the project root."
    exit 1
fi

echo "📦 Step 1: Installing Python dependencies..."
if command -v pip3 &> /dev/null; then
    pip3 install -r requirements.txt
elif command -v pip &> /dev/null; then
    pip install -r requirements.txt
else
    echo "❌ Error: pip not found. Please install Python first."
    exit 1
fi

echo ""
echo "📦 Step 2: Installing frontend dependencies..."
if [ -d "frontend" ]; then
    cd frontend
    if command -v npm &> /dev/null; then
        npm install
        cd ..
    else
        echo "❌ Error: npm not found. Please install Node.js first."
        exit 1
    fi
else
    echo "❌ Error: frontend directory not found."
    exit 1
fi

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Add all required secrets in Replit (see REPLIT_SECRETS.md)"
echo "2. Run: python main.py"
echo "   OR just click the 'Run' button in Replit"
echo ""
echo "💡 The main.py script will auto-install dependencies if needed"
echo "   and start all services automatically."
echo ""

