#!/usr/bin/env python3
"""Check if a work order exists in InfluxDB"""
import os
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from dotenv import load_dotenv

load_dotenv()

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
WORK_ORDERS_BUCKET = os.getenv("WORK_ORDERS_BUCKET", "work_orders")

client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

work_order_no = "WO-20251127-397"

query = f'''
from(bucket: "{WORK_ORDERS_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r["_measurement"] == "work_order")
  |> filter(fn: (r) => r["workOrderNo"] == "{work_order_no}")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> limit(n: 1)
'''

try:
    result = query_api.query(query)
    
    if result and len(result) > 0:
        for table in result:
            for record in table.records:
                print(f"✅ Found work order {work_order_no} in InfluxDB:")
                print(f"   Machine ID: {record.get_value_by_key('machineId', 'N/A')}")
                print(f"   Status: {record.get_value_by_key('status', 'N/A')}")
                print(f"   Priority: {record.get_value_by_key('priority', 'N/A')}")
                print(f"   Created: {record.get_time()}")
                break
    else:
        print(f"❌ Work order {work_order_no} not found in InfluxDB")
except Exception as e:
    print(f"❌ Error querying InfluxDB: {e}")

