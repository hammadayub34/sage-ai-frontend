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

# Load .env file from project root
try:
    from dotenv import load_dotenv
    # Load from project root (parent of influxdb_writer directory)
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    load_dotenv(env_path)
except ImportError:
    pass  # dotenv not installed, skip

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
        client.subscribe(MQTT_TOPIC)  # Bottlefiller topics
        client.subscribe("plc/+/lathe/data")  # Lathe topics
        print(f"📡 Subscribed to: {MQTT_TOPIC} (bottlefiller)")
        print(f"📡 Subscribed to: plc/+/lathe/data (lathe)\n")
    else:
        print(f"❌ Failed to connect to MQTT broker, return code {rc}")

def on_message(client, userdata, msg):
    try:
        # Debug: Print ALL received messages
        print(f"📨 Received message on topic: {msg.topic} (Machine: {msg.topic.split('/')[1] if len(msg.topic.split('/')) > 1 else 'unknown'})")
        
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
                .tag("machine_id", machine_id) \
                .tag("machine_type", "bottlefiller")
            
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
                .tag("machine_id", machine_id) \
                .tag("machine_type", "bottlefiller")
            
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
            
        elif "lathe" in msg.topic or "spindle" in data:
            # Format from lathe_sim (CNC Lathe data)
            # Extract machine_id from topic: "plc/lathe01/lathe/data"
            print(f"🔧 Processing lathe data from topic: {msg.topic}")
            machine_id = topic_parts[1] if len(topic_parts) > 1 else "unknown"
            
            # Extract lathe-specific data
            safety = data.get("safety", {})
            spindle = data.get("spindle", {})
            axis_x = data.get("axis_x", {})
            axis_z = data.get("axis_z", {})
            production = data.get("production", {})
            alarms = data.get("alarms", {})
            status = data.get("status", {})
            tooling = data.get("tooling", {})
            coolant = data.get("coolant", {})
            
            # Create InfluxDB point for lathe with machine_type tag
            point = Point("plc_data") \
                .tag("machine_id", machine_id) \
                .tag("machine_type", "lathe") \
                .field("DoorClosed", bool(safety.get("door_closed", False))) \
                .field("EStopOK", bool(safety.get("estop_ok", False))) \
                .field("SpindleSpeed", float(spindle.get("speed_actual", 0.0))) \
                .field("SpindleSpeedSetpoint", float(spindle.get("speed_setpoint", 0.0))) \
                .field("SpindleLoad", float(spindle.get("load_percent", 0.0))) \
                .field("AxisXPosition", float(axis_x.get("position", 0.0))) \
                .field("AxisXFeedrate", float(axis_x.get("feedrate", 0.0))) \
                .field("AxisXHomed", bool(axis_x.get("homed", False))) \
                .field("AxisZPosition", float(axis_z.get("position", 0.0))) \
                .field("AxisZFeedrate", float(axis_z.get("feedrate", 0.0))) \
                .field("AxisZHomed", bool(axis_z.get("homed", False))) \
                .field("CycleTime", float(production.get("cycle_time_seconds", 0.0))) \
                .field("PartsCompleted", int(production.get("parts_completed", 0))) \
                .field("PartsRejected", int(production.get("parts_rejected", 0))) \
                .field("PartsPerHour", float(production.get("parts_per_hour", 0.0))) \
                .field("AlarmSpindleOverload", bool(alarms.get("spindle_overload", False))) \
                .field("AlarmChuckNotClamped", bool(alarms.get("chuck_not_clamped", False))) \
                .field("AlarmDoorOpen", bool(alarms.get("door_open", False))) \
                .field("AlarmToolWear", bool(alarms.get("tool_wear", False))) \
                .field("AlarmCoolantLow", bool(alarms.get("coolant_low", False))) \
                .field("SystemRunning", bool(status.get("system_running", False))) \
                .field("Machining", bool(status.get("machining", False))) \
                .field("Ready", bool(status.get("ready", False))) \
                .field("Fault", bool(status.get("fault", False))) \
                .field("AutoMode", bool(status.get("auto_mode", False))) \
                .field("ToolNumber", int(tooling.get("tool_number", 0))) \
                .field("ToolLifePercent", float(tooling.get("tool_life_percent", 0.0))) \
                .field("ToolOffsetX", float(tooling.get("tool_offset_x", 0.0))) \
                .field("ToolOffsetZ", float(tooling.get("tool_offset_z", 0.0))) \
                .field("CoolantFlowRate", float(coolant.get("flow_rate", 0.0))) \
                .field("CoolantTemperature", float(coolant.get("temperature", 0.0))) \
                .field("CoolantLevelPercent", float(coolant.get("level_percent", 0.0)))
            
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
            
            # Print detailed summary of what was written
            if "counters" in data:
                # Bottlefiller data
                bottles_per_min = counters.get("BottlesPerMinute", 0.0)
                print(f"💾 Written to InfluxDB [{machine_id}]:")
                print(f"   📊 Production: {bottles_filled} bottles | "
                      f"{bottles_per_min:.1f} bottles/min | "
                      f"{bottles_rejected} rejected")
                print(f"   🔧 Status: Running={system_running} | "
                      f"Filling={filling} | Fault={fault}")
                print(f"   📈 Fill Level: {fill_level:.1f}% | "
                      f"Temp: {tank_temperature:.1f}°C")
                print(f"   ⚠️  Alarms: Fault={alarm_fault} | "
                      f"Overfill={alarm_overfill} | Underfill={alarm_underfill}")
                print()
            elif "lathe" in msg.topic or "spindle" in data:
                # Lathe data - extract again for printing
                lathe_safety = data.get("safety", {})
                lathe_spindle = data.get("spindle", {})
                lathe_axis_x = data.get("axis_x", {})
                lathe_axis_z = data.get("axis_z", {})
                lathe_production = data.get("production", {})
                lathe_alarms = data.get("alarms", {})
                lathe_status = data.get("status", {})
                print(f"💾 Written to InfluxDB [{machine_id} - Lathe]:")
                print(f"   ⚙️  Spindle: Speed={lathe_spindle.get('speed_actual', 0):.1f} RPM | Load={lathe_spindle.get('load_percent', 0):.1f}%")
                print(f"   📍 Axis: X={lathe_axis_x.get('position', 0):.2f} mm | Z={lathe_axis_z.get('position', 0):.2f} mm")
                print(f"   📊 Production: Parts={lathe_production.get('parts_completed', 0)} | Rate={lathe_production.get('parts_per_hour', 0):.1f}/hr | Cycle={lathe_production.get('cycle_time_seconds', 0):.1f}s")
                print(f"   🔧 Status: Running={lathe_status.get('system_running', False)} | Machining={lathe_status.get('machining', False)} | Fault={lathe_status.get('fault', False)}")
                print(f"   ⚠️  Alarms: SpindleOverload={lathe_alarms.get('spindle_overload', False)} | ChuckNotClamped={lathe_alarms.get('chuck_not_clamped', False)}")
                print()
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
    # Check if connecting to cloud broker (HiveMQ Cloud, etc.)
    is_cloud_broker = "hivemq.cloud" in MQTT_BROKER.lower() or "cloud" in MQTT_BROKER.lower()
    
    if os.path.exists(CA_CERT_PATH) and not is_cloud_broker:
        # Use CA cert for local/self-hosted brokers
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
        # For cloud brokers or when CA cert not found, disable certificate verification
        if is_cloud_broker:
            print(f"   ℹ️  Cloud MQTT broker detected, disabling certificate verification")
        else:
            print(f"   ⚠️  CA cert not found: {CA_CERT_PATH}")
            print(f"   ⚠️  Running without TLS verification (for cloud MQTT)")
        mqtt_client.tls_set(cert_reqs=ssl.CERT_NONE)
        mqtt_client.tls_insecure_set(True)  # Disable certificate verification for cloud brokers

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

