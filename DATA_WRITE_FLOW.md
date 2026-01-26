# Exact Data Write Flow to InfluxDB

## Overview
This document explains **exactly** how data flows from Mock PLC Agent → MQTT → InfluxDB Writer → InfluxDB.

---

## Step-by-Step Flow

### 1. **Mock PLC Agent Generates Data** (`mock_plc_agent/mock_plc_agent.py`)

**Location:** Lines 46-120

**What happens:**
- Every `PUBLISH_INTERVAL` seconds (default: 2.0), the agent calls `generate_mock_data()`
- Creates a JSON payload with this structure:
  ```json
  {
    "timestamp": "2025-11-26T01:36:50.099454+00:00",
    "machine_id": "machine-01",
    "counters": {
      "BottlesFilled": 1234,
      "BottlesRejected": 5,
      "BottlesPerMinute": 9.0
    },
    "status": {
      "SystemRunning": true,
      "Filling": false,
      "Fault": false,
      "Ready": true
    },
    "analog": {
      "FillLevel": 75.5,
      "TankTemperature": 22.3,
      "TankPressure": 12.5,
      "FillFlowRate": 0.0,
      "ConveyorSpeed": 125.0
    },
    "alarms": {
      "Fault": false,
      "Overfill": false,
      "Underfill": false,
      "LowProductLevel": false,
      "CapMissing": false
    },
    "inputs": {
      "LowLevel": false
    }
  }
  ```

**Publishing:**
- **Topic:** `plc/{MACHINE_ID}/bottlefiller/data` (e.g., `plc/machine-01/bottlefiller/data`)
- **QoS:** 1 (at least once delivery)
- **Method:** `client.publish(topic, json.dumps(data), qos=1)`

---

### 2. **MQTT Broker Receives & Forwards** (Mosquitto)

**What happens:**
- MQTT broker (running in Docker) receives the message
- Validates authentication (username/password)
- Forwards to all subscribers of `plc/+/bottlefiller/data` (wildcard subscription)

---

### 3. **InfluxDB Writer Receives MQTT Message** (`influxdb_writer/influxdb_writer_production.py`)

**Location:** Lines 54-225

**Step 3.1: Message Reception** (Line 54 - `on_message` callback)
```python
def on_message(client, userdata, msg):
    # Parse JSON from MQTT payload
    data = json.loads(msg.payload.decode())
    
    # Extract machine_id from topic: "plc/machine-01/bottlefiller/data"
    topic_parts = msg.topic.split('/')
    machine_id = topic_parts[1]  # Gets "machine-01"
```

**Step 3.2: Data Format Detection** (Lines 71-186)
- Checks if data has `"counters"` key (mock_plc_agent format)
- If yes, extracts all fields from nested structure

**Step 3.3: Create InfluxDB Point** (Lines 143-182)

**Measurement:** `plc_data` (fixed measurement name)

**Tags:**
- `machine_id`: Extracted from MQTT topic (e.g., "machine-01")
- `line`: Optional (if `line_id` in data)
- `location`: Optional (if `location` in data)

**Fields:** All 18 fields are written as separate field-value pairs:
```python
point = Point("plc_data") \
    .tag("machine_id", machine_id) \
    .field("SystemRunning", system_running) \
    .field("Fault", fault) \
    .field("Filling", filling) \
    .field("Ready", ready) \
    .field("BottlesFilled", bottles_filled) \
    .field("BottlesRejected", bottles_rejected) \
    .field("BottlesPerMinute", bottles_per_minute) \
    .field("AlarmFault", alarm_fault) \
    .field("AlarmOverfill", alarm_overfill) \
    .field("AlarmUnderfill", alarm_underfill) \
    .field("AlarmLowProductLevel", alarm_low_level) \
    .field("AlarmCapMissing", alarm_cap_missing) \
    .field("FillLevel", fill_level) \
    .field("TankTemperature", tank_temperature) \
    .field("TankPressure", tank_pressure) \
    .field("FillFlowRate", fill_flow_rate) \
    .field("ConveyorSpeed", conveyor_speed) \
    .field("LowLevelSensor", low_level_sensor) \
    .time(timestamp)  # UTC timestamp from JSON or current time
```

