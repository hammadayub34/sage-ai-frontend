#!/usr/bin/env node

/**
 * Script to verify scheduled hours calculation vs stored data in MongoDB
 * Compares:
 * 1. Calculated scheduled hours (from shift config) - what our new API returns
 * 2. Stored scheduled hours (from labShiftUtilization collection) - what's actually in DB
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

// Test configuration
const TEST_LAB_ID = '64edc4fb81c07f7f6fbff26b'; // Center For Advanced Research in Engineering
const TEST_SHIFT = 'SHIFT_A';
const TEST_DAYS = 7; // Last 7 days

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
 * Calculate expected scheduled hours from shift config
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

async function verifyScheduledHours() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const labsCollection = db.collection('labs');
    const shiftUtilizationCollection = db.collection('labShiftUtilization');
    const machinesCollection = db.collection('machines');
    
    // Get lab and shift configuration
    const { ObjectId } = await import('mongodb');
    let labObjectId;
    try {
      labObjectId = new ObjectId(TEST_LAB_ID);
    } catch {
      labObjectId = null;
    }
    
    const lab = await labsCollection.findOne({
      $or: [
        { _id: TEST_LAB_ID },
        ...(labObjectId ? [{ _id: labObjectId }] : [])
      ]
    });
    
    if (!lab) {
      console.error('❌ Lab not found');
      return;
    }
    
    console.log(`📋 Lab: ${lab.name}`);
    console.log(`   ID: ${lab._id}\n`);
    
    // Find shift
    if (!lab.shifts || lab.shifts.length === 0) {
      console.error('❌ Lab has no shifts configured');
      return;
    }
    
    const shift = lab.shifts.find(s => s.name === TEST_SHIFT);
    if (!shift) {
      console.error(`❌ Shift "${TEST_SHIFT}" not found in lab`);
      console.log(`   Available shifts: ${lab.shifts.map(s => s.name).join(', ')}`);
      return;
    }
    
    console.log(`⏰ Shift: ${shift.name}`);
    console.log(`   Start Time: ${shift.startTime}`);
    console.log(`   End Time: ${shift.endTime}\n`);
    
    // Calculate date range (Last 7 days)
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (TEST_DAYS - 1));
    startDate.setHours(0, 0, 0, 0);
    
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    console.log(`📅 Date Range: ${startDateStr} to ${endDateStr} (${TEST_DAYS} days)\n`);
    
    // Calculate expected scheduled hours from shift config
    const shiftDuration = calculateShiftDuration(shift.startTime, shift.endTime);
    const numberOfDays = countDays(startDate, endDate);
    const expectedScheduledHours = shiftDuration * numberOfDays;
    
    console.log('🧮 CALCULATED SCHEDULED HOURS (from shift config):');
    console.log('='.repeat(70));
    console.log(`   Shift Duration: ${shiftDuration.toFixed(2)} hours/day`);
    console.log(`   Number of Days: ${numberOfDays} days`);
    console.log(`   Expected Total: ${expectedScheduledHours.toFixed(2)} hours\n`);
    
    // Get machines for this lab
    const machines = await machinesCollection.find({
      $or: [
        { labId: TEST_LAB_ID },
        ...(labObjectId ? [{ labId: labObjectId }] : [])
      ]
    }).toArray();
    
    const machineNames = machines.map(m => m.machineName);
    console.log(`🔧 Machines in Lab: ${machines.length}`);
    console.log(`   Machine Names: ${machineNames.slice(0, 5).join(', ')}${machineNames.length > 5 ? '...' : ''}\n`);
    
    // Get stored scheduled hours from labShiftUtilization collection
    console.log('📊 STORED SCHEDULED HOURS (from labShiftUtilization collection):');
    console.log('='.repeat(70));
    
    const storedData = await shiftUtilizationCollection.find({
      shift_name: TEST_SHIFT,
      machine_name: { $in: machineNames },
      date: {
        $gte: startDateStr,
        $lte: endDateStr
      }
    }).toArray();
    
    console.log(`   Total Records Found: ${storedData.length}`);
    
    if (storedData.length === 0) {
      console.log('   ⚠️  No utilization data found for this date range and shift\n');
      console.log('   This could mean:');
      console.log('   - No data has been collected for this date range yet');
      console.log('   - The shift name in the collection might be different');
      console.log('   - The machine names might not match\n');
      
      // Check what shifts exist in the data
      const availableShifts = await shiftUtilizationCollection.distinct('shift_name', {
        machine_name: { $in: machineNames },
        date: { $gte: startDateStr, $lte: endDateStr }
      });
      console.log(`   Available shifts in data: ${availableShifts.length > 0 ? availableShifts.join(', ') : 'None'}`);
      
      // Check what dates exist
      const availableDates = await shiftUtilizationCollection.distinct('date', {
        machine_name: { $in: machineNames }
      }).then(dates => dates.sort().slice(-10));
      console.log(`   Recent dates in data: ${availableDates.join(', ')}`);
      return;
    }
    
    // Aggregate stored scheduled hours
    const totalStoredScheduledHours = storedData.reduce((sum, doc) => sum + (doc.scheduled_hours || 0), 0);
    const avgStoredScheduledHours = storedData.length > 0 ? totalStoredScheduledHours / storedData.length : 0;
    
    // Group by date
    const byDate = {};
    storedData.forEach(doc => {
      const date = doc.date;
      if (!byDate[date]) {
        byDate[date] = {
          count: 0,
          totalScheduledHours: 0,
          machines: new Set()
        };
      }
      byDate[date].count++;
      byDate[date].totalScheduledHours += doc.scheduled_hours || 0;
      byDate[date].machines.add(doc.machine_name);
    });
    
    console.log(`   Total Stored Scheduled Hours: ${totalStoredScheduledHours.toFixed(2)} hours`);
    console.log(`   Average per Record: ${avgStoredScheduledHours.toFixed(2)} hours`);
    console.log(`   Unique Dates: ${Object.keys(byDate).length}`);
    console.log(`   Unique Machines: ${new Set(storedData.map(d => d.machine_name)).size}\n`);
    
    // Show breakdown by date
    console.log('   Breakdown by Date:');
    const sortedDates = Object.keys(byDate).sort();
    sortedDates.forEach(date => {
      const dayData = byDate[date];
      const expectedForDay = shiftDuration; // Per day
      const actualForDay = dayData.totalScheduledHours;
      const diff = Math.abs(actualForDay - expectedForDay);
      const match = diff < 0.1 ? '✅' : '⚠️';
      
      console.log(`     ${date}: ${actualForDay.toFixed(2)}h (${dayData.machines.size} machines, ${dayData.count} records) ${match}`);
      if (diff >= 0.1) {
        console.log(`       Expected: ${expectedForDay.toFixed(2)}h, Difference: ${diff.toFixed(2)}h`);
      }
    });
    
    // Calculate expected total for all machines
    const expectedTotalForAllMachines = expectedScheduledHours * machines.length;
    
    console.log('\n📈 COMPARISON:');
    console.log('='.repeat(70));
    console.log(`   Calculated (per machine): ${expectedScheduledHours.toFixed(2)} hours`);
    console.log(`   Calculated (all ${machines.length} machines): ${expectedTotalForAllMachines.toFixed(2)} hours`);
    console.log(`   Stored (sum of all records): ${totalStoredScheduledHours.toFixed(2)} hours`);
    
    const difference = Math.abs(totalStoredScheduledHours - expectedTotalForAllMachines);
    const percentageDiff = expectedTotalForAllMachines > 0 
      ? (difference / expectedTotalForAllMachines) * 100 
      : 0;
    
    console.log(`   Difference: ${difference.toFixed(2)} hours (${percentageDiff.toFixed(2)}%)`);
    
    if (difference < 1) {
      console.log(`   ✅ MATCH! Data is consistent.\n`);
    } else if (difference < expectedTotalForAllMachines * 0.1) {
      console.log(`   ⚠️  Close match (within 10%). Small differences might be due to rounding or partial days.\n`);
    } else {
      console.log(`   ❌ MISMATCH! There's a significant difference.\n`);
      console.log('   Possible reasons:');
      console.log('   - Scheduled hours in DB were calculated differently');
      console.log('   - Some machines might have different shift configurations');
      console.log('   - Data might be missing for some dates/machines');
      console.log('   - Shift times might have changed since data was collected\n');
    }
    
    // Show per-machine breakdown
    console.log('🔍 PER-MACHINE BREAKDOWN (first 10 machines):');
    console.log('='.repeat(70));
    const byMachine = {};
    storedData.forEach(doc => {
      const machine = doc.machine_name;
      if (!byMachine[machine]) {
        byMachine[machine] = {
          totalScheduledHours: 0,
          records: 0,
          dates: new Set()
        };
      }
      byMachine[machine].totalScheduledHours += doc.scheduled_hours || 0;
      byMachine[machine].records++;
      byMachine[machine].dates.add(doc.date);
    });
    
    const sortedMachines = Object.entries(byMachine)
      .sort((a, b) => b[1].totalScheduledHours - a[1].totalScheduledHours)
      .slice(0, 10);
    
    sortedMachines.forEach(([machine, data]) => {
      const expectedForMachine = expectedScheduledHours;
      const actualForMachine = data.totalScheduledHours;
      const diff = Math.abs(actualForMachine - expectedForMachine);
      const match = diff < 1 ? '✅' : '⚠️';
      
      console.log(`   ${machine}:`);
      console.log(`     Expected: ${expectedForMachine.toFixed(2)}h`);
      console.log(`     Actual: ${actualForMachine.toFixed(2)}h (${data.records} records, ${data.dates.size} dates)`);
      console.log(`     Difference: ${diff.toFixed(2)}h ${match}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
    console.log('\n\n✅ Connection closed');
  }
}

verifyScheduledHours().catch(console.error);

