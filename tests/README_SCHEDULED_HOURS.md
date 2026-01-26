# Scheduled Hours Utilization Tests

## Overview

Test cases for the Scheduled Hours page utilization data functionality.

## Test Files

### 1. `scheduled-hours-utilization.test.ts`
Unit tests for:
- API call parameter validation
- Data structure validation
- Date range calculations
- Comparison logic (calculated vs stored)
- Error handling
- Data aggregation
- Edge cases

### 2. `scheduled-hours-utilization-integration.test.js`
Integration tests that connect to MongoDB:
- MongoDB query validation
- Data aggregation tests
- Document structure validation
- Date format validation

## Running Tests

### Unit Tests (TypeScript)
```bash
# If using Jest
npm test scheduled-hours-utilization.test.ts

# If using Vitest
npm run test scheduled-hours-utilization
```

### Integration Tests (JavaScript)
```bash
# Requires MongoDB connection
node tests/scheduled-hours-utilization-integration.test.js

# Or with Jest
npm test scheduled-hours-utilization-integration
```

## Test Coverage

### API Call Tests
- ✅ Correct parameter encoding
- ✅ Special character handling
- ✅ Missing parameter handling

### Data Structure Tests
- ✅ Response structure validation
- ✅ Data type validation
- ✅ Required fields presence

### Date Range Tests
- ✅ Last 7 days calculation
- ✅ Date formatting for API
- ✅ Inclusive date range handling

### Comparison Logic Tests
- ✅ Calculated vs stored hours matching
- ✅ Difference detection
- ✅ Total hours calculation for all machines

### Error Handling Tests
- ✅ Missing labId handling
- ✅ Missing shiftName handling
- ✅ API error response handling

### Data Aggregation Tests
- ✅ Scheduled hours summation
- ✅ Average utilization calculation
- ✅ Machine-wise grouping

### Edge Cases
- ✅ Empty data handling
- ✅ Future date ranges
- ✅ No data scenarios

## Expected Behavior

### Successful API Call
```typescript
// Request
GET /api/shift-utilization?labId=xxx&shiftName=SHIFT_A&startDate=2026-01-16&endDate=2026-01-22

// Response
{
  success: true,
  data: {
    shiftName: "SHIFT_A",
    totalMachines: 24,
    machinesWithData: 20,
    averageUtilization: 15.26,
    totalScheduledHours: 287.16,
    totalProductiveHours: 120.5,
    totalIdleHours: 45.2,
    totalNonProductiveHours: 121.46,
    machineUtilizations: [...]
  }
}
```

### Comparison Logic
- **Calculated Scheduled Hours**: From shift configuration (shiftDuration × numberOfDays)
- **Stored Scheduled Hours**: Sum from MongoDB `labShiftUtilization` collection
- **Expected Match**: Should match if all machines have data for all days
- **Expected Difference**: May differ if:
  - Not all machines have data
  - Different shift times when data was collected
  - Missing records for some dates

## Notes

- Integration tests require MongoDB connection
- Set `MONGODB_URI` environment variable if different from default
- Tests use real data from MongoDB, so results may vary
- Date ranges in tests use past dates that have data

