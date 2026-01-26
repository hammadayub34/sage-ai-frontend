# How Performance Values Are Passed to OpenAI API

This document explains exactly how and where performance values are passed to the OpenAI API.

## Overview

There are **two places** where performance values are sent to OpenAI:

1. **Monitoring Page** → `/api/monitoring/analysis` → OpenAI
2. **AI Insights Page** → `/api/ai-insights/wise-analysis` → OpenAI

---

## 1. Monitoring Page Flow

### Step 1: Frontend Calculates Values
**File**: `app/page.tsx`  
**Lines**: 601-683

```typescript
// Calculate performance values from MongoDB data if available, otherwise use InfluxDB data
if (shiftUtilizationData && shiftUtilizationData.totalScheduledHours > 0) {
  // Use MongoDB data - EXACT SAME CALCULATION AS PERFORMANCE SECTION
  const scheduledHoursValue = shiftUtilizationData.totalScheduledHours;
  const downtimeHours = shiftUtilizationData.totalNonProductiveHours;
  const productiveHours = shiftUtilizationData.totalProductiveHours;
  const idleHours = shiftUtilizationData.totalIdleHours;
  
  // Calculate percentages (same as DowntimeStats component)
  const calculatedDowntimePercentage = (downtimeHours / scheduledHoursValue) * 100;
  const calculatedUptimePercentage = ((idleHours + productiveHours) / scheduledHoursValue) * 100;
  
  // Ensure total is exactly 100% (same normalization logic as Performance section)
  const totalPercentage = calculatedDowntimePercentage + calculatedUptimePercentage;
  downtimePercentage = calculatedDowntimePercentage;
  uptimePercentage = totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.1
    ? 100 - calculatedDowntimePercentage
    : calculatedUptimePercentage;
  
  // Convert hours to seconds for API consistency
  totalDowntime = downtimeHours * 3600;
  totalUptime = (idleHours + productiveHours) * 3600;
  scheduledHours = scheduledHoursValue;
}

// Create request body
const requestBody = {
  machineName: machineName,
  machineId: selectedMachineId,
  labName: labName,
  downtimePercentage,      // ← Performance value
  uptimePercentage,        // ← Performance value
  totalDowntime,           // ← Performance value (in seconds)
  totalUptime,             // ← Performance value (in seconds)
  incidentCount,
  scheduledHours,          // ← Performance value (from MongoDB)
  // ... other fields
};

// Send to API
const response = await fetch('/api/monitoring/analysis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
});
```

### Step 2: API Route Receives Values
**File**: `app/api/monitoring/analysis/route.ts`  
**Lines**: 36-38

```typescript
export async function POST(request: NextRequest) {
  try {
    const data: MonitoringAnalysisRequest = await request.json();
    // data.downtimePercentage, data.uptimePercentage, etc.
```

### Step 3: API Formats Values into Prompt
**File**: `app/api/monitoring/analysis/route.ts`  
**Lines**: 131-177

```typescript
const prompt = `You are an industrial operations analyst providing a brief analysis...

Machine Performance Data:
- Machine Name: ${data.machineName}
- Lab/Shopfloor: ${data.labName}
- Time Period Analyzed: ${data.timeRange}

Performance Metrics:
- Downtime: ${data.downtimePercentage.toFixed(2)}% (${downtimeFormatted})  ← HERE
- Uptime: ${data.uptimePercentage.toFixed(2)}% (${uptimeFormatted})        ← HERE
- Downtime Incidents: ${data.incidentCount}
${data.scheduledHours ? `- Scheduled Hours: ${formatScheduledHours(data.scheduledHours)}` : ''}  ← HERE

**Performance Overview**
- Downtime: ${data.downtimePercentage.toFixed(2)}%  ← HERE
- Uptime: ${data.uptimePercentage.toFixed(2)}%      ← HERE
...`;
```

### Step 4: API Sends Prompt to OpenAI
**File**: `app/api/monitoring/analysis/route.ts`  
**Lines**: 184-199

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: 'You are an expert industrial operations analyst...',
    },
    {
      role: 'user',
      content: prompt,  // ← Prompt contains performance values here
    },
  ],
  temperature: 0.7,
  max_tokens: 300,
  stream: true,
});
```

**Key Point**: Performance values are embedded in the `prompt` string, which is sent as the `user` message to OpenAI.

---

## 2. AI Insights Page Flow

### Step 1: Frontend Calculates Values
**File**: `app/ai-insights/page.tsx`  
**Lines**: 1117-1180

```typescript
// Calculate performance values - EXACT SAME LOGIC AS PERFORMANCE SECTION
let downtimePercentage: number;
let uptimePercentage: number;
let totalDowntime: number;
let totalUptime: number;

