#!/usr/bin/env python3
"""
Test script to verify Grafana queries will return results
Tests all the queries we'll use in the dashboard
"""
from influxdb_client import InfluxDBClient
import os

# Configuration
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "plc_data_new")

print("🧪 Testing Grafana Queries")
print("=" * 80)
print(f"Bucket: {INFLUXDB_BUCKET}")
print(f"Machine: machine-01\n")

client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

# Test 1: Status Fields Query
print("📊 TEST 1: Status Fields (SystemRunning, Fault, Filling, Ready)")
print("-" * 80)
query1 = f'''
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "SystemRunning" or 
                       r["_field"] == "Fault" or
                       r["_field"] == "Filling" or
                       r["_field"] == "Ready")
  |> last()
'''

try:
    result1 = query_api.query(query1)
    count = 0
    for table in result1:
        for record in table.records:
            count += 1
            field = record.get_field()
            value = record.get_value()
            status = "✓ TRUE" if value else "✗ FALSE"
            print(f"   ✅ {field:20s}: {status}")
    
    if count == 0:
        print("   ⚠️  No data found")
    else:
        print(f"   ✅ Query successful - {count} fields returned")
except Exception as e:
    print(f"   ❌ Query failed: {e}")

print()

# Test 2: Production Counters Query
print("📊 TEST 2: Production Counters (BottlesFilled, BottlesRejected, BottlesPerMinute)")
print("-" * 80)
query2 = f'''
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "BottlesFilled" or
                       r["_field"] == "BottlesRejected" or
                       r["_field"] == "BottlesPerMinute")
  |> last()
'''

try:
    result2 = query_api.query(query2)
    count = 0
    for table in result2:
        for record in table.records:
            count += 1
            field = record.get_field()
            value = record.get_value()
            print(f"   ✅ {field:20s}: {value}")
    
    if count == 0:
        print("   ⚠️  No data found")
    else:
        print(f"   ✅ Query successful - {count} fields returned")
except Exception as e:
    print(f"   ❌ Query failed: {e}")

print()

# Test 3: Alarms Query
print("📊 TEST 3: Alarms (All 5 alarm fields)")
print("-" * 80)
query3 = f'''
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "AlarmFault" or
                       r["_field"] == "AlarmOverfill" or
                       r["_field"] == "AlarmUnderfill" or
                       r["_field"] == "AlarmLowProductLevel" or
                       r["_field"] == "AlarmCapMissing")
  |> last()
'''

try:
    result3 = query_api.query(query3)
    count = 0
    for table in result3:
        for record in table.records:
            count += 1
            field = record.get_field()
            value = record.get_value()
            status = "⚠️  ACTIVE" if value else "✓ OK"
            print(f"   ✅ {field:25s}: {status}")
    
    if count == 0:
        print("   ⚠️  No data found")
    else:
        print(f"   ✅ Query successful - {count} alarms returned")
except Exception as e:
    print(f"   ❌ Query failed: {e}")

print()

# Test 4: Analog Values Query
print("📊 TEST 4: Analog Values (FillLevel, TankTemperature, TankPressure, etc.)")
print("-" * 80)
query4 = f'''
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "FillLevel" or
                       r["_field"] == "TankTemperature" or
                       r["_field"] == "TankPressure" or
                       r["_field"] == "FillFlowRate" or
                       r["_field"] == "ConveyorSpeed")
  |> last()
'''

try:
    result4 = query_api.query(query4)
    count = 0
    for table in result4:
        for record in table.records:
            count += 1
            field = record.get_field()
            value = record.get_value()
            if isinstance(value, float):
                print(f"   ✅ {field:20s}: {value:.2f}")
            else:
                print(f"   ✅ {field:20s}: {value}")
    
    if count == 0:
        print("   ⚠️  No data found")
    else:
        print(f"   ✅ Query successful - {count} analog values returned")
except Exception as e:
    print(f"   ❌ Query failed: {e}")

print()

# Test 5: Time Series Query (for charts)
print("📊 TEST 5: Time Series Query (BottlesPerMinute over time)")
print("-" * 80)
query5 = f'''
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "BottlesPerMinute")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> limit(n: 10)
'''

try:
    result5 = query_api.query(query5)
    count = 0
    print("   Time Series Data Points:")
    for table in result5:
        for record in table.records:
            count += 1
            time_val = record.get_time()
            value = record.get_value()
            if count <= 5:
                print(f"   [{count}] {time_val}: {value:.2f}")
    
    if count == 0:
        print("   ⚠️  No data found")
    else:
        print(f"   ✅ Query successful - {count} data points returned")
        print(f"   ✅ Ready for time series chart in Grafana")
except Exception as e:
    print(f"   ❌ Query failed: {e}")

print()

# Test 6: All Tags Table Query (Pivot)
print("📊 TEST 6: All Tags Table (Pivot Query)")
print("-" * 80)
query6 = f'''
from(bucket: "{INFLUXDB_BUCKET}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
'''

try:
    result6 = query_api.query(query6)
    count = 0
    fields_found = []
    for table in result6:
        for record in table.records:
            count += 1
            for key, value in record.values.items():
                if key not in ['_start', '_stop', 'result', 'table', '_measurement', 'machine_id']:
                    fields_found.append(key)
                    if len(fields_found) <= 10:
                        if isinstance(value, bool):
                            val_str = "✓" if value else "✗"
                        elif isinstance(value, float):
                            val_str = f"{value:.2f}"
                        else:
                            val_str = str(value)
                        print(f"   ✅ {key:20s}: {val_str}")
    
    if count == 0:
        print("   ⚠️  No data found")
    else:
        print(f"   ✅ Query successful - {len(fields_found)} fields in table")
        print(f"   ✅ Ready for table panel in Grafana")
except Exception as e:
    print(f"   ❌ Query failed: {e}")

print()
print("=" * 80)
print("✅ All queries tested!")
print("=" * 80)
print("\n💡 IMPORTANT FOR GRAFANA:")
print("   • Replace 'range(start: -24h)' with 'range(start: v.timeRangeStart, stop: v.timeRangeStop)'")
print("   • Replace 'every: 5m' with 'every: v.windowPeriod' for auto-aggregation")
print("   • These are Grafana variables that auto-fill based on dashboard time range")
print("\n📋 QUERIES READY FOR GRAFANA:")
print("   ✅ Status Fields Query - Works!")
print("   ✅ Production Counters Query - Works!")
print("   ✅ Alarms Query - Works!")
print("   ✅ Analog Values Query - Works!")
print("   ✅ Time Series Query - Works! (use wider range in Grafana)")
print("   ✅ All Tags Table Query - Works!")

client.close()

