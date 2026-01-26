#!/usr/bin/env python3
"""
Script to import CSV data into InfluxDB.

Usage:
    python scripts/import_csv_to_influxdb.py <csv_file> <bucket_name> [options]

Example:
    python scripts/import_csv_to_influxdb.py data/my_data.csv my_new_bucket
    python scripts/import_csv_to_influxdb.py data/my_data.csv my_new_bucket --measurement my_measurement
    python scripts/import_csv_to_influxdb.py data/my_data.csv my_new_bucket --time-column timestamp --time-format "%Y-%m-%d %H:%M:%S"
"""

import os
import sys
import csv
import argparse
from datetime import datetime
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

# Configuration
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")


def parse_time(time_str, time_format=None):
    """Parse time string to datetime object."""
    if not time_str or time_str.strip() == '':
        return datetime.utcnow()
    
    if time_format:
        try:
            return datetime.strptime(time_str.strip(), time_format)
        except ValueError:
            print(f"⚠️  Warning: Could not parse time '{time_str}' with format '{time_format}', using current time")
            return datetime.utcnow()
    else:
        # Try common formats
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%d",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(time_str.strip(), fmt)
            except ValueError:
                continue
        
        print(f"⚠️  Warning: Could not parse time '{time_str}', using current time")
        return datetime.utcnow()


def import_csv_to_influxdb(
    csv_file,
    bucket_name,
    measurement="data",
    time_column=None,
    time_format=None,
    tag_columns=None,
    field_columns=None,
    skip_header=True,
):
    """Import CSV data into InfluxDB."""
    
    if not os.path.exists(csv_file):
        print(f"❌ Error: CSV file not found: {csv_file}")
        return False
    
    print(f"📂 Reading CSV file: {csv_file}")
    print(f"📦 Target bucket: {bucket_name}")
    print(f"📊 Measurement: {measurement}")
    print(f"⏰ Time column: {time_column or 'auto-generated'}")
    print()
    
    # Connect to InfluxDB
    try:
        client = InfluxDBClient(
            url=INFLUXDB_URL,
            token=INFLUXDB_TOKEN,
            org=INFLUXDB_ORG
        )
        write_api = client.write_api(write_options=SYNCHRONOUS)
        print(f"✅ Connected to InfluxDB at {INFLUXDB_URL}")
    except Exception as e:
        print(f"❌ Error connecting to InfluxDB: {e}")
        return False
    
    # Read CSV file
    points = []
    total_rows = 0
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            # Get column names
            columns = reader.fieldnames
            if not columns:
                print("❌ Error: CSV file has no columns")
                return False
            
            print(f"📋 Columns found: {', '.join(columns)}")
            print()
            
            # Determine which columns are tags/fields
            if tag_columns is None:
                # Auto-detect: columns that look like tags (lowercase, no spaces, etc.)
                tag_columns = []
            if field_columns is None:
                # All other columns except time column
                field_columns = [col for col in columns if col != time_column]
            
            # Process each row
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (1 is header)
                try:
                    # Create point
                    point = Point(measurement)
                    
                    # Add time
                    if time_column and time_column in row:
                        timestamp = parse_time(row[time_column], time_format)
                    else:
                        timestamp = datetime.utcnow()
                    point = point.time(timestamp)
                    
                    # Add tags
                    for tag_col in tag_columns:
                        if tag_col in row and row[tag_col]:
                            point = point.tag(tag_col, str(row[tag_col]).strip())
                    
                    # Add fields
                    for field_col in field_columns:
                        if field_col in row and row[field_col]:
                            value = row[field_col].strip()
                            if not value:
                                continue
                            
                            # Try to convert to number
                            try:
                                # Always use float for numeric values to avoid type conflicts in InfluxDB
                                float_val = float(value)
                                point = point.field(field_col, float_val)
                            except ValueError:
                                # Keep as string if not numeric
                                point = point.field(field_col, value)
                    
                    points.append(point)
                    total_rows += 1
                    
                    # Write in batches of 1000
                    if len(points) >= 1000:
                        write_api.write(bucket=bucket_name, record=points)
                        print(f"  ✅ Written {total_rows} rows...", end='\r')
                        points = []
                
                except Exception as e:
                    print(f"\n⚠️  Warning: Error processing row {row_num}: {e}")
                    continue
        
        # Write remaining points
        if points:
            write_api.write(bucket=bucket_name, record=points)
        
        write_api.close()
        client.close()
        
        print(f"\n✅ Successfully imported {total_rows} rows into bucket '{bucket_name}'")
        return True
        
    except Exception as e:
        print(f"\n❌ Error reading CSV file: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Import CSV data into InfluxDB',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic import (auto-detect everything)
  python scripts/import_csv_to_influxdb.py data/my_data.csv my_bucket
  
  # Specify measurement name
  python scripts/import_csv_to_influxdb.py data/my_data.csv my_bucket --measurement sensors
  
  # Specify time column and format
  python scripts/import_csv_to_influxdb.py data/my_data.csv my_bucket --time-column timestamp --time-format "%Y-%m-%d %H:%M:%S"
  
  # Specify which columns are tags
  python scripts/import_csv_to_influxdb.py data/my_data.csv my_bucket --tag-columns machine_id,location
        """
    )
    
    parser.add_argument('csv_file', help='Path to CSV file')
    parser.add_argument('bucket_name', help='InfluxDB bucket name')
    parser.add_argument('--measurement', default='data', help='Measurement name (default: data)')
    parser.add_argument('--time-column', help='Column name for timestamp (if not specified, uses current time)')
    parser.add_argument('--time-format', help='Time format string (e.g., "%%Y-%%m-%%d %%H:%%M:%%S")')
    parser.add_argument('--tag-columns', help='Comma-separated list of column names to use as tags')
    parser.add_argument('--field-columns', help='Comma-separated list of column names to use as fields (default: all except time and tags)')
    parser.add_argument('--no-header', action='store_true', help='CSV file has no header row')
    
    args = parser.parse_args()
    
    # Parse tag/field columns
    tag_columns = None
    if args.tag_columns:
        tag_columns = [col.strip() for col in args.tag_columns.split(',')]
    
    field_columns = None
    if args.field_columns:
        field_columns = [col.strip() for col in args.field_columns.split(',')]
    
    # Import
    success = import_csv_to_influxdb(
        csv_file=args.csv_file,
        bucket_name=args.bucket_name,
        measurement=args.measurement,
        time_column=args.time_column,
        time_format=args.time_format,
        tag_columns=tag_columns,
        field_columns=field_columns,
        skip_header=not args.no_header,
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

