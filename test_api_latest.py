#!/usr/bin/env python3
"""
Test script to query the frontend API endpoint for latest tag values
"""
import requests
import json
import sys
from datetime import datetime

# Configuration
API_URL = "http://localhost:3005/api/influxdb/latest"
MACHINE_ID = sys.argv[1] if len(sys.argv) > 1 else "machine-01"

def test_latest_endpoint():
    """Query the latest tag values endpoint"""
    print("🧪 Testing Frontend API Endpoint")
    print("=" * 60)
    print(f"📡 Machine ID: {MACHINE_ID}")
    print(f"🌐 Endpoint: {API_URL}?machineId={MACHINE_ID}")
    print()
    
    try:
        response = requests.get(f"{API_URL}?machineId={MACHINE_ID}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Success! Latest tag values:")
            print("-" * 60)
            print(f"Machine ID: {data.get('machineId')}")
            print(f"Timestamp: {data.get('timestamp')}")
            print()
            print("📊 Tag Values:")
            print("-" * 60)
            
            tag_data = data.get('data', {})
            if tag_data:
                # Group by category
                status_fields = ['SystemRunning', 'Fault', 'Filling', 'Ready']
                counter_fields = ['BottlesFilled', 'BottlesRejected', 'BottlesPerMinute']
                alarm_fields = ['AlarmFault', 'AlarmOverfill', 'AlarmUnderfill', 
                               'AlarmLowProductLevel', 'AlarmCapMissing']
                analog_fields = ['FillLevel', 'TankTemperature', 'TankPressure', 
                                'FillFlowRate', 'ConveyorSpeed']
                input_fields = ['LowLevelSensor']
                
                print("\n🔵 STATUS FIELDS:")
                for field in status_fields:
                    if field in tag_data:
                        value = tag_data[field]
                        status = "✓ TRUE" if value else "✗ FALSE"
                        print(f"   {field:25s}: {status}")
                
                print("\n📈 COUNTER FIELDS:")
                for field in counter_fields:
                    if field in tag_data:
                        print(f"   {field:25s}: {tag_data[field]}")
                
                print("\n⚠️  ALARM FIELDS:")
                for field in alarm_fields:
                    if field in tag_data:
                        value = tag_data[field]
                        status = "⚠️  ACTIVE" if value else "✓ OK"
                        print(f"   {field:25s}: {status}")
                
                print("\n📊 ANALOG FIELDS:")
                for field in analog_fields:
                    if field in tag_data:
                        value = tag_data[field]
                        if isinstance(value, float):
                            print(f"   {field:25s}: {value:.2f}")
                        else:
                            print(f"   {field:25s}: {value}")
                
                print("\n🔌 INPUT FIELDS:")
                for field in input_fields:
                    if field in tag_data:
                        value = tag_data[field]
                        status = "✓ TRUE" if value else "✗ FALSE"
                        print(f"   {field:25s}: {status}")
            else:
                print("   ⚠️  No tag data in response")
                
        elif response.status_code == 404:
            print("❌ No data found")
            print("   Make sure:")
            print("   1. Mock PLC agent is running")
            print("   2. InfluxDB writer is running")
            print("   3. Data has been written in the last 5 minutes")
            print()
            print("   Try running:")
            print("   ./start_mock_plc.sh machine-01")
            print("   ./start_influxdb_writer.sh")
            
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error!")
        print("   Make sure the frontend server is running:")
        print("   cd frontend && npm run dev")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_latest_endpoint()

