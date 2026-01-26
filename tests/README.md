# Performance Values Tests

This directory contains tests to ensure that performance values displayed in the Performance section match exactly with the values passed to the AI analysis.

## Problem

Previously, when a shift was selected on the AI Insights page:
- The **Performance section** calculated percentages directly from `shiftUtilization` data
- The **AI analysis** used `maintenanceStats` values which were calculated differently
- This caused a mismatch between what users saw and what the AI analyzed

## Solution

The AI analysis now uses the **exact same calculation logic** as the Performance section:
1. When a shift is selected, calculate percentages from `shiftUtilization` data
2. Apply the same normalization logic to ensure percentages add up to exactly 100%
3. Convert hours to seconds for API consistency
4. Add console logging to verify values match

## Test Files

### `verify-performance-values.js`
A Node.js script that can be run directly to verify the calculation logic:
```bash
node tests/verify-performance-values.js
```

This script tests:
- Basic percentage calculations
- Normalization with rounding
- Shift utilization examples
- Edge cases (100% downtime, 100% uptime)
- API value conversions (hours to seconds)

### `ai-insights-performance-values.test.ts`
TypeScript test file (requires Jest setup) with comprehensive test cases:
- Shift utilization data calculation
- Performance values matching
- Edge cases
- Request body validation

## Running Tests

### Manual Verification
```bash
node tests/verify-performance-values.js
```

### Jest Tests (if Jest is installed)
```bash
npm test tests/ai-insights-performance-values.test.ts
```

## Verification Checklist

When testing in the browser:
1. ✅ Open AI Insights page
2. ✅ Select a lab and shift
3. ✅ Check browser console for logs:
   - `[AI Insights Analysis] Using shift utilization data (matching Performance section)`
   - `[AI Insights Analysis] Final request body values`
4. ✅ Verify that the percentages in the Performance section match the console logs
5. ✅ Verify that the AI analysis uses the same values

## Key Calculation Logic

```typescript
// Calculate percentages (same as Performance section)
const calculatedDowntimePercentage = (downtimeHours / scheduledHours) * 100;
const calculatedUptimePercentage = ((idleHours + productiveHours) / scheduledHours) * 100;

// Normalize to ensure exactly 100%
const totalPercentage = calculatedDowntimePercentage + calculatedUptimePercentage;
const downtimePercentage = calculatedDowntimePercentage;
const uptimePercentage = totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.1
  ? 100 - calculatedDowntimePercentage
  : calculatedUptimePercentage;

// Convert to seconds for API
const totalDowntime = downtimeHours * 3600;
const totalUptime = (idleHours + productiveHours) * 3600;
```

## Expected Behavior

- **When shift is selected**: AI analysis uses `shiftUtilization` data (matching Performance section)
- **When no shift selected**: AI analysis uses `maintenanceStats` data
- **Normalization**: Percentages always add up to exactly 100% (within 0.1% tolerance)
- **Console logs**: Show matching values for verification

