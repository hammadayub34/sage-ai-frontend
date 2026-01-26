#!/bin/bash
# Start Mock PLC Agent with JSON output enabled
# Usage: start_mock_plc_debug.sh [machine-01] [print|save|both]

MACHINE_ID=${1:-machine-01}
MODE=${2:-both}  # print, save, or both

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Set machine ID
export MACHINE_ID="$MACHINE_ID"

# Set output options based on mode
if [ "$MODE" == "print" ] || [ "$MODE" == "both" ]; then
    export PRINT_JSON_DATA=true
    echo "✅ JSON printing enabled"
fi

if [ "$MODE" == "save" ] || [ "$MODE" == "both" ]; then
    export SAVE_JSON_DATA=true
    export JSON_OUTPUT_FILE="/tmp/mock_plc_data_${MACHINE_ID}.json"
    echo "✅ JSON saving enabled: $JSON_OUTPUT_FILE"
fi

echo "🚀 Starting Mock PLC Agent for $MACHINE_ID (Debug Mode)..."
echo "   Working directory: $(pwd)"
echo "   Mode: $MODE"
echo ""

# Use python3 or python depending on what's available
if command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
elif command -v python &> /dev/null; then
    PYTHON_CMD=python
else
    echo "❌ Error: Python not found!"
    exit 1
fi

$PYTHON_CMD mock_plc_agent/mock_plc_agent.py

