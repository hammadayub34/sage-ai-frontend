"""
Configuration file for Mock PLC Agent
"""
import os

# Load .env file from project root
try:
    from dotenv import load_dotenv
    # Load from project root (parent of mock_plc_agent directory)
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    load_dotenv(env_path)
except ImportError:
    pass  # dotenv not installed, skip

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

