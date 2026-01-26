#!/usr/bin/env python3
"""
Simple script to query InfluxDB and see data
Usage: 
  python3 query_influxdb.py                    # Uses .env file
  python3 query_influxdb.py --url <url> --token <token> --org <org> --bucket <bucket>
"""
from influxdb_client import InfluxDBClient
import os
import sys
import argparse
from datetime import datetime, timedelta

# Load .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def query_influxdb(url, token, org, bucket, time_range="-1h", field="BottlesPerMinute", machine_id="machine-01"):
    """Query InfluxDB and display results"""
    print(f"🔍 Querying InfluxDB...")
    print(f"   URL: {url}")
    print(f"   Org: {org}")
    print(f"   Bucket: {bucket}")
    print(f"   Time Range: {time_range}")
    print(f"   Field: {field}")
    print(f"   Machine: {machine_id}\n")
    
    try:
        client = InfluxDBClient(url=url, token=token, org=org)
        query_api = client.query_api()
        
        # Query 1: Get latest value
        print("📊 Latest Value:")
        query1 = f'''
        from(bucket: "{bucket}")
          |> range(start: {time_range})
          |> filter(fn: (r) => r["machine_id"] == "{machine_id}")
          |> filter(fn: (r) => r["_field"] == "{field}")
          |> last()
        '''
        result1 = query_api.query(query1)
        
        if result1:
            for table in result1:
                for record in table.records:
                    value = record.get_value()
                    time = record.get_time()
                    print(f"   ✅ {field} = {value} at {time}")
        else:
            print(f"   ⚠️  No data found for {field}")
        
        print()
        
        # Query 2: Get all recent data points
        print(f"📊 Recent Data Points (last {time_range}):")
        query2 = f'''
        from(bucket: "{bucket}")
          |> range(start: {time_range})
          |> filter(fn: (r) => r["machine_id"] == "{machine_id}")
          |> filter(fn: (r) => r["_field"] == "{field}")
          |> limit(n: 10)
        '''
        result2 = query_api.query(query2)
        
        count = 0
        for table in result2:
            for record in table.records:
                value = record.get_value()
                time = record.get_time()
                print(f"   {time}: {value}")
                count += 1
        
        if count == 0:
            print(f"   ⚠️  No data points found")
        else:
            print(f"\n   📈 Found {count} data point(s)")
        
        print()
        
        # Query 3: List all available fields
        print("📊 Available Fields:")
        query3 = f'''
        from(bucket: "{bucket}")
          |> range(start: {time_range})
          |> filter(fn: (r) => r["machine_id"] == "{machine_id}")
          |> keys()
          |> keep(columns: ["_field"])
          |> distinct()
        '''
        result3 = query_api.query(query3)
        
        fields = []
        for table in result3:
            for record in table.records:
                field = record.get_value()
                if field and field not in fields:
                    fields.append(field)
        
        if fields:
            print(f"   ✅ Available fields: {', '.join(fields[:10])}")
            if len(fields) > 10:
                print(f"   ... and {len(fields) - 10} more")
        else:
            print(f"   ⚠️  No fields found")
        
        print()
        
        # Query 4: Count total data points
        print("📊 Total Data Points:")
        query4 = f'''
        from(bucket: "{bucket}")
          |> range(start: {time_range})
          |> filter(fn: (r) => r["machine_id"] == "{machine_id}")
          |> count()
        '''
        result4 = query_api.query(query4)
        
        total = 0
        for table in result4:
            for record in table.records:
                total = record.get_value()
        
        print(f"   ✅ Total: {total} data points")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error querying InfluxDB: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Query InfluxDB data")
    parser.add_argument("--url", default=os.getenv("INFLUXDB_URL", "http://localhost:8086"))
    parser.add_argument("--token", default=os.getenv("INFLUXDB_TOKEN", ""))
    parser.add_argument("--org", default=os.getenv("INFLUXDB_ORG", "myorg"))
    parser.add_argument("--bucket", default=os.getenv("INFLUXDB_BUCKET", "plc_data_new"))
    parser.add_argument("--time-range", default="-1h", help="Time range (e.g., -1h, -30m, -24h)")
    parser.add_argument("--field", default="BottlesPerMinute", help="Field to query")
    parser.add_argument("--machine", default="machine-01", help="Machine ID")
    
    args = parser.parse_args()
    
    if not args.token:
        print("❌ Error: INFLUXDB_TOKEN not set")
        print("   Set it in .env file or use --token argument")
        sys.exit(1)
    
    query_influxdb(
        url=args.url,
        token=args.token,
        org=args.org,
        bucket=args.bucket,
        time_range=args.time_range,
        field=args.field,
        machine_id=args.machine
    )

