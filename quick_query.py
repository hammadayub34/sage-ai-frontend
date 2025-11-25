#!/usr/bin/env python3
"""
Quick InfluxDB Query Script
Usage: python3 quick_query.py
"""
from influxdb_client import InfluxDBClient

# Configuration
INFLUXDB_URL = "http://localhost:8086"
INFLUXDB_TOKEN = "my-super-secret-auth-token"
INFLUXDB_ORG = "myorg"
INFLUXDB_BUCKET = "plc_data_new"

# Connect
client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

# Example query: Get latest values for machine-01
query = f'''
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> last()
'''

print("🔍 Querying InfluxDB...")
print(f"   Bucket: {INFLUXDB_BUCKET}")
print(f"   Machine: machine-01\n")

try:
    result = query_api.query(query)
    
    found = False
    for table in result:
        for record in table.records:
            found = True
            field = record.get_field()
            value = record.get_value()
            
            if isinstance(value, bool):
                value_str = "✓ TRUE" if value else "✗ FALSE"
            elif isinstance(value, float):
                value_str = f"{value:.2f}"
            else:
                value_str = str(value)
            
            print(f"  {field:25s}: {value_str}")
    
    if not found:
        print("  ⚠️  No data found for machine-01 in last 24h")
        print("  💡 Try: python3 query_influxdb_example.py for more queries")
    
except Exception as e:
    print(f"  ❌ Error: {e}")

client.close()

