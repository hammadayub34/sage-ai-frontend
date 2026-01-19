#!/usr/bin/env python3
"""
Delete all work orders from both InfluxDB and Pinecone
"""
import os
import sys
from influxdb_client import InfluxDBClient
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
WORK_ORDERS_BUCKET = os.getenv("WORK_ORDERS_BUCKET", "work_orders")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "alarm-manual")

# Get work orders from InfluxDB
client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
query_api = client.query_api()

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
                work_order_no = record.values.get('workOrderNo')
                if work_order_no and work_order_no not in ['workOrderNo', '_value', '_time', '_measurement']:
                    work_orders.add(str(work_order_no))
    
    if not work_orders:
        print("❌ No work orders found in InfluxDB")
        sys.exit(0)
    
    print(f"\n✅ Found {len(work_orders)} work order(s) in InfluxDB:")
    for wo in sorted(work_orders):
        print(f"   - {wo}")
    
    # Confirm deletion (skip if --yes flag is passed)
    if '--yes' not in sys.argv:
        print(f"\n⚠️  This will delete {len(work_orders)} work order(s) from both InfluxDB and Pinecone")
        confirm = input("Are you sure you want to continue? (yes/no): ")
        if confirm.lower() != 'yes':
            print("❌ Deletion cancelled")
            sys.exit(0)
    else:
        print(f"\n🗑️  Deleting {len(work_orders)} work order(s) from both InfluxDB and Pinecone...")
    
    # Delete from InfluxDB
    print("\n🗑️  Deleting from InfluxDB...")
    from influxdb_client.client.write_api import SYNCHRONOUS
    delete_api = client.delete_api()
    
    for wo_no in work_orders:
        try:
            # Delete using the delete API
            delete_api.delete(
                start="1970-01-01T00:00:00Z",
                stop="2099-12-31T23:59:59Z",
                predicate=f'_measurement="work_order" AND workOrderNo="{wo_no}"',
                bucket=WORK_ORDERS_BUCKET
            )
            print(f"   ✅ Deleted {wo_no} from InfluxDB")
        except Exception as e:
            print(f"   ❌ Error deleting {wo_no} from InfluxDB: {e}")
    
    # Delete from Pinecone
    if PINECONE_API_KEY:
        print("\n🗑️  Deleting from Pinecone...")
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(PINECONE_INDEX_NAME)
        
        for wo_no in work_orders:
            try:
                # Query to find vectors
                dummy_vector = [0.0] * 1536
                result = index.query(
                    vector=dummy_vector,
                    top_k=200,
                    include_metadata=True,
                    filter={
                        'document_type': {'$eq': 'work_order_history'},
                        'work_order_no': {'$eq': wo_no}
                    }
                )
                
                if result.matches:
                    vector_ids = [match.id for match in result.matches]
                    index.delete(ids=vector_ids)
                    print(f"   ✅ Deleted {len(vector_ids)} vector(s) for {wo_no} from Pinecone")
                else:
                    print(f"   ℹ️  No vectors found for {wo_no} in Pinecone")
            except Exception as e:
                print(f"   ❌ Error deleting {wo_no} from Pinecone: {e}")
    else:
        print("\n⚠️  PINECONE_API_KEY not set, skipping Pinecone deletion")
    
    print(f"\n✅ Successfully deleted {len(work_orders)} work order(s) from both databases")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    client.close()

