#!/bin/bash
# Backfill alarm events from InfluxDB

cd /Users/khanhamza/mqtt-ot-network

MACHINE_ID=${1:-machine-01}
TIME_RANGE=${2:--24h}

export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=my-super-secret-auth-token
export INFLUXDB_ORG=myorg
export INFLUXDB_BUCKET=plc_data_new
export ALARM_EVENTS_FILE=/tmp/alarm_events.json
export TIME_RANGE=$TIME_RANGE

echo "🔄 Backfilling alarm events for $MACHINE_ID..."
python3 alarm_monitor/backfill_alarm_events.py $MACHINE_ID

