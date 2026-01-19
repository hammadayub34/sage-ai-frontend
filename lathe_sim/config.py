"""
Configuration file for CNC Lathe Simulator
"""
import os

# Load .env file from project root
try:
    from dotenv import load_dotenv
    # Load from project root (parent of lathe_sim directory)
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    load_dotenv(env_path)
except ImportError:
    pass  # dotenv not installed, skip

# MQTT Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "8883"))
MQTT_TOPIC_BASE = "plc/lathe"  # Topic base for lathe
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "mock_plc_agent")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "mock_plc_agent_pass")
MQTT_TLS_ENABLED = os.getenv("MQTT_TLS_ENABLED", "true").lower() == "true"
CA_CERT_PATH = os.getenv("CA_CERT_PATH", "mosquitto/config/certs/ca.crt")
MQTT_TLS_CHECK_HOSTNAME = os.getenv("MQTT_TLS_CHECK_HOSTNAME", "false").lower() == "true"

# Agent Configuration
PUBLISH_INTERVAL = float(os.getenv("LATHE_PUBLISH_INTERVAL", "2.0"))  # seconds (default 2 seconds)
CLIENT_ID = "lathe_sim"

# Machine ID - identifies which machine this agent represents
MACHINE_ID = os.getenv("LATHE_MACHINE_ID", "lathe01")

