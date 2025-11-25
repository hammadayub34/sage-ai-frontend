#!/bin/bash
# Start Mock PLC Agent
# Usage: ./start_mock_plc.sh [machine-id]
# Example: ./start_mock_plc.sh machine-01

MACHINE_ID=${1:-machine-01}

cd /Users/khanhamza/mqtt-ot-network

export MACHINE_ID=$MACHINE_ID
export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=8883
export MQTT_USERNAME=edge_gateway
export MQTT_PASSWORD=edge_gateway_pass
export MQTT_TLS_ENABLED=true
export MQTT_TLS_CHECK_HOSTNAME=false
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export CLIENT_CERT_PATH=mosquitto/config/certs/client.crt
export CLIENT_KEY_PATH=mosquitto/config/certs/client.key

echo "🚀 Starting Mock PLC Agent..."
echo "   Machine ID: $MACHINE_ID"
echo "   Publishing to: plc/$MACHINE_ID/bottlefiller/data"
echo ""

python3 mock_plc_agent/mock_plc_agent.py

