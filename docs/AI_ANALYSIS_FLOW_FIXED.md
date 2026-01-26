# AI Analysis Flow - Fixed Implementation

## Exact Flow When User Changes Selections

### Step 1: User Changes Selection
When user changes:
- **Lab** → `selectedLabId` changes
- **Machine** → `selectedMachineId` changes  
- **Shift** → `selectedShift` changes
- **Date Range** → `dateRange` object changes

### Step 2: Data Fetching Triggers (Automatic)
Three useEffects automatically trigger:

**A. Scheduled Hours Fetch:**
```typescript
useEffect(() => {
  fetchScheduledHours();
}, [fetchScheduledHours]);
```
- `fetchScheduledHours` depends on: `[selectedLabId, selectedShift, dateRange]`
- Makes API call: `/api/scheduled-hours?labId=...&shiftName=...&startDate=...&endDate=...`
- Updates: `scheduledHoursData` and `loadingScheduledHours`

**B. Utilization Data Fetch:**
```typescript
useEffect(() => {
  fetchUtilizationData();
}, [fetchUtilizationData]);
```
- `fetchUtilizationData` depends on: `[selectedLabId, selectedShift, selectedMachineId, machines, dateRange]`
- Makes API call: `/api/shift-utilization?labId=...&shiftName=...&startDate=...&endDate=...&machineName=...` (machineName only if machine selected)
- Updates: `utilizationData` and `loadingUtilization`

**C. Query Info Fetch:**
```typescript
useEffect(() => {
  fetchQueryInfo();
}, [fetchQueryInfo]);
```
- Makes API call: `/api/shift-utilization/query-info?labId=...&shiftName=...&startDate=...&endDate=...&machineName=...`
- Updates: `queryInfo` and `loadingQueryInfo`

### Step 3: AI Analysis Auto-Trigger (Line 1120)
After data is fetched, this useEffect watches for changes:

```typescript
useEffect(() => {
  if (
    selectedLabId &&
    selectedShift &&
    !loadingScheduledHours &&
    !loadingUtilization &&
    scheduledHoursData &&
    utilizationData &&
    !isAnalysisInProgress.current
  ) {
    const dataKey = `${selectedLabId}-${selectedMachineId || 'all'}-${selectedShift}-${formatDateForAPI(dateRange.startDate)}-${formatDateForAPI(dateRange.endDate)}-${scheduledHoursData?.scheduledHours}-${utilizationData?.data?.totalScheduledHours}`;
    
    if (lastAnalysisDataKey.current !== dataKey) {
      lastAnalysisDataKey.current = dataKey;
      fetchAIAnalysis(false); // Auto-trigger
    }
  }
}, [
  selectedLabId,
  selectedShift,
  selectedMachineId,  // ✅ NOW INCLUDED
  dateRange,
  scheduledHoursData,
  utilizationData,
  loadingScheduledHours,
  loadingUtilization,
  fetchAIAnalysis,
]);
```

**What triggers:**
- ✅ Lab change → new `selectedLabId` → triggers
- ✅ Machine change → new `selectedMachineId` → triggers (FIXED)
- ✅ Shift change → new `selectedShift` → triggers
- ✅ Date range change → new `dateRange` → triggers
- ✅ Data loaded → `scheduledHoursData` and `utilizationData` become truthy → triggers

### Step 4: Data Collection
`fetchAIAnalysis()` calls `getAllPageData()` which collects:

```typescript
{
  timestamp: "2024-01-15T10:30:00Z",
  page: "Insights",
  user: { id, name, email },
  selections: {
    lab: { id: "lab123", name: "Lab Name" },
    machine: { id: "machine456", name: "Machine Name", description: "..." },  // ✅ Machine included
    shift: { name: "SHIFT_A", startTime: "08:00", endTime: "16:00" },
    dateRange: { startDate: "2024-01-08", endDate: "2024-01-15", ... }
  },
  scheduledHours: { data: {...}, apiCall: { parameters: {...} } },
  utilization: { data: {...}, apiCall: { parameters: { machineName: "..." } } },  // ✅ Machine name in params
  queryInfo: { data: {...}, apiCall: { parameters: { machineName: "..." } } },
  ...
}
```

### Step 5: OpenAI API Call
- **Endpoint:** `POST /api/insights/analysis`
- **Body:** Complete JSON from `getAllPageData()`
- **Response:** Markdown analysis text
- **Display:** Shows in collapsible "AI Analysis" section

## Fixes Applied

### ✅ Fix 1: Machine Selection Now Tracked
**Before:**
```typescript
const dataKey = `${selectedLabId}-${selectedShift}-${dateRange}...`;
// Missing selectedMachineId!
```

**After:**
```typescript
const dataKey = `${selectedLabId}-${selectedMachineId || 'all'}-${selectedShift}-${dateRange}...`;
// ✅ Machine included
```

### ✅ Fix 2: getAllPageData Memoized
**Before:**
```typescript
const getAllPageData = () => { ... };
// Recreated on every render
```

**After:**
```typescript
const getAllPageData = useCallback(() => { ... }, [
  selectedLabId, selectedMachineId, selectedShift, dateRange,
  labs, machines, labShifts, user,
  scheduledHoursData, utilizationData,
  loadingScheduledHours, loadingUtilization,
  queryInfo, loadingQueryInfo, calculationSteps
]);
// ✅ Only recreates when dependencies change
```

### ✅ Fix 3: Complete Dependencies
**Before:**
```typescript
fetchAIAnalysis dependencies: [selectedLabId, selectedShift, getAllPageData]
// Missing selectedMachineId, dateRange
```

**After:**
```typescript
fetchAIAnalysis dependencies: [selectedLabId, selectedShift, selectedMachineId, dateRange, getAllPageData]
// ✅ All selections included
```

### ✅ Fix 4: useEffect Dependencies Updated
**Before:**
```typescript
useEffect dependencies: [selectedLabId, selectedShift, dateRange, ...]
// Missing selectedMachineId
```

**After:**
```typescript
useEffect dependencies: [selectedLabId, selectedShift, selectedMachineId, dateRange, ...]
// ✅ Machine changes now trigger analysis
```

## Verification

To verify it's working:
1. Open browser console
2. Change lab → Should see: `[AI Insights] Error:` or analysis appears
3. Change machine → Should see new analysis triggered
4. Change shift → Should see new analysis triggered
5. Change date range → Should see new analysis triggered

Check the `dataKey` in console logs - it should include the machine ID when a machine is selected.

