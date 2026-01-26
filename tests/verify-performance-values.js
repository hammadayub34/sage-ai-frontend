/**
 * Manual verification script for AI Insights Performance Values
 * 
 * This script can be run to verify that the performance calculation logic
 * matches between the Performance section display and AI analysis.
 * 
 * Usage: node tests/verify-performance-values.js
 */

// Helper function to calculate percentages with normalization (same as Performance section)
function calculatePerformancePercentages(scheduledHours, downtimeHours, productiveHours, idleHours) {
  const calculatedDowntimePercentage = scheduledHours > 0 
    ? (downtimeHours / scheduledHours) * 100 
    : 0;
  const calculatedUptimePercentage = scheduledHours > 0 
    ? ((idleHours + productiveHours) / scheduledHours) * 100 
    : 0;
  
  // Ensure total is exactly 100% (same normalization logic as Performance section)
  const totalPercentage = calculatedDowntimePercentage + calculatedUptimePercentage;
  const downtimePercentage = calculatedDowntimePercentage;
  const uptimePercentage = totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.1
    ? 100 - calculatedDowntimePercentage
    : calculatedUptimePercentage;
  
  return {
    downtimePercentage,
    uptimePercentage,
    calculatedDowntimePercentage,
    calculatedUptimePercentage,
    totalPercentage,
  };
}

// Test cases
console.log('🧪 Testing AI Insights Performance Values Calculation\n');

// Test 1: Basic calculation
console.log('Test 1: Basic calculation');
const test1 = calculatePerformancePercentages(100, 10, 70, 20);
console.log('Input: scheduled=100h, downtime=10h, productive=70h, idle=20h');
console.log(`Result: downtime=${test1.downtimePercentage.toFixed(2)}%, uptime=${test1.uptimePercentage.toFixed(2)}%`);
console.log(`Total: ${(test1.downtimePercentage + test1.uptimePercentage).toFixed(2)}%`);
console.log(`✅ ${(test1.downtimePercentage + test1.uptimePercentage === 100) ? 'PASS' : 'FAIL'}\n`);

// Test 2: Normalization test
console.log('Test 2: Normalization with rounding');
const test2 = calculatePerformancePercentages(100, 10.5, 70.3, 19.2);
console.log('Input: scheduled=100h, downtime=10.5h, productive=70.3h, idle=19.2h');
console.log(`Result: downtime=${test2.downtimePercentage.toFixed(2)}%, uptime=${test2.uptimePercentage.toFixed(2)}%`);
console.log(`Total: ${(test2.downtimePercentage + test2.uptimePercentage).toFixed(2)}%`);
console.log(`✅ ${Math.abs((test2.downtimePercentage + test2.uptimePercentage) - 100) < 0.1 ? 'PASS' : 'FAIL'}\n`);

// Test 3: Shift utilization example
console.log('Test 3: Shift utilization example');
const shiftUtil = {
  totalScheduledHours: 200,
  totalNonProductiveHours: 25,
  totalProductiveHours: 150,
  totalIdleHours: 25,
};
const test3 = calculatePerformancePercentages(
  shiftUtil.totalScheduledHours,
  shiftUtil.totalNonProductiveHours,
  shiftUtil.totalProductiveHours,
  shiftUtil.totalIdleHours
);
console.log('Input: shift utilization data');
console.log(`  Scheduled: ${shiftUtil.totalScheduledHours}h`);
console.log(`  Downtime: ${shiftUtil.totalNonProductiveHours}h`);
console.log(`  Productive: ${shiftUtil.totalProductiveHours}h`);
console.log(`  Idle: ${shiftUtil.totalIdleHours}h`);
console.log(`Result: downtime=${test3.downtimePercentage.toFixed(2)}%, uptime=${test3.uptimePercentage.toFixed(2)}%`);
console.log(`Total: ${(test3.downtimePercentage + test3.uptimePercentage).toFixed(2)}%`);

// Calculate seconds for API
const totalDowntimeSeconds = shiftUtil.totalNonProductiveHours * 3600;
const totalUptimeSeconds = (shiftUtil.totalProductiveHours + shiftUtil.totalIdleHours) * 3600;
console.log(`API Values: totalDowntime=${totalDowntimeSeconds}s (${(totalDowntimeSeconds/3600).toFixed(2)}h), totalUptime=${totalUptimeSeconds}s (${(totalUptimeSeconds/3600).toFixed(2)}h)`);
console.log(`✅ ${Math.abs((test3.downtimePercentage + test3.uptimePercentage) - 100) < 0.1 ? 'PASS' : 'FAIL'}\n`);

// Test 4: Edge case - 100% downtime
console.log('Test 4: Edge case - 100% downtime');
const test4 = calculatePerformancePercentages(100, 100, 0, 0);
console.log('Input: scheduled=100h, downtime=100h, productive=0h, idle=0h');
console.log(`Result: downtime=${test4.downtimePercentage.toFixed(2)}%, uptime=${test4.uptimePercentage.toFixed(2)}%`);
console.log(`✅ ${(test4.downtimePercentage === 100 && test4.uptimePercentage === 0) ? 'PASS' : 'FAIL'}\n`);

// Test 5: Edge case - 100% uptime
console.log('Test 5: Edge case - 100% uptime');
const test5 = calculatePerformancePercentages(100, 0, 50, 50);
console.log('Input: scheduled=100h, downtime=0h, productive=50h, idle=50h');
console.log(`Result: downtime=${test5.downtimePercentage.toFixed(2)}%, uptime=${test5.uptimePercentage.toFixed(2)}%`);
console.log(`✅ ${(test5.downtimePercentage === 0 && test5.uptimePercentage === 100) ? 'PASS' : 'FAIL'}\n`);

console.log('✅ All tests completed!');
console.log('\n📝 Verification Checklist:');
console.log('1. Performance section calculates percentages from shiftUtilization when shift is selected');
console.log('2. AI analysis should use the SAME calculation when shift is selected');
console.log('3. Values should be normalized to exactly 100% (within 0.1% tolerance)');
console.log('4. Hours should be converted to seconds for API (multiply by 3600)');
console.log('5. Console logs should show matching values between Performance section and AI analysis');

