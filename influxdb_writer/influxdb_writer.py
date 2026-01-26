#!/usr/bin/env python3
"""
InfluxDB Writer Service - Subscribes to MQTT and writes to InfluxDB
"""
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import paho.mqtt.client as mqtt
import json
import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "plc/bottlefiller/data")  # Subscribe to full data topic

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "plc_data")

# MQTT callback
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to MQTT broker")
        client.subscribe(MQTT_TOPIC)
        print(f"📡 Subscribed to: {MQTT_TOPIC}\n")
    else:
        print(f"❌ Failed to connect to MQTT broker, return code {rc}")

def on_message(client, userdata, msg):
    try:
        # Parse JSON message
        data = json.loads(msg.payload.decode())
        
        # Debug: print received topic
        print(f"📨 Received message on topic: {msg.topic}")
        
        # Handle different data formats
        # Format 1: From modbus_reader (BottleCount, FillerSpeed, LineRunning)
        # Format 2: From mock_plc_agent (counters, analog, status)
        
        if "BottleCount" in data:
            # Format from modbus_reader
            bottle_count = int(data.get("BottleCount", 0))
            filler_speed = float(data.get("FillerSpeed", 0.0))
            line_running = bool(data.get("LineRunning", False))
        elif "counters" in data:
            # Format from mock_plc_agent
            bottle_count = int(data.get("counters", {}).get("BottlesFilled", 0))
            filler_speed = float(data.get("analog", {}).get("FillFlowRate", 0.0))
            line_running = bool(data.get("status", {}).get("SystemRunning", False))
        else:
            # Skip if format not recognized
            print(f"⚠️  Unknown data format, skipping. Keys: {list(data.keys())[:5]}")
            return
        
        # Create InfluxDB point
        point = Point("plc_data") \
            .field("BottleCount", bottle_count) \
            .field("FillerSpeed", filler_speed) \
            .field("LineRunning", line_running) \
            .time(datetime.fromisoformat(data.get("timestamp", datetime.now().isoformat())))
        
        # Write to InfluxDB
        write_api.write(bucket=INFLUXDB_BUCKET, record=point)
        
        print(f"💾 Written to InfluxDB: Bottles={bottle_count}, "
              f"Speed={filler_speed:.2f}, Running={line_running}")
        
    except json.JSONDecodeError as e:
        print(f"⚠️  JSON decode error: {e}")
    except Exception as e:
        print(f"⚠️  Error writing to InfluxDB: {e}")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"⚠️  Unexpected MQTT disconnection (rc={rc})")

# Connect to InfluxDB
print(f"🔗 Connecting to InfluxDB at {INFLUXDB_URL}...")
try:
    influx_client = InfluxDBClient(
        url=INFLUXDB_URL,
        token=INFLUXDB_TOKEN,
        org=INFLUXDB_ORG
    )
    write_api = influx_client.write_api(write_options=SYNCHRONOUS)
    print(f"✅ Connected to InfluxDB")
    print(f"   Org: {INFLUXDB_ORG}")
    print(f"   Bucket: {INFLUXDB_BUCKET}\n")
except Exception as e:
    print(f"❌ InfluxDB connection error: {e}")
    print(f"   Make sure InfluxDB is running at {INFLUXDB_URL}")
    exit(1)

# Create MQTT client
mqtt_client = mqtt.Client(client_id="influxdb_writer")
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message
mqtt_client.on_disconnect = on_disconnect
mqtt_client.reconnect_delay_set(min_delay=1, max_delay=120)

print(f"🔗 Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    print("🔄 Waiting for messages...\n")
    mqtt_client.loop_forever()
except KeyboardInterrupt:
    print("\n🛑 Stopping InfluxDB Writer...")
    mqtt_client.disconnect()
    write_api.close()
    influx_client.close()
    print("✅ InfluxDB Writer stopped")
except Exception as e:
    print(f"❌ Error: {e}")
    mqtt_client.disconnect()
    write_api.close()
    influx_client.close()
    exit(1)

