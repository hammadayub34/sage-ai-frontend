# CNC Lathe Simulator

## Overview

The Lathe Simulator is a new mock agent that simulates CNC Lathe telemetry and publishes to MQTT, running in parallel with the existing bottle filler simulation.

## Architecture

```
OT Network:
  ┌─────────────────────┐
  │  Lathe Simulator    │
  │  (lathe_sim.py)     │
  └──────────┬──────────┘
             │ MQTT Publish
             │ Topic: plc/lathe01/lathe/data
             │
IT Network:
  ┌──────────▼──────────┐
  │  MQTT Broker        │
  └──────────┬──────────┘
             │ MQTT Subscribe
  ┌──────────▼──────────┐
  │  InfluxDB Writer    │ (TODO: Add subscription)
  └──────────┬──────────┘
             │ Write
  ┌──────────▼──────────┐
  │  InfluxDB           │
  └─────────────────────┘
```

## Files Created

- `lathe_sim/__init__.py` - Package initialization
- `lathe_sim/config.py` - Configuration (MQTT settings, machine ID)
- `lathe_sim/lathe_sim.py` - Main simulator with `startLatheMock()` function
- `start_lathe_sim.sh` - Startup script

## Data Structure

The simulator publishes JSON data with the following structure:

```json
{
  "timestamp": "2025-11-26T01:28:55.753835+00:00",
  "machine_id": "lathe01",
  "safety": {
    "door_closed": true,      // 95% true
    "estop_ok": true          // Always true
  },
  "spindle": {
    "speed_actual": 1432.5,   // 0-2500 RPM (around 1500 ± random)
    "load_percent": 69.1      // 0-100% (random 20-80)
  },
  "axis_x": {
    "position": 51.45         // 0-200 mm (random)
  },
  "axis_z": {
    "position": 76.92         // 0-300 mm (random)
  },
  "production": {
    "cycle_time_seconds": 33.1,  // 20-50 seconds (random)
    "parts_completed": 1          // Incrementing integer
  },
  "alarms": {
    "spindle_overload": false,    // true if load_percent > 90
    "chuck_not_clamped": false    // Always false for now
  }
}
```

## Usage

### Start the Lathe Simulator

```bash
# Default machine ID (lathe01)
./start_lathe_sim.sh

# Or specify machine ID
./start_lathe_sim.sh lathe01
```

### Environment Variables

- `LATHE_MACHINE_ID` - Machine ID (default: "lathe01")
- `LATHE_PUBLISH_INTERVAL` - Publish interval in seconds (default: 1.0)
- `MQTT_BROKER_HOST` - MQTT broker hostname (from .env)
- `MQTT_BROKER_PORT` - MQTT broker port (from .env)
- `MQTT_TLS_ENABLED` - Enable TLS (from .env)
- `MQTT_USERNAME` - MQTT username (uses mock_plc_agent by default)
- `MQTT_PASSWORD` - MQTT password (uses mock_plc_agent_pass by default)

### Debug Options

- `PRINT_JSON_DATA=true` - Print full JSON payload to console
- `SAVE_JSON_DATA=true` - Save data to JSON file
- `JSON_OUTPUT_FILE=/path/to/file.json` - Custom output file path

## MQTT Topic

- **Topic Pattern**: `plc/{machine-id}/lathe/data`
- **Example**: `plc/lathe01/lathe/data`
- **QoS**: 1 (at least once delivery)
- **Retain**: false

## MQTT Configuration

The lathe simulator uses the same MQTT credentials as the bottle filler mock agent (`mock_plc_agent`). The MQTT ACL has been updated to allow:
- `mock_plc_agent` user can write to `plc/+/lathe/#`
- `influxdb_writer` user can read from `plc/+/lathe/#`

## Next Steps

1. ✅ **COMPLETED**: Create lathe simulator with MQTT publishing
2. ⏳ **TODO**: Update InfluxDB Writer to subscribe to `plc/+/lathe/data`
3. ⏳ **TODO**: Add lathe data parsing and writing to InfluxDB
4. ⏳ **TODO**: Create frontend UI for CNC Lathe dashboard

## Testing

To test the simulator:

1. Make sure MQTT broker is running:
   ```bash
   docker ps | grep mqtt
   ```

2. Start the lathe simulator:
   ```bash
   ./start_lathe_sim.sh lathe01
   ```

3. Verify MQTT messages (in another terminal):
   ```bash
   mosquitto_sub -h localhost -p 8883 -u mock_plc_agent -P mock_plc_agent_pass \
     --cafile mosquitto/config/certs/ca.crt -t "plc/+/lathe/data" -v
   ```

4. Check console output - you should see:
   ```
   📤 [lathe01] Published to MQTT:
      ⏰ Time: 2025-11-26T01:28:55.753835+00:00
      🔒 Safety: Door=True | EStop=True
      ⚙️  Spindle: Speed=1432.5 RPM | Load=69.1%
      📍 Axis X: 51.45 mm | Axis Z: 76.92 mm
      📊 Production: Cycle=33.1s | Parts=1
      ⚠️  Alarms: SpindleOverload=False | ChuckNotClamped=False
      📡 Topic: plc/lathe01/lathe/data
   ```

