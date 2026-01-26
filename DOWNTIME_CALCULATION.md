# Downtime Calculation Documentation

## Overview

This document describes the fields and logic used to calculate machine downtime for both Bottle Filler and CNC Lathe machines.

---

## Bottle Filler Machine Downtime

### Fields Used
- **`AlarmLowProductLevel`** (Boolean)

### Logic
A machine is considered **DOWN** when:
- `AlarmLowProductLevel == true`

### Why This Field?
- `SystemRunning` is always `True` (set once at startup, never changes)
- `Fault` is always `False` (hardcoded, never changes)
- `AlarmLowProductLevel` actually changes (5% chance in mock agent) and indicates production stoppage

### Notes
- When `AlarmLowProductLevel` is `true`, production stops because the product tank level is below the minimum operating threshold
- This is a critical alarm that prevents the machine from operating normally

---

## CNC Lathe Machine Downtime

### Fields Used
- **`Fault`** (Boolean)
- **`AlarmChuckNotClamped`** (Boolean)
- **`AlarmDoorOpen`** (Boolean)

### Logic
A machine is considered **DOWN** when **ANY** of the following is `true`:
- `Fault == true`
- `AlarmChuckNotClamped == true`
- `AlarmDoorOpen == true`

### Why These Fields?
- `system_running` is always `True` (initialized, never changes)
- `Fault` field actually changes (based on door open or chuck not clamped conditions)
- `AlarmChuckNotClamped` and `AlarmDoorOpen` are critical alarms that stop production

### Notes
- The `Fault` field is calculated as: `fault = chuck_not_clamped OR door_open`
- These conditions prevent safe operation of the lathe machine

---

## Downtime Period Detection

### How It Works
1. The system queries InfluxDB for the specified time range
2. For each timestamp, it checks if any downtime-indicating field is `true`
3. It detects **transitions**:
   - **UP → DOWN**: When a field changes from `false` to `true`
   - **DOWN → UP**: When a field changes from `true` to `false`
4. Each transition creates a downtime period with:
   - Start time (when machine went down)
   - End time (when machine came back up, or `null` if still down)
   - Duration (calculated in seconds)

### Statistics Calculated
- **Total Downtime**: Sum of all downtime period durations
- **Incident Count**: Number of downtime periods
- **Average Downtime**: Total downtime / incident count
- **Uptime Percentage**: `((total_time - total_downtime) / total_time) * 100`

---

## Limitations

### Bottle Filler
- Downtime detection relies solely on `AlarmLowProductLevel`
- This alarm has only a 5% chance of occurring in the mock agent
- As a result, downtime events will be infrequent
- **Recommendation**: Consider updating the mock agent to simulate more realistic downtime scenarios

### CNC Lathe
- Downtime detection works well because `Fault` field actually changes
- Multiple conditions can trigger downtime (door open, chuck not clamped)
- More realistic downtime simulation

---

## Future Improvements

### Potential Enhancements
1. **Make mock agents simulate downtime**:
   - Periodically set `SystemRunning = false` for both machine types
   - Simulate maintenance windows or planned downtime
   - Add random fault conditions

2. **Expand downtime criteria**:
   - For Bottle Filler: Consider other critical alarms that stop production
   - For Lathe: Add more fault conditions or alarm combinations

3. **Planned vs Unplanned Downtime**:
   - Distinguish between scheduled maintenance and unexpected faults
   - Track different downtime categories

---

## API Endpoint

**Endpoint**: `/api/influxdb/downtime`

**Query Parameters**:
- `machineId`: Machine identifier (e.g., "machine-01", "lathe01")
- `timeRange`: Time range to analyze (e.g., "-24h", "-7d")
- `machineType`: Machine type ("bottlefiller" or "lathe")

**Example**:
```
GET /api/influxdb/downtime?machineId=machine-01&timeRange=-24h&machineType=bottlefiller
```

**Response**:
```json
{
  "data": {
    "totalDowntime": 3600,
    "totalDowntimeFormatted": "1h 0m 0s",
    "incidentCount": 3,
    "averageDowntime": 1200,
    "averageDowntimeFormatted": "20m 0s",
    "periods": [
      {
        "startTime": "2025-01-15T10:00:00Z",
        "endTime": "2025-01-15T10:20:00Z",
        "duration": 1200
      }
    ],
    "uptimePercentage": 95.8
  }
}
```

---

## Related Files

- **API Route**: `frontend/app/api/influxdb/downtime/route.ts`
- **Component**: `frontend/components/DowntimeStats.tsx`
- **Query Function**: `frontend/lib/influxdb.ts` (queryDowntime function)
- **Mock Agents**:
  - `mock_plc_agent/mock_plc_agent.py` (Bottle Filler)
  - `lathe_sim/lathe_sim.py` (CNC Lathe)

---

**Last Updated**: January 2025  
**Version**: 1.0

