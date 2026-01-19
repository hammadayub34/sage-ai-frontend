# Quick Start Guide - MQTT Server & Mock Data

## Step-by-Step Instructions

### Step 1: Start MQTT Server (Mosquitto)

**Option A: Using Docker Compose (Recommended)**
```bash
cd /Users/khanhamza/mqtt-ot-network

# Start MQTT broker and InfluxDB
docker-compose up -d

# Or if using production setup:
docker-compose -f docker-compose.production.yml up -d
```

**Verify MQTT is running:**
```bash
docker ps | grep mqtt
```

You should see `mqtt-broker` or `mqtt-broker-production` running.

**MQTT Ports:**
- **Port 1883**: Non-TLS MQTT (development)
- **Port 8883**: TLS MQTT (production)
- **Port 9001**: WebSocket

---

### Step 2: Start InfluxDB Writer

The InfluxDB writer subscribes to MQTT and stores data in InfluxDB.

**In Terminal 1:**
```bash
cd /Users/khanhamza/mqtt-ot-network
./start_influxdb_writer.sh
```

**Or manually:**
```bash
cd /Users/khanhamza/mqtt-ot-network

export MQTT_BROKER_HOST=localhost
export MQTT_BROKER_PORT=8883
export MQTT_USERNAME=influxdb_writer
export MQTT_PASSWORD=influxdb_writer_pass
export MQTT_TLS_ENABLED=true
export MQTT_TLS_CHECK_HOSTNAME=false
export CA_CERT_PATH=mosquitto/config/certs/ca.crt
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=my-super-secret-auth-token
export INFLUXDB_ORG=myorg
export INFLUXDB_BUCKET=plc_data_new

python3 influxdb_writer/influxdb_writer_production.py
```

**Expected output:**
```
🚀 Starting InfluxDB Writer...
   Subscribing to: plc/+/bottlefiller/data (all machines)
   Writing to: InfluxDB at http://localhost:8086

✅ Connected to MQTT broker
📡 Subscribed to: plc/+/bottlefiller/data (multi-machine support)
```

---

### Step 3: Start Mock PLC Agents (Generate Data)

**For Machine 01 (Terminal 2):**
```bash
cd /Users/khanhamza/mqtt-ot-network
./start_mock_plc.sh machine-01
```

**For Machine 02 (Terminal 3):**
```bash
cd /Users/khanhamza/mqtt-ot-network
./start_mock_plc.sh machine-02
```

**For Machine 03 (Terminal 4):**
```bash
cd /Users/khanhamza/mqtt-ot-network
./start_mock_plc.sh machine-03
```

**Or start all at once (macOS only):**
```bash
./start_all_machines.sh
```

**Expected output:**
```
🚀 Starting Mock PLC Agent...
   Machine ID: machine-01
   Publishing to: plc/machine-01/bottlefiller/data

✅ Connected to MQTT broker
📤 Publishing data every 2 seconds...
💾 Written [machine-01]: Running=True, Fault=False, Bottles=1234, ...
```

---

## Complete Setup Summary

### Terminal 1: InfluxDB Writer
```bash
./start_influxdb_writer.sh
```

### Terminal 2: Mock PLC - Machine 01
```bash
./start_mock_plc.sh machine-01
```

### Terminal 3: Mock PLC - Machine 02 (optional)
```bash
./start_mock_plc.sh machine-02
```

### Terminal 4: Mock PLC - Machine 03 (optional)
```bash
./start_mock_plc.sh machine-03
```

---

## Verify Everything is Working

### 1. Check Docker Services
```bash
docker ps
```
Should show:
- `mqtt-broker` or `mqtt-broker-production`
- `influxdb` or `influxdb-production`

### 2. Check Data in InfluxDB
```bash
python3 check_influxdb_data.py
```

### 3. Test API Endpoint
```bash
python3 test_api_latest.py machine-01
```

### 4. View in Frontend
Open browser: `http://localhost:3005`
- Should see data for machine-01
- Switch to machine-02/03 to see their data (if started)

---

## Troubleshooting

### MQTT Connection Issues
- **Check MQTT is running**: `docker ps | grep mqtt`
- **Check port**: Should be 8883 (TLS) or 1883 (non-TLS)
- **Check certificates**: `ls mosquitto/config/certs/`

### No Data in InfluxDB
- **Check InfluxDB writer is running**: Look for "💾 Written" messages
- **Check mock PLC is publishing**: Look for "📤 Publishing" messages
- **Check bucket name**: Should be `plc_data_new`

### Frontend Shows 0s
- **Click "🔄 Refresh Data" button**
- **Check browser console** (F12) for errors
- **Verify API endpoint works**: `curl http://localhost:3005/api/influxdb/latest?machineId=machine-01`

---

## Port Reference

- **MQTT (non-TLS)**: `1883`
- **MQTT (TLS)**: `8883`
- **InfluxDB**: `8086`
- **Grafana**: `3003` or `3004`
- **Frontend**: `3005`

---

## Quick Commands

```bash
# Start everything
docker-compose up -d
./start_influxdb_writer.sh        # Terminal 1
./start_mock_plc.sh machine-01    # Terminal 2

# Stop everything
docker-compose down
# Then Ctrl+C in each terminal
```

