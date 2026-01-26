#!/usr/bin/env python3
"""
Test InfluxDB connection and verify bucket name
"""
from dotenv import load_dotenv
import os
from influxdb_client import InfluxDBClient
from influxdb_client.client.exceptions import InfluxDBError

load_dotenv()

url = os.getenv('INFLUXDB_URL')
token = os.getenv('INFLUXDB_TOKEN')
org = os.getenv('INFLUXDB_ORG')
bucket = os.getenv('INFLUXDB_BUCKET')

print("=" * 60)
print("Testing InfluxDB Connection and Bucket")
print("=" * 60)
print(f"URL: {url}")
print(f"Org: {org}")
print(f"Bucket: {bucket}")
print(f"Token: {'SET' if token else 'NOT SET'}")
print()

if not all([url, token, org, bucket]):
    print("❌ Missing required environment variables!")
    print("   Required: INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET")
    exit(1)

try:
    print("🔗 Testing basic connectivity first...")
    import urllib3
    import socket
    
    # Test basic connectivity
    try:
        host = url.replace('https://', '').replace('http://', '').split('/')[0]
        print(f"   Testing connection to {host}...")
        sock = socket.create_connection((host, 443), timeout=10)
        sock.close()
        print("   ✅ Network connectivity OK")
    except Exception as e:
        print(f"   ⚠️  Network test failed: {e}")
        print("   💡 This might be a Replit network restriction")
    
    print("\n🔗 Connecting to InfluxDB...")
    # Use longer timeout for connection - configure urllib3 pool manager
    import urllib3
    http = urllib3.PoolManager(
        timeout=urllib3.Timeout(connect=30.0, read=30.0),
        retries=urllib3.Retry(total=3, backoff_factor=0.3)
    )
    
    client = InfluxDBClient(
        url=url, 
        token=token, 
        org=org, 
        timeout=30000  # 30 seconds in milliseconds
    )
    
    # Test 1: List all buckets
    print("\n📦 Test 1: Listing all buckets...")
    buckets_api = client.buckets_api()
    buckets_response = buckets_api.find_buckets()
    
    # Access buckets from response object
    bucket_list = buckets_response.buckets
    print(f"   Found {len(bucket_list)} buckets:")
    bucket_names = []
    for b in bucket_list:
        bucket_names.append(b.name)
        print(f"   - {b.name}")
    
    # Test 2: Check if our bucket exists
    print(f"\n🔍 Test 2: Checking if bucket '{bucket}' exists...")
    if bucket in bucket_names:
        print(f"   ✅ Bucket '{bucket}' exists!")
    else:
        print(f"   ❌ Bucket '{bucket}' NOT FOUND!")
        print(f"   Available buckets: {', '.join(bucket_names)}")
        print(f"   💡 Update INFLUXDB_BUCKET in .env to one of the above")
        exit(1)
    
    # Test 3: Try to query the bucket
    print(f"\n📊 Test 3: Querying bucket '{bucket}'...")
    query_api = client.query_api()
    
    # Simple query to check if bucket has data
    query = f'''
        from(bucket: "{bucket}")
          |> range(start: -1h)
          |> limit(n: 1)
    '''
    
    try:
        results = list(query_api.query(query))
        if results:
            print(f"   ✅ Bucket is accessible and queryable!")
            print(f"   ✅ Found data in bucket")
        else:
            print(f"   ✅ Bucket is accessible but empty (no data yet)")
            print(f"   💡 This is normal if Mock PLC Agent hasn't started yet")
    except InfluxDBError as e:
        print(f"   ❌ Query failed: {e}")
        print(f"   💡 Check bucket permissions and token access")
        exit(1)
    
    print("\n" + "=" * 60)
    print("✅ All tests passed! InfluxDB is configured correctly.")
    print("=" * 60)
    
    client.close()
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

