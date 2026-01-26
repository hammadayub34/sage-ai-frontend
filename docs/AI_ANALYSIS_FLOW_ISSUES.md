# AI Analysis Flow - Current Issues and Fix

## Current Flow When User Changes Selections

### 1. User Changes Lab/Shift/Date Range/Machine
- User selects a different lab, shift, date range, or machine from dropdowns

### 2. Data Fetching Triggers
- `fetchScheduledHours()` is triggered via useEffect (depends on: selectedLabId, selectedShift, dateRange)
- `fetchUtilizationData()` is triggered via useEffect (depends on: selectedLabId, selectedShift, selectedMachineId, machines, dateRange)
- `fetchQueryInfo()` is triggered via useEffect

### 3. API Calls Made
- `/api/scheduled-hours?labId=...&shiftName=...&startDate=...&endDate=...`
- `/api/shift-utilization?labId=...&shiftName=...&startDate=...&endDate=...&machineName=...` (if machine selected)
- `/api/shift-utilization/query-info?labId=...&shiftName=...&startDate=...&endDate=...&machineName=...`

### 4. State Updates
- `scheduledHoursData` is updated
- `utilizationData` is updated
- `loadingScheduledHours` and `loadingUtilization` are set to false

### 5. AI Analysis Auto-Trigger (Line 1120)
The useEffect watches for:
- `selectedLabId`
- `selectedShift`
- `dateRange`
- `scheduledHoursData`
- `utilizationData`
- `loadingScheduledHours`
- `loadingUtilization`

**Conditions to trigger:**
- selectedLabId exists
- selectedShift exists
- !loadingScheduledHours
- !loadingUtilization
- scheduledHoursData exists
- utilizationData exists
- !isAnalysisInProgress.current

### 6. Data Collection
When triggered, `fetchAIAnalysis()` calls `getAllPageData()` which collects:
- User info
- Selected lab, machine, shift, date range
- Scheduled hours data
- Utilization data
- Query info

### 7. OpenAI API Call
- POST to `/api/insights/analysis`
- Body: JSON from `getAllPageData()`
- OpenAI analyzes the data and returns markdown analysis

## Issues Found

### Issue 1: Machine Selection Not Tracked in dataKey
**Location:** Line 1132
```typescript
const dataKey = `${selectedLabId}-${selectedShift}-${formatDateForAPI(dateRange.startDate)}-${formatDateForAPI(dateRange.endDate)}-${scheduledHoursData?.scheduledHours}-${utilizationData?.data?.totalScheduledHours}`;
```
**Problem:** `selectedMachineId` is NOT included in the dataKey, so changing machine won't trigger a new analysis.

### Issue 2: getAllPageData Not Memoized
**Location:** Line 703
**Problem:** `getAllPageData` is recreated on every render, causing `fetchAIAnalysis` to be recreated, which might cause the useEffect to trigger unnecessarily or miss updates.

### Issue 3: Missing Dependencies
**Location:** Line 1117
```typescript
}, [selectedLabId, selectedShift, getAllPageData]);
```
**Problem:** `fetchAIAnalysis` doesn't include all dependencies like `dateRange`, `selectedMachineId`, `scheduledHoursData`, `utilizationData`, etc. This means the function might use stale data.

### Issue 4: Race Condition
**Problem:** When selections change, `scheduledHoursData` and `utilizationData` might be set to `null` first, then new data is fetched. The useEffect might not trigger correctly during this transition.

## Fix Required

1. Include `selectedMachineId` in the dataKey
2. Memoize `getAllPageData` with proper dependencies
3. Add all necessary dependencies to `fetchAIAnalysis`
4. Ensure the useEffect properly handles data transitions

