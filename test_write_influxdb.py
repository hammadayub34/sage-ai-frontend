#!/usr/bin/env python3
"""
Test script to write a test point to InfluxDB and verify it works
"""
from influxdb_client import InfluxDBClient, Point
from datetime import datetime
import os

# Configuration
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "plc_data")

print("🧪 Testing InfluxDB connection and write...")
print(f"   URL: {INFLUXDB_URL}")
print(f"   Bucket: {INFLUXDB_BUCKET}\n")

try:
    # Connect to InfluxDB
    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    write_api = client.write_api()
    
    # Write a test point
    test_point = Point("plc_data") \
        .tag("machine_id", "test-machine") \
        .field("TestField", 999) \
        .field("SystemRunning", True) \
        .time(datetime.utcnow())
    
    print("📝 Writing test point...")
    write_api.write(bucket=INFLUXDB_BUCKET, record=test_point)
    write_api.close()
    print("✅ Test point written successfully!\n")
    
    # Now read it back
    query_api = client.query_api()
    query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -1m)
      |> filter(fn: (r) => r["machine_id"] == "test-machine")
      |> filter(fn: (r) => r["_field"] == "TestField")
    '''
    
    print("🔍 Reading test point back...")
    result = query_api.query(query)
    
    found = False
    for table in result:
        for record in table.records:
            found = True
            print(f"✅ Found test point: {record.get_field()} = {record.get_value()}")
            print(f"   Machine: {record.values.get('machine_id')}")
            print(f"   Time: {record.get_time()}\n")
    
    if not found:
        print("⚠️  Test point not found (but write succeeded - might be a timing issue)\n")
    
    # Check for any real data
    query2 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -1h)
      |> group(columns: ["machine_id"])
      |> count()
    '''
    
    print("🔍 Checking for real data...")
    result2 = query_api.query(query2)
    
    total = 0
    machines = []
    for table in result2:
        for record in table.records:
            machine_id = record.values.get("machine_id", "unknown")
            count = record.get_value()
            total += count
            machines.append(f"{machine_id}: {count} points")
    
    if total > 0:
        print(f"✅ Found {total} total data points from:")
        for m in machines:
            print(f"   - {m}")
    else:
        print("⚠️  No real data found in last hour")
        print("   Make sure:")
        print("   1. InfluxDB Writer is running")
        print("   2. Mock PLC Agent is publishing")
        print("   3. They're both connected to MQTT broker")
    
    query_api.close()
    client.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    print("\n💡 Troubleshooting:")
    print("   1. Check if InfluxDB is running: docker ps | grep influxdb")
    print("   2. Check InfluxDB logs: docker logs influxdb-production")
    print("   3. Verify URL is correct: http://localhost:8086")

