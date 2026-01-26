#!/bin/bash
# Simple script to start Mock PLC Agent
# Run this to start data generation
# Usage: start_mock_plc.sh [machine-01]

MACHINE_ID=${1:-machine-01}

# Get script directory (works in both local and Replit)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Set machine ID as environment variable
export MACHINE_ID="$MACHINE_ID"

echo "🚀 Starting Mock PLC Agent for $MACHINE_ID..."
echo "   Working directory: $(pwd)"
echo "   Machine ID: $MACHINE_ID"

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