**Timestamp:**
- Parses `timestamp` from JSON payload (UTC ISO format)
- Falls back to `datetime.now(timezone.utc)` if missing/invalid

---

### 4. **Write to InfluxDB** (Line 196)

**Location:** Line 196

**Method:**
```python
write_api.write(bucket=INFLUXDB_BUCKET, record=point)
```

**Details:**
- **Write API:** `SYNCHRONOUS` mode (waits for write confirmation)
- **Bucket:** `plc_data_new` (from `.env` or default)
- **Record:** Single `Point` object containing all fields

**What gets written:**
- **One data point** per MQTT message
- **All 18 fields** in the same point (same timestamp)
- **Tags** for filtering/grouping (`machine_id`, etc.)

---

## InfluxDB Data Structure

### Measurement: `plc_data`

### Tags:
- `machine_id`: "machine-01", "machine-02", etc.

### Fields (18 total):
1. `SystemRunning` (boolean)
2. `Fault` (boolean)
3. `Filling` (boolean)
4. `Ready` (boolean)
5. `BottlesFilled` (integer)
6. `BottlesRejected` (integer)
7. `BottlesPerMinute` (float)
8. `AlarmFault` (boolean)
9. `AlarmOverfill` (boolean)
10. `AlarmUnderfill` (boolean)
11. `AlarmLowProductLevel` (boolean)
12. `AlarmCapMissing` (boolean)
13. `FillLevel` (float)
14. `TankTemperature` (float)
15. `TankPressure` (float)
16. `FillFlowRate` (float)
17. `ConveyorSpeed` (float)
18. `LowLevelSensor` (boolean)

### Timestamp:
- UTC timezone
- From JSON payload or current time

---

## Configuration

### Environment Variables (from `.env`):

**MQTT:**
- `MQTT_BROKER_HOST`: MQTT broker address (default: "localhost")
- `MQTT_BROKER_PORT`: MQTT port (default: 8883 for TLS)
- `MQTT_USERNAME`: MQTT username
- `MQTT_PASSWORD`: MQTT password
- `MQTT_TLS_ENABLED`: Enable TLS (default: "true")
- `MQTT_TOPIC`: Subscription topic (default: "plc/+/bottlefiller/data")

**InfluxDB:**
- `INFLUXDB_URL`: InfluxDB URL (default: "http://localhost:8086")
- `INFLUXDB_TOKEN`: Authentication token
- `INFLUXDB_ORG`: Organization name (default: "myorg")
- `INFLUXDB_BUCKET`: Bucket name (default: "plc_data_new")

**Machine:**
- `MACHINE_ID`: Machine identifier (default: "machine-01")

---

## Write Frequency

- **Mock PLC Agent:** Publishes every `PUBLISH_INTERVAL` seconds (default: 2.0)
- **InfluxDB Writer:** Writes immediately upon receiving MQTT message
- **Result:** One data point written to InfluxDB every ~2 seconds per machine

---

## Error Handling

**MQTT Connection Errors:**
- Reconnects automatically (min_delay=1s, max_delay=120s)
- Logs disconnection events

**InfluxDB Write Errors:**
- Catches exceptions and prints error message
- Does NOT retry (relies on MQTT QoS 1 for message delivery)
- Continues processing next message

**JSON Parse Errors:**
- Catches `JSONDecodeError` and logs warning
- Skips malformed messages

---

## Verification

To verify data is being written:

```bash
# Query latest data
python3 query_influxdb.py --time-range='-10m' --field='BottlesPerMinute'

# Check all data
python3 check_influxdb_data.py
```

---

## Key Points

1. **One MQTT message = One InfluxDB point** (with all 18 fields)
2. **Same timestamp** for all fields in a point
3. **Synchronous writes** (waits for confirmation)
4. **Machine ID as tag** for filtering/grouping
5. **All fields written together** (not separate points per field)

