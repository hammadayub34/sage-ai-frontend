#!/usr/bin/env python3
"""
CNC Lathe Simulator - Simulates CNC Lathe telemetry and publishes to MQTT
Publishes to: plc/{machine-id}/lathe/data
Supports multiple machines via LATHE_MACHINE_ID environment variable
"""
import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime, timezone
import sys
import os
import ssl
import uuid

# Add parent directory to path for config import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lathe_sim.config import (
    MQTT_BROKER, MQTT_PORT, MQTT_TOPIC_BASE,
    PUBLISH_INTERVAL, CLIENT_ID,
    MACHINE_ID, MQTT_USERNAME, MQTT_PASSWORD,
    MQTT_TLS_ENABLED, CA_CERT_PATH, MQTT_TLS_CHECK_HOSTNAME
)

# Store MQTT_BROKER for TLS detection
_MQTT_BROKER_HOST = MQTT_BROKER

# Debug/Output options
PRINT_JSON_DATA = os.getenv("PRINT_JSON_DATA", "false").lower() == "true"
SAVE_JSON_DATA = os.getenv("SAVE_JSON_DATA", "false").lower() == "true"
JSON_OUTPUT_FILE = os.getenv("JSON_OUTPUT_FILE", f"/tmp/lathe_sim_data_{MACHINE_ID}.json")

# CNC Lathe State
class LatheState:
    def __init__(self):
        self.parts_completed = 0
        self.parts_rejected = 0
        self.system_running = True
        self.machining = False
        self.tool_life_percent = 100.0
        self.coolant_level_percent = 100.0
        self.start_time = time.time()
        self.current_tool = 1
        
    def generate_mock_data(self):
        """Generate realistic mock CNC Lathe telemetry"""
        # Simulate machining cycle
        if random.random() > 0.6:  # 40% chance of completing a part
            self.parts_completed += 1
            self.machining = True
            # Slowly decrease tool life
            self.tool_life_percent = max(0, self.tool_life_percent - random.uniform(0.1, 0.5))
            # Slowly decrease coolant
            self.coolant_level_percent = max(0, self.coolant_level_percent - random.uniform(0.05, 0.2))
        else:
            self.machining = False
            
        # Calculate production rate
        elapsed_time = max(1, time.time() - self.start_time)
        parts_per_hour = round((self.parts_completed / elapsed_time) * 3600, 1)
        
        # Safety - door closed 95% of the time
        door_closed = random.random() > 0.05
        estop_ok = True  # Always OK in normal operation
        
        # Spindle data
        speed_setpoint = 1500.0
        speed_actual = round(random.uniform(1400, 1600), 1)
        load_percent = round(random.uniform(20, 80), 1)
        # Occasionally high load
        if random.random() > 0.9:
            load_percent = round(random.uniform(85, 95), 1)
        
        # Axis positions
        axis_x_position = round(random.uniform(0, 200), 2)
        axis_x_feedrate = round(random.uniform(100, 250), 1)
        axis_x_homed = True
        
        axis_z_position = round(random.uniform(0, 300), 2)
        axis_z_feedrate = round(random.uniform(150, 300), 1)
        axis_z_homed = True
        
        # Production metrics
        cycle_time_seconds = round(random.uniform(20, 50), 1)
        
        # Alarms
        spindle_overload = load_percent > 90
        chuck_not_clamped = random.random() > 0.98  # 2% chance (rare fault)
        door_open = not door_closed
        tool_wear = self.tool_life_percent < 30
        coolant_low = self.coolant_level_percent < 20
        
        # Status
        ready = not self.machining and self.system_running
        fault = chuck_not_clamped or door_open
        
        # Tooling
        tool_number = self.current_tool
        tool_offset_x = round(random.uniform(-0.5, 0.5), 3)
        tool_offset_z = round(random.uniform(-0.5, 0.5), 3)
        
        # Coolant
        coolant_flow_rate = round(random.uniform(5, 10), 1) if self.system_running else 0.0
        coolant_temperature = round(random.uniform(20, 25), 1)
        
        data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "machine_id": MACHINE_ID,
            "safety": {
                "door_closed": door_closed,
                "estop_ok": estop_ok,
            },
            "spindle": {
                "speed_actual": speed_actual,
                "speed_setpoint": speed_setpoint,
                "load_percent": load_percent,
            },
            "axis_x": {
                "position": axis_x_position,
                "feedrate": axis_x_feedrate,
                "homed": axis_x_homed,
            },
            "axis_z": {
                "position": axis_z_position,
                "feedrate": axis_z_feedrate,
                "homed": axis_z_homed,
            },
            "production": {
                "cycle_time_seconds": cycle_time_seconds,
                "parts_completed": self.parts_completed,
                "parts_rejected": self.parts_rejected,
                "parts_per_hour": parts_per_hour,
            },
            "alarms": {
                "spindle_overload": spindle_overload,
                "chuck_not_clamped": chuck_not_clamped,
                "door_open": door_open,
                "tool_wear": tool_wear,
                "coolant_low": coolant_low,
            },
            "status": {
                "system_running": self.system_running,
                "machining": self.machining,
                "ready": ready,
                "fault": fault,
                "auto_mode": True,
            },
            "tooling": {
                "tool_number": tool_number,
                "tool_life_percent": round(self.tool_life_percent, 1),
                "tool_offset_x": tool_offset_x,
                "tool_offset_z": tool_offset_z,
            },
            "coolant": {
                "flow_rate": coolant_flow_rate,
                "temperature": coolant_temperature,
                "level_percent": round(self.coolant_level_percent, 1),
            }
        }
        return data

