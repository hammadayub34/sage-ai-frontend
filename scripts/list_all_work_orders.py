#!/usr/bin/env python3
"""
List all work orders from InfluxDB
"""
import os
from influxdb_client import InfluxDBClient
from dotenv import load_dotenv

load_dotenv()

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
WORK_ORDERS_BUCKET = os.getenv("WORK_ORDERS_BUCKET", "work_orders")

client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

# Query all work orders
query = f'''
from(bucket: "{WORK_ORDERS_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r["_measurement"] == "work_order")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> group(columns: ["workOrderNo"])
  |> sort(columns: ["_time"], desc: true)
'''

print("📋 Fetching all work orders from InfluxDB...")
work_orders = set()

try:
    result = query_api.query(query)
    
    if result:
        for table in result:
            for record in table.records:
                # Access values from the record
                work_order_no = record.values.get('workOrderNo') or record.values.get('_value')
                if work_order_no and work_order_no not in ['workOrderNo', '_value', '_time', '_measurement']:
                    work_orders.add(str(work_order_no))
    
    if work_orders:
        print(f"\n✅ Found {len(work_orders)} work order(s) in InfluxDB:")
        for wo in sorted(work_orders):
            print(f"   - {wo}")
    else:
        print("\n❌ No work orders found in InfluxDB")
        
except Exception as e:
    print(f"❌ Error querying InfluxDB: {e}")
    import traceback
    traceback.print_exc()

