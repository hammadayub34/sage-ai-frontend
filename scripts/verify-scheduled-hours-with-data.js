#!/usr/bin/env node

/**
 * Script to verify scheduled hours with actual data from MongoDB
 * Tests with a date range that has data
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

// Test with a date range that has data (December 2025)
const TEST_LAB_ID = '64edc4fb81c07f7f6fbff26b';
const TEST_SHIFT = 'SHIFT_A';
const TEST_START_DATE = '2025-12-01';
const TEST_END_DATE = '2025-12-07'; // 7 days

function parseTimeToHours(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + (minutes / 60);
}

function calculateShiftDuration(startTime, endTime) {
  const startHours = parseTimeToHours(startTime);
  const endHours = parseTimeToHours(endTime);
  
  if (endHours < startHours) {
    return (24 - startHours) + endHours;
  } else {
    return endHours - startHours;
  }
}

function countDays(startDate, endDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

async function verifyWithData() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const labsCollection = db.collection('labs');
    const shiftUtilizationCollection = db.collection('labShiftUtilization');
    const machinesCollection = db.collection('machines');
    const { ObjectId } = await import('mongodb');
    
    // Get lab
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
    
    if (!lab || !lab.shifts) {
      console.error('❌ Lab or shifts not found');
      return;
    }
    
    const shift = lab.shifts.find(s => s.name === TEST_SHIFT);
    if (!shift) {
      console.error(`❌ Shift "${TEST_SHIFT}" not found`);
      return;
    }
    
    console.log(`📋 Lab: ${lab.name}`);
    console.log(`⏰ Shift: ${shift.name} (${shift.startTime} - ${shift.endTime})`);
    console.log(`📅 Date Range: ${TEST_START_DATE} to ${TEST_END_DATE}\n`);
    
    // Calculate expected
    const shiftDuration = calculateShiftDuration(shift.startTime, shift.endTime);
    const numberOfDays = countDays(TEST_START_DATE, TEST_END_DATE);
    const expectedPerMachine = shiftDuration * numberOfDays;
    
    console.log('🧮 CALCULATED (from shift config):');
    console.log(`   Shift Duration: ${shiftDuration.toFixed(2)} hours/day`);
    console.log(`   Days: ${numberOfDays}`);
    console.log(`   Expected per machine: ${expectedPerMachine.toFixed(2)} hours\n`);
    
    // Get machines
    const machines = await machinesCollection.find({
      $or: [
        { labId: TEST_LAB_ID },
        ...(labObjectId ? [{ labId: labObjectId }] : [])
      ]
    }).toArray();
    
    const machineNames = machines.map(m => m.machineName);
    console.log(`🔧 Machines: ${machines.length}\n`);
    
    // Get stored data
    const storedData = await shiftUtilizationCollection.find({
      shift_name: TEST_SHIFT,
      machine_name: { $in: machineNames },
      date: {
        $gte: TEST_START_DATE,
        $lte: TEST_END_DATE
      }
    }).toArray();
    
    console.log(`📊 STORED DATA:`);
    console.log(`   Records found: ${storedData.length}`);
    
    if (storedData.length === 0) {
      console.log('   ⚠️  No data for this range. Checking what dates are available...\n');
      
      // Find available dates
      const availableDates = await shiftUtilizationCollection.distinct('date', {
        machine_name: { $in: machineNames },
        shift_name: TEST_SHIFT
      });
      
      availableDates.sort();
      console.log(`   Available dates: ${availableDates.length}`);
      if (availableDates.length > 0) {
        console.log(`   First: ${availableDates[0]}`);
        console.log(`   Last: ${availableDates[availableDates.length - 1]}`);
        console.log(`   Sample: ${availableDates.slice(-10).join(', ')}`);
      }
      return;
    }
    
    // Aggregate
    const totalStored = storedData.reduce((sum, d) => sum + (d.scheduled_hours || 0), 0);
    const byDate = {};
    const byMachine = {};
    
    storedData.forEach(doc => {
      // By date
      if (!byDate[doc.date]) {
        byDate[doc.date] = { total: 0, count: 0, machines: new Set() };
      }
      byDate[doc.date].total += doc.scheduled_hours || 0;
      byDate[doc.date].count++;
      byDate[doc.date].machines.add(doc.machine_name);
      
      // By machine
      if (!byMachine[doc.machine_name]) {
        byMachine[doc.machine_name] = { total: 0, count: 0, dates: new Set() };
      }
      byMachine[doc.machine_name].total += doc.scheduled_hours || 0;
      byMachine[doc.machine_name].count++;
      byMachine[doc.machine_name].dates.add(doc.date);
    });
    
    console.log(`   Total scheduled hours: ${totalStored.toFixed(2)}`);
    console.log(`   Unique dates: ${Object.keys(byDate).length}`);
    console.log(`   Unique machines: ${Object.keys(byMachine).length}\n`);
    
    // Expected total (all machines)
    const expectedTotal = expectedPerMachine * machines.length;
    
    console.log('📈 COMPARISON:');
    console.log(`   Expected (${machines.length} machines × ${expectedPerMachine.toFixed(2)}h): ${expectedTotal.toFixed(2)}h`);
    console.log(`   Stored (sum of all records): ${totalStored.toFixed(2)}h`);
    
    const diff = Math.abs(totalStored - expectedTotal);
    const pctDiff = expectedTotal > 0 ? (diff / expectedTotal) * 100 : 0;
    
    console.log(`   Difference: ${diff.toFixed(2)}h (${pctDiff.toFixed(2)}%)\n`);
    
    // Per-date breakdown
    console.log('📅 PER-DATE BREAKDOWN:');
    const sortedDates = Object.keys(byDate).sort();
    sortedDates.forEach(date => {
      const dayData = byDate[date];
      const expectedPerDay = shiftDuration * dayData.machines.size;
      const actual = dayData.total;
      const diff = Math.abs(actual - expectedPerDay);
      const match = diff < 0.5 ? '✅' : '⚠️';
      
      console.log(`   ${date}: ${actual.toFixed(2)}h (${dayData.machines.size} machines) ${match}`);
      if (diff >= 0.5) {
        console.log(`     Expected: ${expectedPerDay.toFixed(2)}h, Diff: ${diff.toFixed(2)}h`);
      }
    });
    
    // Per-machine breakdown (top 5)
    console.log('\n🔧 PER-MACHINE BREAKDOWN (top 5):');
    const sortedMachines = Object.entries(byMachine)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    
    sortedMachines.forEach(([machine, data]) => {
      const expected = expectedPerMachine;
      const actual = data.total;
      const diff = Math.abs(actual - expected);
      const match = diff < 1 ? '✅' : '⚠️';
      
      console.log(`   ${machine}:`);
      console.log(`     Expected: ${expected.toFixed(2)}h, Actual: ${actual.toFixed(2)}h (${data.dates.size} dates) ${match}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

verifyWithData().catch(console.error);

