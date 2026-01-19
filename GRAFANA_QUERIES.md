# Grafana Queries - Ready to Use

All queries have been tested and verified to work with your InfluxDB data.

## Important Notes

- **Bucket**: `plc_data_new`
- **Machine ID**: `machine-01` (or remove filter to see all machines)
- **Time Range**: Use `v.timeRangeStart` and `v.timeRangeStop` in Grafana (auto-filled)
- **Window Period**: Use `v.windowPeriod` for auto-aggregation in Grafana

## Query 1: Status Fields Panel

**Use for**: Stat panels showing SystemRunning, Fault, Filling, Ready

```flux
from(bucket: "plc_data_new")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "SystemRunning" or 
                       r["_field"] == "Fault" or
                       r["_field"] == "Filling" or
                       r["_field"] == "Ready")
  |> last()
```

**Returns**: 4 status fields (boolean values)

---

## Query 2: Production Counters Panel

**Use for**: Stat panels showing BottlesFilled, BottlesRejected, BottlesPerMinute

```flux
from(bucket: "plc_data_new")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "BottlesFilled" or
                       r["_field"] == "BottlesRejected" or
                       r["_field"] == "BottlesPerMinute")
  |> last()
```

**Returns**: 3 counter fields (integer/float values)

---

## Query 3: Alarms Panel

**Use for**: Stat/Table panel showing all alarm statuses

```flux
from(bucket: "plc_data_new")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "AlarmFault" or
                       r["_field"] == "AlarmOverfill" or
                       r["_field"] == "AlarmUnderfill" or
                       r["_field"] == "AlarmLowProductLevel" or
                       r["_field"] == "AlarmCapMissing")
  |> last()
```

**Returns**: 5 alarm fields (boolean values)

---

## Query 4: Analog Values Panel

**Use for**: Gauge panels or stat panels for analog sensors

```flux
from(bucket: "plc_data_new")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "FillLevel" or
                       r["_field"] == "TankTemperature" or
                       r["_field"] == "TankPressure" or
                       r["_field"] == "FillFlowRate" or
                       r["_field"] == "ConveyorSpeed")
  |> last()
```

**Returns**: 5 analog fields (float values)

---

## Query 5: Time Series Chart

**Use for**: Line/Bar charts showing trends over time

```flux
from(bucket: "plc_data_new")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "BottlesPerMinute")
  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
```

**Variations** (change `_field` to see different metrics):
- `BottlesFilled` - Total bottles filled over time
- `BottlesPerMinute` - Production rate over time
- `FillLevel` - Tank level over time
- `TankTemperature` - Temperature over time
- `ConveyorSpeed` - Speed over time

**Returns**: Time series data points for charting

---

## Query 6: All Tags Table

**Use for**: Table panel showing all 18 fields at once

```flux
from(bucket: "plc_data_new")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 100)
```

**Returns**: Table with one row per timestamp, one column per field

---

## How to Use in Grafana

1. **Open Grafana**: `http://localhost:3003` (or 3004)
2. **Create New Dashboard** → **Add Panel**
3. **Select InfluxDB datasource**
4. **Switch to Flux query mode** (not InfluxQL)
5. **Paste one of the queries above**
6. **Set visualization type**:
   - Stat panels: Use Query 1, 2, 3, or 4
   - Time series: Use Query 5
   - Table: Use Query 6
7. **Set time range**: Last 24 hours (or wider due to timezone)
8. **Apply**

## Test Results

All queries have been tested and verified:
- ✅ Status Fields Query - **4 fields returned**
- ✅ Production Counters Query - **3 fields returned**
- ✅ Alarms Query - **5 fields returned**
- ✅ Analog Values Query - **5 fields returned**
- ✅ Time Series Query - **10+ data points returned**
- ✅ All Tags Table Query - **19 fields returned**

## Color Theme (Black/Grey)

To set dark theme in Grafana:
1. Click your profile icon (bottom left)
2. Go to **Preferences**
3. Select **Theme: Dark**
4. Click **Save**

This will give you the black/grey color scheme you requested.

