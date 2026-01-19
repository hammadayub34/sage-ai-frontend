#!/bin/bash
# Test script to query the frontend API endpoint for latest tag values

echo "🧪 Testing Frontend API Endpoint"
echo "=================================="
echo ""

# Default values
MACHINE_ID=${1:-machine-01}
PORT=${2:-3005}

echo "📡 Querying latest tag values for: $MACHINE_ID"
echo "🌐 Endpoint: http://localhost:$PORT/api/influxdb/latest?machineId=$MACHINE_ID"
echo ""

# Make the request
curl -s -X GET "http://localhost:$PORT/api/influxdb/latest?machineId=$MACHINE_ID" | \
  python3 -m json.tool 2>/dev/null || \
  curl -s -X GET "http://localhost:$PORT/api/influxdb/latest?machineId=$MACHINE_ID"

echo ""
echo ""
echo "💡 Usage:"
echo "   ./test_frontend_api.sh [machineId] [port]"
echo "   Example: ./test_frontend_api.sh machine-01 3005"

