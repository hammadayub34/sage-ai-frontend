# Insights Page API Calls - Complete Breakdown

## Overview
This document details all API calls made on the Insights page (`/scheduled-hours`), including parameters, execution order, and triggers.

---

## API Calls Summary

| # | Endpoint | Method | Trigger | Parameters |
|---|----------|--------|---------|------------|
| 1 | `/api/labs/user` | GET | Page Load | `userId` |
| 2 | `/api/labs` | GET | Lab Selection | None |
| 3 | `/api/machines` | GET | Lab Selection | `labId` |
| 4 | `/api/scheduled-hours` | GET | Lab + Shift + Date Range | `labId`, `shiftName`, `startDate`, `endDate` |
| 5 | `/api/shift-utilization/query-info` | GET | Lab + Shift + Date Range | `labId`, `shiftName`, `startDate`, `endDate`, `machineName?` |
| 6 | `/api/shift-utilization` | GET | Lab + Shift + Date Range | `labId`, `shiftName`, `startDate`, `endDate`, `machineName?` |

---

## Detailed API Calls

### 1. Get User Labs (Initial Load)

**Endpoint:** `GET /api/labs/user?userId={userId}`

**Trigger:** 
- Page load (useEffect on mount)
- Reads `userId` from localStorage

**Parameters:**
```javascript
{
  userId: string  // From localStorage.getItem('user')
}
```

**Example:**
```
GET /api/labs/user?userId=507f1f77bcf86cd799439011
```

**Response:**
```javascript
{
  success: true,
  labs: [
    {
      _id: "...",
      name: "Lab Name",
      description: "...",
      shifts: [...]
    }
  ]
}
```

**Code Location:** Lines 142-180

---

### 2. Get All Labs with Shifts

**Endpoint:** `GET /api/labs`

**Trigger:**
- When `selectedLabId` changes (useEffect)
- Called in `fetchLabWithShifts()`
- Also called when user manually selects a lab

**Parameters:**
```javascript
// No query parameters - fetches ALL labs
```

**Example:**
```
GET /api/labs
```

**Response:**
```javascript
{
  success: true,
  labs: [
    {
      _id: "...",
      name: "Lab Name",
      shifts: [
        {
          name: "Shift A",
          startTime: "08:00",
          endTime: "16:00"
        }
      ]
    }
  ]
}
```

**Code Location:** Lines 229-257

**Note:** The frontend filters the response to find the selected lab and extracts its shifts.

---

### 3. Get Machines for Lab

**Endpoint:** `GET /api/machines?labId={labId}`

**Trigger:**
- When `selectedLabId` changes (useEffect)
- Called in `fetchMachinesForLab()`
- Also called when user manually selects a lab

**Parameters:**
```javascript
{
  labId: string  // Selected lab ID
}
```

**Example:**
```
GET /api/machines?labId=507f1f77bcf86cd799439011
```

**Response:**
```javascript
{
  success: true,
  machines: [
    {
      _id: "...",
      machineName: "Machine 1",
      labId: "...",
      status: "active"
    }
  ]
}
```

**Code Location:** Lines 188-226

**Note:** Auto-selects the first machine if available.

---

### 4. Calculate Scheduled Hours

**Endpoint:** `GET /api/scheduled-hours?labId={labId}&shiftName={shiftName}&startDate={startDate}&endDate={endDate}`

**Trigger:**
- When `selectedLabId`, `selectedShift`, or `dateRange` changes
- Called in `fetchScheduledHours()` (useEffect dependency: `fetchScheduledHours`)

**Parameters:**
```javascript
{
  labId: string,        // Selected lab ID
  shiftName: string,    // Selected shift name (e.g., "Shift A")
  startDate: string,    // YYYY-MM-DD format (e.g., "2025-01-01")
  endDate: string       // YYYY-MM-DD format (e.g., "2025-01-07")
}
```

**Example:**
```
GET /api/scheduled-hours?labId=507f1f77bcf86cd799439011&shiftName=Shift%20A&startDate=2025-01-01&endDate=2025-01-07
```

**Response:**
```javascript
{
  success: true,
  scheduledHours: 56.0,
  shiftInfo: {
    shiftName: "Shift A",
    startTime: "08:00",
    endTime: "16:00",
    shiftDuration: 8.0,      // Hours per day
    numberOfDays: 7          // Number of days in range
  }
}
```

**Code Location:** Lines 268-352

**Calculation:**
- `scheduledHours = shiftDuration × numberOfDays`
- Example: 8 hours/day × 7 days = 56 hours

---

### 5. Get Query Information & Last Seen

**Endpoint:** `GET /api/shift-utilization/query-info?labId={labId}&shiftName={shiftName}&startDate={startDate}&endDate={endDate}&machineName={machineName?}`

**Trigger:**
- When `selectedLabId`, `selectedShift`, `selectedMachineId`, or `dateRange` changes
- Called in `fetchQueryInfo()` (useEffect dependency: `fetchQueryInfo`)

