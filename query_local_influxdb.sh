#!/bin/bash
# Quick script to query local InfluxDB
# Usage: ./query_local_influxdb.sh [field] [time-range] [machine-id]

FIELD=${1:-BottlesPerMinute}
TIME_RANGE=${2:--1h}
MACHINE_ID=${3:-machine-01}

echo "🔍 Querying Local InfluxDB..."
echo "   Field: $FIELD"
echo "   Time Range: $TIME_RANGE"
echo "   Machine: $MACHINE_ID"
echo ""

python3 query_influxdb.py \
  --time-range="$TIME_RANGE" \
  --field="$FIELD" \
  --machine="$MACHINE_ID"

