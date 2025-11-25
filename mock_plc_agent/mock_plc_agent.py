#!/usr/bin/env python3
"""
Mock PLC Agent - Simulates bottle filler PLC tags and publishes to MQTT
Supports multiple machines via MACHINE_ID environment variable
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
from mock_plc_agent.config import (
    MQTT_BROKER, MQTT_PORT, MQTT_TOPIC_BASE,
    PUBLISH_INTERVAL, CLIENT_ID,
    FILL_TARGET_DEFAULT, FILL_TIME_DEFAULT, FILL_SPEED_DEFAULT,
    CONVEYOR_SPEED_DEFAULT, TOLERANCE_DEFAULT
)

# Machine ID - identifies which machine this agent represents
MACHINE_ID = os.getenv("MACHINE_ID", "machine-01")

# Bottle Filler Tag States
class BottleFillerTags:
    def __init__(self):
        self.bottles_filled = 0
        self.bottles_rejected = 0
        self.fill_target = FILL_TARGET_DEFAULT
        self.system_running = False
        self.filling = False
        self.start_time = time.time()
        
    def generate_mock_data(self):
        """Generate realistic mock PLC data"""
        # Simulate bottle filling cycle
        if random.random() > 0.7:  # 30% chance of new bottle
            self.bottles_filled += 1
            self.filling = True
        else:
            self.filling = False
            
        # Calculate production rate
        elapsed_time = max(1, time.time() - self.start_time)
        bottles_per_minute = round(self.bottles_filled / elapsed_time * 60, 1)
        
        # Generate sensor data
        data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "machine_id": MACHINE_ID,  # Include machine_id in payload
            "inputs": {
                "BottlePresent": random.choice([True, False]),
                "BottleAtFill": self.filling,
                "BottleAtCap": random.choice([True, False]) if self.filling else False,
                "LowLevel": random.random() > 0.9,  # 10% chance
                "HighLevel": random.random() > 0.95,  # 5% chance
                "CapPresent": random.choice([True, False]) if self.filling else False,
            },
            "outputs": {
                "FillValve": self.filling,
                "ConveyorMotor": self.system_running,
                "CappingMotor": self.filling and random.choice([True, False]),
                "IndicatorGreen": self.system_running and not self.filling,
                "IndicatorRed": not self.system_running,
                "IndicatorYellow": self.filling,
            },
            "analog": {
                "FillLevel": round(random.uniform(0, 100), 2),
                "FillFlowRate": round(random.uniform(10, 50), 2) if self.filling else 0.0,
                "TankTemperature": round(random.uniform(20, 25), 1),
                "TankPressure": round(random.uniform(10, 15), 2),
                "ConveyorSpeed": round(random.uniform(100, 150), 1) if self.system_running else 0.0,
            },
            "setpoints": {
                "FillTarget": self.fill_target,
                "FillTime": FILL_TIME_DEFAULT,
                "FillSpeed": FILL_SPEED_DEFAULT,
                "ConveyorSpeed": CONVEYOR_SPEED_DEFAULT,
                "Tolerance": TOLERANCE_DEFAULT,
            },
            "status": {
                "SystemRunning": self.system_running,
                "Filling": self.filling,
                "Ready": not self.filling and self.system_running,
                "Fault": False,
                "AutoMode": True,
            },
            "counters": {
                "BottlesFilled": self.bottles_filled,
                "BottlesRejected": self.bottles_rejected,
                "BottlesPerMinute": bottles_per_minute,
            },
            "alarms": {
                "LowProductLevel": random.random() > 0.95,
                "Overfill": False,
                "Underfill": False,
                "NoBottle": not self.filling,
                "CapMissing": random.random() > 0.9 if self.filling else False,
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
    # Suppress verbose publish messages - only show errors
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

# Configure TLS if enabled
MQTT_TLS_ENABLED = os.getenv("MQTT_TLS_ENABLED", "false").lower() == "true"
MQTT_USERNAME = os.getenv("MQTT_USERNAME", None)
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", None)
CA_CERT_PATH = os.getenv("CA_CERT_PATH", None)
CLIENT_CERT_PATH = os.getenv("CLIENT_CERT_PATH", None)
CLIENT_KEY_PATH = os.getenv("CLIENT_KEY_PATH", None)

if MQTT_USERNAME and MQTT_PASSWORD:
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

if MQTT_TLS_ENABLED:
    print(f"🔐 Configuring TLS connection...")
    if CA_CERT_PATH and os.path.exists(CA_CERT_PATH):
        client.tls_set(
            ca_certs=CA_CERT_PATH,
            certfile=CLIENT_CERT_PATH if CLIENT_CERT_PATH and os.path.exists(CLIENT_CERT_PATH) else None,
            keyfile=CLIENT_KEY_PATH if CLIENT_KEY_PATH and os.path.exists(CLIENT_KEY_PATH) else None,
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2
        )
        check_hostname = os.getenv("MQTT_TLS_CHECK_HOSTNAME", "true").lower() == "true"
        if not check_hostname:
            client.tls_insecure_set(True)
            print(f"   ⚠️  Hostname verification disabled (for testing only)")
        print(f"   ✅ TLS configured with CA cert: {CA_CERT_PATH}")
    else:
        print(f"   ⚠️  CA cert not found, running without TLS verification")
        client.tls_set(cert_reqs=ssl.CERT_NONE)

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

# Initialize tag generator
tags = BottleFillerTags()
tags.system_running = True

print("🚀 Mock PLC Agent started. Publishing data every {} seconds...".format(PUBLISH_INTERVAL))
print(f"🏭 Machine ID: {MACHINE_ID}")
print(f"📡 Topic: plc/{MACHINE_ID}/bottlefiller/#")
print("Press Ctrl+C to stop\n")

try:
    while True:
        # Check connection status before publishing
        if not connected:
            print("⏳ Waiting for connection...")
            time.sleep(1)
            continue
        
        # Generate mock data
        data = tags.generate_mock_data()
        
        try:
            # Publish full dataset with machine_id in topic
            topic_full = f"plc/{MACHINE_ID}/bottlefiller/data"
            payload = json.dumps(data, indent=2)
            result = client.publish(topic_full, payload, qos=1, retain=False)
            
            # Publish individual tag groups (for selective subscriptions)
            client.publish(f"plc/{MACHINE_ID}/bottlefiller/inputs", json.dumps(data["inputs"]), qos=1)
            client.publish(f"plc/{MACHINE_ID}/bottlefiller/outputs", json.dumps(data["outputs"]), qos=1)
            client.publish(f"plc/{MACHINE_ID}/bottlefiller/analog", json.dumps(data["analog"]), qos=1)
            client.publish(f"plc/{MACHINE_ID}/bottlefiller/status", json.dumps(data["status"]), qos=1)
            client.publish(f"plc/{MACHINE_ID}/bottlefiller/counters", json.dumps(data["counters"]), qos=1)
            client.publish(f"plc/{MACHINE_ID}/bottlefiller/alarms", json.dumps(data["alarms"]), qos=1)
            
            # Print status
            print(f"⏰ {data['timestamp']} | "
                  f"[{MACHINE_ID}] | "
                  f"Bottles: {data['counters']['BottlesFilled']} | "
                  f"Filling: {data['status']['Filling']} | "
                  f"Level: {data['analog']['FillLevel']}%")
        except Exception as e:
            print(f"⚠️  Error publishing: {e}")
            connected = False
        
        time.sleep(PUBLISH_INTERVAL)
        
except KeyboardInterrupt:
    print("\n🛑 Stopping agent...")
    client.loop_stop()
    client.disconnect()
    print("✅ Agent stopped")
except Exception as e:
    print(f"\n❌ Error: {e}")
    client.loop_stop()
    client.disconnect()
    exit(1)

