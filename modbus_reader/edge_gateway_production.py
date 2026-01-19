#!/usr/bin/env python3
"""
Edge Gateway (Production) - Reads from PLC via Modbus and publishes to Cloud MQTT Broker
This runs on the OT network and connects to IT network MQTT broker via TLS
Supports multiple machines via MACHINE_ID environment variable
"""
from pymodbus.client import ModbusTcpClient
import paho.mqtt.client as mqtt
import json
import time
import sys
import os
import ssl
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Production Configuration
# These should be set via environment variables or config file
PLC_HOST = os.getenv("PLC_HOST", "10.0.1.10")  # PLC IP in OT network
PLC_PORT = int(os.getenv("PLC_PORT", "502"))

# Machine ID - identifies which machine this gateway represents
MACHINE_ID = os.getenv("MACHINE_ID", "machine-01")

# MQTT Broker (IT Network / Cloud)
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "192.168.1.100")  # Cloud broker IP
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "8883"))  # TLS port
MQTT_TOPIC = os.getenv("MQTT_TOPIC", f"plc/{MACHINE_ID}/bottlefiller/data")
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "edge_gateway")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "edge_gateway_pass")

# TLS Configuration
MQTT_TLS_ENABLED = os.getenv("MQTT_TLS_ENABLED", "true").lower() == "true"
CA_CERT_PATH = os.getenv("CA_CERT_PATH", "mosquitto/config/certs/ca.crt")
CLIENT_CERT_PATH = os.getenv("CLIENT_CERT_PATH", "mosquitto/config/certs/client.crt")
CLIENT_KEY_PATH = os.getenv("CLIENT_KEY_PATH", "mosquitto/config/certs/client.key")

POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "1.0"))

# Modbus register addresses
REG_BOTTLE_COUNT = 0
REG_FILLER_SPEED_HIGH = 1
REG_FILLER_SPEED_LOW = 2
REG_LINE_RUNNING = 3

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
        print(f"❌ Failed to connect to MQTT broker, return code {rc}")

def on_disconnect(client, userdata, rc):
    global connected, reconnect_count
    connected = False
    if rc != 0:
        reconnect_count += 1
        print(f"⚠️  Unexpected MQTT disconnection (rc={rc}). Reconnecting...")

def on_publish(client, userdata, mid):
    # Suppress verbose publish messages
    pass

# Initialize MQTT client
mqtt_client = mqtt.Client(client_id=f"edge_gateway_{MACHINE_ID}", clean_session=True)
mqtt_client.on_connect = on_connect
mqtt_client.on_disconnect = on_disconnect
mqtt_client.on_publish = on_publish
mqtt_client.reconnect_delay_set(min_delay=1, max_delay=120)

# Set username and password
mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

# Configure TLS if enabled
if MQTT_TLS_ENABLED:
    print(f"🔐 Configuring TLS connection...")
    if os.path.exists(CA_CERT_PATH):
        mqtt_client.tls_set(
            ca_certs=CA_CERT_PATH,
            certfile=CLIENT_CERT_PATH if os.path.exists(CLIENT_CERT_PATH) else None,
            keyfile=CLIENT_KEY_PATH if os.path.exists(CLIENT_KEY_PATH) else None,
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

# Connect to MQTT Broker (IT Network)
print(f"🔗 Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
print(f"   Network: OT → IT (outbound connection)")
print(f"   TLS: {'Enabled' if MQTT_TLS_ENABLED else 'Disabled'}")
try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    mqtt_client.loop_start()
    # Wait for connection
    for i in range(10):
        if connected:
            break
        time.sleep(0.5)
    if not connected:
        raise Exception("MQTT connection timeout")
except Exception as e:
    print(f"❌ MQTT connection error: {e}")
    print(f"   Make sure the MQTT broker is accessible from OT network")
    print(f"   Check firewall rules allow outbound connection to {MQTT_BROKER}:{MQTT_PORT}")
    exit(1)

# Connect to PLC via Modbus (OT Network)
print(f"🔗 Connecting to PLC at {PLC_HOST}:{PLC_PORT}...")
plc_client = ModbusTcpClient(PLC_HOST, port=PLC_PORT)

try:
    if not plc_client.connect():
        raise Exception("Failed to connect to PLC")
    print(f"✅ Connected to PLC")
except Exception as e:
    print(f"❌ Modbus connection error: {e}")
    print(f"   Make sure PLC is running at {PLC_HOST}:{PLC_PORT}")
    exit(1)

print(f"🚀 Edge Gateway started (OT Network → IT Network)")
print(f"🏭 Machine ID: {MACHINE_ID}")
print(f"📡 Publishing to MQTT topic: {MQTT_TOPIC}")
print(f"⏱️  Polling interval: {POLL_INTERVAL} seconds")
print("Press Ctrl+C to stop\n")

try:
    while True:
        if not connected:
            print("⏳ Waiting for MQTT connection...")
            time.sleep(1)
            continue

        try:
            # Read Modbus holding registers
            result = plc_client.read_holding_registers(REG_BOTTLE_COUNT, 4, unit=1)
            
            if result.isError():
                print(f"⚠️  Modbus read error: {result}")
                time.sleep(POLL_INTERVAL)
                continue

            # Parse Modbus data
            bottle_count = result.registers[0]
            filler_speed_high = result.registers[1]
            filler_speed_low = result.registers[2]
            line_running = bool(result.registers[3])
            
            # Combine speed (if using 32-bit REAL, combine high and low words)
            filler_speed = filler_speed_high / 100.0  # Convert to REAL

            # Create JSON payload with machine_id
            data = {
                "timestamp": datetime.now().isoformat(),
                "source": "edge_gateway_ot",
                "machine_id": MACHINE_ID,
                "plc_ip": PLC_HOST,
                "BottleCount": bottle_count,
                "FillerSpeed": round(filler_speed, 2),
                "LineRunning": line_running
            }

            # Publish to MQTT (IT Network)
            payload = json.dumps(data)
            result = mqtt_client.publish(MQTT_TOPIC, payload, qos=1, retain=False)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"⏰ {data['timestamp']} | "
                      f"[{MACHINE_ID}] | "
                      f"Bottles: {bottle_count} | "
                      f"Speed: {filler_speed:.2f} | "
                      f"Running: {line_running} | "
                      f"→ {MQTT_BROKER}")
            else:
                print(f"⚠️  MQTT publish error: {result.rc}")

        except Exception as e:
            print(f"⚠️  Error reading Modbus: {e}")
        
        time.sleep(POLL_INTERVAL)

except KeyboardInterrupt:
    print("\n🛑 Stopping Edge Gateway...")
    mqtt_client.loop_stop()
    mqtt_client.disconnect()
    plc_client.close()
    print("✅ Edge Gateway stopped")
except Exception as e:
    print(f"\n❌ Error: {e}")
    mqtt_client.loop_stop()
    mqtt_client.disconnect()
    plc_client.close()
    exit(1)

