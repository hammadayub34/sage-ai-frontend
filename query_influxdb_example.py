#!/usr/bin/env python3
"""
Example script to query InfluxDB and view data
Usage: python3 query_influxdb_example.py
"""

from influxdb_client import InfluxDBClient
from datetime import datetime

# Configuration
INFLUXDB_URL = "http://localhost:8086"
INFLUXDB_TOKEN = "my-super-secret-auth-token"
INFLUXDB_ORG = "myorg"
INFLUXDB_BUCKET = "plc_data_new"

def main():
    print("🔍 InfluxDB Query Examples")
    print("=" * 80)
    
    # Create client
    client = InfluxDBClient(
        url=INFLUXDB_URL,
        token=INFLUXDB_TOKEN,
        org=INFLUXDB_ORG
    )
    query_api = client.query_api()
    
    # Query 1: Check if we have any data
    print("\n📊 Query 1: Check for any data in last 24h")
    print("-" * 80)
    query1 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_measurement"] == "plc_data")
      |> limit(n: 5)
    '''
    
    try:
        result1 = query_api.query(query1)
        count = 0
        for table in result1:
            for record in table.records:
                count += 1
                print(f"  {count}. {record.get_time()}: {record.get_field()} = {record.get_value()}")
        
        if count == 0:
            print("  ⚠️  No data found. Make sure services are running!")
        else:
            print(f"  ✅ Found at least {count} data points")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Query 2: Latest values for machine-01
    print("\n📊 Query 2: Latest values for machine-01")
    print("-" * 80)
    query2 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_measurement"] == "plc_data")
      |> filter(fn: (r) => r["machine_id"] == "machine-01")
      |> last()
    '''
    
    try:
        result2 = query_api.query(query2)
        found = False
        for table in result2:
            for record in table.records:
                found = True
                field = record.get_field()
                value = record.get_value()
                if isinstance(value, bool):
                    value_str = "✓ TRUE" if value else "✗ FALSE"
                else:
                    value_str = str(value)
                print(f"  {field:25s}: {value_str}")
        
        if not found:
            print("  ⚠️  No data found for machine-01")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Query 3: Count total data points
    print("\n📊 Query 3: Total data points in last 24h")
    print("-" * 80)
    query3 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_measurement"] == "plc_data")
      |> count()
    '''
    
    try:
        result3 = query_api.query(query3)
        for table in result3:
            for record in table.records:
                print(f"  Total data points: {record.get_value()}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Query 4: Which machines have data
    print("\n📊 Query 4: Machines with data")
    print("-" * 80)
    query4 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_measurement"] == "plc_data")
      |> keep(columns: ["machine_id"])
      |> distinct(column: "machine_id")
    '''
    
    try:
        result4 = query_api.query(query4)
        machines = []
        for table in result4:
            for record in table.records:
                machine_id = record.get_value()
                if machine_id not in machines:
                    machines.append(machine_id)
        
        if machines:
            print(f"  ✅ Machines with data: {', '.join(machines)}")
        else:
            print("  ⚠️  No machines found")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Query 5: All tags for machine-01 (pivot table)
    print("\n📊 Query 5: All latest tag values for machine-01 (pivot)")
    print("-" * 80)
    query5 = f'''
    from(bucket: "{INFLUXDB_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_measurement"] == "plc_data")
      |> filter(fn: (r) => r["machine_id"] == "machine-01")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
    '''
    
    try:
        result5 = query_api.query(query5)
        found = False
        for table in result5:
            for record in table.records:
                found = True
                print(f"  Time: {record.get_time()}")
                for key, value in record.values.items():
                    if key not in ['_start', '_stop', 'result', 'table', '_measurement', '_time']:
                        if isinstance(value, bool):
                            val_str = "✓ TRUE" if value else "✗ FALSE"
                        elif isinstance(value, float):
                            val_str = f"{value:.2f}"
                        else:
                            val_str = str(value)
                        print(f"  {key:25s}: {val_str}")
        
        if not found:
            print("  ⚠️  No data found for machine-01")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    print("\n" + "=" * 80)
    print("✅ Query examples completed!")
    print("\n💡 TIP: Use the InfluxDB Web UI at http://localhost:8086 for visual queries")
    print("   Login: admin / admin123")
    print("   Go to: Data Explorer > Select bucket: plc_data_new")
    
    client.close()

if __name__ == "__main__":
    main()

