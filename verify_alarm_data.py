#!/usr/bin/env python3
"""
Verify Alarm Data - Check what alarms are being received and displayed
"""
import asyncio
import websockets
import json
from datetime import datetime

WS_URL = "ws://localhost:8765"
ALARM_EVENTS_FILE = "/tmp/alarm_events.json"

def load_json_events():
    """Load events from JSON file"""
    try:
        with open(ALARM_EVENTS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

async def verify_websocket_alarms():
    """Connect to WebSocket and verify alarm messages"""
    print("=" * 80)
    print("🔍 VERIFYING ALARM DATA")
    print("=" * 80)
    print(f"\n📡 Connecting to WebSocket: {WS_URL}")
    print("   Waiting for alarm messages... (Press Ctrl+C to stop)\n")
    
    received_alarms = []
    
    try:
        async with websockets.connect(WS_URL) as websocket:
            print("✅ Connected to WebSocket server\n")
            print("📨 Listening for alarm messages...\n")
            
            # Wait for messages for 30 seconds
            try:
                async with asyncio.timeout(30):
                    async for message in websocket:
                        alarm = json.loads(message)
                        received_alarms.append(alarm)
                        
                        print(f"{'='*80}")
                        print(f"🚨 ALARM RECEIVED VIA WEBSOCKET:")
                        print(f"{'='*80}")
                        print(f"   Machine ID:     {alarm.get('machine_id', 'N/A')}")
                        print(f"   Alarm Name:  {alarm.get('alarm_name', 'N/A')}")
                        print(f"   Alarm Type:  {alarm.get('alarm_type', 'N/A')}")
                        print(f"   State:       {alarm.get('state', 'N/A')}")
                        print(f"   Timestamp:   {alarm.get('timestamp', 'N/A')}")
                        print(f"{'='*80}\n")
                        
            except asyncio.TimeoutError:
                print("\n⏱️  30 seconds elapsed. No more messages received.\n")
                
    except ConnectionRefusedError:
        print(f"❌ Connection refused to {WS_URL}")
        print("   Make sure the alarm monitor is running:")
        print("   ./start_alarm_monitor.sh")
        return
    except Exception as e:
        print(f"❌ Error: {e}")
        return
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 SUMMARY")
    print("=" * 80)
    print(f"   Total alarms received: {len(received_alarms)}")
    
    if received_alarms:
        print(f"\n   Breakdown by state:")
        raised = sum(1 for a in received_alarms if a.get('state') == 'RAISED')
        cleared = sum(1 for a in received_alarms if a.get('state') == 'CLEARED')
        print(f"   - RAISED:  {raised}")
        print(f"   - CLEARED: {cleared}")
        
        print(f"\n   Breakdown by alarm type:")
        alarm_types = {}
        for alarm in received_alarms:
            alarm_type = alarm.get('alarm_type', 'Unknown')
            alarm_types[alarm_type] = alarm_types.get(alarm_type, 0) + 1
        for alarm_type, count in alarm_types.items():
            print(f"   - {alarm_type}: {count}")
        
        print(f"\n   Breakdown by machine:")
        machines = {}
        for alarm in received_alarms:
            machine_id = alarm.get('machine_id', 'Unknown')
            machines[machine_id] = machines.get(machine_id, 0) + 1
        for machine_id, count in machines.items():
            print(f"   - {machine_id}: {count}")
    
    # Compare with JSON file
    print(f"\n{'='*80}")
    print("📄 COMPARING WITH JSON FILE")
    print("=" * 80)
    json_events = load_json_events()
    print(f"   Events in JSON file: {len(json_events)}")
    
    if json_events:
        recent_json = json_events[-5:]  # Last 5 events
        print(f"\n   Last 5 events in JSON file:")
        for i, event in enumerate(recent_json, 1):
            print(f"   {i}. {event.get('alarm_type', 'N/A')} - {event.get('state', 'N/A')} - {event.get('timestamp', 'N/A')[:19]}")
    
    print("\n" + "=" * 80)
    print("✅ Verification complete")
    print("=" * 80)

if __name__ == "__main__":
    try:
        asyncio.run(verify_websocket_alarms())
    except KeyboardInterrupt:
        print("\n\n🛑 Stopped by user")

