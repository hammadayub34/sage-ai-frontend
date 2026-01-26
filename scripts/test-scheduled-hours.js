#!/usr/bin/env node

/**
 * Test script for /api/scheduled-hours endpoint
 * Tests various day ranges and verifies calculations
 */

const BASE_URL = 'http://localhost:3005';

// Test lab with known shifts
const TEST_LAB_ID = '64edc4fb81c07f7f6fbff26b'; // Center For Advanced Research in Engineering
const TEST_SHIFT = 'SHIFT_A'; // 00:01 to 11:59

/**
 * Parse time string (HH:MM) to decimal hours
 */
function parseTimeToHours(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + (minutes / 60);
}

/**
 * Calculate shift duration in hours
 */
function calculateShiftDuration(startTime, endTime) {
  const startHours = parseTimeToHours(startTime);
  const endHours = parseTimeToHours(endTime);
  
  if (endHours < startHours) {
    // Midnight crossover: (24 - startTime) + endTime
    return (24 - startHours) + endHours;
  } else {
    // Normal case: endTime - startTime
    return endHours - startHours;
  }
}

/**
 * Count days in date range (inclusive)
 */
function countDays(startDate, endDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // +1 to include both start and end dates
}

/**
 * Calculate expected scheduled hours
 */
function calculateExpectedScheduledHours(startTime, endTime, startDate, endDate) {
  const shiftDuration = calculateShiftDuration(startTime, endTime);
  const numberOfDays = countDays(startDate, endDate);
  return shiftDuration * numberOfDays;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Run a single test case
 */
async function runTest(testName, startDate, endDate, expectedShiftDuration, expectedDays) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 Test: ${testName}`);
  console.log(`${'='.repeat(70)}`);
  
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);
  
  console.log(`📅 Date Range: ${startDateStr} to ${endDateStr}`);
  console.log(`⏰ Shift: ${TEST_SHIFT} (00:01 to 11:59)`);
  
  // Calculate expected values
  const expectedScheduledHours = calculateExpectedScheduledHours(
    '00:01',
    '11:59',
    startDate,
    endDate
  );
  
  console.log(`\n🧮 Expected Calculation:`);
  console.log(`   Shift Duration: ${expectedShiftDuration.toFixed(2)} hours/day`);
  console.log(`   Number of Days: ${expectedDays} days`);
  console.log(`   Expected Scheduled Hours: ${expectedShiftDuration.toFixed(2)} × ${expectedDays} = ${expectedScheduledHours.toFixed(2)} hours`);
  
  // Make API call
  const url = `${BASE_URL}/api/scheduled-hours?labId=${TEST_LAB_ID}&shiftName=${TEST_SHIFT}&startDate=${startDateStr}&endDate=${endDateStr}`;
  console.log(`\n🌐 API Call: ${url}`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      const actualScheduledHours = data.scheduledHours;
      const actualShiftDuration = data.shiftInfo.shiftDuration;
      const actualDays = data.shiftInfo.numberOfDays;
      
      console.log(`\n✅ API Response:`);
      console.log(`   Shift Duration: ${actualShiftDuration} hours/day`);
      console.log(`   Number of Days: ${actualDays} days`);
      console.log(`   Scheduled Hours: ${actualScheduledHours} hours`);
      
      // Verify results
      const durationMatch = Math.abs(actualShiftDuration - expectedShiftDuration) < 0.01;
      const daysMatch = actualDays === expectedDays;
      const hoursMatch = Math.abs(actualScheduledHours - expectedScheduledHours) < 0.01;
      
      console.log(`\n🔍 Verification:`);
      console.log(`   Shift Duration: ${durationMatch ? '✅ CORRECT' : '❌ MISMATCH'} (Expected: ${expectedShiftDuration.toFixed(2)}, Got: ${actualShiftDuration})`);
      console.log(`   Number of Days: ${daysMatch ? '✅ CORRECT' : '❌ MISMATCH'} (Expected: ${expectedDays}, Got: ${actualDays})`);
      console.log(`   Scheduled Hours: ${hoursMatch ? '✅ CORRECT' : '❌ MISMATCH'} (Expected: ${expectedScheduledHours.toFixed(2)}, Got: ${actualScheduledHours})`);
      
      if (durationMatch && daysMatch && hoursMatch) {
        console.log(`\n✅ TEST PASSED`);
        return true;
      } else {
        console.log(`\n❌ TEST FAILED`);
        return false;
      }
    } else {
      console.log(`\n❌ API Error: ${data.error}`);
      return false;
    }
  } catch (error) {
    console.log(`\n❌ Request Error: ${error.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 SCHEDULED HOURS API TEST SUITE`);
  console.log(`${'='.repeat(70)}`);
  console.log(`\n📊 Testing shift: ${TEST_SHIFT} (00:01 to 11:59)`);
  console.log(`   Shift Duration Calculation:`);
  console.log(`   - Start: 00:01 = 0.0167 hours (1 minute)`);
  console.log(`   - End: 11:59 = 11.9833 hours (11 hours 59 minutes)`);
  console.log(`   - Duration: 11.9833 - 0.0167 = 11.9666 hours ≈ 11.97 hours/day`);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const results = [];
  
  // Test 1: 2 days
  const test1Start = new Date(today);
  test1Start.setDate(today.getDate() - 1);
  const test1End = new Date(today);
  const result1 = await runTest('2 Days (Yesterday to Today)', test1Start, test1End, 11.97, 2);
  results.push({ name: '2 Days', passed: result1 });
  
  // Test 2: 7 days
  const test2Start = new Date(today);
  test2Start.setDate(today.getDate() - 6);
  const test2End = new Date(today);
  const result2 = await runTest('7 Days (Last 7 Days)', test2Start, test2End, 11.97, 7);
  results.push({ name: '7 Days', passed: result2 });
  
  // Test 3: 14 days
  const test3Start = new Date(today);
  test3Start.setDate(today.getDate() - 13);
  const test3End = new Date(today);
  const result3 = await runTest('14 Days (Last 14 Days)', test3Start, test3End, 11.97, 14);
  results.push({ name: '14 Days', passed: result3 });
  
  // Test 4: 30 days
  const test4Start = new Date(today);
  test4Start.setDate(today.getDate() - 29);
  const test4End = new Date(today);
  const result4 = await runTest('30 Days (Last 30 Days)', test4Start, test4End, 11.97, 30);
  results.push({ name: '30 Days', passed: result4 });
  
  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 TEST SUMMARY`);
  console.log(`${'='.repeat(70)}`);
  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${index + 1}. ${result.name}: ${status}`);
  });
  
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  console.log(`\n📈 Results: ${passedCount}/${results.length} tests passed`);
  
  if (allPassed) {
    console.log(`\n🎉 ALL TESTS PASSED!`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  SOME TESTS FAILED`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});

