#!/bin/bash
# Start MQTT Data Viewer for debugging
# Works with production setup (TLS on port 8883)

cd "$(dirname "$0")"

echo "🔍 Starting MQTT Data Viewer..."
echo ""
echo "This will show all MQTT messages being published by Mock PLC Agents"
echo "and received by the InfluxDB Writer."
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Use production settings (same as InfluxDB Writer and Mock PLC Agent)
export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=8883
export MQTT_TLS_ENABLED=true
export MQTT_USERNAME=influxdb_writer
export MQTT_PASSWORD=influxdb_writer_pass
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export MQTT_TLS_CHECK_HOSTNAME=false
export MQTT_TOPIC=plc/+/bottlefiller/#  # Subscribe to all machines

python3 data_viewer/mqtt_subscriber.py

