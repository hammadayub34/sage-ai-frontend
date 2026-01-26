# API Calls on Scheduled Hours Page

## Summary
The Scheduled Hours page makes **6 different API calls** to various endpoints.

## API Calls Breakdown

### 1. **Fetch User Labs** (`/api/labs/user`)
- **When**: On initial page load (once)
- **Trigger**: `useEffect` when user is logged in
- **Purpose**: Get list of labs for the logged-in user
- **Method**: `fetchUserLabs(userId)`
- **Frequency**: Once per page load

### 2. **Fetch Machines** (`/api/machines`)
- **When**: When a lab is selected
- **Trigger**: `handleLabChange` → `fetchMachinesForLab(labId)`
- **Purpose**: Get list of machines for the selected lab
- **Method**: `fetchMachinesForLab(labId)`
- **Frequency**: Once per lab selection

### 3. **Fetch Lab with Shifts** (`/api/labs`)
- **When**: When a lab is selected
- **Trigger**: `handleLabChange` → `fetchLabWithShifts(labId)`
- **Purpose**: Get lab details including shift configurations
- **Method**: `fetchLabWithShifts(labId)`
- **Frequency**: Once per lab selection

### 4. **Fetch Scheduled Hours** (`/api/scheduled-hours`)
- **When**: When lab, shift, or date range changes
- **Trigger**: `useEffect` with dependencies: `[selectedLabId, selectedShift, dateRange]`
- **Purpose**: Calculate scheduled hours based on shift config and date range
- **Method**: `fetchScheduledHours()`
- **Frequency**: Every time lab, shift, or date range changes

### 5. **Fetch Query Info** (`/api/shift-utilization/query-info`)
- **When**: When lab, shift, machine, or date range changes
- **Trigger**: `useEffect` with dependencies: `[selectedLabId, selectedShift, selectedMachineId, machines, dateRange]`
- **Purpose**: Get MongoDB query information and last seen date
- **Method**: `fetchQueryInfo()`
- **Frequency**: Every time lab, shift, machine, or date range changes

### 6. **Fetch Utilization Data** (`/api/shift-utilization`)
- **When**: When lab, shift, machine, or date range changes
- **Trigger**: `useEffect` with dependencies: `[selectedLabId, selectedShift, selectedMachineId, machines, dateRange]`
- **Purpose**: Get actual utilization data from MongoDB
- **Method**: `fetchUtilizationData()`
- **Frequency**: Every time lab, shift, machine, or date range changes

## Total API Calls on Page Load

When the page first loads with a lab selected:
1. `/api/labs/user` - Get user labs (1 call)
2. `/api/machines` - Get machines for selected lab (1 call)
3. `/api/labs` - Get lab with shifts (1 call)
4. `/api/scheduled-hours` - Calculate scheduled hours (1 call)
5. `/api/shift-utilization/query-info` - Get query info (1 call)
6. `/api/shift-utilization` - Get utilization data (1 call)

**Total: 6 API calls on initial load**

## API Calls on User Interaction

When user changes:
- **Lab**: 3 calls (machines, lab with shifts, scheduled hours, query info, utilization data)
- **Shift**: 3 calls (scheduled hours, query info, utilization data)
- **Machine**: 2 calls (query info, utilization data)
- **Date Range**: 3 calls (scheduled hours, query info, utilization data)

## Optimization Opportunities

1. **Combine API calls**: Could combine `/api/shift-utilization/query-info` and `/api/shift-utilization` into a single endpoint
2. **Debounce**: Could debounce date range changes to reduce API calls
3. **Caching**: Could cache lab and machine data to reduce redundant calls
4. **Parallel calls**: Some calls could be made in parallel (e.g., scheduled hours, query info, and utilization data)

