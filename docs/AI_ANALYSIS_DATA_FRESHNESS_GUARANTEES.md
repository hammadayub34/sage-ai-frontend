# AI Analysis Data Freshness Guarantees

## Problem Statement

When user changes selections (lab, machine, shift, date range), multiple API calls are triggered. We need to **GUARANTEE** that the AI analysis always uses the latest data that matches the current selections, not stale data from previous selections.

## Potential Issues

1. **Race Conditions**: API calls complete at different times. If user changes selection while calls are in progress, old responses might be used.
2. **Stale Data**: API responses from previous selections might still be in state when new selections are made.
3. **Missing Validation**: No verification that API responses actually match current selections.
4. **Duplicate Prevention**: Need to prevent triggering analysis multiple times for the same data.

## Solution: Multi-Layer Safeguards

### Layer 1: Generation Tracking (Prevents Race Conditions)

Use a `generation` ref that increments whenever selections change. Each API response is tagged with the generation it was requested for. Only use responses that match the current generation.

```typescript
const dataGeneration = useRef(0); // Tracks which "generation" of data we're on

// When selections change, increment generation
useEffect(() => {
  dataGeneration.current += 1;
  console.log(`[Data Generation] Incremented to ${dataGeneration.current} due to selection change`);
}, [selectedLabId, selectedShift, selectedMachineId, dateRange]);

// Store generation with each API response
const fetchUtilizationData = useCallback(async () => {
  const currentGeneration = dataGeneration.current;
  // ... make API call ...
  const data = await response.json();
  
  // Only update state if this is still the current generation
  if (currentGeneration === dataGeneration.current) {
    setUtilizationData(data);
  } else {
    console.warn(`[Data Generation] Discarding stale utilization data (generation ${currentGeneration} vs current ${dataGeneration.current})`);
  }
}, [...]);
```

### Layer 2: Selection-Response Validation (Prevents Stale Data)

Before using API responses, verify they match current selections:

```typescript
const validateDataFreshness = useCallback(() => {
  // Check scheduled hours matches current shift
  const scheduledShift = scheduledHoursData?.data?.shiftInfo?.shiftName;
  if (scheduledShift && scheduledShift !== selectedShift) {
    console.warn('[Data Validation] Scheduled hours shift mismatch:', scheduledShift, 'vs', selectedShift);
    return false;
  }
  
  // Check utilization matches current shift
  const utilizationShift = utilizationData?.data?.shiftName;
  if (utilizationShift && utilizationShift !== selectedShift) {
    console.warn('[Data Validation] Utilization shift mismatch:', utilizationShift, 'vs', selectedShift);
    return false;
  }
  
  // Check query info matches current selections
  const queryShift = queryInfo?.parameters?.shiftName;
  const queryLabId = queryInfo?.parameters?.labId;
  if (queryShift && queryShift !== selectedShift) {
    console.warn('[Data Validation] Query info shift mismatch:', queryShift, 'vs', selectedShift);
    return false;
  }
  if (queryLabId && queryLabId !== selectedLabId) {
    console.warn('[Data Validation] Query info lab mismatch:', queryLabId, 'vs', selectedLabId);
    return false;
  }
  
  // Check date ranges match
  const queryStartDate = queryInfo?.parameters?.startDate;
  const queryEndDate = queryInfo?.parameters?.endDate;
  const currentStartDate = formatDateForAPI(dateRange.startDate);
  const currentEndDate = formatDateForAPI(dateRange.endDate);
  if (queryStartDate && queryStartDate !== currentStartDate) {
    console.warn('[Data Validation] Query start date mismatch:', queryStartDate, 'vs', currentStartDate);
    return false;
  }
  if (queryEndDate && queryEndDate !== currentEndDate) {
    console.warn('[Data Validation] Query end date mismatch:', queryEndDate, 'vs', currentEndDate);
    return false;
  }
  
  return true;
}, [selectedLabId, selectedShift, dateRange, scheduledHoursData, utilizationData, queryInfo]);
```

### Layer 3: Data Fingerprint (Prevents Duplicate Calls)

Create a unique fingerprint that includes both selections AND actual API response data:

```typescript
const generateDataFingerprint = useCallback(() => {
  // Include selections
  const selectionsKey = `${selectedLabId}-${selectedMachineId || 'all'}-${selectedShift}-${formatDateForAPI(dateRange.startDate)}-${formatDateForAPI(dateRange.endDate)}`;
  
  // Include actual API response data (not just selections)
  // This ensures if same selections return different data, we trigger new analysis
  const scheduledHours = scheduledHoursData?.scheduledHours || 0;
  const utilization = utilizationData?.data?.averageUtilization || 0;
  const machineCount = utilizationData?.data?.machinesWithData || 0;
  
  const dataKey = `${selectionsKey}-${scheduledHours}-${utilization}-${machineCount}`;
  
  return dataKey;
}, [selectedLabId, selectedMachineId, selectedShift, dateRange, scheduledHoursData, utilizationData]);
```

