# CNC Lathe Implementation - Complete

## ✅ Implementation Status: COMPLETE

All components have been implemented and are ready to use.

---

## 📁 Files Created

### 1. Lathe Simulator
- **`lathe_sim/__init__.py`** - Package initialization
- **`lathe_sim/config.py`** - Configuration (MQTT, machine ID, publish interval)
- **`lathe_sim/lathe_sim.py`** - Main simulator (generates 32 fields of lathe data)

### 2. Startup Script
- **`start_lathe_sim.sh`** - Convenient script to start the lathe simulator

---

## 📝 Files Modified

### 1. InfluxDB Writer (`influxdb_writer/influxdb_writer_production.py`)
- **Added subscription** to `plc/+/lathe/data` (line ~50)
- **Added lathe data handler** (lines 186-249) - processes 32 fields
- **No changes to bottlefiller code** - existing logic untouched

### 2. MQTT ACL (`mosquitto/config/acl`)
- **Added write permission** for `mock_plc_agent` to `plc/+/lathe/#`
- **Added read permission** for `influxdb_writer` to `plc/+/lathe/#`

---

## 🏗️ Architecture

```
┌─────────────────────┐
│  Mock PLC Agent     │ → plc/machine-01/bottlefiller/data
│  (Bottle Filler)    │
└─────────────────────┘
         │
         │ MQTT
         ▼
┌─────────────────────┐
│   MQTT Broker       │
│   (Mosquitto)       │
└─────────────────────┘
         │
         │ (2 subscriptions)
         ▼
┌─────────────────────┐
│  InfluxDB Writer    │ ← Subscribes to:
│                     │   • plc/+/bottlefiller/data (existing)
│                     │   • plc/+/lathe/data (NEW)
└─────────────────────┘
         │
         │ Writes to
         ▼
┌─────────────────────┐
│     InfluxDB        │
│  (plc_data_new)     │
│                     │
│  Measurement: plc_data
│  Tags:
│    • machine_id: "machine-01" or "lathe01"
│    • machine_type: "bottlefiller" or "lathe" (NEW)
└─────────────────────┘

┌─────────────────────┐
│  Lathe Sim Agent    │ → plc/lathe01/lathe/data
│  (NEW)              │
└─────────────────────┘
```

---

## 📊 Data Structure

### Lathe publishes 32 fields:

**Safety (2):**
- `DoorClosed`, `EStopOK`

**Spindle (3):**
- `SpindleSpeed`, `SpindleSpeedSetpoint`, `SpindleLoad`

**Axis X (3):**
- `AxisXPosition`, `AxisXFeedrate`, `AxisXHomed`

**Axis Z (3):**
- `AxisZPosition`, `AxisZFeedrate`, `AxisZHomed`

**Production (4):**
- `CycleTime`, `PartsCompleted`, `PartsRejected`, `PartsPerHour`

**Alarms (5):**
- `AlarmSpindleOverload`, `AlarmChuckNotClamped`, `AlarmDoorOpen`, `AlarmToolWear`, `AlarmCoolantLow`

**Status (5):**
- `SystemRunning`, `Machining`, `Ready`, `Fault`, `AutoMode`

**Tooling (4):**
- `ToolNumber`, `ToolLifePercent`, `ToolOffsetX`, `ToolOffsetZ`

**Coolant (3):**
- `CoolantFlowRate`, `CoolantTemperature`, `CoolantLevelPercent`

### InfluxDB Tags:
- `machine_id`: "lathe01", "lathe02", etc.
- `machine_type`: "lathe" (to distinguish from "bottlefiller")

---

## 🚀 Usage

### Start Lathe Simulator:
```bash
# Default machine ID (lathe01)
./start_lathe_sim.sh

# Specify machine ID
./start_lathe_sim.sh lathe02
```

### Environment Variables:
The lathe simulator uses the same `.env` file and respects:
- `LATHE_MACHINE_ID` - Machine ID (default: "lathe01")
- `LATHE_PUBLISH_INTERVAL` - Publish interval in seconds (default: 2.0)
- `MQTT_BROKER_HOST`, `MQTT_BROKER_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD` - MQTT settings
- `MQTT_TLS_ENABLED` - Enable TLS (default: true)

### Verify Data Flow:
```bash
# Check if lathe data is in InfluxDB
python3 query_influxdb.py --time-range='-5m' --field='SpindleSpeed' --machine='lathe01'
```

---

## ✅ Key Features

1. **Parallel Architecture** - Lathe runs independently from bottlefiller
2. **Same Infrastructure** - Uses same MQTT broker and InfluxDB bucket
3. **No Bottlefiller Changes** - All existing code untouched
4. **32 Fields** - Comprehensive lathe telemetry
5. **Machine Type Tag** - Easy filtering in InfluxDB queries

---

## 🔍 Testing

To test the implementation:

1. **Start InfluxDB Writer** (if not already running):
   ```bash
   python3 influxdb_writer/influxdb_writer_production.py
   ```

2. **Start Lathe Simulator**:
   ```bash
   ./start_lathe_sim.sh
   ```

3. **Verify MQTT messages** (should see in InfluxDB Writer output):
   ```
   📨 Received message on topic: plc/lathe01/lathe/data (Machine: lathe01)
   💾 Written to InfluxDB [lathe01 - Lathe]:
      ⚙️  Spindle: Speed=1450.5 RPM | Load=65.3%
      ...
   ```

4. **Query InfluxDB**:
   ```bash
   python3 query_influxdb.py --time-range='-5m' --field='SpindleSpeed' --machine='lathe01'
   ```

---

## 📋 Next Steps (Optional)

- Frontend UI for lathe data (separate page or dashboard)
- Grafana dashboards for lathe metrics
- Additional lathe machines (lathe02, lathe03, etc.)

---

## 🎉 Implementation Complete!

The CNC Lathe feature is fully implemented and ready to use. Both bottlefiller and lathe data will flow through the same InfluxDB Writer to InfluxDB, distinguished by the `machine_type` tag.

