# Start Steps (Docker Already Running)

## Quick Start - 3 Steps

### Step 1: Start InfluxDB Writer
**Terminal 1:**
```bash
cd /Users/khanhamza/mqtt-ot-network
./start_influxdb_writer.sh
```

**What it does:**
- Subscribes to MQTT broker
- Receives data from mock PLC agents
- Writes data to InfluxDB

**Expected output:**
```
🚀 Starting InfluxDB Writer...
✅ Connected to MQTT broker
📡 Subscribed to: plc/+/bottlefiller/data
```

---

### Step 2: Start Mock PLC Agent(s)
**Terminal 2 (Machine 01):**
```bash
cd /Users/khanhamza/mqtt-ot-network
./start_mock_plc.sh machine-01
```

**Terminal 3 (Machine 02 - Optional):**
```bash
./start_mock_plc.sh machine-02
```

**Terminal 4 (Machine 03 - Optional):**
```bash
./start_mock_plc.sh machine-03
```

**What it does:**
- Generates realistic bottle filler data
- Publishes to MQTT every 2 seconds
- Includes all 18 tags (BottlesFilled, status, alarms, etc.)

**Expected output:**
```
🚀 Starting Mock PLC Agent...
   Machine ID: machine-01
✅ Connected to MQTT broker
📤 Publishing data every 2 seconds...
```

---

### Step 3: Verify Data is Flowing

**Check InfluxDB Writer Terminal:**
- Should see: `💾 Written [machine-01]: Running=True, Bottles=1234, ...`

**Check Mock PLC Terminal:**
- Should see: `📤 Publishing data...`

**Test API:**
```bash
python3 test_api_latest.py machine-01
```

**View in Frontend:**
- Open: `http://localhost:3005`
- Click "🔄 Refresh Data" button
- Should see actual values (not 0s)

---

## Summary

**Minimum (1 machine):**
1. Terminal 1: `./start_influxdb_writer.sh`
2. Terminal 2: `./start_mock_plc.sh machine-01`

**All machines:**
1. Terminal 1: `./start_influxdb_writer.sh`
2. Terminal 2: `./start_mock_plc.sh machine-01`
3. Terminal 3: `./start_mock_plc.sh machine-02`
4. Terminal 4: `./start_mock_plc.sh machine-03`

---

## Troubleshooting

**No data showing?**
- Make sure InfluxDB writer is running (Terminal 1)
- Make sure mock PLC is running (Terminal 2+)
- Wait 5-10 seconds for data to flow
- Click "🔄 Refresh Data" in frontend

**Connection errors?**
- Check MQTT is running: `docker ps | grep mqtt`
- Check certificates exist: `ls mosquitto/config/certs/`

