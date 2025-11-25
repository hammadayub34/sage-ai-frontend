"""
Configuration file for Mock PLC Agent
"""
import os

# MQTT Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_TOPIC_BASE = "plc/bottlefiller"

# Agent Configuration
PUBLISH_INTERVAL = float(os.getenv("PUBLISH_INTERVAL", "2.0"))  # seconds
CLIENT_ID = "mock_plc_agent"

# Bottle Filler Configuration
FILL_TARGET_DEFAULT = 500.0  # mL
FILL_TIME_DEFAULT = 5.0  # seconds
FILL_SPEED_DEFAULT = 75.0  # percentage
CONVEYOR_SPEED_DEFAULT = 125.0  # RPM
TOLERANCE_DEFAULT = 5.0  # mL

