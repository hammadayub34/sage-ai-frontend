# Replit Deployment Status Check

## Quick Status Check Commands

Run these in your Replit shell to see what's set up:

### 1. Check Python Dependencies
```bash
pip list | grep -E "(paho-mqtt|influxdb-client)"
```

Should show:
- `paho-mqtt`
- `influxdb-client`

### 2. Check Frontend Dependencies
```bash
cd frontend && ls node_modules 2>/dev/null | head -5 && cd ..
```

If you see files, dependencies are installed. If error, need to install.

### 3. Check if main.py exists
```bash
ls -la main.py
```

### 4. Check Environment Variables
```bash
echo "MQTT_BROKER_HOST: $MQTT_BROKER_HOST"
echo "INFLUXDB_URL: $INFLUXDB_URL"
```

If empty, secrets not set yet.

### 5. Check if services are running
```bash
ps aux | grep -E "(python3|node)" | grep -v grep
```

---

## Current Status Checklist

Run this to check everything:

```bash
echo "=== DEPENDENCY CHECK ==="
echo "Python deps:"
pip list | grep -E "(paho-mqtt|influxdb-client)" || echo "❌ Not installed"
echo ""
echo "Frontend deps:"
[ -d "frontend/node_modules" ] && echo "✅ Installed" || echo "❌ Not installed"
echo ""
echo "=== FILES CHECK ==="
[ -f "main.py" ] && echo "✅ main.py exists" || echo "❌ main.py missing"
[ -f ".replit" ] && echo "✅ .replit exists" || echo "❌ .replit missing"
echo ""
echo "=== ENV VARS CHECK ==="
[ -n "$MQTT_BROKER_HOST" ] && echo "✅ MQTT_BROKER_HOST set" || echo "❌ MQTT_BROKER_HOST not set"
[ -n "$INFLUXDB_URL" ] && echo "✅ INFLUXDB_URL set" || echo "❌ INFLUXDB_URL not set"
echo ""
echo "=== SERVICES CHECK ==="
ps aux | grep -E "influxdb_writer|mock_plc_agent|node.*frontend" | grep -v grep || echo "❌ No services running"
```

