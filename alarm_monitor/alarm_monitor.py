#!/usr/bin/env python3
"""
Alarm Monitor - Subscribes to MQTT and tracks alarm state transitions
Stores alarm events with timestamps for real-time display
Broadcasts alarm changes via WebSocket for real-time UI notifications
Saves alarm events to InfluxDB for persistent storage
"""
import asyncio
import paho.mqtt.client as mqtt
import json
import os
import ssl
import uuid
from datetime import datetime, timezone
from pathlib import Path
import websockets
from threading import Thread
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

# MQTT Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "8883"))
MQTT_TOPIC_BOTTLEFILLER = os.getenv("MQTT_TOPIC_BOTTLEFILLER", "plc/+/bottlefiller/alarms")
MQTT_TOPIC_LATHE = os.getenv("MQTT_TOPIC_LATHE", "plc/+/lathe/alarms")
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "influxdb_writer")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "influxdb_writer_pass")
MQTT_TLS_ENABLED = os.getenv("MQTT_TLS_ENABLED", "true").lower() == "true"
CA_CERT_PATH = os.getenv("CA_CERT_PATH", "mosquitto/config/certs/ca.crt")
MQTT_TLS_CHECK_HOSTNAME = os.getenv("MQTT_TLS_CHECK_HOSTNAME", "false").lower() == "true"

# WebSocket Configuration
WS_HOST = os.getenv("WS_HOST", "0.0.0.0")
WS_PORT = int(os.getenv("WS_PORT", "8765"))

# Alarm event storage (for debugging/verification)
ALARM_EVENTS_FILE = os.getenv("ALARM_EVENTS_FILE", "/tmp/alarm_events.json")
MAX_EVENTS = 1000  # Keep last 1000 events

# InfluxDB Configuration for alarm events
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-auth-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
INFLUXDB_BUCKET_ALARMS = os.getenv("INFLUXDB_BUCKET_ALARMS", "alarm_events")  # Separate bucket for alarms

# Track previous alarm states per machine
previous_alarms = {}

# WebSocket connected clients
connected_clients = set()

# Global event loop for WebSocket (will be set in main)
ws_loop = None

# InfluxDB client for alarm events (will be initialized in main)
_influx_client = None
_influx_write_api = None

