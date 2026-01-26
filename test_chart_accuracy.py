#!/usr/bin/env python3
"""
Test script to verify chart data accuracy
Compares what charts should show vs what they actually show
"""
from influxdb_client import InfluxDBClient
from datetime import datetime
import json

# Configuration
INFLUXDB_URL = "http://localhost:8086"
INFLUXDB_TOKEN = "my-super-secret-auth-token"
INFLUXDB_ORG = "myorg"
INFLUXDB_BUCKET = "plc_data_new"
MACHINE_ID = "machine-01"

def test_chart_data(field: str, timeRange: str = "-24h", windowPeriod: str = "5m"):
    """Test what the chart should show for a given field"""
    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    query_api = client.query_api()
    
    query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: {timeRange})
      |> filter(fn: (r) => r["_measurement"] == "plc_data")
      |> filter(fn: (r) => r["machine_id"] == "{MACHINE_ID}")
      |> filter(fn: (r) => r["_field"] == "{field}")
      |> aggregateWindow(every: {windowPeriod}, fn: mean, createEmpty: false)
      |> limit(n: 20)
    '''
    
    result = query_api.query(query)
    data_points = []
    
    for table in result:
        for record in table.records:
            data_points.append({
                'time': str(record.get_time()),
                'value': float(record.get_value())
            })
    
    client.close()
    return data_points

def test_latest_tags():
    """Test what the tags table should show"""
    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    query_api = client.query_api()
    
    query = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_measurement"] == "plc_data")
      |> filter(fn: (r) => r["machine_id"] == "{MACHINE_ID}")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
    '''
    
    result = query_api.query(query)
    tags = {}
    
    for table in result:
        for record in table.records:
            for key, value in record.values.items():
                if key not in ['_start', '_stop', 'result', 'table', '_measurement', '_time']:
                    tags[key] = value
    
    client.close()
    return tags

def main():
    print("🧪 CHART DATA ACCURACY TEST")
    print("=" * 70)
    print(f"Machine: {MACHINE_ID}")
    print(f"Bucket: {INFLUXDB_BUCKET}")
    print()
    
    # Test 1: BottlesPerMinute Chart
    print("📊 TEST 1: BottlesPerMinute Chart")
    print("-" * 70)
    bottles_data = test_chart_data("BottlesPerMinute", "-24h", "5m")
    print(f"   Data points: {len(bottles_data)}")
    if bottles_data:
        print(f"   First point: {bottles_data[0]['time']} = {bottles_data[0]['value']:.2f}")
        print(f"   Last point: {bottles_data[-1]['time']} = {bottles_data[-1]['value']:.2f}")
        print(f"   Min value: {min(p['value'] for p in bottles_data):.2f}")
        print(f"   Max value: {max(p['value'] for p in bottles_data):.2f}")
        print(f"   ✅ Chart should display {len(bottles_data)} points")
    else:
        print("   ⚠️  No data points found")
    print()
    
    # Test 2: FillLevel Chart
    print("📊 TEST 2: FillLevel Chart")
    print("-" * 70)
    filllevel_data = test_chart_data("FillLevel", "-24h", "5m")
    print(f"   Data points: {len(filllevel_data)}")
    if filllevel_data:
        print(f"   First point: {filllevel_data[0]['time']} = {filllevel_data[0]['value']:.2f}")
        print(f"   Last point: {filllevel_data[-1]['time']} = {filllevel_data[-1]['value']:.2f}")
        print(f"   Min value: {min(p['value'] for p in filllevel_data):.2f}")
        print(f"   Max value: {max(p['value'] for p in filllevel_data):.2f}")
        print(f"   ✅ Chart should display {len(filllevel_data)} points")
    else:
        print("   ⚠️  No data points found")
    print()
    
    # Test 3: Latest Tags
    print("📊 TEST 3: Latest Tag Values (Tags Table)")
    print("-" * 70)
    tags = test_latest_tags()
    if tags:
        print(f"   Tags found: {len(tags)}")
        print(f"   BottlesFilled: {tags.get('BottlesFilled', 'N/A')}")
        print(f"   BottlesPerMinute: {tags.get('BottlesPerMinute', 'N/A')}")
        print(f"   FillLevel: {tags.get('FillLevel', 'N/A')}")
        print(f"   SystemRunning: {tags.get('SystemRunning', 'N/A')}")
        print(f"   ✅ Tags table should show these values")
    else:
        print("   ⚠️  No tags found")
    print()
    
    print("=" * 70)
    print("✅ TEST COMPLETE")
    print()
    print("💡 VERIFICATION STEPS:")
    print("   1. Open UI in browser")
    print("   2. Open DevTools → Network tab")
    print("   3. Click 'Refresh Data' button")
    print("   4. Check /api/influxdb/query requests")
    print("   5. Compare response data with test results above")
    print()
    print("💡 EXPECTED RESULTS:")
    print(f"   - BottlesPerMinute chart: {len(bottles_data)} data points")
    print(f"   - FillLevel chart: {len(filllevel_data)} data points")
    print(f"   - Tags table: {len(tags)} tag values")

if __name__ == "__main__":
    main()

