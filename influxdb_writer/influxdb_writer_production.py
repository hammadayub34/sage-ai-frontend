#!/usr/bin/env python3
"""
InfluxDB Writer Service (Production) - Subscribes to MQTT and writes to InfluxDB
This runs on the IT network and subscribes to cloud MQTT broker
Supports multiple machines via machine_id tags
"""
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import paho.mqtt.client as mqtt
import json
import sys
import os
import ssl
import uuid
from datetime import datetime, timezone

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Production Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "192.168.1.100")  # Cloud broker IP
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "8883"))  # TLS port
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "plc/+/bottlefiller/data")  # Wildcard for multiple machines
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "influxdb_writer")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "influxdb_writer_pass")

# TLS Configuration
MQTT_TLS_ENABLED = os.getenv("MQTT_TLS_ENABLED", "true").lower() == "true"
CA_CERT_PATH = os.getenv("CA_CERT_PATH", "mosquitto/config/certs/ca.crt")

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://192.168.1.201:8086")  # IT network
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "plc_data_new")

# MQTT callback
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to MQTT broker")
        client.subscribe(MQTT_TOPIC)
        print(f"📡 Subscribed to: {MQTT_TOPIC} (multi-machine support)\n")
    else:
        print(f"❌ Failed to connect to MQTT broker, return code {rc}")

def on_message(client, userdata, msg):
    try:
        # Parse JSON message
        data = json.loads(msg.payload.decode())
        
        # Extract machine_id from topic: "plc/machine-01/bottlefiller/data"
        topic_parts = msg.topic.split('/')
        machine_id = topic_parts[1] if len(topic_parts) > 1 else "unknown"
        
        # Optional: Extract additional metadata from environment or data
        line_id = data.get("line_id") or os.getenv("LINE_ID", None)
        location = data.get("location") or os.getenv("LOCATION", None)
        
        # Debug: print received topic
        print(f"📨 Received message on topic: {msg.topic} (Machine: {machine_id})")
        
        # Handle different data formats
        if "BottleCount" in data:
            # Format from edge gateway (simplified)
            bottle_count = int(data.get("BottleCount", 0))
            filler_speed = float(data.get("FillerSpeed", 0.0))
            line_running = bool(data.get("LineRunning", False))
            
            # Create InfluxDB point with basic fields and machine_id tag
            point = Point("plc_data") \
                .tag("machine_id", machine_id)
            
            # Add optional tags if available
            if line_id:
                point = point.tag("line", line_id)
            if location:
                point = point.tag("location", location)
            
            # Parse timestamp (expecting UTC with timezone info)
            timestamp_str = data.get("timestamp")
            if timestamp_str:
                try:
                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    timestamp = datetime.now(timezone.utc)
            else:
                timestamp = datetime.now(timezone.utc)
            
            point = point \
                .field("BottleCount", bottle_count) \
                .field("FillerSpeed", filler_speed) \
                .field("LineRunning", line_running) \
                .time(timestamp)
            
        elif "counters" in data:
            # Format from mock_plc_agent (full dataset)
            # Extract all critical tags
            
            # === TIER 1: CRITICAL STATUS ===
            status = data.get("status", {})
            system_running = bool(status.get("SystemRunning", False))
            fault = bool(status.get("Fault", False))
            filling = bool(status.get("Filling", False))
            ready = bool(status.get("Ready", False))
            
            # === TIER 1: CRITICAL COUNTERS ===
            counters = data.get("counters", {})
            bottles_filled = int(counters.get("BottlesFilled", 0))
            bottles_rejected = int(counters.get("BottlesRejected", 0))
            bottles_per_minute = float(counters.get("BottlesPerMinute", 0.0))
            
            # === TIER 1: CRITICAL ALARMS ===
            alarms = data.get("alarms", {})
            alarm_fault = bool(alarms.get("Fault", False) or fault)  # Check both
            alarm_overfill = bool(alarms.get("Overfill", False))
            alarm_underfill = bool(alarms.get("Underfill", False))
            alarm_low_level = bool(alarms.get("LowProductLevel", False))
            alarm_cap_missing = bool(alarms.get("CapMissing", False))
            
            # === TIER 2: IMPORTANT ANALOG ===
            analog = data.get("analog", {})
            fill_level = float(analog.get("FillLevel", 0.0))
            tank_temperature = float(analog.get("TankTemperature", 0.0))
            tank_pressure = float(analog.get("TankPressure", 0.0))
            fill_flow_rate = float(analog.get("FillFlowRate", 0.0))
            conveyor_speed = float(analog.get("ConveyorSpeed", 0.0))
            
            # === TIER 2: IMPORTANT INPUTS ===
            inputs = data.get("inputs", {})
            low_level_sensor = bool(inputs.get("LowLevel", False))
            
            # Create InfluxDB point with ALL critical tags and machine_id
            # Tier 1: Critical Status, Counters, Alarms
            # Tier 2: Important Analog and Inputs
            point = Point("plc_data") \
                .tag("machine_id", machine_id)
            
            # Add optional tags if available
            if line_id:
                point = point.tag("line", line_id)
            if location:
                point = point.tag("location", location)
            
            point = point \
                .field("SystemRunning", system_running) \
                .field("Fault", fault) \
                .field("Filling", filling) \
                .field("Ready", ready) \
                .field("BottlesFilled", bottles_filled) \
                .field("BottlesRejected", bottles_rejected) \
                .field("BottlesPerMinute", bottles_per_minute) \
                .field("AlarmFault", alarm_fault) \
                .field("AlarmOverfill", alarm_overfill) \
                .field("AlarmUnderfill", alarm_underfill) \
                .field("AlarmLowProductLevel", alarm_low_level) \
                .field("AlarmCapMissing", alarm_cap_missing) \
                .field("FillLevel", fill_level) \
                .field("TankTemperature", tank_temperature) \
                .field("TankPressure", tank_pressure) \
                .field("FillFlowRate", fill_flow_rate) \
                .field("ConveyorSpeed", conveyor_speed) \
                .field("LowLevelSensor", low_level_sensor)
            
            # Parse timestamp (expecting UTC with timezone info)
            timestamp_str = data.get("timestamp")
            if timestamp_str:
                try:
                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    timestamp = datetime.now(timezone.utc)
            else:
                timestamp = datetime.now(timezone.utc)
            
            point = point.time(timestamp)
            
        else:
            print(f"⚠️  Unknown data format, skipping. Keys: {list(data.keys())[:5]}")
            return
        
        # Write to InfluxDB with explicit error handling
        try:
            # Debug: Print point details (every 10th message to avoid spam)
            import random
            if random.randint(1, 10) == 1:  # Print debug info 10% of the time
                data_timestamp = data.get("timestamp", "not provided")
                print(f"🔍 DEBUG: Writing to bucket={INFLUXDB_BUCKET}, machine_id={machine_id}, timestamp={data_timestamp}")
            
            write_api.write(bucket=INFLUXDB_BUCKET, record=point)
            
            # Print summary of critical tags with machine_id
            if "counters" in data:
                print(f"💾 Written [{machine_id}]: Running={system_running}, Fault={fault}, "
                      f"Bottles={bottles_filled}, Rejected={bottles_rejected}, "
                      f"Alarms=[Fault:{alarm_fault}, Overfill:{alarm_overfill}, Underfill:{alarm_underfill}]")
            else:
                print(f"💾 Written [{machine_id}]: Bottles={bottle_count}, Speed={filler_speed:.2f}, Running={line_running}")
        except Exception as write_error:
            print(f"❌ Failed to write to InfluxDB: {write_error}")
            import traceback
            traceback.print_exc()
            return  # Don't continue if write failed
        
    except json.JSONDecodeError as e:
        print(f"⚠️  JSON decode error: {e}")
    except Exception as e:
        print(f"⚠️  Error writing to InfluxDB: {e}")
        import traceback
        traceback.print_exc()

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

