# Scheduled Hours Utilization Data Implementation

## Summary

Added utilization data display to the Scheduled Hours page that shows data from MongoDB `labShiftUtilization` collection.

## Implementation Details

### 1. Frontend Changes (`app/scheduled-hours/page.tsx`)

#### Added State
```typescript
const [loadingUtilization, setLoadingUtilization] = useState(false);
const [utilizationData, setUtilizationData] = useState<UtilizationData | null>(null);
```

#### Added Interface
```typescript
interface UtilizationData {
  success: boolean;
  data?: {
    shiftName: string;
    totalMachines: number;
    machinesWithData: number;
    averageUtilization: number;
    totalProductiveHours: number;
    totalIdleHours: number;
    totalScheduledHours: number;
    totalNonProductiveHours: number;
    totalNodeOffHours: number;
    machineUtilizations: Array<{...}>;
  };
  error?: string;
}
```

#### Added Function: `fetchUtilizationData`
- Makes separate API call to `/api/shift-utilization`
- Passes parameters: `labId`, `shiftName`, `startDate`, `endDate`
- Handles loading states and errors
- Automatically called when dependencies change

### 2. API Endpoint Used

**Endpoint**: `GET /api/shift-utilization`

**Parameters** (passed from frontend):
- `labId`: Selected lab ID
- `shiftName`: Selected shift name (e.g., "SHIFT_A")
- `startDate`: Start date in `YYYY-MM-DD` format
- `endDate`: End date in `YYYY-MM-DD` format

**How it works**:
1. Queries MongoDB `labShiftUtilization` collection
2. Filters by shift name, machine names (from lab), and date range
3. Aggregates data by machine
4. Returns totals and machine-wise breakdown

### 3. UI Display

The page now shows two sections:

#### Section 1: Scheduled Hours (Calculated)
- Shows calculated scheduled hours from shift configuration
- Based on: `shiftDuration × numberOfDays`

#### Section 2: Utilization Data (from MongoDB)
- **Summary Cards**:
  - Average Utilization
  - Total Scheduled Hours (from MongoDB)
  - Total Productive Hours
  - Total Idle Hours
- **Additional Metrics**:
  - Total Non-Productive Hours
  - Total Node Off Hours
  - Machines with Data / Total Machines
- **Machine-wise Table**:
  - Shows utilization for each machine
  - Columns: Machine, Utilization, Scheduled, Productive, Idle, Non-Productive, Records
- **Comparison Section**:
  - Compares calculated vs stored scheduled hours
  - Shows warning if they differ significantly
  - Explains possible reasons for differences

### 4. Data Flow

```
User selects:
  - Lab
  - Shift
  - Date Range (Today, Last 7 Days, Last 30 Days, or custom)

Frontend makes TWO API calls:
  1. GET /api/scheduled-hours
     → Calculates scheduled hours from shift config
     → Returns: calculated scheduled hours
  
  2. GET /api/shift-utilization
     → Queries MongoDB labShiftUtilization collection
     → Returns: actual utilization data from database

Frontend displays:
  - Calculated scheduled hours (from shift config)
  - Actual utilization data (from MongoDB)
  - Comparison between the two
```

### 5. Test Cases

#### Unit Tests (`tests/scheduled-hours-utilization.test.ts`)
- ✅ API call parameter validation
- ✅ Data structure validation
- ✅ Date range calculations
- ✅ Comparison logic
- ✅ Error handling
- ✅ Data aggregation
- ✅ Edge cases

#### Integration Tests (`tests/scheduled-hours-utilization-integration.test.js`)
- ✅ MongoDB query validation
- ✅ Data aggregation tests
- ✅ Document structure validation
- ✅ Date format validation

## Key Features

1. **Separate API Call**: Utilization data is fetched via separate call to `/api/shift-utilization`
2. **Parameter Passing**: All parameters (labId, shiftName, startDate, endDate) are passed from frontend
3. **Automatic Updates**: Data refreshes when lab, shift, or date range changes
4. **Comparison Display**: Shows both calculated and stored values side-by-side
5. **Machine Breakdown**: Detailed table showing utilization per machine
6. **Error Handling**: Graceful handling of missing data or API errors

## Example API Call

```typescript
// Frontend code
const params = new URLSearchParams({
  labId: '64edc4fb81c07f7f6fbff26b',
  shiftName: 'SHIFT_A',
  startDate: '2026-01-16',
  endDate: '2026-01-22',
});

const response = await fetch(`/api/shift-utilization?${params.toString()}`);
```

## MongoDB Query

```javascript
// Backend query (in /api/shift-utilization)
db.labShiftUtilization.find({
  shift_name: "SHIFT_A",
  machine_name: { $in: ["Machine1", "Machine2", ...] },
  date: {
    $gte: "2026-01-16",
    $lte: "2026-01-22"
  }
})
```

## Testing

Run tests with:
```bash
# Unit tests
npm test scheduled-hours-utilization

# Integration tests (requires MongoDB)
npm test scheduled-hours-utilization-integration
```

## Files Modified/Created

1. **Modified**: `app/scheduled-hours/page.tsx`
   - Added utilization data state and fetching
   - Added utilization data display section
   - Added comparison section

2. **Created**: `tests/scheduled-hours-utilization.test.ts`
   - Unit tests for utilization functionality

3. **Created**: `tests/scheduled-hours-utilization-integration.test.js`
   - Integration tests with MongoDB

4. **Created**: `tests/README_SCHEDULED_HOURS.md`
   - Test documentation

5. **Created**: `docs/SCHEDULED_HOURS_UTILIZATION_IMPLEMENTATION.md`
   - This documentation

