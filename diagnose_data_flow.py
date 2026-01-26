#!/usr/bin/env python3
"""
Diagnostic script to check why data is not flowing to InfluxDB
"""
import paho.mqtt.client as mqtt
import time
import json
import os
import ssl
from dotenv import load_dotenv
from influxdb_client import InfluxDBClient, Point
from datetime import datetime, timezone

load_dotenv()

print("=" * 60)
print("DATA FLOW DIAGNOSTIC")
print("=" * 60)
print()

# Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "8883"))
MQTT_USERNAME_WRITER = os.getenv("MQTT_USERNAME", "influxdb_writer")
MQTT_PASSWORD_WRITER = os.getenv("MQTT_PASSWORD", "influxdb_writer_pass")
MQTT_USERNAME_AGENT = os.getenv("MQTT_USERNAME", "mock_plc_agent")
MQTT_PASSWORD_AGENT = os.getenv("MQTT_PASSWORD", "mock_plc_agent_pass")
MQTT_TLS_ENABLED = os.getenv("MQTT_TLS_ENABLED", "true").lower() == "true"
MACHINE_ID = os.getenv("MACHINE_ID", "machine-01")

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "plc_data_new")

print("📋 Configuration:")
print(f"   MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
print(f"   MQTT TLS: {MQTT_TLS_ENABLED}")
print(f"   Machine ID: {MACHINE_ID}")
print(f"   InfluxDB: {INFLUXDB_URL}")
print(f"   Bucket: {INFLUXDB_BUCKET}")
print()

# Test 1: Check InfluxDB connection
print("1️⃣ Testing InfluxDB Connection...")
try:
    influx_client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    write_api = influx_client.write_api()
    
    # Test write
    test_point = Point("diagnostic_test") \
        .field("test_value", 1) \
        .time(datetime.now(timezone.utc))
    
    write_api.write(bucket=INFLUXDB_BUCKET, record=test_point)
    write_api.close()
    influx_client.close()
    print("   ✅ InfluxDB connection and write: SUCCESS")
except Exception as e:
    print(f"   ❌ InfluxDB error: {e}")
    exit(1)

print()

# Test 2: Check MQTT subscription
print("2️⃣ Testing MQTT Subscription...")
received_messages = []

def on_connect_sub(client, userdata, flags, rc):
    if rc == 0:
        client.subscribe(f"plc/+/bottlefiller/data")
        print(f"   ✅ Connected and subscribed to: plc/+/bottlefiller/data")
    else:
        print(f"   ❌ Connection failed: {rc}")

def on_message_sub(client, userdata, msg):
    received_messages.append(msg)
    print(f"   📨 Received: {msg.topic}")

sub_client = mqtt.Client(client_id="diagnostic_subscriber")
sub_client.on_connect = on_connect_sub
sub_client.on_message = on_message_sub

if MQTT_USERNAME_WRITER and MQTT_PASSWORD_WRITER:
    sub_client.username_pw_set(MQTT_USERNAME_WRITER, MQTT_PASSWORD_WRITER)

if MQTT_TLS_ENABLED:
    sub_client.tls_set(cert_reqs=ssl.CERT_NONE)
    sub_client.tls_insecure_set(True)

try:
    sub_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    sub_client.loop_start()
    time.sleep(2)  # Wait for connection
    
    print("   ⏳ Waiting 10 seconds for messages from Mock PLC Agent...")
    time.sleep(10)
    
    sub_client.loop_stop()
    sub_client.disconnect()
    
    if received_messages:
        print(f"   ✅ Received {len(received_messages)} message(s)")
        for msg in received_messages[:3]:  # Show first 3
            try:
                data = json.loads(msg.payload.decode())
                print(f"      Topic: {msg.topic}")
                print(f"      Has 'counters': {'counters' in data}")
                print(f"      Machine ID in data: {data.get('machine_id', 'N/A')}")
            except:
                print(f"      Topic: {msg.topic} (non-JSON payload)")
    else:
        print(f"   ⚠️  NO messages received!")
        print(f"   💡 Mock PLC Agent might not be publishing")
except Exception as e:
    print(f"   ❌ Error: {e}")

print()

# Test 3: Test publishing
print("3️⃣ Testing MQTT Publishing...")
pub_connected = False

def on_connect_pub(client, userdata, flags, rc):
    global pub_connected
    if rc == 0:
        pub_connected = True
        print(f"   ✅ Connected to MQTT broker")

def on_publish_pub(client, userdata, mid):
    print(f"   ✅ Message published (mid: {mid})")

pub_client = mqtt.Client(client_id="diagnostic_publisher")
pub_client.on_connect = on_connect_pub
pub_client.on_publish = on_publish_pub

if MQTT_USERNAME_AGENT and MQTT_PASSWORD_AGENT:
    pub_client.username_pw_set(MQTT_USERNAME_AGENT, MQTT_PASSWORD_AGENT)

if MQTT_TLS_ENABLED:
    pub_client.tls_set(cert_reqs=ssl.CERT_NONE)
    pub_client.tls_insecure_set(True)

try:
    pub_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    pub_client.loop_start()
    
    # Wait for connection
    for i in range(10):
        if pub_connected:
            break
        time.sleep(0.5)
    
    if pub_connected:
        # Publish test message
        topic = f"plc/{MACHINE_ID}/bottlefiller/data"
        test_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "machine_id": MACHINE_ID,
            "counters": {
                "BottlesFilled": 9999,
                "BottlesRejected": 0,
                "BottlesPerMinute": 99.9
            },
            "status": {
                "SystemRunning": True,
                "Filling": False,
                "Fault": False,
                "Ready": True
            },
            "analog": {
                "FillLevel": 75.5,
                "TankTemperature": 22.3,
                "TankPressure": 12.5,
                "FillFlowRate": 0.0,
                "ConveyorSpeed": 125.0
            },
            "alarms": {
                "Fault": False,
                "Overfill": False,
                "Underfill": False,
                "LowProductLevel": False,
                "CapMissing": False
            },
            "inputs": {
                "LowLevel": False
            }
        }
        
        payload = json.dumps(test_data)
        result = pub_client.publish(topic, payload, qos=1)
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"   ✅ Test message published to: {topic}")
            time.sleep(2)  # Wait for delivery
        else:
            print(f"   ❌ Publish failed: {result.rc}")
    else:
        print(f"   ❌ Could not connect to MQTT broker")
    
    pub_client.loop_stop()
    pub_client.disconnect()
except Exception as e:
    print(f"   ❌ Error: {e}")

print()
print("=" * 60)
print("DIAGNOSTIC COMPLETE")
print("=" * 60)
print()
print("📊 Summary:")
print(f"   InfluxDB: ✅ Working")
print(f"   MQTT Subscription: {'✅ Working' if received_messages else '❌ No messages'}")
print(f"   MQTT Publishing: {'✅ Working' if pub_connected else '❌ Failed'}")
print()
if not received_messages:
    print("💡 Recommendation:")
    print("   The Mock PLC Agent process is running but not publishing messages.")
    print("   Try:")
    print("   1. Kill the agent: pkill -f mock_plc_agent.py")
    print("   2. Restart it: python3 mock_plc_agent/mock_plc_agent.py")
    print("   3. Check the terminal output for connection errors")

