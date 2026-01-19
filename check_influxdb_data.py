#!/usr/bin/env python3
"""
Quick script to check if data is in InfluxDB
Fixed to avoid schema collision errors
"""
from influxdb_client import InfluxDBClient
import os
from datetime import datetime, timedelta

# Load .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, skip

# Configuration
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "plc_data_new")

print("🔍 Checking InfluxDB for data...")
print(f"   URL: {INFLUXDB_URL}")
print(f"   Bucket: {INFLUXDB_BUCKET}")
print(f"   Org: {INFLUXDB_ORG}\n")

try:
    # Connect to InfluxDB
    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    query_api = client.query_api()
    
    # Query 1: Count total data points in last 10 minutes
    print("📊 Query 1: Total data points (last 10 minutes)")
    query1 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -10m)
      |> count()
    '''
    result1 = query_api.query(query1)
    
    total_count = 0
    for table in result1:
        for record in table.records:
            total_count = record.get_value()
    
    if total_count > 0:
        print(f"   ✅ Found {total_count} data points\n")
    else:
        print(f"   ⚠️  No data points found (check if data is being written)\n")
    
    # Query 2: List all machine_ids (using a specific field to avoid schema collision)
    print("📊 Query 2: Machines sending data")
    query2 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -10m)
      |> filter(fn: (r) => r["_field"] == "SystemRunning")
      |> group(columns: ["machine_id"])
      |> distinct(column: "machine_id")
    '''
    try:
        result2 = query_api.query(query2)
        
        machine_ids = []
        for table in result2:
            for record in table.records:
                machine_id = record.values.get("machine_id", "unknown")
                if machine_id and machine_id not in machine_ids:
                    machine_ids.append(machine_id)
        
        if machine_ids:
            print(f"   ✅ Machines: {', '.join(machine_ids)}\n")
        else:
            print(f"   ⚠️  No machines found\n")
    except Exception as e:
        print(f"   ⚠️  Could not determine machines: {str(e)[:60]}\n")
    
    # Query 3: Latest data point from each machine (using specific field)
    print("📊 Query 3: Latest data from each machine")
    query3 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -10m)
      |> filter(fn: (r) => r["_field"] == "BottlesFilled")
      |> group(columns: ["machine_id"])
      |> last()
    '''
    try:
        result3 = query_api.query(query3)
        
        if result3:
            for table in result3:
                for record in table.records:
                    machine_id = record.values.get("machine_id", "unknown")
                    field = record.get_field()
                    value = record.get_value()
                    time = record.get_time()
                    print(f"   [{machine_id}] {field} = {value} at {time}")
            print()
        else:
            print("   ⚠️  No recent data found\n")
    except Exception as e:
        print(f"   ⚠️  Could not get latest data: {str(e)[:60]}\n")
    
    # Query 4: Sample of all fields from latest point
    print("📊 Query 4: Sample data (latest point)")
    query4 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -10m)
      |> last()
    '''
    try:
        result4 = query_api.query(query4)
        
        if result4:
            sample_data = {}
            for table in result4:
                for record in table.records:
                    machine_id = record.values.get("machine_id", "unknown")
                    field = record.get_field()
                    value = record.get_value()
                    time = record.get_time()
                    
                    if machine_id not in sample_data:
                        sample_data[machine_id] = {"time": time, "fields": {}}
                    sample_data[machine_id]["fields"][field] = value
            
            for machine_id, data in sample_data.items():
                print(f"   [{machine_id}] at {data['time']}:")
                for field, value in list(data['fields'].items())[:5]:  # Show first 5 fields
                    print(f"      {field}: {value}")
                if len(data['fields']) > 5:
                    print(f"      ... and {len(data['fields']) - 5} more fields")
            print()
        else:
            print("   ⚠️  No sample data found\n")
    except Exception as e:
        print(f"   ⚠️  Could not get sample data: {str(e)[:60]}\n")
    
    # Query 5: Data points per minute (using a specific field to avoid schema collision)
    print("📊 Query 5: Data points per minute (last 10 minutes)")
    query5 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -10m)
      |> filter(fn: (r) => r["_field"] == "SystemRunning")
      |> group(columns: ["machine_id"])
      |> aggregateWindow(every: 1m, fn: count, createEmpty: false)
      |> yield(name: "count")
    '''
    try:
        result5 = query_api.query(query5)
        
        if result5:
            for table in result5:
                for record in table.records:
                    machine_id = record.values.get("machine_id", "unknown")
                    count = record.get_value()
                    time = record.get_time()
                    print(f"   [{machine_id}] {count} points at {time}")
            print()
        else:
            print("   ⚠️  No data rate found\n")
    except Exception as e:
        print(f"   ⚠️  Could not calculate data rate: {str(e)[:60]}\n")
    
    # Check for any real data (using a specific field to avoid schema collision)
    query6 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r["_field"] == "SystemRunning" or r["_field"] == "BottlesFilled")
      |> group(columns: ["machine_id"])
      |> count()
    '''
    
    print("🔍 Checking for real data...")
    try:
        result6 = query_api.query(query6)
        
        total = 0
        machines = []
        for table in result6:
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
    except Exception as e:
        print(f"⚠️  Could not count data points: {str(e)[:60]}")
    
    client.close()
    
    print("\n✅ Check complete!")
    if total_count > 0:
        print(f"   📈 Data is flowing: {total_count} points in last 10 minutes")
        if machine_ids:
            print(f"   🏭 Machines active: {len(machine_ids)}")
        print(f"   💡 View in Grafana: http://localhost:3004")
    else:
        print("   ⚠️  No data found. Check:")
        print("      1. Is InfluxDB Writer running?")
        print("      2. Is Mock PLC Agent publishing?")
        print("      3. Check InfluxDB Writer terminal for errors")
    
except Exception as e:
    print(f"❌ Error querying InfluxDB: {e}")
    import traceback
    traceback.print_exc()
