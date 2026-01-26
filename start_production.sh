#!/bin/bash
# Start Production MQTT-OT Network System

set -e

echo "🚀 Starting MQTT-OT Network Production System"
echo "=============================================="

# Step 1: Start Docker services
echo ""
echo "📦 Step 1: Starting Docker services..."
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Verify services
echo ""
echo "✅ Checking services..."
docker ps --filter "name=mqtt-broker-production\|influxdb-production\|grafana-production" --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "✅ Services started!"
echo ""
echo "📋 Next steps:"
echo "   1. Start InfluxDB Writer in Terminal 1:"
echo "      cd /Users/khanhamza/mqtt-ot-network"
echo "      export MQTT_BROKER_HOST=localhost MQTT_BROKER_PORT=8883 MQTT_USERNAME=influxdb_writer MQTT_PASSWORD=influxdb_writer_pass MQTT_TLS_ENABLED=true MQTT_TLS_CHECK_HOSTNAME=false CA_CERT_PATH=mosquitto/config/certs/ca.crt INFLUXDB_URL=http://localhost:8086 INFLUXDB_TOKEN=my-super-secret-auth-token INFLUXDB_ORG=myorg INFLUXDB_BUCKET=plc_data"
echo "      python3 influxdb_writer/influxdb_writer_production.py"
echo ""
echo "   2. Start Mock PLC Agent(s) in Terminal 2+ (for each machine):"
echo "      export MACHINE_ID=machine-01"
echo "      export MQTT_BROKER_HOST=localhost MQTT_BROKER_PORT=8883 MQTT_USERNAME=edge_gateway MQTT_PASSWORD=edge_gateway_pass MQTT_TLS_ENABLED=true MQTT_TLS_CHECK_HOSTNAME=false CA_CERT_PATH=mosquitto/config/certs/ca.crt CLIENT_CERT_PATH=mosquitto/config/certs/client.crt CLIENT_KEY_PATH=mosquitto/config/certs/client.key"
echo "      python3 mock_plc_agent/mock_plc_agent.py"
echo ""
echo "🌐 Access points:"
echo "   - Grafana: http://localhost:3004 (admin/admin)"
echo "   - InfluxDB: http://localhost:8086"
echo "   - MQTT Broker: localhost:8883 (TLS)"
echo ""