### Layer 4: Complete Dependency Tracking

Ensure all dependencies are tracked in useCallback and useEffect:

```typescript
const collectAllAPIData = useCallback(() => {
  // ... collect data ...
}, [
  selectedLabId, 
  selectedMachineId, 
  selectedShift, 
  dateRange,
  labs, 
  machines, 
  labShifts,
  scheduledHoursData, 
  queryInfo, 
  utilizationData,
  loadingScheduledHours, 
  loadingQueryInfo, 
  loadingUtilization
]);

const fetchAIAnalysis = useCallback(async () => {
  // ... fetch analysis ...
}, [
  selectedLabId,
  selectedShift,
  selectedMachineId,
  dateRange,
  loadingScheduledHours,
  loadingQueryInfo,
  loadingUtilization,
  scheduledHoursData,
  queryInfo,
  utilizationData,
  collectAllAPIData,
  validateDataFreshness
]);
```

### Layer 5: Auto-Trigger with All Safeguards

```typescript
const lastAnalysisFingerprint = useRef<string>('');
const isAnalysisInProgress = useRef(false);

useEffect(() => {
  // Don't trigger if analysis is already in progress
  if (isAnalysisInProgress.current) {
    return;
  }
  
  // Don't trigger if any API is still loading
  if (loadingScheduledHours || loadingQueryInfo || loadingUtilization) {
    return;
  }
  
  // Don't trigger if required data is missing
  if (
    !selectedLabId ||
    !selectedShift ||
    !scheduledHoursData?.success ||
    !queryInfo?.success ||
    !utilizationData?.success
  ) {
    return;
  }
  
  // CRITICAL: Validate data freshness before proceeding
  if (!validateDataFreshness()) {
    console.warn('[AI Analysis] Data validation failed - waiting for fresh data');
    return;
  }
  
  // Generate fingerprint for current data state
  const currentFingerprint = generateDataFingerprint();
  
  // Only trigger if fingerprint changed (new data)
  if (currentFingerprint === lastAnalysisFingerprint.current) {
    console.log('[AI Analysis] Fingerprint unchanged, skipping duplicate analysis');
    return;
  }
  
  console.log('[AI Analysis] Triggering analysis with fresh data:', {
    previousFingerprint: lastAnalysisFingerprint.current,
    currentFingerprint,
    lab: selectedLabId,
    machine: selectedMachineId || 'all',
    shift: selectedShift,
    dateRange: `${formatDateForAPI(dateRange.startDate)} to ${formatDateForAPI(dateRange.endDate)}`
  });
  
  lastAnalysisFingerprint.current = currentFingerprint;
  fetchAIAnalysis();
}, [
  selectedLabId,
  selectedShift,
  selectedMachineId,
  dateRange,
  loadingScheduledHours,
  loadingQueryInfo,
  loadingUtilization,
  scheduledHoursData,
  queryInfo,
  utilizationData,
  validateDataFreshness,
  generateDataFingerprint,
  fetchAIAnalysis
]);
```

## Flow Diagram

```
User Changes Selection
    ↓
Generation Incremented (Layer 1)
    ↓
API Calls Triggered (with generation tracking)
    ↓
API Responses Received
    ↓
Generation Check (Layer 1): Is response generation == current generation?
    ├─ NO → Discard response (stale)
    └─ YES → Update state
    ↓
All APIs Complete
    ↓
Validation Check (Layer 2): Do responses match current selections?
    ├─ NO → Wait for fresh data
    └─ YES → Continue
    ↓
Fingerprint Check (Layer 3): Is fingerprint different from last analysis?
    ├─ NO → Skip (duplicate)
    └─ YES → Continue
    ↓
Trigger AI Analysis
    ↓
collectAllAPIData() called (uses latest state)
    ↓
Send to OpenAI
```

## Benefits

1. **Race Condition Prevention**: Generation tracking ensures old responses are discarded
2. **Stale Data Prevention**: Validation ensures responses match current selections
3. **Duplicate Prevention**: Fingerprint ensures we don't analyze the same data twice
4. **Complete Dependency Tracking**: All dependencies are tracked, ensuring callbacks use latest data
5. **Transparency**: Console logs show exactly what's happening at each step

## Testing Checklist

- [ ] Change lab → Analysis triggers with new lab data
- [ ] Change machine → Analysis triggers with new machine data
- [ ] Change shift → Analysis triggers with new shift data
- [ ] Change date range → Analysis triggers with new date data
- [ ] Rapidly change selections → Only latest data is used (old responses discarded)
- [ ] Same selections, different data → New analysis triggered (fingerprint includes data)
- [ ] Same selections, same data → No duplicate analysis (fingerprint prevents)