**Parameters:**
```javascript
{
  labId: string,        // Selected lab ID
  shiftName: string,    // Selected shift name
  startDate: string,    // YYYY-MM-DD format
  endDate: string,      // YYYY-MM-DD format
  machineName?: string  // Optional: Selected machine name (if machine is selected)
}
```

**Example (All Machines):**
```
GET /api/shift-utilization/query-info?labId=507f1f77bcf86cd799439011&shiftName=Shift%20A&startDate=2025-01-01&endDate=2025-01-07
```

**Example (Specific Machine):**
```
GET /api/shift-utilization/query-info?labId=507f1f77bcf86cd799439011&shiftName=Shift%20A&startDate=2025-01-01&endDate=2025-01-07&machineName=Machine%201
```

**Response:**
```javascript
{
  success: true,
  query: {
    shift_name: "Shift A",
    machine_name: { $in: ["Machine 1", "Machine 2"] },
    date: { $gte: "2025-01-01", $lte: "2025-01-07" }
  },
  queryString: "{...}",
  collection: "labShiftUtilization",
  database: "admin",
  recordCount: 21,
  lastSeenDate: "2025-01-07",
  lastSeenRecord: {
    date: "2025-01-07",
    shift_name: "Shift A",
    machine_name: "Machine 1",
    scheduled_hours: 8.0,
    utilization: 75.5
  },
  parameters: {
    labId: "...",
    shiftName: "Shift A",
    machineName: "All machines" | "Machine 1",
    startDate: "2025-01-01",
    endDate: "2025-01-07",
    machineCount: 3
  }
}
```

**Code Location:** Lines 712-803

**Purpose:** 
- Shows the exact MongoDB query being executed
- Displays last seen date for utilization data
- Provides query statistics

---

### 6. Get Utilization Data from MongoDB

**Endpoint:** `GET /api/shift-utilization?labId={labId}&shiftName={shiftName}&startDate={startDate}&endDate={endDate}&machineName={machineName?}`

**Trigger:**
- When `selectedLabId`, `selectedShift`, `selectedMachineId`, or `dateRange` changes
- Called in `fetchUtilizationData()` (useEffect dependency: `fetchUtilizationData`)

**Parameters:**
```javascript
{
  labId: string,        // Selected lab ID
  shiftName: string,    // Selected shift name
  startDate: string,    // YYYY-MM-DD format
  endDate: string,      // YYYY-MM-DD format
  machineName?: string  // Optional: Selected machine name (if machine is selected)
}
```

**Example (All Machines):**
```
GET /api/shift-utilization?labId=507f1f77bcf86cd799439011&shiftName=Shift%20A&startDate=2025-01-01&endDate=2025-01-07
```

**Example (Specific Machine):**
```
GET /api/shift-utilization?labId=507f1f77bcf86cd799439011&shiftName=Shift%20A&startDate=2025-01-01&endDate=2025-01-07&machineName=Machine%201
```

**Response:**
```javascript
{
  success: true,
  data: {
    shiftName: "Shift A",
    totalMachines: 3,
    machinesWithData: 2,
    averageUtilization: 72.5,
    totalProductiveHours: 40.5,
    totalIdleHours: 12.0,
    totalScheduledHours: 56.0,
    totalNonProductiveHours: 2.5,
    totalNodeOffHours: 1.0,
    machineUtilizations: [
      {
        machineName: "Machine 1",
        averageUtilization: 80.0,
        totalProductiveHours: 24.0,
        totalIdleHours: 5.0,
        totalScheduledHours: 30.0,
        totalNonProductiveHours: 1.0,
        totalNodeOffHours: 0.0,
        recordCount: 3
      },
      // ... more machines
    ],
    dateRange: {
      start: "2025-01-01",
      end: "2025-01-07",
      days: 7
    },
    _debug: {
      queryParameters: {...},
      mongoQuery: {...},
      rawResults: [...],
      calculationSteps: [...],
      overallCalculation: {...}
    }
  }
}
```

**Code Location:** Lines 806-917

**Purpose:**
- Fetches aggregated utilization data from MongoDB `labShiftUtilization` collection
- Calculates totals and averages per machine
- Returns machine-wise breakdown

---

## Execution Order

### Initial Page Load

1. **Page Mounts** → Read `userId` from localStorage
2. **API Call #1:** `GET /api/labs/user?userId=...`
   - Fetches labs for the user
   - Auto-selects first lab → Sets `selectedLabId`
3. **Lab Selected** → Triggers multiple useEffects:
   - **API Call #2:** `GET /api/labs` (fetch lab shifts)
   - **API Call #3:** `GET /api/machines?labId=...` (fetch machines)