# MQTT Client Setup
connected = False
reconnect_count = 0

def on_connect(client, userdata, flags, rc):
    global connected, reconnect_count
    if rc == 0:
        connected = True
        if reconnect_count > 0:
            print(f"✅ Reconnected to MQTT broker (reconnect #{reconnect_count})")
            reconnect_count = 0
        else:
            print(f"✅ Connected to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
    else:
        connected = False
        print(f"❌ Failed to connect, return code {rc}")

def on_publish(client, userdata, mid):
    # Suppress verbose publish messages
    pass

def on_disconnect(client, userdata, rc):
    global connected, reconnect_count
    connected = False
    if rc != 0:
        reconnect_count += 1
        print(f"⚠️  Unexpected disconnection (rc={rc}). Reconnecting...")
    else:
        print("ℹ️  Disconnected from broker")

def on_log(client, userdata, level, buf):
    # Only log warnings and errors
    if level <= mqtt.MQTT_LOG_WARNING:
        print(f"MQTT Log: {buf}")

# Initialize MQTT client with unique client ID to avoid conflicts
client = mqtt.Client(client_id=f"{CLIENT_ID}_{MACHINE_ID}_{uuid.uuid4().hex[:8]}", clean_session=True)
client.on_connect = on_connect
client.on_publish = on_publish
client.on_disconnect = on_disconnect
client.on_log = on_log

# Enable automatic reconnection
client.reconnect_delay_set(min_delay=1, max_delay=120)

# Set username and password
if MQTT_USERNAME and MQTT_PASSWORD:
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    print(f"   🔑 Using authentication: {MQTT_USERNAME}")

# Configure TLS if enabled
if MQTT_TLS_ENABLED:
    print(f"🔐 Configuring TLS connection...")
    # Check if connecting to cloud broker (HiveMQ Cloud, etc.)
    is_cloud_broker = "hivemq.cloud" in _MQTT_BROKER_HOST.lower() or "cloud" in _MQTT_BROKER_HOST.lower()
    
    if CA_CERT_PATH and os.path.exists(CA_CERT_PATH) and not is_cloud_broker:
        # Use CA cert for local/self-hosted brokers
        client.tls_set(
            ca_certs=CA_CERT_PATH,
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2
        )
        if not MQTT_TLS_CHECK_HOSTNAME:
            client.tls_insecure_set(True)
            print(f"   ⚠️  Hostname verification disabled (for testing only)")
        print(f"   ✅ TLS configured with CA cert: {CA_CERT_PATH}")
    else:
        # For cloud brokers, disable certificate verification
        if is_cloud_broker:
            print(f"   ℹ️  Cloud MQTT broker detected, disabling certificate verification")
        else:
            print(f"   ⚠️  CA cert not found, running without TLS verification (for cloud MQTT)")
        client.tls_set(cert_reqs=ssl.CERT_NONE)
        client.tls_insecure_set(True)  # Disable certificate verification for cloud brokers

# Connect to broker
def connect_broker():
    global connected
    try:
        print(f"🔗 Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_start()
        # Wait for connection to establish
        for i in range(10):
            if connected:
                break
            time.sleep(0.5)
        if not connected:
            raise Exception("Connection timeout")
    except Exception as e:
        print(f"❌ Connection error: {e}")
        print(f"   Make sure the MQTT broker is running at {MQTT_BROKER}:{MQTT_PORT}")
        exit(1)

connect_broker()

# Initialize lathe state
lathe = LatheState()

print("🚀 CNC Lathe Simulator started. Publishing data every {} seconds...".format(PUBLISH_INTERVAL))
print(f"🏭 Machine ID: {MACHINE_ID}")
print(f"📡 Topic: plc/{MACHINE_ID}/lathe/data")
print("Press Ctrl+C to stop\n")

try:
    while True:
        # Check connection status before publishing
        if not connected:
            print("⏳ Waiting for connection...")
            time.sleep(1)
            continue
        
        # Generate mock data
        data = lathe.generate_mock_data()
        
        try:
            # Publish full dataset with machine_id in topic
            topic_full = f"plc/{MACHINE_ID}/lathe/data"
            payload = json.dumps(data, indent=2)
            result = client.publish(topic_full, payload, qos=1, retain=False)
            
            # Publish alarms separately (for alarm monitor WebSocket)
            client.publish(f"plc/{MACHINE_ID}/lathe/alarms", json.dumps(data["alarms"]), qos=1)
            
            # Print detailed status with key metrics
            print(f"📤 [{MACHINE_ID}] Published to MQTT:")
            print(f"   ⏰ Time: {data['timestamp']}")
            print(f"   🔒 Safety: Door={data['safety']['door_closed']} | EStop={data['safety']['estop_ok']}")
            print(f"   ⚙️  Spindle: Speed={data['spindle']['speed_actual']:.1f} RPM | Load={data['spindle']['load_percent']:.1f}%")
            print(f"   📍 Axis X: {data['axis_x']['position']:.2f} mm | Axis Z: {data['axis_z']['position']:.2f} mm")
            print(f"   📊 Production: Cycle={data['production']['cycle_time_seconds']:.1f}s | Parts={data['production']['parts_completed']} | Rate={data['production']['parts_per_hour']:.1f}/hr")
            print(f"   🔧 Status: Running={data['status']['system_running']} | Machining={data['status']['machining']} | Fault={data['status']['fault']}")
            print(f"   ⚠️  Alarms: SpindleOverload={data['alarms']['spindle_overload']} | ChuckNotClamped={data['alarms']['chuck_not_clamped']}")
            print(f"   📡 Topic: {topic_full}")
            
            # Print full JSON if enabled
            if PRINT_JSON_DATA:
                print(f"\n📄 Full JSON Data:")
                print("=" * 60)
                print(payload)
                print("=" * 60)
            
            # Save to JSON file if enabled
            if SAVE_JSON_DATA:
                try:
                    # Read existing data if file exists
                    json_data = []
                    if os.path.exists(JSON_OUTPUT_FILE):
                        try:
                            with open(JSON_OUTPUT_FILE, 'r') as f:
                                json_data = json.load(f)
                                if not isinstance(json_data, list):
                                    json_data = [json_data]
                        except (json.JSONDecodeError, ValueError):
                            json_data = []
                    
                    # Append new data with timestamp
                    json_data.append({
                        "timestamp": data['timestamp'],
                        "machine_id": MACHINE_ID,
                        "topic": topic_full,
                        "data": data
                    })
                    
                    # Write back to file
                    with open(JSON_OUTPUT_FILE, 'w') as f:
                        json.dump(json_data, f, indent=2)
                    
                    print(f"💾 Saved to: {JSON_OUTPUT_FILE} ({len(json_data)} entries)")
                except Exception as e:
                    print(f"⚠️  Error saving JSON: {e}")
            
            print()
        except Exception as e:
            print(f"⚠️  Error publishing: {e}")
            connected = False
        
        time.sleep(PUBLISH_INTERVAL)
        
except KeyboardInterrupt:
    print("\n🛑 Stopping lathe simulator...")
    client.loop_stop()
    client.disconnect()
    print("✅ Lathe simulator stopped")
except Exception as e:
    print(f"\n❌ Error: {e}")
    client.loop_stop()
    client.disconnect()
    exit(1)

