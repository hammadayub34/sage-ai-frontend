#!/bin/bash
# Start InfluxDB Writer Service

cd /Users/khanhamza/mqtt-ot-network

export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=1883
export MQTT_USERNAME=influxdb_writer
export MQTT_PASSWORD=influxdb_writer_pass
export MQTT_TLS_ENABLED=false
export MQTT_TLS_CHECK_HOSTNAME=false
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=my-super-secret-auth-token
export INFLUXDB_ORG=myorg
export INFLUXDB_BUCKET=plc_data_new

echo "🚀 Starting InfluxDB Writer..."
echo "   Subscribing to: plc/+/bottlefiller/data (all machines)"
echo "   Writing to: InfluxDB at http://localhost:8086"
echo ""

python3 influxdb_writer/influxdb_writer_production.py

