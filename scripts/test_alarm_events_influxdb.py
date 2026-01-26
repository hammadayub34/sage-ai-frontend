#!/usr/bin/env python3
"""
Test script to check if alarm events are being saved to InfluxDB
"""
import os
from influxdb_client import InfluxDBClient
from datetime import datetime, timedelta

# Load .env file if it exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
BUCKET_NAME = os.getenv("INFLUXDB_BUCKET_ALARMS", "alarm_events")

print(f"🔍 Testing alarm events in InfluxDB...")
print(f"   URL: {INFLUXDB_URL}")
print(f"   Bucket: {BUCKET_NAME}")
print(f"   Org: {INFLUXDB_ORG}\n")

try:
    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    query_api = client.query_api()
    
    # Query for alarm events from the last hour
    start_time = (datetime.now() - timedelta(hours=1)).isoformat() + "Z"
    
    query = f'''from(bucket: "{BUCKET_NAME}")
      |> range(start: {start_time}, stop: now())
      |> filter(fn: (r) => r._measurement == "alarm_events")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 20)'''
    
    print(f"📊 Querying alarm events from last hour...\n")
    
    events = []
    event_map = {}
    
    # Query using query method
    try:
        results = query_api.query(query)
        for table in results:
            for record in table.records:
                time_key = str(record.get_time())
                if time_key not in event_map:
                    # Access record values directly (after pivot, all fields are in record)
                    # Tags and fields are accessible via record.values dict
                    record_dict = {}
                    for key in record.values:
                        record_dict[key] = record.values[key]
                    
                    event_map[time_key] = {
                        'timestamp': str(record.get_time()),
                        'machine_id': record_dict.get('machine_id', ''),
                        'alarm_type': record_dict.get('alarm_type', ''),
                        'alarm_name': record_dict.get('alarm_name', ''),
                        'alarm_label': record_dict.get('alarm_label', ''),
                        'state': record_dict.get('state', ''),
                        'value': record_dict.get('value', False),
                    }
    except Exception as e:
        print(f"❌ Query error: {e}")
        import traceback
        traceback.print_exc()
    
    events = list(event_map.values())
    
    if events:
        print(f"✅ Found {len(events)} alarm events in InfluxDB:\n")
        for i, event in enumerate(events[:10], 1):
            print(f"  {i}. {event['alarm_type']} ({event['state']})")
            print(f"     Machine: {event['machine_id']}")
            print(f"     Time: {event['timestamp']}\n")
        
        if len(events) > 10:
            print(f"  ... and {len(events) - 10} more events\n")
        
        print(f"✅ Alarm events are being saved correctly to InfluxDB!")
    else:
        print(f"⚠️  No alarm events found in the last hour")
        print(f"   This could mean:")
        print(f"   - No alarms have been raised yet")
        print(f"   - Alarm monitor is not saving to InfluxDB")
        print(f"   - Check alarm monitor logs: tail -f /tmp/alarm_monitor.log")
    
    client.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

