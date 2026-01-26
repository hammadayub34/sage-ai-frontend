# How to Get Utilization Data for Date Ranges

## Overview

When you select dates from the calendar (e.g., "Last 7 Days"), here's how the data flows:

## Data Flow

### 1. User Selects Date Range
- **Frontend**: User clicks "Last 7 Days" button or selects dates in calendar
- **State**: `dateRange` is set to `{ startDate: Date, endDate: Date }`
- **Format**: Dates are converted to `YYYY-MM-DD` format when making API calls

### 2. API Call to Get Utilization Data

**Endpoint**: `GET /api/shift-utilization`

**Parameters**:
- `labId`: Selected lab ID
- `shiftName`: Selected shift (e.g., "SHIFT_A")
- `startDate`: Start date in `YYYY-MM-DD` format
- `endDate`: End date in `YYYY-MM-DD` format

**Example**:
```typescript
const startDateStr = dateRange.startDate.toISOString().split('T')[0]; // "2026-01-16"
const endDateStr = dateRange.endDate.toISOString().split('T')[0];     // "2026-01-22"

const response = await fetch(
  `/api/shift-utilization?labId=${labId}&shiftName=${shiftName}&startDate=${startDateStr}&endDate=${endDateStr}`
);
```

### 3. MongoDB Query

The API queries the `labShiftUtilization` collection:

```javascript
const utilizationData = await shiftUtilizationCollection.find({
  shift_name: shiftName,           // e.g., "SHIFT_A"
  machine_name: { $in: machineNames },  // All machines in the lab
  date: {
    $gte: startDateStr,  // Greater than or equal to start date
    $lte: endDateStr     // Less than or equal to end date
  }
}).toArray();
```

### 4. Data Aggregation

The API aggregates the data:
- Sums up `scheduled_hours` for all machines and dates
- Calculates totals for `productive_hours`, `idle_hours`, `non_productive_hours`
- Computes average utilization

### 5. Response Format

```json
{
  "success": true,
  "data": {
    "shiftName": "SHIFT_A",
    "totalMachines": 24,
    "machinesWithData": 20,
    "averageUtilization": 15.26,
    "totalProductiveHours": 120.5,
    "totalIdleHours": 45.2,
    "totalScheduledHours": 287.16,
    "totalNonProductiveHours": 121.46,
    "machineUtilizations": [...]
  }
}
```

## How to Verify Data is Correct

### Method 1: Compare Calculated vs Stored Scheduled Hours

**Calculated Scheduled Hours** (from shift configuration):
- Uses our new `/api/scheduled-hours` endpoint
- Calculates: `shiftDuration × numberOfDays`
- Based on shift start/end times from lab configuration

**Stored Scheduled Hours** (from MongoDB):
- Sum of `scheduled_hours` from `labShiftUtilization` collection
- These are the actual values stored when data was collected

**Verification**:
```bash
# Run verification script
node scripts/verify-scheduled-hours.js
```

This script:
1. Calculates expected scheduled hours from shift config
2. Queries MongoDB for stored scheduled hours
3. Compares them and shows differences

### Method 2: Check Data Completeness

**Questions to ask**:
1. **Are there records for all dates?**
   - Expected: One record per machine per day per shift
   - Check: Count unique dates in the result

2. **Are there records for all machines?**
   - Expected: All machines in the lab should have data
   - Check: Compare `machinesWithData` vs `totalMachines`

3. **Do scheduled hours match?**
   - Expected: Stored `scheduled_hours` should match calculated value
   - Check: Compare per-day totals

### Method 3: Manual Verification

**Step 1**: Calculate expected scheduled hours
```javascript
// For SHIFT_A (00:01 to 11:59) = 11.97 hours/day
// For 7 days = 11.97 × 7 = 83.77 hours per machine
// For 24 machines = 83.77 × 24 = 2,010.48 hours total
```

**Step 2**: Query MongoDB directly
```javascript
db.labShiftUtilization.aggregate([
  {
    $match: {
      shift_name: "SHIFT_A",
      date: { $gte: "2026-01-16", $lte: "2026-01-22" }
    }
  },
  {
    $group: {
      _id: null,
      totalScheduledHours: { $sum: "$scheduled_hours" },
      count: { $sum: 1 }
    }
  }
])
```

**Step 3**: Compare results
- If they match → Data is correct ✅
- If they differ → Investigate why (missing data, different shift times, etc.)

## Common Issues

### Issue 1: No Data Found
**Symptoms**: API returns empty results or `machinesWithData: 0`

**Possible Causes**:
- Data hasn't been collected for that date range yet
- Shift name mismatch (e.g., "SHIFT_A" vs "shift_a")
- Machine names don't match between `machines` and `labShiftUtilization` collections

**Solution**: Check what dates/shifts are actually in the database:
```bash
node scripts/check-utilization-data.js
```

### Issue 2: Scheduled Hours Don't Match
**Symptoms**: Calculated hours ≠ Stored hours

**Possible Causes**:
- Shift times changed after data was collected
- Partial days (data collected mid-shift)
- Different calculation method used when storing data

**Solution**: Compare per-day to identify which dates are off

### Issue 3: Missing Machines
**Symptoms**: `machinesWithData < totalMachines`

**Possible Causes**:
- Some machines don't have sensors/nodes
- Data collection failed for some machines
- Machines were added after data collection period

**Solution**: Check which machines are missing and why

## Verification Scripts

### 1. Check All Utilization Data
```bash
node scripts/check-utilization-data.js
```
Shows:
- Total records
- Sample documents
- Statistics by shift and machine
- Recent data

### 2. Verify Scheduled Hours Calculation
```bash
node scripts/verify-scheduled-hours.js
```
Compares:
- Calculated scheduled hours (from shift config)
- Stored scheduled hours (from MongoDB)
- Shows differences and breakdowns

### 3. Test with Actual Data
```bash
node scripts/verify-scheduled-hours-with-data.js
```
Tests with a date range that has data and shows detailed comparison

## Example: Last 7 Days Flow

1. **User clicks "Last 7 Days"**
   ```typescript
   const end = new Date();
   const start = new Date();
   start.setDate(start.getDate() - 6); // 7 days ago
   setDateRange({ startDate: start, endDate: end });
   ```

2. **Frontend calls API**
   ```typescript
   const url = `/api/shift-utilization?labId=${labId}&shiftName=SHIFT_A&startDate=2026-01-16&endDate=2026-01-22`;
   ```

3. **API queries MongoDB**
   ```javascript
   db.labShiftUtilization.find({
     shift_name: "SHIFT_A",
     machine_name: { $in: ["Machine1", "Machine2", ...] },
     date: { $gte: "2026-01-16", $lte: "2026-01-22" }
   })
   ```

4. **API aggregates and returns**
   - Sums all `scheduled_hours`, `productive_hours`, etc.
   - Calculates averages
   - Returns aggregated data

5. **Frontend displays**
   - Shows total scheduled hours
   - Shows utilization percentages
   - Shows breakdown by machine

## Best Practices

1. **Always verify data exists** before displaying
2. **Show loading states** while fetching
3. **Handle empty results** gracefully
4. **Log API calls** for debugging
5. **Compare calculated vs stored** when possible
6. **Check date ranges** match what's in the database

