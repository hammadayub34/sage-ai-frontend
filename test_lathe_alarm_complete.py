#!/usr/bin/env python3
"""
Complete test for lathe alarms - checks both MQTT and WebSocket
"""
import asyncio
import websockets
import json
import paho.mqtt.client as mqtt
import ssl
import os
import sys
from threading import Thread
import time

# MQTT Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "8883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "influxdb_writer")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "influxdb_writer_pass")
MQTT_TLS_ENABLED = True
CA_CERT_PATH = "mosquitto/config/certs/ca.crt"

# WebSocket URL
WS_URL = "ws://localhost:8765"

mqtt_messages = []
ws_messages = []

def on_mqtt_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT broker")
        client.subscribe("plc/+/lathe/alarms")
        print("📡 Subscribed to: plc/+/lathe/alarms")
    else:
        print(f"❌ MQTT connection failed: {rc}")

def on_mqtt_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        mqtt_messages.append({
            "topic": msg.topic,
            "payload": payload,
            "timestamp": time.time()
        })
        
        # Check if any alarm is True
        active_alarms = [k for k, v in payload.items() if v is True]
        if active_alarms:
            print(f"\n🚨 MQTT: Active lathe alarm detected!")
            print(f"   Topic: {msg.topic}")
            print(f"   Active Alarms: {active_alarms}")
            print(f"   Full Payload: {json.dumps(payload, indent=2)}")
        else:
            print(f"📡 MQTT: Received alarms (all False): {list(payload.keys())}")
    except Exception as e:
        print(f"❌ Error processing MQTT message: {e}")

async def test_websocket():
    """Test WebSocket connection"""
    try:
        async with websockets.connect(WS_URL) as websocket:
            print("✅ Connected to WebSocket")
            print("📡 Listening for alarm messages...\n")
            
            try:
                async with asyncio.timeout(30):
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            ws_messages.append(data)
                            
                            machine_id = data.get("machine_id", "unknown")
                            if machine_id.startswith("lathe"):
                                print(f"\n🚨 WEBSOCKET: Lathe alarm detected!")
                                print(f"   Machine ID: {machine_id}")
                                print(f"   Alarm Type: {data.get('alarm_type', 'Unknown')}")
                                print(f"   Alarm Name: {data.get('alarm_name', 'Unknown')}")
                                print(f"   State: {data.get('state', 'Unknown')}")
                                print(f"   Timestamp: {data.get('timestamp', 'Unknown')}")
                            else:
                                print(f"📦 WebSocket: Bottle filler alarm (ignoring)")
                        except json.JSONDecodeError:
                            pass
            except asyncio.TimeoutError:
                pass
    except ConnectionRefusedError:
        print(f"❌ Could not connect to WebSocket: {WS_URL}")
    except Exception as e:
        print(f"❌ WebSocket error: {e}")

def run_mqtt_test():
    """Run MQTT test in a thread"""
    client = mqtt.Client(client_id="test_lathe_alarms")
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    if MQTT_TLS_ENABLED and os.path.exists(CA_CERT_PATH):
        client.tls_set(
            ca_certs=CA_CERT_PATH,
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2
        )
        client.tls_insecure_set(True)  # For localhost
    
    client.on_connect = on_mqtt_connect
    client.on_message = on_mqtt_message
    
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        time.sleep(30)  # Listen for 30 seconds
        client.loop_stop()
        client.disconnect()
    except Exception as e:
        print(f"❌ MQTT error: {e}")

async def main():
    print("=" * 60)
    print("🧪 Complete Lathe Alarm Test")
    print("=" * 60)
    print()
    print("Testing both MQTT and WebSocket connections...")
    print("Listening for 30 seconds...\n")
    print("-" * 60)
    
    # Start MQTT test in a thread
    mqtt_thread = Thread(target=run_mqtt_test, daemon=True)
    mqtt_thread.start()
    
    # Run WebSocket test
    await test_websocket()
    
    # Wait for MQTT thread to finish
    mqtt_thread.join(timeout=5)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    print(f"MQTT Messages Received: {len(mqtt_messages)}")
    print(f"WebSocket Messages Received: {len(ws_messages)}")
    
    if mqtt_messages:
        active_count = sum(1 for m in mqtt_messages if any(v for v in m["payload"].values() if v is True))
        print(f"MQTT Messages with Active Alarms: {active_count}")
    
    lathe_ws_count = sum(1 for m in ws_messages if m.get("machine_id", "").startswith("lathe"))
    print(f"WebSocket Lathe Alarms: {lathe_ws_count}")
    
    if len(mqtt_messages) > 0 and lathe_ws_count == 0:
        print("\n⚠️  Note: MQTT messages are being received, but no WebSocket broadcasts.")
        print("   This is normal if alarms are all False (no state transitions).")
        print("   The alarm monitor only broadcasts when alarm states change.")

if __name__ == "__main__":
    asyncio.run(main())

