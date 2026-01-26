#!/usr/bin/env python3
"""
Backfill script to add all work orders from InfluxDB to WORK_ORDERS_HISTORY.md and embed into Pinecone
"""
import os
import json
from influxdb_client import InfluxDBClient
from dotenv import load_dotenv
from append_work_order_to_doc import append_work_order_to_doc

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

print("📋 Fetching work orders from InfluxDB...")
work_orders = {}

try:
    result = query_api.query(query)
    
    for table in result:
        for record in table.records:
            wo_no = record.values.get('workOrderNo', '')
            if not wo_no:
                continue
            
            # Get all fields from the record
            if wo_no not in work_orders:
                work_orders[wo_no] = {
                    'workOrderNo': wo_no,
                    'machineId': record.values.get('machineId', ''),
                    'status': record.values.get('status', 'pending'),
                    'priority': record.values.get('priority', 'Medium'),
                    'weekNo': record.values.get('weekNo', ''),
                    'weekOf': record.values.get('weekOf', ''),
                    'alarmType': record.values.get('alarmType', ''),
                    'machineType': record.values.get('machineType', ''),
                    'companyName': record.values.get('companyName', ''),
                    'equipmentName': record.values.get('equipmentName', ''),
                    'equipmentNumber': record.values.get('equipmentNumber', ''),
                    'equipmentLocation': record.values.get('equipmentLocation', ''),
                    'equipmentDescription': record.values.get('equipmentDescription', ''),
                    'location': record.values.get('location', ''),
                    'building': record.values.get('building', ''),
                    'floor': record.values.get('floor', ''),
                    'room': record.values.get('room', ''),
                    'specialInstructions': record.values.get('specialInstructions', ''),
                    'shop': record.values.get('shop', ''),
                    'vendor': record.values.get('vendor', ''),
                    'vendorAddress': record.values.get('vendorAddress', ''),
                    'vendorPhone': record.values.get('vendorPhone', ''),
                    'vendorContact': record.values.get('vendorContact', ''),
                    'taskNumber': record.values.get('taskNumber', ''),
                    'frequency': record.values.get('frequency', ''),
                    'workPerformedBy': record.values.get('workPerformedBy', ''),
                    'workDescription': record.values.get('workDescription', ''),
                    'workPerformed': record.values.get('workPerformed', ''),
                    'standardHours': str(record.values.get('standardHours', 0)),
                    'overtimeHours': str(record.values.get('overtimeHours', 0)),
                    'workCompleted': record.values.get('workCompleted', False),
                }
                
                # Parse parts and materials if they're strings
                parts_str = record.values.get('parts', '[]')
                materials_str = record.values.get('materials', '[]')
                try:
                    work_orders[wo_no]['parts'] = json.loads(parts_str) if isinstance(parts_str, str) else parts_str
                except:
                    work_orders[wo_no]['parts'] = []
                try:
                    work_orders[wo_no]['materials'] = json.loads(materials_str) if isinstance(materials_str, str) else materials_str
                except:
                    work_orders[wo_no]['materials'] = []
    
    print(f"✅ Found {len(work_orders)} unique work orders in InfluxDB")
    
    # Check which ones are already in the markdown doc
    from pathlib import Path
    doc_file = Path(__file__).parent.parent / "WORK_ORDERS_HISTORY.md"
    existing_wo_nos = set()
    if doc_file.exists():
        with open(doc_file, 'r', encoding='utf-8') as f:
            content = f.read()
            import re
            matches = re.findall(r'## Work Order: (.+)', content)
            existing_wo_nos = set(matches)
    
    print(f"📄 Found {len(existing_wo_nos)} work orders already in markdown doc")
    
    # Append missing work orders
    missing = [wo for wo in work_orders.keys() if wo not in existing_wo_nos]
    if missing:
        print(f"\n📝 Adding {len(missing)} missing work orders to markdown doc...")
        for wo_no in missing:
            print(f"   Adding {wo_no}...")
            append_work_order_to_doc(work_orders[wo_no])
        print(f"✅ Added {len(missing)} work orders to markdown doc")
    else:
        print("✅ All work orders are already in the markdown doc")
    
    print("\n📤 Now embedding all work orders into Pinecone...")
    import subprocess
    result = subprocess.run(
        ['python3', 'scripts/embed_work_orders_history.py'],
        cwd=Path(__file__).parent.parent,
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        print("✅ Successfully embedded work orders into Pinecone")
    else:
        print(f"❌ Error embedding: {result.stderr}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    client.close()

