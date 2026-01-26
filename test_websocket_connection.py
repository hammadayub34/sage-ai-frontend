#!/usr/bin/env python3
"""
Test WebSocket connection to alarm monitor
This script connects to the WebSocket server and listens for alarm messages
"""
import asyncio
import websockets
import json
import sys

WS_URL = "ws://localhost:8765"

async def test_websocket():
    """Test WebSocket connection and listen for messages"""
    print(f"🔍 Testing WebSocket connection to {WS_URL}")
    print("=" * 60)
    
    try:
        async with websockets.connect(WS_URL) as websocket:
            print("✅ WebSocket connection established!")
            print("📡 Listening for alarm messages...")
            print("   (Press Ctrl+C to stop)\n")
            
            # Wait for messages
            try:
                async for message in websocket:
                    alarm = json.loads(message)
                    print(f"\n{'='*60}")
                    print(f"🚨 ALARM EVENT RECEIVED:")
                    print(f"   Machine: {alarm.get('machine_id', 'unknown')}")
                    print(f"   Alarm: {alarm.get('alarm_name', 'unknown')}")
                    print(f"   Type: {alarm.get('alarm_type', 'unknown')}")
                    print(f"   State: {alarm.get('state', 'unknown')}")
                    print(f"   Timestamp: {alarm.get('timestamp', 'unknown')}")
                    print(f"{'='*60}\n")
            except KeyboardInterrupt:
                print("\n🛑 Stopping test...")
                
    except websockets.exceptions.InvalidURI:
        print(f"❌ Invalid WebSocket URL: {WS_URL}")
        print("   Make sure the URL is correct (ws://host:port)")
        sys.exit(1)
    except ConnectionRefusedError:
        print(f"❌ Connection refused to {WS_URL}")
        print("   Make sure the alarm monitor is running:")
        print("   ./start_alarm_monitor.sh")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(test_websocket())
    except KeyboardInterrupt:
        print("\n✅ Test stopped")