4. **Shift Auto-Selected** (from API Call #2 response)
   - Sets `selectedShift`
5. **Date Range Default** (Last 7 Days)
   - Sets `dateRange`
6. **All Dependencies Ready** → Triggers:
   - **API Call #4:** `GET /api/scheduled-hours?labId=...&shiftName=...&startDate=...&endDate=...`
   - **API Call #5:** `GET /api/shift-utilization/query-info?labId=...&shiftName=...&startDate=...&endDate=...`
   - **API Call #6:** `GET /api/shift-utilization?labId=...&shiftName=...&startDate=...&endDate=...`

**Note:** API Calls #4, #5, and #6 run in parallel (separate useEffects).

---

### User Changes Lab

1. **User selects new lab** → `handleLabChange()` called
2. **State cleared:**
   - `selectedMachineId` → cleared
   - `selectedShift` → cleared
   - `machines` → cleared
   - `labShifts` → cleared
   - `scheduledHoursData` → cleared
   - `utilizationData` → cleared
   - `queryInfo` → cleared
3. **New lab ID set** → `setSelectedLabId(newLabId)`
4. **useEffects trigger:**
   - **API Call #2:** `GET /api/labs` (fetch shifts for new lab)
   - **API Call #3:** `GET /api/machines?labId={newLabId}` (fetch machines for new lab)
5. **Shift auto-selected** → Sets `selectedShift`
6. **Dependencies ready** → Triggers:
   - **API Call #4:** `GET /api/scheduled-hours?labId={newLabId}&...`
   - **API Call #5:** `GET /api/shift-utilization/query-info?labId={newLabId}&...`
   - **API Call #6:** `GET /api/shift-utilization?labId={newLabId}&...`

---

### User Changes Machine

1. **User selects machine** → `handleMachineChange()` called
2. **State updated:** `setSelectedMachineId(machineId)`
3. **useEffects trigger:**
   - **API Call #5:** `GET /api/shift-utilization/query-info?labId=...&machineName={machineName}&...`
   - **API Call #6:** `GET /api/shift-utilization?labId=...&machineName={machineName}&...`
4. **API Call #4** (scheduled hours) does NOT change (doesn't depend on machine)

---

### User Changes Shift

1. **User selects shift** → `handleShiftChange()` called
2. **State updated:** `setSelectedShift(shiftName)`
3. **useEffects trigger:**
   - **API Call #4:** `GET /api/scheduled-hours?labId=...&shiftName={newShift}&...`
   - **API Call #5:** `GET /api/shift-utilization/query-info?labId=...&shiftName={newShift}&...`
   - **API Call #6:** `GET /api/shift-utilization?labId=...&shiftName={newShift}&...`

---

### User Changes Date Range

1. **User selects date range** (preset button or calendar)
   - Preset: `handlePresetRange(days)`
   - Calendar: `handleDateRangeChange(range)`
2. **State updated:** `setDateRange({ startDate, endDate })`
3. **useEffects trigger:**
   - **API Call #4:** `GET /api/scheduled-hours?labId=...&startDate={newStart}&endDate={newEnd}`
   - **API Call #5:** `GET /api/shift-utilization/query-info?labId=...&startDate={newStart}&endDate={newEnd}`
   - **API Call #6:** `GET /api/shift-utilization?labId=...&startDate={newStart}&endDate={newEnd}`

---

## Parallel Execution

When multiple dependencies change simultaneously (e.g., lab + shift + date range), the following API calls run in parallel:

- **API Call #4** (`/api/scheduled-hours`)
- **API Call #5** (`/api/shift-utilization/query-info`)
- **API Call #6** (`/api/shift-utilization`)

They are triggered by separate `useEffect` hooks and execute concurrently.

---

## Date Format

All dates are formatted as **YYYY-MM-DD** using the `formatDateForAPI()` helper function:

```javascript
const formatDateForAPI = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
```

**Example:** `new Date('2025-01-15')` → `"2025-01-15"`

---

## Conditional Parameters

### `machineName` Parameter

- **Included** when a specific machine is selected (`selectedMachineId` is set)
- **Omitted** when "All machines" is selected or no machine is selected
- **Validation:** Only included if the machine exists in the current `machines` array (prevents stale data)

**Code Logic:**
```javascript
const selectedMachine = selectedMachineId && machines.length > 0 
  ? machines.find(m => m._id === selectedMachineId) 
  : null;
const machineName = selectedMachine?.machineName || null;

if (machineName) {
  params.append('machineName', machineName);
}
```

---

## Error Handling

All API calls include error handling:
- Failed requests show toast notifications
- Error states are stored in component state
- Loading states prevent duplicate calls

---

## Summary

**Total API Calls:** 6 endpoints

**Most Frequent:**
- API Calls #4, #5, #6 run whenever lab, shift, or date range changes
- These 3 calls typically run together in parallel

**Least Frequent:**
- API Call #1: Only on page load
- API Call #2: Only when lab changes
- API Call #3: Only when lab changes

**Typical User Flow:**
1. Page loads → 1 API call
2. Lab auto-selected → 2 API calls
3. Shift auto-selected + date range default → 3 API calls
4. **Total: 6 API calls on initial load**

**Subsequent Changes:**
- Change lab → 5 API calls (2 new + 3 data calls)
- Change machine → 2 API calls (query-info + utilization)
- Change shift → 3 API calls (scheduled-hours + query-info + utilization)
- Change date range → 3 API calls (scheduled-hours + query-info + utilization)


