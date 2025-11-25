#!/bin/bash
# Restart Python services after Docker is running

echo "🔄 Restarting services..."
echo ""

# Stop existing services
echo "📝 Stopping existing services..."
pkill -f "influxdb_writer_production.py|mock_plc_agent.py" 2>/dev/null
sleep 2

# Start InfluxDB Writer in background
echo "📝 Starting InfluxDB Writer..."
cd /Users/khanhamza/mqtt-ot-network
nohup ./start_influxdb_writer.sh > /tmp/influxdb_writer.log 2>&1 &
echo "   ✅ Started (check /tmp/influxdb_writer.log for output)"

# Start Mock PLC Agent in background
echo "📝 Starting Mock PLC Agent (machine-01)..."
nohup ./start_mock_plc.sh machine-01 > /tmp/mock_plc.log 2>&1 &
echo "   ✅ Started (check /tmp/mock_plc.log for output)"

sleep 3

# Check if they're running
if ps aux | grep -q "influxdb_writer_production.py" | grep -v grep; then
    echo "   ✅ InfluxDB Writer is running"
else
    echo "   ⚠️  InfluxDB Writer may not have started"
fi

if ps aux | grep -q "mock_plc_agent.py" | grep -v grep; then
    echo "   ✅ Mock PLC Agent is running"
else
    echo "   ⚠️  Mock PLC Agent may not have started"
fi

echo ""
echo "✅ Services restarted!"
echo ""
echo "💡 To check logs:"
echo "   tail -f /tmp/influxdb_writer.log"
echo "   tail -f /tmp/mock_plc.log"
echo ""
echo "💡 To check data:"
echo "   python3 check_influxdb_data.py"

