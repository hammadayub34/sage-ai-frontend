# Scheduled Hours Calculation Logic

## Overview

The `/api/scheduled-hours` endpoint calculates the total scheduled hours for a shift within a given date range based on the shift's start and end times.

## Calculation Formula

```
Scheduled Hours = Shift Duration (hours/day) × Number of Days
```

## Step-by-Step Calculation

### Step 1: Parse Shift Times

Shift times are stored in `HH:MM` format (e.g., "00:01", "11:59", "22:00", "06:00").

**Example**: Shift "SHIFT_A" with `startTime: "00:01"` and `endTime: "11:59"`

```javascript
// Parse to decimal hours
startTime = "00:01" → 0 hours + (1/60) hours = 0.0167 hours
endTime = "11:59" → 11 hours + (59/60) hours = 11.9833 hours
```

### Step 2: Calculate Shift Duration

There are two cases:

#### Case A: Normal Shift (endTime ≥ startTime)

```
Shift Duration = endTime - startTime
```

**Example**: 08:00 to 16:00
```
Shift Duration = 16.0 - 8.0 = 8.0 hours/day
```

**Example**: 00:01 to 11:59
```
Shift Duration = 11.9833 - 0.0167 = 11.9666 hours/day ≈ 11.97 hours/day
```

#### Case B: Midnight Crossover (endTime < startTime)

When the shift spans midnight (e.g., 22:00 to 06:00):

```
Shift Duration = (24 - startTime) + endTime
```

**Example**: 22:00 to 06:00
```
Shift Duration = (24 - 22.0) + 6.0 = 2.0 + 6.0 = 8.0 hours/day
```

**Example**: 16:20 to 00:35
```
startTime = 16.333 hours (16 hours 20 minutes)
endTime = 0.583 hours (35 minutes)
Shift Duration = (24 - 16.333) + 0.583 = 7.667 + 0.583 = 8.25 hours/day
```

### Step 3: Count Days in Date Range

The date range is **inclusive** of both start and end dates.

```javascript
startDate = new Date("2026-01-01")  // Set to 00:00:00
endDate = new Date("2026-01-04")    // Set to 23:59:59

diffTime = endDate.getTime() - startDate.getTime()
diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
numberOfDays = diffDays + 1  // +1 to include both start and end dates
```

**Examples**:
- Jan 1 to Jan 1 = 1 day (same day)
- Jan 1 to Jan 4 = 4 days (Jan 1, 2, 3, 4)
- Jan 1 to Jan 7 = 7 days (Jan 1, 2, 3, 4, 5, 6, 7)
- Jan 1 to Jan 14 = 14 days
- Jan 1 to Jan 30 = 30 days

### Step 4: Calculate Total Scheduled Hours

```
Scheduled Hours = Shift Duration × Number of Days
```

## Test Cases & Results

### Test Case 1: 2 Days
- **Shift**: SHIFT_A (00:01 to 11:59)
- **Date Range**: Yesterday to Today (2 days)
- **Calculation**: 11.97 hours/day × 2 days = **23.93 hours** ✅

### Test Case 2: 7 Days
- **Shift**: SHIFT_A (00:01 to 11:59)
- **Date Range**: Last 7 Days
- **Calculation**: 11.97 hours/day × 7 days = **83.77 hours** ✅

### Test Case 3: 14 Days
- **Shift**: SHIFT_A (00:01 to 11:59)
- **Date Range**: Last 14 Days
- **Calculation**: 11.97 hours/day × 14 days = **167.53 hours** ✅

### Test Case 4: 30 Days
- **Shift**: SHIFT_A (00:01 to 11:59)
- **Date Range**: Last 30 Days
- **Calculation**: 11.97 hours/day × 30 days = **359.00 hours** ✅

## Detailed Example: 7 Days Calculation

**Input**:
- Lab ID: `64edc4fb81c07f7f6fbff26b`
- Shift: `SHIFT_A`
- Start Date: `2026-01-16`
- End Date: `2026-01-22`

**Step 1: Parse Shift Times**
```
startTime = "00:01" → 0.0167 hours
endTime = "11:59" → 11.9833 hours
```

**Step 2: Calculate Shift Duration**
```
Since 11.9833 > 0.0167 (normal shift, no midnight crossover):
Shift Duration = 11.9833 - 0.0167 = 11.9666 hours ≈ 11.97 hours/day
```

**Step 3: Count Days**
```
Start: 2026-01-16 00:00:00
End:   2026-01-22 23:59:59
Days: Jan 16, 17, 18, 19, 20, 21, 22 = 7 days
```

**Step 4: Calculate Total**
```
Scheduled Hours = 11.97 × 7 = 83.77 hours
```

**API Response**:
```json
{
  "success": true,
  "scheduledHours": 83.77,
  "shiftInfo": {
    "shiftName": "SHIFT_A",
    "startTime": "00:01",
    "endTime": "11:59",
    "shiftDuration": 11.97,
    "numberOfDays": 7
  }
}
```

## Midnight Crossover Example

**Input**:
- Shift: `SHIFT_B` (16:20 to 00:35)
- Date Range: 7 days

**Step 1: Parse Shift Times**
```
startTime = "16:20" → 16.333 hours
endTime = "00:35" → 0.583 hours
```

**Step 2: Calculate Shift Duration**
```
Since 0.583 < 16.333 (midnight crossover):
Shift Duration = (24 - 16.333) + 0.583 = 7.667 + 0.583 = 8.25 hours/day
```

**Step 3: Count Days**
```
7 days
```

**Step 4: Calculate Total**
```
Scheduled Hours = 8.25 × 7 = 57.75 hours
```

## Verification

All calculations are verified using the test suite in `scripts/test-scheduled-hours.js`:

- ✅ 2 Days: Correct
- ✅ 7 Days: Correct
- ✅ 14 Days: Correct
- ✅ 30 Days: Correct
- ✅ Midnight Crossover: Correct
- ✅ Error Handling: Correct

## Key Points

1. **Date Range is Inclusive**: Both start and end dates are counted
2. **Midnight Crossover Handled**: Shifts that span midnight are calculated correctly
3. **Precision**: Times are stored as decimal hours (e.g., 11.97 hours = 11 hours 58.2 minutes)
4. **Rounding**: Final result is rounded to 2 decimal places for display

