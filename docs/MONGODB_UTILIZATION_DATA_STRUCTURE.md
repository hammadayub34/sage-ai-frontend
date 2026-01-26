# MongoDB Utilization Data Structure and Queries

## What is Saved in MongoDB?

### Collection Name: `labShiftUtilization`

### Document Structure

Each document represents **one machine, one shift, one day** of utilization data:

```javascript
{
  "_id": ObjectId("66669ad1aef129137811211a"),
  "mac_address": "08:D1:F9:A5:EB:78",           // MAC address of the sensor node
  "machine_name": "CARE MAIN DB",               // Name of the machine
  "shift_name": "SHIFT_A",                      // Shift name (e.g., "SHIFT_A", "SHIFT_B")
  "date": "2024-06-09",                         // Date in YYYY-MM-DD format
  "utilization": 0,                             // Utilization percentage (0-100)
  "productive_hours": 0,                        // Hours machine was productive
  "idle_hours": 2.515,                          // Hours machine was idle
  "non_productive_hours": 0,                    // Hours machine was down/non-productive
  "node_off_hours": 0.485,                      // Hours the sensor node was off
  "scheduled_hours": 3,                         // Total scheduled hours for this shift/day
  "status": "success"                           // Status of data collection
}
```

### Key Fields Explained

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `_id` | ObjectId | MongoDB document ID | `66669ad1aef129137811211a` |
| `mac_address` | String | MAC address of the sensor node | `"08:D1:F9:A5:EB:78"` |
| `machine_name` | String | Name of the machine | `"CARE MAIN DB"` |
| `shift_name` | String | Shift identifier | `"SHIFT_A"`, `"SHIFT_B"` |
| `date` | String | Date in YYYY-MM-DD format | `"2024-06-09"` |
| `utilization` | Number | Utilization percentage (0-100) | `38.287` |
| `productive_hours` | Number | Hours machine was productive | `1.149` |
| `idle_hours` | Number | Hours machine was idle | `2.515` |
| `non_productive_hours` | Number | Hours machine was down | `0` |
| `node_off_hours` | Number | Hours sensor node was off | `0.485` |
| `scheduled_hours` | Number | Total scheduled hours for shift | `3` |
| `status` | String | Data collection status | `"success"` |

### Important Notes

1. **One Document = One Machine + One Shift + One Day**
   - If you have 10 machines, 2 shifts, and 7 days, you'd expect up to 140 documents (10 × 2 × 7)

2. **Date Format**
   - Always stored as string in `YYYY-MM-DD` format (e.g., `"2024-06-09"`)
   - This allows easy range queries

3. **Scheduled Hours**
   - This is the total scheduled hours for that specific shift on that day
   - Should match: `shiftDuration × 1 day` (for a single day)

4. **Utilization Calculation**
   - `utilization = (productive_hours / scheduled_hours) × 100`
   - Or: `utilization = ((productive_hours + idle_hours) / scheduled_hours) × 100`

## How to Query Data for Multiple Dates for a Shift

### Basic Query Pattern

```javascript
db.labShiftUtilization.find({
  shift_name: "SHIFT_A",                    // Filter by shift
  machine_name: { $in: ["Machine1", "Machine2"] },  // Filter by machines
  date: {                                    // Filter by date range
    $gte: "2026-01-16",                      // Greater than or equal to start date
    $lte: "2026-01-22"                       // Less than or equal to end date
  }
})
```

### Example 1: Get All Data for a Shift in Date Range

```javascript
// Get all SHIFT_A data from Jan 16-22, 2026
db.labShiftUtilization.find({
  shift_name: "SHIFT_A",
  date: {
    $gte: "2026-01-16",
    $lte: "2026-01-22"
  }
})
```

### Example 2: Get Data for Specific Machines

```javascript
// Get data for specific machines
db.labShiftUtilization.find({
  shift_name: "SHIFT_A",
  machine_name: { $in: ["CARE MAIN DB", "Solar production", "energy meter"] },
  date: {
    $gte: "2026-01-16",
    $lte: "2026-01-22"
  }
})
```

### Example 3: Aggregate Data (Sum Totals)

```javascript
// Sum up scheduled hours for all machines in date range
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
      totalProductiveHours: { $sum: "$productive_hours" },
      totalIdleHours: { $sum: "$idle_hours" },
      totalNonProductiveHours: { $sum: "$non_productive_hours" },
      count: { $sum: 1 }
    }
  }
])
```

### Example 4: Group by Date

```javascript
// Get totals for each date
db.labShiftUtilization.aggregate([
  {
    $match: {
      shift_name: "SHIFT_A",
      date: { $gte: "2026-01-16", $lte: "2026-01-22" }
    }
  },
  {
    $group: {
      _id: "$date",
      totalScheduledHours: { $sum: "$scheduled_hours" },
      totalProductiveHours: { $sum: "$productive_hours" },
      machineCount: { $addToSet: "$machine_name" }
    }
  },
  {
    $sort: { _id: 1 }  // Sort by date
  }
])
```

### Example 5: Group by Machine

```javascript
// Get totals for each machine
db.labShiftUtilization.aggregate([
  {
    $match: {
      shift_name: "SHIFT_A",
      date: { $gte: "2026-01-16", $lte: "2026-01-22" }
    }
  },
  {
    $group: {
      _id: "$machine_name",
      totalScheduledHours: { $sum: "$scheduled_hours" },
      totalProductiveHours: { $sum: "$productive_hours" },
      avgUtilization: { $avg: "$utilization" },
      dateCount: { $addToSet: "$date" }
    }
  },
  {
    $sort: { totalScheduledHours: -1 }  // Sort by scheduled hours descending
  }
])
```

