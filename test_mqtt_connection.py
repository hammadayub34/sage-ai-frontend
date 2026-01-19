#!/usr/bin/env python3
"""
Test MQTT connection to verify publishing and subscribing works
"""
import paho.mqtt.client as mqtt
import json
import time
import os
import ssl

# Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "8883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "edge_gateway")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "edge_gateway_pass")
CA_CERT_PATH = os.getenv("CA_CERT_PATH", "mosquitto/config/certs/ca.crt")
CLIENT_CERT_PATH = os.getenv("CLIENT_CERT_PATH", "mosquitto/config/certs/client.crt")
CLIENT_KEY_PATH = os.getenv("CLIENT_KEY_PATH", "mosquitto/config/certs/client.key")

print("🧪 Testing MQTT Connection...")
print(f"   Broker: {MQTT_BROKER}:{MQTT_PORT}")
print(f"   Username: {MQTT_USERNAME}\n")

# Test publish
print("📤 Test 1: Publishing test message...")
try:
    pub_client = mqtt.Client(client_id="test_publisher", clean_session=True)
    pub_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    if os.path.exists(CA_CERT_PATH):
        pub_client.tls_set(
            ca_certs=CA_CERT_PATH,
            certfile=CLIENT_CERT_PATH if os.path.exists(CLIENT_CERT_PATH) else None,
            keyfile=CLIENT_KEY_PATH if os.path.exists(CLIENT_KEY_PATH) else None,
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2
        )
        pub_client.tls_insecure_set(True)  # Disable hostname check for testing
    
    pub_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    pub_client.loop_start()
    time.sleep(1)
    
    test_topic = "plc/machine-01/bottlefiller/data"
    test_message = json.dumps({"test": True, "timestamp": time.time()})
    result = pub_client.publish(test_topic, test_message, qos=1)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"   ✅ Published to {test_topic}")
    else:
        print(f"   ❌ Publish failed: {result.rc}")
    
    time.sleep(1)
    pub_client.loop_stop()
    pub_client.disconnect()
    
except Exception as e:
    print(f"   ❌ Publish error: {e}")
    import traceback
    traceback.print_exc()

# Test subscribe
print("\n📥 Test 2: Subscribing to test topic...")
try:
    sub_client = mqtt.Client(client_id="test_subscriber", clean_session=True)
    sub_client.username_pw_set("influxdb_writer", "influxdb_writer_pass")
    
    message_received = False
    
    def on_connect_sub(client, userdata, flags, rc):
        if rc == 0:
            print("   ✅ Connected to broker")
            client.subscribe("plc/+/bottlefiller/data")
            print("   ✅ Subscribed to plc/+/bottlefiller/data")
        else:
            print(f"   ❌ Connection failed: {rc}")
    
    def on_message_sub(client, userdata, msg):
        global message_received
        message_received = True
        print(f"   ✅ Received message on {msg.topic}")
        print(f"      Payload: {msg.payload.decode()[:50]}...")
    
    sub_client.on_connect = on_connect_sub
    sub_client.on_message = on_message_sub
    
    if os.path.exists(CA_CERT_PATH):
        sub_client.tls_set(
            ca_certs=CA_CERT_PATH,
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2
        )
        sub_client.tls_insecure_set(True)
    
    sub_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    sub_client.loop_start()
    
    print("   ⏳ Waiting 5 seconds for messages...")
    time.sleep(5)
    
    sub_client.loop_stop()
    sub_client.disconnect()
    
    if message_received:
        print("   ✅ Subscription test passed!")
    else:
        print("   ⚠️  No messages received (but connection worked)")
    
except Exception as e:
    print(f"   ❌ Subscribe error: {e}")
    import traceback
    traceback.print_exc()

print("\n✅ MQTT connection test complete!")

