#!/usr/bin/env python3
"""
Script to create the work_orders bucket in InfluxDB if it doesn't exist.
"""

import os
import requests
from influxdb_client import InfluxDBClient, BucketsApi, BucketRetentionRules

# InfluxDB configuration
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
BUCKET_NAME = "work_orders"

def create_bucket_if_not_exists():
    """Create the work_orders bucket if it doesn't exist."""
    try:
        client = InfluxDBClient(
            url=INFLUXDB_URL,
            token=INFLUXDB_TOKEN,
            org=INFLUXDB_ORG
        )
        
        buckets_api = BucketsApi(client)
        
        # Check if bucket exists
        buckets = buckets_api.find_buckets()
        existing_bucket = None
        
        for bucket in buckets.buckets:
            if bucket.name == BUCKET_NAME:
                existing_bucket = bucket
                break
        
        if existing_bucket:
            print(f"✅ Bucket '{BUCKET_NAME}' already exists")
            print(f"   ID: {existing_bucket.id}")
            print(f"   Retention: {existing_bucket.retention_rules}")
        else:
            print(f"📦 Creating bucket '{BUCKET_NAME}'...")
            
            # Create bucket with no retention (infinite retention)
            retention_rules = BucketRetentionRules(type="expire", every_seconds=0)
            bucket = buckets_api.create_bucket(
                bucket_name=BUCKET_NAME,
                org=INFLUXDB_ORG,
                retention_rules=retention_rules
            )
            
            print(f"✅ Bucket '{BUCKET_NAME}' created successfully")
            print(f"   ID: {bucket.id}")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ Error creating bucket: {e}")
        return False

if __name__ == "__main__":
    print(f"🔍 Checking InfluxDB bucket: {BUCKET_NAME}")
    print(f"   URL: {INFLUXDB_URL}")
    print(f"   Org: {INFLUXDB_ORG}\n")
    
    success = create_bucket_if_not_exists()
    exit(0 if success else 1)