// If shift is selected and we have shift utilization data, use those values
if (selectedShift && shiftUtilization && shiftUtilization.totalScheduledHours > 0) {
  const scheduledHours = shiftUtilization.totalScheduledHours || 0;
  const downtimeHours = shiftUtilization.totalNonProductiveHours || 0;
  const productiveHours = shiftUtilization.totalProductiveHours || 0;
  const idleHours = shiftUtilization.totalIdleHours || 0;
  
  // Calculate percentages (EXACT SAME as Performance section display)
  const calculatedDowntimePercentage = scheduledHours > 0 
    ? (downtimeHours / scheduledHours) * 100 
    : 0;
  const calculatedUptimePercentage = scheduledHours > 0 
    ? ((idleHours + productiveHours) / scheduledHours) * 100 
    : 0;
  
  // Normalize to ensure exactly 100%
  const totalPercentage = calculatedDowntimePercentage + calculatedUptimePercentage;
  downtimePercentage = calculatedDowntimePercentage;
  uptimePercentage = totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.1
    ? 100 - calculatedDowntimePercentage
    : calculatedUptimePercentage;
  
  // Convert hours to seconds for API consistency
  totalDowntime = downtimeHours * 3600;
  totalUptime = (idleHours + productiveHours) * 3600;
} else {
  // Use maintenanceStats values
  downtimePercentage = maintenanceStats.downtimePercentage;
  uptimePercentage = maintenanceStats.uptimePercentage;
  totalDowntime = maintenanceStats.totalDowntime;
  totalUptime = maintenanceStats.totalUptime;
}

// Create request body
const requestBody: any = {
  labName: currentSelectedLab.name,
  totalMachines: maintenanceStats.totalMachines,
  downtimePercentage,      // ← Performance value
  uptimePercentage,        // ← Performance value
  totalDowntime,           // ← Performance value (in seconds)
  totalUptime,             // ← Performance value (in seconds)
  timePeriod: getDateRangeLabel(dateRange),
  // ... other fields
};

// Send to API
const response = await fetch('/api/ai-insights/wise-analysis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
});
```

### Step 2: API Route Receives Values
**File**: `app/api/ai-insights/wise-analysis/route.ts`  
**Lines**: 33-35

```typescript
export async function POST(request: NextRequest) {
  try {
    const data: WiseAnalysisRequest = await request.json();
    // data.downtimePercentage, data.uptimePercentage, etc.
```

### Step 3: API Formats Values into Prompt
**File**: `app/api/ai-insights/wise-analysis/route.ts`  
**Lines**: 97-127

```typescript
const prompt = `You are an industrial operations analyst providing insights...

Lab Performance Data:
- Lab Name: ${data.labName}
- Total Machines: ${data.totalMachines}
- Time Period Analyzed: ${data.timePeriod}

Performance Metrics:
- Total Downtime: ${data.downtimePercentage.toFixed(2)}% (${downtimeFormatted})  ← HERE
- Total Uptime: ${data.uptimePercentage.toFixed(2)}% (${uptimeFormatted})        ← HERE
...`;
```

### Step 4: API Sends Prompt to OpenAI
**File**: `app/api/ai-insights/wise-analysis/route.ts`  
**Lines**: 134-149

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: 'You are an expert industrial operations analyst...',
    },
    {
      role: 'user',
      content: prompt,  // ← Prompt contains performance values here
    },
  ],
  temperature: 0.7,
  max_tokens: 800,
  stream: true,
});
```

**Key Point**: Performance values are embedded in the `prompt` string, which is sent as the `user` message to OpenAI.

---

## Summary

### How Values Are Passed:
1. **Frontend** calculates performance values (matching Performance section display)
2. **Frontend** sends values in JSON request body to API route
3. **API Route** receives values and formats them into a text prompt string
4. **API Route** sends the prompt string to OpenAI via `openai.chat.completions.create()`
5. **OpenAI** receives the prompt as the `user` message and generates analysis

### Where Values Are Passed:
- **Monitoring Page**: `app/page.tsx` (lines 662-683) → `app/api/monitoring/analysis/route.ts` (lines 143-144, 184-199)
- **AI Insights Page**: `app/ai-insights/page.tsx` (lines 1175-1180) → `app/api/ai-insights/wise-analysis/route.ts` (lines 108-109, 134-149)

### Key Performance Values Passed:
- `downtimePercentage` - Percentage of downtime (0-100)
- `uptimePercentage` - Percentage of uptime (0-100)
- `totalDowntime` - Total downtime in seconds
- `totalUptime` - Total uptime in seconds
- `scheduledHours` - Scheduled hours (Monitoring page only)

### Important Notes:
- Values are **embedded in the prompt string**, not sent as separate parameters
- The prompt is sent as the `user` message in the OpenAI chat completion API
- Values are formatted with `.toFixed(2)` for percentages
- Duration values are formatted as human-readable strings (e.g., "2 hours, 30 minutes")

