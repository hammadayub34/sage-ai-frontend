#!/bin/bash
# Diagnose the entire pipeline

echo "🔍 Diagnosing MQTT-OT Network Pipeline"
echo "========================================"
echo ""

# Check Docker containers
echo "📦 Docker Containers:"
docker ps --filter "name=influxdb-production\|mqtt-broker-production\|grafana-production" --format "  {{.Names}}: {{.Status}}" || echo "  ⚠️  No containers found"
echo ""

# Check Python processes
echo "🐍 Python Processes:"
echo "  InfluxDB Writer:"
ps aux | grep "influxdb_writer_production.py" | grep -v grep | awk '{print "    PID:", $2, "-", $11, $12, $13}' || echo "    ⚠️  Not running"
echo "  Mock PLC Agents:"
ps aux | grep "mock_plc_agent.py" | grep -v grep | awk '{print "    PID:", $2, "-", $11, $12, $13}' || echo "    ⚠️  Not running"
echo ""

# Check MQTT broker connections
echo "📡 MQTT Broker Connections (last 10 lines):"
docker logs mqtt-broker-production 2>&1 | tail -10 | grep -E "connected|subscribed|published" || echo "  ⚠️  No recent activity"
echo ""

# Check InfluxDB data
echo "💾 InfluxDB Data Check:"
python3 check_influxdb_data.py 2>&1 | grep -E "Found|No data|Machines:" | head -5
echo ""

# Check MQTT topics
echo "📨 MQTT Topic Activity:"
echo "  Checking for messages on plc/+/bottlefiller/data..."
docker exec mqtt-broker-production mosquitto_sub -h localhost -p 8883 -u influxdb_writer -P influxdb_writer_pass --cafile /mosquitto/config/certs/ca.crt -t "plc/+/bottlefiller/data" -C 1 -W 2 2>&1 | head -3 || echo "  ⚠️  No messages received (timeout or connection issue)"
echo ""

echo "✅ Diagnosis complete!"
echo ""
echo "💡 Next steps:"
echo "   1. If InfluxDB Writer not running: ./start_influxdb_writer.sh"
echo "   2. If Mock PLC not running: ./start_mock_plc.sh machine-01"
echo "   3. Check logs: docker logs mqtt-broker-production"

