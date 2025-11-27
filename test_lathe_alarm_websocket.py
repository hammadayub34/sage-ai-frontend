#!/usr/bin/env python3
"""
Test script to listen for lathe alarm messages via WebSocket
This connects to the Alarm Monitor's WebSocket server and displays lathe alarms
"""
import asyncio
import websockets
import json
from datetime import datetime

WS_URL = "ws://localhost:8765"

async def test_lathe_alarms():
    """Connect to WebSocket and listen for lathe alarm messages"""
    print("🔌 Connecting to Alarm Monitor WebSocket...")
    print(f"   URL: {WS_URL}")
    print("   Waiting for lathe alarm messages...")
    print("   (Make sure lathe simulator is running and generating alarms)\n")
    print("=" * 60)
    
    try:
        async with websockets.connect(WS_URL) as websocket:
            print("✅ Connected to WebSocket server!\n")
            print("📡 Listening for alarm messages...")
            print("   (Press Ctrl+C to stop)\n")
            print("-" * 60)
            
            message_count = 0
            lathe_alarm_count = 0
            
            async for message in websocket:
                try:
                    data = json.loads(message)
                    message_count += 1
                    
                    # Check if this is a lathe alarm
                    machine_id = data.get("machine_id", "unknown")
                    is_lathe = machine_id.startswith("lathe")
                    
                    if is_lathe:
                        lathe_alarm_count += 1
                        alarm_type = data.get("alarm_type", "Unknown")
                        alarm_name = data.get("alarm_name", "Unknown")
                        state = data.get("state", "Unknown")
                        timestamp = data.get("timestamp", "Unknown")
                        
                        print(f"\n🚨 LATHE ALARM #{lathe_alarm_count} DETECTED!")
                        print(f"   Machine ID: {machine_id}")
                        print(f"   Alarm Type: {alarm_type}")
                        print(f"   Alarm Name: {alarm_name}")
                        print(f"   State: {state}")
                        print(f"   Timestamp: {timestamp}")
                        print(f"   Full Message: {json.dumps(data, indent=2)}")
                        print("-" * 60)
                    else:
                        # Show bottle filler alarms too, but mark them
                        print(f"📦 Bottle Filler Alarm (ignoring): {data.get('alarm_type', 'Unknown')}")
                    
                    # Show summary every 10 messages
                    if message_count % 10 == 0:
                        print(f"\n📊 Summary: {message_count} total messages, {lathe_alarm_count} lathe alarms\n")
                        
                except json.JSONDecodeError:
                    print(f"⚠️  Received non-JSON message: {message}")
                except Exception as e:
                    print(f"❌ Error processing message: {e}")
                    
    except websockets.exceptions.ConnectionClosed:
        print("\n❌ WebSocket connection closed")
    except ConnectionRefusedError:
        print(f"\n❌ Could not connect to {WS_URL}")
        print("   Make sure Alarm Monitor is running:")
        print("   ./start_alarm_monitor.sh")
    except KeyboardInterrupt:
        print(f"\n\n🛑 Stopped listening")
        print(f"📊 Final Summary: {message_count} total messages, {lathe_alarm_count} lathe alarms")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 Lathe Alarm WebSocket Test")
    print("=" * 60)
    print()
    asyncio.run(test_lathe_alarms())