def load_alarm_events():
    """Load alarm events from file"""
    if os.path.exists(ALARM_EVENTS_FILE):
        try:
            with open(ALARM_EVENTS_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    return []

def save_alarm_to_influxdb(event):
    """Save alarm event to InfluxDB for persistent storage"""
    global _influx_write_api
    
    if _influx_write_api is None:
        return  # InfluxDB not initialized, skip silently
    
    try:
        # Parse timestamp
        timestamp = datetime.fromisoformat(event["timestamp"].replace('Z', '+00:00'))
        
        # Create InfluxDB point
        point = Point("alarm_events") \
            .tag("machine_id", event["machine_id"]) \
            .tag("alarm_type", event["alarm_type"]) \
            .tag("alarm_name", event.get("alarm_name", event["alarm_type"])) \
            .tag("state", event["state"]) \
            .field("value", event["value"]) \
            .field("alarm_label", event.get("alarm_label", event["alarm_type"])) \
            .time(timestamp)
        
        # Write to InfluxDB
        _influx_write_api.write(bucket=INFLUXDB_BUCKET_ALARMS, record=point)
        print(f"💾 Saved alarm event to InfluxDB: {event['machine_id']} - {event['alarm_type']} ({event['state']})")
    except Exception as e:
        print(f"⚠️  Error saving alarm to InfluxDB: {e}")

def save_alarm_event(event):
    """Save alarm event to file (append) - for debugging/verification"""
    events = load_alarm_events()
    events.append(event)
    
    # Keep only last MAX_EVENTS
    if len(events) > MAX_EVENTS:
        events = events[-MAX_EVENTS:]
    
    with open(ALARM_EVENTS_FILE, 'w') as f:
        json.dump(events, f, indent=2)
    
    # Also save to InfluxDB for persistent storage
    save_alarm_to_influxdb(event)

async def broadcast_alarm(message):
    """Broadcast alarm event to all connected WebSocket clients"""
    if connected_clients:
        # Create tasks for all clients
        disconnected = set()
        for client in connected_clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
            except Exception as e:
                print(f"⚠️  Error broadcasting to client: {e}")
                disconnected.add(client)
        
        # Remove disconnected clients
        connected_clients.difference_update(disconnected)

def check_alarm_transitions(machine_id, alarms, timestamp, machine_type="bottlefiller"):
    """Check for alarm state transitions and record events"""
    global previous_alarms
    
    # Map alarm names from MQTT to display names based on machine type
    if machine_type == "lathe":
        alarm_map = {
            "spindle_overload": "AlarmSpindleOverload",
            "chuck_not_clamped": "AlarmChuckNotClamped",
            "door_open": "AlarmDoorOpen",
            "tool_wear": "AlarmToolWear",
            "coolant_low": "AlarmCoolantLow",
        }
    else:  # bottlefiller
        alarm_map = {
            "Overfill": "AlarmOverfill",
            "Underfill": "AlarmUnderfill",
            "LowProductLevel": "AlarmLowProductLevel",
            "CapMissing": "AlarmCapMissing",
        }
    
    # Get previous state for this machine
    prev = previous_alarms.get(machine_id, {})
    
    # Check each alarm for transitions
    for alarm_key, alarm_name in alarm_map.items():
        current_value = alarms.get(alarm_key, False)
        prev_value = prev.get(alarm_key, False)
        
        # Detect transition: false -> true (alarm raised)
        if not prev_value and current_value:
            event = {
                "timestamp": timestamp,
                "machine_id": machine_id,
                "alarm_name": alarm_key,  # Original name from MQTT
                "alarm_type": alarm_name,  # Mapped name for UI
                "alarm_label": alarm_key,
                "state": "RAISED",
                "value": True
            }
            save_alarm_event(event)  # Keep for debugging
            
            # Broadcast via WebSocket
            ws_message = json.dumps({
                "machine_id": machine_id,
                "alarm_name": alarm_key,
                "alarm_type": alarm_name,
                "state": "RAISED",
                "timestamp": timestamp
            })
            if ws_loop is not None:
                asyncio.run_coroutine_threadsafe(broadcast_alarm(ws_message), ws_loop)
            
            print(f"🚨 ALARM RAISED: {machine_id} - {alarm_name} at {timestamp}")
        
        # Detect transition: true -> false (alarm cleared)
        elif prev_value and not current_value:
            event = {
                "timestamp": timestamp,
                "machine_id": machine_id,
                "alarm_name": alarm_key,
                "alarm_type": alarm_name,
                "alarm_label": alarm_key,
                "state": "CLEARED",
                "value": False
            }
            save_alarm_event(event)  # Keep for debugging
            
            # Broadcast via WebSocket
            ws_message = json.dumps({
                "machine_id": machine_id,
                "alarm_name": alarm_key,
                "alarm_type": alarm_name,
                "state": "CLEARED",
                "timestamp": timestamp
            })
            if ws_loop is not None:
                asyncio.run_coroutine_threadsafe(broadcast_alarm(ws_message), ws_loop)
            
            print(f"✅ ALARM CLEARED: {machine_id} - {alarm_name} at {timestamp}")
    
    # Update previous state
    previous_alarms[machine_id] = alarms.copy()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to MQTT broker")
        client.subscribe(MQTT_TOPIC_BOTTLEFILLER)
        client.subscribe(MQTT_TOPIC_LATHE)
        print(f"📡 Subscribed to: {MQTT_TOPIC_BOTTLEFILLER} (bottlefiller)")
        print(f"📡 Subscribed to: {MQTT_TOPIC_LATHE} (lathe)\n")
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        topic = msg.topic
        
        # Determine machine type from topic
        machine_type = "lathe" if "/lathe/alarms" in topic else "bottlefiller"
        
        # Extract machine_id from topic: plc/{machine_id}/bottlefiller/alarms or plc/{machine_id}/lathe/alarms
        parts = topic.split('/')
        if len(parts) >= 2:
            machine_id = parts[1]
        else:
            machine_id = "unknown"
        
        # Get timestamp (alarms topic doesn't have timestamp, use current time)
        # Use ISO format with Z suffix (UTC timezone indicator)
        # Remove timezone info before adding Z to avoid +00:00Z (invalid format)
        utc_now = datetime.now(timezone.utc)
        timestamp = utc_now.replace(tzinfo=None).isoformat() + "Z"
        
        # Payload from alarms topic is directly the alarms object
        alarms = {}
        
        if machine_type == "lathe":
            # Map lathe alarm names from MQTT to our tracking format
            if "spindle_overload" in payload:
                alarms["spindle_overload"] = payload["spindle_overload"]
            if "chuck_not_clamped" in payload:
                alarms["chuck_not_clamped"] = payload["chuck_not_clamped"]
            if "door_open" in payload:
                alarms["door_open"] = payload["door_open"]
            if "tool_wear" in payload:
                alarms["tool_wear"] = payload["tool_wear"]
            if "coolant_low" in payload:
                alarms["coolant_low"] = payload["coolant_low"]
        else:  # bottlefiller
            # Map alarm names from MQTT to our tracking format
            if "LowProductLevel" in payload:
                alarms["LowProductLevel"] = payload["LowProductLevel"]
            if "Overfill" in payload:
                alarms["Overfill"] = payload["Overfill"]
            if "Underfill" in payload:
                alarms["Underfill"] = payload["Underfill"]
            if "CapMissing" in payload:
                alarms["CapMissing"] = payload["CapMissing"]
        # NoBottle is in MQTT but we don't track it
        
        # Check for alarm transitions
        if alarms:
            check_alarm_transitions(machine_id, alarms, timestamp, machine_type)
            
    except json.JSONDecodeError:
        pass
    except Exception as e:
        print(f"❌ Error processing message: {e}")

# WebSocket server handler
async def websocket_handler(websocket, path=None):
    """Handle new WebSocket connection"""
    connected_clients.add(websocket)
    print(f"🔌 WebSocket client connected. Total clients: {len(connected_clients)}")
    
    try:
        # Keep connection alive
        await websocket.wait_closed()
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.remove(websocket)
        print(f"🔌 WebSocket client disconnected. Total clients: {len(connected_clients)}")

async def start_websocket_server():
    """Start WebSocket server"""
    async with websockets.serve(websocket_handler, WS_HOST, WS_PORT):
        print(f"🌐 WebSocket server started on ws://{WS_HOST}:{WS_PORT}")
        await asyncio.Future()  # Run forever

def run_websocket_server():
    """Run WebSocket server in a separate thread"""
    global ws_loop
    ws_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(ws_loop)
    ws_loop.run_until_complete(start_websocket_server())

# Create MQTT client
client = mqtt.Client(client_id=f"alarm_monitor_{uuid.uuid4().hex[:8]}", clean_session=True)
client.on_connect = on_connect
client.on_message = on_message

# Configure authentication
if MQTT_USERNAME and MQTT_PASSWORD:
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

# Configure TLS
if MQTT_TLS_ENABLED:
    if os.path.exists(CA_CERT_PATH):
        client.tls_set(
            ca_certs=CA_CERT_PATH,
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2
        )
        if not MQTT_TLS_CHECK_HOSTNAME:
            client.tls_insecure_set(True)

if __name__ == "__main__":
    print("🚨 Alarm Monitor starting...")
    print(f"🔗 Connecting to {MQTT_BROKER}:{MQTT_PORT}")
    print(f"📡 Topics: {MQTT_TOPIC_BOTTLEFILLER} and {MQTT_TOPIC_LATHE}")
    print(f"💾 Events file: {ALARM_EVENTS_FILE} (for debugging)")
    print(f"🌐 WebSocket: ws://{WS_HOST}:{WS_PORT}")
    print(f"⚠️  Tracking: Overfill, Underfill, LowProductLevel, CapMissing\n")
    
    # Initialize InfluxDB client for alarm events
    print(f"🔗 Connecting to InfluxDB for alarm storage...")
    try:
        _influx_client = InfluxDBClient(
            url=INFLUXDB_URL,
            token=INFLUXDB_TOKEN,
            org=INFLUXDB_ORG
        )
        _influx_write_api = _influx_client.write_api(write_options=SYNCHRONOUS)
        print(f"✅ Connected to InfluxDB")
        print(f"   Bucket: {INFLUXDB_BUCKET_ALARMS}\n")
    except Exception as e:
        print(f"⚠️  InfluxDB connection error (alarms will still be saved to file): {e}")
        print(f"   Continuing without InfluxDB storage...\n")
        _influx_client = None
        _influx_write_api = None
    
    # Start WebSocket server in a separate thread
    ws_thread = Thread(target=run_websocket_server, daemon=True)
    ws_thread.start()
    
    # Give WebSocket server time to start
    import time
    time.sleep(1)
    
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n🛑 Stopping alarm monitor...")
        client.disconnect()
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)
