#!/bin/bash
# Simple script to start CNC Lathe Simulator
# Usage: start_lathe_sim.sh [lathe01]

# Determine the Python command
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Error: Neither 'python3' nor 'python' command found."
    exit 1
fi

# Default machine ID if not provided
LATHE_MACHINE_ID=${1:-lathe01}

# Set environment variables for the Python script
# Note: These explicitly override .env file values for local development
export LATHE_MACHINE_ID="$LATHE_MACHINE_ID"
export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=1883  # Use 1883 for non-TLS (local dev) - overrides .env
export MQTT_USERNAME=${MQTT_USERNAME:-mock_plc_agent}
export MQTT_PASSWORD=${MQTT_PASSWORD:-mock_plc_agent_pass}
export MQTT_TLS_ENABLED=false  # Disable TLS for local dev - overrides .env
export CA_CERT_PATH=${CA_CERT_PATH:-mosquitto/config/certs/ca.crt}
export MQTT_TLS_CHECK_HOSTNAME=false  # Disable for localhost

echo "🚀 Starting CNC Lathe Simulator for $LATHE_MACHINE_ID..."
echo "   Working directory: $(pwd)"
echo "   Machine ID: $LATHE_MACHINE_ID"

# Run the Python script in the background and log its output
# Use nohup to ensure it keeps running after terminal closes
# Redirect stdout and stderr to a log file
nohup $PYTHON_CMD lathe_sim/lathe_sim.py > "/tmp/lathe_sim_${LATHE_MACHINE_ID}.log" 2>&1 &

echo "✅ CNC Lathe Simulator started. Check logs: tail -f /tmp/lathe_sim_${LATHE_MACHINE_ID}.log"
echo "   PID: $!" # Print PID of the background process

