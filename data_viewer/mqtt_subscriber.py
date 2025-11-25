#!/usr/bin/env python3
"""
MQTT Data Viewer/Subscriber - Receives and displays MQTT messages
Supports both development (port 1883) and production (port 8883 with TLS)
"""
import paho.mqtt.client as mqtt
import json
import sys
import os
import ssl
from datetime import datetime

# Add parent directory to path for config import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data_viewer.display_formatter import format_message, format_summary

# MQTT Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "8883"))  # Default to production port
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "plc/+/bottlefiller/#")  # Subscribe to all machines and subtopics
CLIENT_ID = "data_viewer"

# TLS/Authentication Configuration (for production)
MQTT_TLS_ENABLED = os.getenv("MQTT_TLS_ENABLED", "true").lower() == "true"
MQTT_USERNAME = os.getenv("MQTT_USERNAME", None)
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", None)
CA_CERT_PATH = os.getenv("CA_CERT_PATH", "mosquitto/config/certs/ca.crt")
MQTT_TLS_CHECK_HOSTNAME = os.getenv("MQTT_TLS_CHECK_HOSTNAME", "false").lower() == "true"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to MQTT broker")
        client.subscribe(MQTT_TOPIC)
        print(f"📡 Subscribed to: {MQTT_TOPIC}\n")
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_message(client, userdata, msg):
    topic = msg.topic
    try:
        payload = json.loads(msg.payload.decode())
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        print(f"\n{'='*60}")
        print(f"⏰ {timestamp} | Topic: {topic}")
        print(f"{'='*60}")
        
        # Pretty print JSON
        print(json.dumps(payload, indent=2))
        
        # Show summary for full data topic
        if topic.endswith("/data"):
            summary = format_summary(payload)
            if summary:
                print(f"\n{summary}")
        
        print(f"{'='*60}\n")
            
    except json.JSONDecodeError:
        # Not JSON, print raw message
        print(format_message(topic, msg.payload.decode()))
    except Exception as e:
        print(f"❌ Error processing message: {e}")
        print(f"   Topic: {topic}")
        print(f"   Payload: {msg.payload.decode()[:100]}...")

def on_subscribe(client, userdata, mid, granted_qos):
    print(f"✅ Subscription confirmed (QoS: {granted_qos[0]})")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"⚠️  Unexpected disconnection from broker (rc={rc}). Will reconnect automatically.")
    else:
        print("ℹ️  Disconnected from broker")

# Create MQTT client with clean session
client = mqtt.Client(client_id=CLIENT_ID, clean_session=True)
client.on_connect = on_connect
client.on_message = on_message
client.on_subscribe = on_subscribe
client.on_disconnect = on_disconnect

# Enable automatic reconnection
client.reconnect_delay_set(min_delay=1, max_delay=120)

# Configure authentication if provided
if MQTT_USERNAME and MQTT_PASSWORD:
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    print(f"🔐 Using authentication: {MQTT_USERNAME}")

# Configure TLS if enabled
if MQTT_TLS_ENABLED:
    print(f"🔐 Configuring TLS connection...")
    if os.path.exists(CA_CERT_PATH):
        client.tls_set(
            ca_certs=CA_CERT_PATH,
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2
        )
        if not MQTT_TLS_CHECK_HOSTNAME:
            client.tls_insecure_set(True)
            print(f"   ⚠️  Hostname verification disabled (for testing)")
        print(f"   ✅ TLS configured with CA cert: {CA_CERT_PATH}")
    else:
        print(f"   ⚠️  CA cert not found: {CA_CERT_PATH}")
        print(f"   ⚠️  Running without TLS verification")
        client.tls_set(cert_reqs=ssl.CERT_NONE)

print("🔍 MQTT Data Viewer starting...")
print(f"🔗 Connecting to {MQTT_BROKER}:{MQTT_PORT}")
print(f"📡 Topic: {MQTT_TOPIC}")

try:
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    print("🔄 Waiting for messages...\n")
    client.loop_forever()
except KeyboardInterrupt:
    print("\n🛑 Stopping viewer...")
    client.disconnect()
    print("✅ Viewer stopped")
except Exception as e:
    print(f"❌ Error: {e}")
    print(f"   Make sure the MQTT broker is running at {MQTT_BROKER}:{MQTT_PORT}")
    exit(1)

