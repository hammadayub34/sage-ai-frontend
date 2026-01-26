#!/bin/bash
# Start mock PLC agents for all machines
# This will start machine-01, machine-02, and machine-03 in separate terminals

cd "$(dirname "$0")"

echo "🚀 Starting Mock PLC Agents for all machines..."
echo ""

# Check if we're on macOS (use osascript) or Linux (use xterm/gnome-terminal)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use osascript to open new Terminal windows
    echo "📱 Opening new Terminal windows for each machine..."
    
    osascript -e "tell application \"Terminal\" to do script \"cd '$(pwd)' && ./start_mock_plc.sh machine-01\""
    sleep 1
    
    osascript -e "tell application \"Terminal\" to do script \"cd '$(pwd)' && ./start_mock_plc.sh machine-02\""
    sleep 1
    
    osascript -e "tell application \"Terminal\" to do script \"cd '$(pwd)' && ./start_mock_plc.sh machine-03\""
    
    echo ""
    echo "✅ Started 3 mock PLC agents in separate Terminal windows"
    echo "   - machine-01"
    echo "   - machine-02"
    echo "   - machine-03"
    echo ""
    echo "💡 Make sure InfluxDB writer is running:"
    echo "   ./start_influxdb_writer.sh"
    
else
    # Linux - use xterm or gnome-terminal
    echo "📱 Starting in background (Linux)..."
    echo "   Run each in a separate terminal:"
    echo "   ./start_mock_plc.sh machine-01"
    echo "   ./start_mock_plc.sh machine-02"
    echo "   ./start_mock_plc.sh machine-03"
fi

