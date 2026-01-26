#!/bin/bash
echo "=========================================="
echo "Data Flow Diagnostic"
echo "=========================================="
echo ""

echo "=== Step 1: Check if services are running ==="
MOCK_PLC=$(ps aux | grep "mock_plc_agent" | grep -v grep | wc -l)
INFLUX_WRITER=$(ps aux | grep "influxdb_writer" | grep -v grep | wc -l)

if [ "$MOCK_PLC" -gt 0 ]; then
    echo "✅ Mock PLC Agent: Running"
else
    echo "❌ Mock PLC Agent: NOT running"
fi

if [ "$INFLUX_WRITER" -gt 0 ]; then
    echo "✅ InfluxDB Writer: Running"
else
    echo "❌ InfluxDB Writer: NOT running"
fi

echo ""
echo "=== Step 2: Check Mock PLC Agent logs ==="
if [ -f "/tmp/mock_plc_agent.log" ]; then
    echo "Last 10 lines:"
    tail -10 /tmp/mock_plc_agent.log
else
    echo "❌ Log file not found"
fi

echo ""
echo "=== Step 3: Check InfluxDB Writer logs ==="
if [ -f "/tmp/influxdb_writer.log" ]; then
    echo "Last 10 lines:"
    tail -10 /tmp/influxdb_writer.log
else
    echo "❌ Log file not found"
fi

echo ""
echo "=== Step 4: Test InfluxDB connection and data ==="
python3 << 'PYTHON'
import os
import sys
from dotenv import load_dotenv
from influxdb_client import InfluxDBClient

# Load .env from workspace root
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else '/home/runner/workspace', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    # Try loading from current directory
    load_dotenv()

url = os.getenv('INFLUXDB_URL')
token = os.getenv('INFLUXDB_TOKEN')
org = os.getenv('INFLUXDB_ORG')
bucket = os.getenv('INFLUXDB_BUCKET')

if not all([url, token, org, bucket]):
    print("❌ Missing InfluxDB environment variables!")
    print("   Check your .env file")
    exit(1)

print(f"Connecting to: {url}")
print(f"Bucket: {bucket}\n")

try:
    client = InfluxDBClient(url=url, token=token, org=org, timeout=30000)
    query_api = client.query_api()
    
    # Query for BottlesPerMinute in last hour
    query = f'''
        from(bucket: "{bucket}")
          |> range(start: -1h)
          |> filter(fn: (r) => r["machine_id"] == "machine-01")
          |> filter(fn: (r) => r["_field"] == "BottlesPerMinute")
          |> limit(n: 10)
    '''
    
    print("Querying BottlesPerMinute data from last hour...")
    results = list(query_api.query(query))
    
    if results and len(results) > 0:
        total_records = sum(len(table.records) for table in results)
        if total_records > 0:
            print(f"✅ Found {total_records} data points!")
            print("\nSample data:")
            count = 0
            for table in results:
                for record in table.records:
                    if count < 3:
                        print(f"  {record.get_time()}: {record.get_value()}")
                        count += 1
        else:
            print("⚠️ Query returned tables but no records")
    else:
        print("❌ No data found!")
        print("   Possible issues:")
        print("   1. Mock PLC Agent not publishing")
        print("   2. InfluxDB Writer not writing")
        print("   3. Data not in InfluxDB Cloud yet")
    
    # Also check for any data in the bucket
    print("\nChecking for ANY data in bucket...")
    any_data_query = f'''
        from(bucket: "{bucket}")
          |> range(start: -1h)
          |> filter(fn: (r) => r["machine_id"] == "machine-01")
          |> limit(n: 5)
    '''
    any_results = list(query_api.query(any_data_query))
    any_total = sum(len(table.records) for table in any_results)
    if any_total > 0:
        print(f"✅ Found {any_total} total data points in bucket")
        print("   (Data is being written, but might be different fields)")
    else:
        print("❌ No data at all in bucket for machine-01")
    
    client.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
PYTHON

echo ""
echo "=========================================="

