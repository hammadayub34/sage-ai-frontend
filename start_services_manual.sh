#!/bin/bash
# Manual service startup script for Replit
# Run this if Python is available

echo "=== Checking Environment ==="
echo "Python commands:"
which python python3 2>/dev/null || echo "❌ Python not found in PATH"
echo ""
echo "Pip commands:"
which pip pip3 2>/dev/null || echo "❌ Pip not found in PATH"
echo ""
echo "Node commands:"
which node npm 2>/dev/null || echo "❌ Node not found"
echo ""

# Try to find Python
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ ERROR: Python not found!"
    echo ""
    echo "💡 Solutions:"
    echo "1. Make sure your Repl is set to 'Python' language"
    echo "2. Or create a new Python Repl and import from GitHub"
    echo "3. Or check Replit settings to ensure Python is installed"
    exit 1
fi

echo "✅ Found Python: $PYTHON_CMD"
echo ""

# Check dependencies
echo "=== Checking Dependencies ==="
if ! $PYTHON_CMD -c "import paho.mqtt.client" 2>/dev/null; then
    echo "📥 Installing Python dependencies..."
    pip install -r requirements.txt
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📥 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "=== Starting Services ==="
echo ""

# Start InfluxDB Writer
echo "🚀 Starting InfluxDB Writer..."
$PYTHON_CMD influxdb_writer/influxdb_writer_production.py > /tmp/influxdb_writer.log 2>&1 &
INFLUXDB_PID=$!
echo "✅ InfluxDB Writer started (PID: $INFLUXDB_PID)"
echo "   Logs: tail -f /tmp/influxdb_writer.log"

sleep 2

# Start Mock PLC Agent
echo "🚀 Starting Mock PLC Agent..."
$PYTHON_CMD mock_plc_agent/mock_plc_agent.py > /tmp/mock_plc_agent.log 2>&1 &
PLC_PID=$!
echo "✅ Mock PLC Agent started (PID: $PLC_PID)"
echo "   Logs: tail -f /tmp/mock_plc_agent.log"

sleep 2

# Start Frontend
echo "🚀 Starting Frontend..."
cd frontend && npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo "✅ Frontend started (PID: $FRONTEND_PID)"
echo "   Logs: tail -f /tmp/frontend.log"

echo ""
echo "=========================================="
echo "✅ All services started!"
echo "=========================================="
echo ""
echo "📊 Check status:"
echo "   ps aux | grep -E '(influxdb_writer|mock_plc_agent|node)' | grep -v grep"
echo ""
echo "📝 View logs:"
echo "   tail -f /tmp/influxdb_writer.log"
echo "   tail -f /tmp/mock_plc_agent.log"
echo "   tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop:"
echo "   kill $INFLUXDB_PID $PLC_PID $FRONTEND_PID"

