#!/usr/bin/env python3
"""
Backfill Alarm Events - Query InfluxDB to find past alarm transitions
and populate the alarm events file
"""
import json
import os
from influxdb_client import InfluxDBClient
from datetime import datetime, timezone

# Configuration
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "plc_data_new")
ALARM_EVENTS_FILE = os.getenv("ALARM_EVENTS_FILE", "/tmp/alarm_events.json")
TIME_RANGE = os.getenv("TIME_RANGE", "-24h")  # How far back to look

# Alarm fields to check
ALARM_FIELDS = [
    "AlarmFault",
    "AlarmOverfill",
    "AlarmUnderfill",
    "AlarmLowProductLevel",
    "AlarmCapMissing"
]

def detect_transitions(values):
    """Detect alarm transitions from a list of (time, value) tuples"""
    transitions = []
    prev_value = None
    prev_time = None
    
    for time, value in values:
        if prev_value is not None:
            if prev_value == False and value == True:
                transitions.append({
                    "state": "RAISED",
                    "timestamp": prev_time.isoformat() if prev_time else time.isoformat(),
                    "value": True
                })
            elif prev_value == True and value == False:
                transitions.append({
                    "state": "CLEARED",
                    "timestamp": time.isoformat(),
                    "value": False
                })
        prev_value = value
        prev_time = time
    
    return transitions

def backfill_alarm_events(machine_id="machine-01"):
    """Backfill alarm events from InfluxDB"""
    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    query_api = client.query_api()
    
    all_events = []
    
    print(f"🔍 Backfilling alarm events for {machine_id}...")
    print(f"📅 Time range: {TIME_RANGE}")
    print("=" * 60)
    
    for alarm_field in ALARM_FIELDS:
        # Map InfluxDB field name to alarm label
        alarm_label_map = {
            "AlarmFault": "Fault",
            "AlarmOverfill": "Overfill",
            "AlarmUnderfill": "Underfill",
            "AlarmLowProductLevel": "LowProductLevel",
            "AlarmCapMissing": "CapMissing"
        }
        
        alarm_label = alarm_label_map.get(alarm_field, alarm_field)
        
        # Query values sorted by time
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
          |> range(start: {TIME_RANGE})
          |> filter(fn: (r) => r["machine_id"] == "{machine_id}")
          |> filter(fn: (r) => r["_field"] == "{alarm_field}")
          |> sort(columns: ["_time"])
          |> aggregateWindow(every: 1s, fn: last, createEmpty: false)
        '''
        
        try:
            results = query_api.query(query)
            values = []
            
            for table in results:
                for record in table.records:
                    time = record.get_time()
                    value = record.get_value()
                    values.append((time, value))
            
            if values:
                transitions = detect_transitions(values)
                print(f"  {alarm_field}: {len(transitions)} transitions found")
                
                for transition in transitions:
                    event = {
                        "timestamp": transition["timestamp"],
                        "machine_id": machine_id,
                        "alarm_type": alarm_field,
                        "alarm_label": alarm_label,
                        "state": transition["state"],
                        "value": transition["value"]
                    }
                    all_events.append(event)
            else:
                print(f"  {alarm_field}: No data found")
                
        except Exception as e:
            print(f"  {alarm_field}: Error - {e}")
    
    # Sort all events by timestamp
    all_events.sort(key=lambda x: x["timestamp"])
    
    # Save to file
    with open(ALARM_EVENTS_FILE, 'w') as f:
        json.dump(all_events, f, indent=2)
    
    print("=" * 60)
    print(f"✅ Backfilled {len(all_events)} alarm events")
    print(f"💾 Saved to: {ALARM_EVENTS_FILE}")
    
    client.close()
    return all_events

if __name__ == "__main__":
    import sys
    machine_id = sys.argv[1] if len(sys.argv) > 1 else "machine-01"
    backfill_alarm_events(machine_id)

