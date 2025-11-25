#!/bin/bash
# Stop all MQTT-OT Network services

echo "🛑 Stopping all MQTT-OT Network services..."
echo ""

# Stop InfluxDB Writer
echo "📝 Stopping InfluxDB Writer..."
pkill -f "influxdb_writer_production.py" && echo "   ✅ Stopped" || echo "   ℹ️  Not running"

# Stop Mock PLC Agents
echo "📝 Stopping Mock PLC Agents..."
pkill -f "mock_plc_agent.py" && echo "   ✅ Stopped" || echo "   ℹ️  Not running"

# Stop Edge Gateway (if running)
echo "📝 Stopping Edge Gateway..."
pkill -f "edge_gateway_production.py" && echo "   ✅ Stopped" || echo "   ℹ️  Not running"

# Stop Modbus Reader (if running)
echo "📝 Stopping Modbus Reader..."
pkill -f "modbus_reader.py" && echo "   ✅ Stopped" || echo "   ℹ️  Not running"

# Optional: Stop Docker containers (commented out by default)
# Uncomment the lines below if you want to stop Docker services too
# echo ""
# echo "📦 Stopping Docker containers..."
# docker-compose -f docker-compose.production.yml down
# echo "   ✅ Docker containers stopped"

echo ""
echo "✅ All Python services stopped!"
echo ""
echo "💡 To stop Docker containers too, run:"
echo "   docker-compose -f docker-compose.production.yml down"