# Create MQTT client with unique ID to avoid conflicts
client_id = f"influxdb_writer_it_{uuid.uuid4().hex[:8]}"
mqtt_client = mqtt.Client(client_id=client_id, clean_session=True)
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message
mqtt_client.on_disconnect = on_disconnect
mqtt_client.reconnect_delay_set(min_delay=1, max_delay=120)

# Set username and password
mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

# Configure TLS if enabled
if MQTT_TLS_ENABLED:
    print(f"🔐 Configuring TLS connection...")
    if os.path.exists(CA_CERT_PATH):
        mqtt_client.tls_set(
            ca_certs=CA_CERT_PATH,
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2
        )
        # Disable hostname verification for testing (localhost vs mqtt-broker)
        # In production, use proper hostname matching
        check_hostname = os.getenv("MQTT_TLS_CHECK_HOSTNAME", "true").lower() == "true"
        if not check_hostname:
            mqtt_client.tls_insecure_set(True)
            print(f"   ⚠️  Hostname verification disabled (for testing only)")
        print(f"   ✅ TLS configured with CA cert: {CA_CERT_PATH}")
    else:
        print(f"   ⚠️  CA cert not found: {CA_CERT_PATH}")
        print(f"   ⚠️  Running without TLS verification (not recommended for production)")
        mqtt_client.tls_set(cert_reqs=ssl.CERT_NONE)

print(f"🔗 Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
print(f"   Network: IT Network")
print(f"   TLS: {'Enabled' if MQTT_TLS_ENABLED else 'Disabled'}")
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

