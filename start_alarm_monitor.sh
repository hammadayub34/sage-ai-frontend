#!/bin/bash
# Start Alarm Monitor

cd /Users/khanhamza/mqtt-ot-network

export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=1883  # Use 1883 for non-TLS (local dev) - overrides .env
export MQTT_TOPIC="plc/+/bottlefiller/alarms"
export MQTT_USERNAME=influxdb_writer
export MQTT_PASSWORD=influxdb_writer_pass
export MQTT_TLS_ENABLED=false  # Disable TLS for local dev - overrides .env
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export MQTT_TLS_CHECK_HOSTNAME=false
export ALARM_EVENTS_FILE=/tmp/alarm_events.json

echo "🚨 Starting Alarm Monitor..."
python3 alarm_monitor/alarm_monitor.py

