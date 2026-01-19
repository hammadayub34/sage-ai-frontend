#!/usr/bin/env python3
"""
Modbus Reader Service - Reads from OpenPLC and publishes to MQTT
"""
from pymodbus.client import ModbusTcpClient
import paho.mqtt.client as mqtt
import json
import time
import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
PLC_HOST = os.getenv("PLC_HOST", "localhost")
PLC_PORT = int(os.getenv("PLC_PORT", "502"))
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "plc/bottle_filler")
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "1.0"))

# Modbus register addresses
REG_BOTTLE_COUNT = 0
REG_FILLER_SPEED_HIGH = 1
REG_FILLER_SPEED_LOW = 2
REG_LINE_RUNNING = 3

# MQTT Client Setup
connected = False

def on_connect(client, userdata, flags, rc):
    global connected
    if rc == 0:
        connected = True
        print(f"✅ Connected to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
    else:
        connected = False
        print(f"❌ Failed to connect to MQTT broker, return code {rc}")

def on_disconnect(client, userdata, rc):
    global connected
    connected = False
    if rc != 0:
        print(f"⚠️  Unexpected MQTT disconnection (rc={rc})")

# Initialize MQTT client
mqtt_client = mqtt.Client(client_id="modbus_reader")
mqtt_client.on_connect = on_connect
mqtt_client.on_disconnect = on_disconnect
mqtt_client.reconnect_delay_set(min_delay=1, max_delay=120)

# Connect to MQTT
print(f"🔗 Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
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
    exit(1)

# Connect to OpenPLC via Modbus
print(f"🔗 Connecting to OpenPLC at {PLC_HOST}:{PLC_PORT}...")
plc_client = ModbusTcpClient(PLC_HOST, port=PLC_PORT)

try:
    if not plc_client.connect():
        raise Exception("Failed to connect to OpenPLC")
    print(f"✅ Connected to OpenPLC")
except Exception as e:
    print(f"❌ Modbus connection error: {e}")
    print(f"   Make sure OpenPLC is running at {PLC_HOST}:{PLC_PORT}")
    exit(1)

print(f"🚀 Modbus Reader started. Polling every {POLL_INTERVAL} seconds...")
print(f"📡 Publishing to MQTT topic: {MQTT_TOPIC}")
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
            # For simplicity, using single register
            filler_speed = filler_speed_high / 100.0  # Convert to REAL (assuming stored as integer * 100)

            # Create JSON payload
            data = {
                "timestamp": datetime.now().isoformat(),
                "BottleCount": bottle_count,
                "FillerSpeed": round(filler_speed, 2),
                "LineRunning": line_running
            }

            # Publish to MQTT
            payload = json.dumps(data)
            result = mqtt_client.publish(MQTT_TOPIC, payload, qos=1, retain=False)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"⏰ {data['timestamp']} | "
                      f"Bottles: {bottle_count} | "
                      f"Speed: {filler_speed:.2f} | "
                      f"Running: {line_running}")
            else:
                print(f"⚠️  MQTT publish error: {result.rc}")

        except Exception as e:
            print(f"⚠️  Error reading Modbus: {e}")
        
        time.sleep(POLL_INTERVAL)

except KeyboardInterrupt:
    print("\n🛑 Stopping Modbus Reader...")
    mqtt_client.loop_stop()
    mqtt_client.disconnect()
    plc_client.close()
    print("✅ Modbus Reader stopped")
except Exception as e:
    print(f"\n❌ Error: {e}")
    mqtt_client.loop_stop()
    mqtt_client.disconnect()
    plc_client.close()
    exit(1)