### Example 6: Get Unique Dates Available

```javascript
// Find what dates have data for a shift
db.labShiftUtilization.distinct("date", {
  shift_name: "SHIFT_A",
  machine_name: "CARE MAIN DB"
})
```

### Example 7: Count Records per Date

```javascript
// Count how many records exist for each date
db.labShiftUtilization.aggregate([
  {
    $match: {
      shift_name: "SHIFT_A"
    }
  },
  {
    $group: {
      _id: "$date",
      recordCount: { $sum: 1 },
      machineCount: { $addToSet: "$machine_name" }
    }
  },
  {
    $project: {
      date: "$_id",
      recordCount: 1,
      machineCount: { $size: "$machineCount" }
    }
  },
  {
    $sort: { date: -1 }  // Most recent first
  }
])
```

## TypeScript/Node.js Query Examples

### Using MongoDB Driver

```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient(uri);
await client.connect();
const db = client.db('admin');
const collection = db.collection('labShiftUtilization');

// Query for date range
const startDate = '2026-01-16';
const endDate = '2026-01-22';
const shiftName = 'SHIFT_A';
const machineNames = ['Machine1', 'Machine2', 'Machine3'];

const data = await collection.find({
  shift_name: shiftName,
  machine_name: { $in: machineNames },
  date: {
    $gte: startDate,
    $lte: endDate
  }
}).toArray();

// Aggregate totals
const totals = await collection.aggregate([
  {
    $match: {
      shift_name: shiftName,
      machine_name: { $in: machineNames },
      date: { $gte: startDate, $lte: endDate }
    }
  },
  {
    $group: {
      _id: null,
      totalScheduledHours: { $sum: '$scheduled_hours' },
      totalProductiveHours: { $sum: '$productive_hours' },
      totalIdleHours: { $sum: '$idle_hours' },
      totalNonProductiveHours: { $sum: '$non_productive_hours' },
      count: { $sum: 1 }
    }
  }
]).toArray();
```

### Using Our API Pattern (from shift-utilization route)

```typescript
// This is how our API does it
const shiftUtilizationCollection = db.collection('labShiftUtilization');

// Get machine names for the lab
const machines = await machinesCollection.find({ labId: labId }).toArray();
const machineNames = machines.map(m => m.machineName);

// Query utilization data
const utilizationData = await shiftUtilizationCollection.find({
  shift_name: shiftName,
  machine_name: { $in: machineNames },
  date: {
    $gte: startDateStr,  // "2026-01-16"
    $lte: endDateStr     // "2026-01-22"
  }
}).toArray();

// Aggregate by machine
const machineStats = new Map();
utilizationData.forEach((doc) => {
  const machineName = doc.machine_name;
  if (!machineStats.has(machineName)) {
    machineStats.set(machineName, {
      totalScheduledHours: 0,
      totalProductiveHours: 0,
      totalIdleHours: 0,
      // ... other fields
    });
  }
  const stats = machineStats.get(machineName);
  stats.totalScheduledHours += doc.scheduled_hours || 0;
  stats.totalProductiveHours += doc.productive_hours || 0;
  // ... accumulate other fields
});
```

## Common Query Patterns

### Pattern 1: Get All Data for Last N Days

```javascript
const days = 7;
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - (days - 1));

const startDateStr = startDate.toISOString().split('T')[0]; // "2026-01-16"
const endDateStr = endDate.toISOString().split('T')[0];     // "2026-01-22"

db.labShiftUtilization.find({
  shift_name: "SHIFT_A",
  date: { $gte: startDateStr, $lte: endDateStr }
})
```

### Pattern 2: Get Data for Specific Date Range

```javascript
db.labShiftUtilization.find({
  shift_name: "SHIFT_A",
  date: { $gte: "2026-01-01", $lte: "2026-01-31" }  // Entire month
})
```

### Pattern 3: Get Latest Data

```javascript
// Get most recent date
const latestDate = await db.labShiftUtilization
  .find({ shift_name: "SHIFT_A" })
  .sort({ date: -1 })
  .limit(1)
  .toArray();

// Get all data for latest date
db.labShiftUtilization.find({
  shift_name: "SHIFT_A",
  date: latestDate[0].date
})
```

## Important Query Tips

1. **Date Range Queries**
   - Always use `$gte` (greater than or equal) and `$lte` (less than or equal)
   - Dates are strings, so they compare lexicographically (which works for YYYY-MM-DD format)

2. **Machine Name Matching**
   - Use `$in` operator for multiple machines
   - Machine names must match exactly (case-sensitive)

3. **Shift Name Matching**
   - Shift names are case-sensitive
   - Common values: `"SHIFT_A"`, `"SHIFT_B"`, `"shift-3"`

4. **Performance**
   - Create indexes on frequently queried fields:
     ```javascript
     db.labShiftUtilization.createIndex({ shift_name: 1, date: 1, machine_name: 1 });
     ```

5. **Empty Results**
   - If no data found, check:
     - Date range (are there records for those dates?)
     - Shift name (exact match required)
     - Machine names (do they exist in the collection?)

## Summary

- **What's saved**: One document per machine per shift per day
- **Key fields**: `machine_name`, `shift_name`, `date`, `scheduled_hours`, `productive_hours`, `idle_hours`, `non_productive_hours`, `utilization`
- **How to query**: Use `find()` with `shift_name`, `machine_name` (with `$in`), and `date` range (`$gte`/`$lte`)
- **How to aggregate**: Use `aggregate()` with `$match` and `$group` stages

