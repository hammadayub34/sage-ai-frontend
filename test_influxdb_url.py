#!/usr/bin/env python3
"""
Test script to find or verify InfluxDB Cloud URL
"""
from influxdb_client import InfluxDBClient
import os
from dotenv import load_dotenv

load_dotenv()

token = os.getenv('INFLUXDB_TOKEN', 'sZqeJ2UsDy9cIS4Yf_5RBYBHE-PE948EBjeXZ9CvNkT3u9EhGPrRwD87E45xVzbfXdLtmvI2jB3qQXy09SZ6uA==')
org = os.getenv('INFLUXDB_ORG', 'WISER')

# Common InfluxDB Cloud URLs to try
common_urls = [
    'https://us-east-1-1.aws.cloud2.influxdata.com',
    'https://us-west-2-1.aws.cloud2.influxdata.com',
    'https://europe-west1-1.gcp.cloud2.influxdata.com',
    'https://europe-central2-1.gcp.cloud2.influxdata.com',
    'https://ap-southeast-2-1.aws.cloud2.influxdata.com',
    'https://ap-northeast-1-1.aws.cloud2.influxdata.com',
]

print("🔍 Testing InfluxDB Cloud URLs...")
print(f"Token: {token[:20]}...")
print(f"Org: {org}\n")

for url in common_urls:
    try:
        print(f"Testing: {url}...", end=" ")
        client = InfluxDBClient(url=url, token=token, org=org, timeout=5)
        # Try to query buckets to verify connection
        buckets_api = client.buckets_api()
        buckets = buckets_api.find_buckets()
        print("✅ SUCCESS!")
        print(f"   Found {len(buckets)} buckets")
        print(f"   ✅ Your InfluxDB URL is: {url}\n")
        client.close()
        break
    except Exception as e:
        print(f"❌ Failed: {str(e)[:50]}")
        try:
            client.close()
        except:
            pass

print("\n💡 If none worked, check your InfluxDB dashboard:")
print("   1. Go to Settings → Profile")
print("   2. Look for 'InfluxDB URL' or 'API Endpoint'")
print("   3. Or check Data → Sources")

