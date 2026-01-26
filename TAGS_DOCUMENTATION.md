# PLC Tags Documentation

## All Tags Being Stored and Displayed

### 📊 **COUNTER FIELDS** (Bottle Numbers & Production Metrics)

1. **`BottlesFilled`** (Integer)
   - **What it is**: Total number of bottles successfully filled
   - **Type**: Counter (increments over time)
   - **Example**: `1234`, `5678`, `10000`
   - **Display**: Large number in Production Counters panel
   - **This is your main bottle number/count!**

2. **`BottlesRejected`** (Integer)
   - **What it is**: Total number of bottles rejected (defective)
   - **Type**: Counter (increments over time)
   - **Example**: `5`, `12`, `23`
   - **Display**: Smaller number in Production Counters panel

3. **`BottlesPerMinute`** (Float)
   - **What it is**: Current production rate (bottles per minute)
   - **Type**: Calculated metric
   - **Example**: `45.2`, `52.8`, `38.5`
   - **Display**: Rate display + time series chart

---

### 🔵 **STATUS FIELDS** (System State)

4. **`SystemRunning`** (Boolean)
   - System is running/operational
   - `true` = Running, `false` = Stopped

5. **`Fault`** (Boolean)
   - System fault detected
   - `true` = Fault, `false` = No fault

6. **`Filling`** (Boolean)
   - Currently filling bottles
   - `true` = Filling, `false` = Not filling

7. **`Ready`** (Boolean)
   - System ready for operation
   - `true` = Ready, `false` = Not ready

---

### ⚠️ **ALARM FIELDS** (Alerts & Warnings)

8. **`AlarmFault`** (Boolean)
   - General fault alarm
   - `true` = Alarm active, `false` = OK

9. **`AlarmOverfill`** (Boolean)
   - Bottle overfill detected
   - `true` = Overfill alarm, `false` = OK

10. **`AlarmUnderfill`** (Boolean)
    - Bottle underfill detected
    - `true` = Underfill alarm, `false` = OK

11. **`AlarmLowProductLevel`** (Boolean)
    - Low product level in tank
    - `true` = Low level alarm, `false` = OK

12. **`AlarmCapMissing`** (Boolean)
    - Missing cap detected
    - `true` = Cap missing alarm, `false` = OK

---

### 📈 **ANALOG FIELDS** (Continuous Values)

13. **`FillLevel`** (Float)
    - Tank fill level percentage
    - Range: `0.0` to `100.0`
    - Example: `75.5`, `82.3`, `45.0`
    - Display: Gauge + Chart

14. **`TankTemperature`** (Float)
    - Tank temperature in Celsius
    - Example: `22.3`, `25.8`, `20.1`
    - Display: Gauge

15. **`TankPressure`** (Float)
    - Tank pressure in PSI
    - Example: `15.2`, `18.5`, `12.8`
    - Display: Text value

16. **`FillFlowRate`** (Float)
    - Fill flow rate (L/min)
    - Example: `2.5`, `3.2`, `1.8`
    - Display: Text value

17. **`ConveyorSpeed`** (Float)
    - Conveyor speed in RPM
    - Example: `120.0`, `150.0`, `100.0`
    - Display: Gauge

---

### 🔌 **INPUT FIELDS** (Sensor States)

18. **`LowLevelSensor`** (Boolean)
    - Low level sensor state
    - `true` = Low level detected, `false` = Normal

---

## Summary

**Total Tags: 18**

- **3 Counter Tags** (including **BottlesFilled** - your main bottle number)
- **4 Status Tags**
- **5 Alarm Tags**
- **5 Analog Tags**
- **1 Input Tag**

---

## Bottle Number Details

### Primary Bottle Number:
- **Tag Name**: `BottlesFilled`
- **Type**: Integer counter
- **What it represents**: Total cumulative count of bottles successfully filled
- **Updates**: Increments as bottles are filled
- **Display**: 
  - Large number in "Production Counters" panel
  - Also visible in "All Tags Table"

### Related Bottle Metrics:
- **`BottlesRejected`**: Count of rejected/defective bottles
- **`BottlesPerMinute`**: Current production rate

---

## Where to See These Tags

1. **Production Counters Panel** (Top right)
   - Shows: BottlesFilled (large), BottlesRejected, BottlesPerMinute

2. **All Tags Table** (Bottom of dashboard)
   - Shows: All 18 tags organized by category

3. **API Endpoint**
   - `GET /api/influxdb/latest?machineId=machine-01`
   - Returns all tags in JSON format

4. **Individual Panels**
   - Status Panel: SystemRunning, Fault, Filling, Ready
   - Alarms Panel: All 5 alarm tags
   - Tank Status: FillLevel, TankTemperature, TankPressure

---

## Example Data

```json
{
  "BottlesFilled": 1234,        ← Main bottle number!
  "BottlesRejected": 5,
  "BottlesPerMinute": 45.2,
  "SystemRunning": true,
  "Fault": false,
  "Filling": true,
  "Ready": true,
  "AlarmFault": false,
  "AlarmOverfill": false,
  "AlarmUnderfill": false,
  "AlarmLowProductLevel": false,
  "AlarmCapMissing": false,
  "FillLevel": 75.5,
  "TankTemperature": 22.3,
  "TankPressure": 15.2,
  "FillFlowRate": 2.5,
  "ConveyorSpeed": 120.0,
  "LowLevelSensor": false
}
```

