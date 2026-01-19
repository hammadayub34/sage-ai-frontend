"""
Configuration for Modbus Reader Service
"""
import os

# PLC Configuration
PLC_HOST = os.getenv("PLC_HOST", "openplc")
PLC_PORT = int(os.getenv("PLC_PORT", "502"))

# MQTT Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "plc/bottle_filler")

# Polling Configuration
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "1.0"))

