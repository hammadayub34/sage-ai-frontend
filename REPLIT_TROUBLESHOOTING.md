# Replit Troubleshooting Guide

## Mock PLC Agent Crashing (Exit Code 1)

If the Mock PLC Agent keeps crashing with exit code 1, check the following:

### Step 1: Check the Logs

In Replit shell, run:
```bash
cat /tmp/mock_plc_agent.log
```

This will show you the exact error message.

### Step 2: Verify MQTT Secrets

The Mock PLC Agent requires these environment variables (secrets):

```bash
# Check if MQTT secrets are set
python3 -c "import os; print('MQTT_BROKER_HOST:', os.getenv('MQTT_BROKER_HOST', 'NOT SET')); print('MQTT_BROKER_PORT:', os.getenv('MQTT_BROKER_PORT', 'NOT SET')); print('MQTT_USERNAME:', os.getenv('MQTT_USERNAME', 'NOT SET')); print('MQTT_PASSWORD:', 'SET' if os.getenv('MQTT_PASSWORD') else 'NOT SET')"
```

### Step 3: Common Issues

#### Issue: Missing MQTT Secrets
**Solution:** Add these secrets in Replit:
- `MQTT_BROKER_HOST` - Your MQTT broker hostname
- `MQTT_BROKER_PORT` - Usually `8883` for TLS or `1883` for non-TLS
- `MQTT_USERNAME` - Your MQTT username
- `MQTT_PASSWORD` - Your MQTT password
- `MQTT_TLS_ENABLED` - Set to `true` if using TLS (usually `true` for cloud brokers)

#### Issue: Connection Timeout
**Solution:** 
- Verify your MQTT broker is accessible
- Check if `MQTT_TLS_ENABLED=true` matches your broker configuration
- For cloud brokers (like HiveMQ), you usually need TLS enabled

#### Issue: Import Error (config.py not found)
**Solution:**
```bash
# Verify the config file exists
ls -la mock_plc_agent/config.py

# If missing, check if you're in the right directory
pwd  # Should show /home/runner/.../mqtt-ot-network
```

#### Issue: Missing Python Dependencies
**Solution:**
```bash
pip3 install paho-mqtt
```

### Step 4: Test MQTT Connection Manually

Test if you can connect to MQTT:

```bash
python3 << EOF
import paho.mqtt.client as mqtt
import os
import ssl

broker = os.getenv("MQTT_BROKER_HOST", "localhost")
port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
username = os.getenv("MQTT_USERNAME")
password = os.getenv("MQTT_PASSWORD")
tls_enabled = os.getenv("MQTT_TLS_ENABLED", "false").lower() == "true"

print(f"Testing connection to {broker}:{port}")
print(f"TLS: {tls_enabled}")
print(f"Username: {username}")

client = mqtt.Client()
if username and password:
    client.username_pw_set(username, password)

if tls_enabled:
    client.tls_set(cert_reqs=ssl.CERT_NONE)
    client.tls_insecure_set(True)

try:
    client.connect(broker, port, 60)
    print("✅ Connection successful!")
    client.disconnect()
except Exception as e:
    print(f"❌ Connection failed: {e}")
EOF
```

### Step 5: Run Mock PLC Agent Manually

To see the error directly:

```bash
cd /home/runner/.../mqtt-ot-network  # Your project path
python3 mock_plc_agent/mock_plc_agent.py
```

This will show the error message directly in the console.

## Quick Fix Checklist

- [ ] All MQTT secrets added in Replit Secrets tab
- [ ] `MQTT_TLS_ENABLED` matches your broker (usually `true` for cloud)
- [ ] Python dependencies installed: `pip3 install -r requirements.txt`
- [ ] Checked logs: `cat /tmp/mock_plc_agent.log`
- [ ] Tested MQTT connection manually (see Step 4)

## Still Not Working?

1. Check the full error in logs: `cat /tmp/mock_plc_agent.log | tail -20`
2. Verify you're using the correct MQTT broker credentials
3. Make sure the MQTT broker is accessible from Replit (not blocked by firewall)
4. Try running the agent manually to see the exact error

