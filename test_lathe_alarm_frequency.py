#!/usr/bin/env python3
"""
Test script to monitor lathe alarm topic frequency
"""
import paho.mqtt.client as mqtt
import json
import time
import ssl
from datetime import datetime

message_count = 0
start_time = time.time()
messages = []

def on_connect(client, userdata, flags, rc):
    print('✅ Connected to MQTT broker')
    client.subscribe('plc/+/lathe/alarms')
    print('📡 Subscribed to: plc/+/lathe/alarms')
    print()

def on_message(client, userdata, msg):
    global message_count, messages
    message_count += 1
    try:
        payload = json.loads(msg.payload.decode())
        timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
        
        # Extract machine ID from topic
        machine_id = msg.topic.split('/')[1]
        
        # Find active alarms
        active_alarms = [k for k, v in payload.items() if v]
        
        messages.append({
            'time': timestamp,
            'machine_id': machine_id,
            'topic': msg.topic,
            'alarms': payload,
            'active_alarms': active_alarms
        })
        
        print(f'[{timestamp}] Message #{message_count} from {machine_id}')
        if active_alarms:
            print(f'   🚨 Active alarms: {active_alarms}')
        else:
            print(f'   ✅ All alarms cleared')
        print()
    except Exception as e:
        print(f'❌ Error parsing message: {e}')

# Setup MQTT client
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

# Configure TLS
client.username_pw_set('influxdb_writer', 'influxdb_writer_pass')
try:
    client.tls_set(
        ca_certs='mosquitto/config/certs/ca.crt',
        cert_reqs=ssl.CERT_REQUIRED,
        tls_version=ssl.PROTOCOL_TLSv1_2
    )
    client.tls_insecure_set(True)  # Disable hostname verification for localhost
except:
    print('⚠️  TLS setup failed, trying without TLS...')

print('🔍 Monitoring lathe alarm topic: plc/+/lathe/alarms')
print('⏱️  Monitoring for 60 seconds...')
print('=' * 60)
print()

try:
    client.connect('localhost', 8883, 60)
    client.loop_start()
    time.sleep(60)
    client.loop_stop()
    client.disconnect()
except Exception as e:
    print(f'❌ Connection error: {e}')
    exit(1)

elapsed = time.time() - start_time
print()
print('=' * 60)
print(f'📊 RESULTS:')
print(f'   Total messages received: {message_count}')
print(f'   Time elapsed: {elapsed:.1f} seconds')
if elapsed > 0:
    print(f'   Messages per second: {message_count/elapsed:.3f}')
    print(f'   Messages per minute: {(message_count/elapsed)*60:.2f}')
    print(f'   Average time between messages: {elapsed/message_count:.2f} seconds' if message_count > 0 else '   No messages received')
print()

if messages:
    print('📋 Message timeline (first 20 messages):')
    for i, msg in enumerate(messages[:20], 1):
        print(f'   {i}. [{msg["time"]}] {msg["machine_id"]}')
        if msg['active_alarms']:
            print(f'      🚨 Active: {msg["active_alarms"]}')
    if len(messages) > 20:
        print(f'   ... and {len(messages) - 20} more messages')
    
    # Count state changes
    state_changes = 0
    for i in range(1, len(messages)):
        prev_alarms = set(messages[i-1]['active_alarms'])
        curr_alarms = set(messages[i]['active_alarms'])
        if prev_alarms != curr_alarms:
            state_changes += 1
    
    print()
    print(f'📈 State changes detected: {state_changes}')
    print(f'   (Alarm state changed {state_changes} times in {elapsed:.1f} seconds)')
else:
    print('⚠️  No messages received. Is the lathe simulator running?')

