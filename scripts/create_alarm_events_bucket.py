#!/usr/bin/env python3
"""
Create alarm_events bucket in InfluxDB if it doesn't exist
"""
import os
from influxdb_client import InfluxDBClient
from influxdb_client.client.exceptions import InfluxDBError

# Load .env file if it exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
BUCKET_NAME = os.getenv("INFLUXDB_BUCKET_ALARMS", "alarm_events")

print(f"🔗 Connecting to InfluxDB at {INFLUXDB_URL}...")
try:
    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    buckets_api = client.buckets_api()
    
    # Check if bucket exists and create if needed
    try:
        existing_bucket = buckets_api.find_bucket_by_name(BUCKET_NAME)
        if existing_bucket:
            print(f"✅ Bucket '{BUCKET_NAME}' already exists")
        else:
            raise Exception("Bucket not found")
    except Exception:
        # Bucket doesn't exist, create it
        print(f"📦 Creating bucket '{BUCKET_NAME}'...")
        try:
            bucket = buckets_api.create_bucket(bucket_name=BUCKET_NAME, org=INFLUXDB_ORG)
            print(f"✅ Bucket '{BUCKET_NAME}' created successfully")
        except InfluxDBError as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print(f"✅ Bucket '{BUCKET_NAME}' already exists")
            else:
                print(f"❌ Error creating bucket: {e}")
                raise
    
    client.close()
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)

