#!/usr/bin/env node

/**
 * Check if there's utilization data for Nissin 1 machine in Agriauto Industries Limited lab
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

async function checkNissin1Data() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const labsCollection = db.collection('labs');
    const machinesCollection = db.collection('machines');
    const shiftUtilizationCollection = db.collection('labShiftUtilization');
    
    // Find Agriauto Industries Limited lab
    const agriautoLab = await labsCollection.findOne({
      name: { $regex: /agriauto/i }
    });
    
    if (!agriautoLab) {
      console.log('❌ Agriauto Industries Limited lab not found');
      return;
    }
    
    console.log(`📋 Lab Found: ${agriautoLab.name}`);
    console.log(`   ID: ${agriautoLab._id}\n`);
    
    // Find Nissin 1 machine
    const { ObjectId } = await import('mongodb');
    let labObjectId;
    try {
      labObjectId = new ObjectId(agriautoLab._id);
    } catch {
      labObjectId = null;
    }
    
    const nissin1Machine = await machinesCollection.findOne({
      labId: { $in: [agriautoLab._id.toString(), agriautoLab._id, ...(labObjectId ? [labObjectId] : [])] },
      machineName: { $regex: /nissin\s*1/i }
    });
    
    if (!nissin1Machine) {
      console.log('❌ Nissin 1 machine not found in Agriauto lab');
      
      // Show all machines in this lab
      const allMachines = await machinesCollection.find({
        labId: { $in: [agriautoLab._id.toString(), agriautoLab._id, ...(labObjectId ? [labObjectId] : [])] }
      }).toArray();
      
      console.log(`\n📋 Machines in Agriauto lab (${allMachines.length}):`);
      allMachines.forEach((m, idx) => {
        console.log(`   ${idx + 1}. ${m.machineName} (ID: ${m._id})`);
      });
      return;
    }
    
    console.log(`🔧 Machine Found: ${nissin1Machine.machineName}`);
    console.log(`   ID: ${nissin1Machine._id}\n`);
    
    // Check for utilization data
    const utilizationData = await shiftUtilizationCollection.find({
      machine_name: nissin1Machine.machineName
    }).toArray();
    
    console.log(`📊 Utilization Data for "${nissin1Machine.machineName}":`);
    console.log(`   Total Records: ${utilizationData.length}\n`);
    
    if (utilizationData.length === 0) {
      console.log('❌ NO utilization data found for Nissin 1\n');
      
      // Check what machines have data
      const allMachinesWithData = await shiftUtilizationCollection.distinct('machine_name');
      console.log(`📋 Machines that DO have utilization data (${allMachinesWithData.length}):`);
      const nissinMachines = allMachinesWithData.filter(name => /nissin/i.test(name));
      if (nissinMachines.length > 0) {
        console.log(`   Nissin machines with data: ${nissinMachines.join(', ')}`);
      } else {
        console.log(`   No Nissin machines found in utilization data`);
      }
      console.log(`   Sample machines: ${allMachinesWithData.slice(0, 10).join(', ')}${allMachinesWithData.length > 10 ? '...' : ''}`);
    } else {
      console.log('✅ Utilization data found!\n');
      
      // Show date range
      const dates = utilizationData.map(d => d.date).sort();
      console.log(`📅 Date Range:`);
      console.log(`   First Date: ${dates[0]}`);
      console.log(`   Last Date: ${dates[dates.length - 1]}`);
      console.log(`   Total Unique Dates: ${new Set(dates).size}\n`);
      
      // Show by shift
      const byShift = {};
      utilizationData.forEach(doc => {
        const shift = doc.shift_name || 'Unknown';
        if (!byShift[shift]) {
          byShift[shift] = { count: 0, totalScheduledHours: 0 };
        }
        byShift[shift].count++;
        byShift[shift].totalScheduledHours += doc.scheduled_hours || 0;
      });
      
      console.log(`⏰ Data by Shift:`);
      Object.entries(byShift).forEach(([shift, data]) => {
        console.log(`   ${shift}: ${data.count} records, ${data.totalScheduledHours.toFixed(2)}h total scheduled`);
      });
      
      // Show recent records
      console.log(`\n📄 Recent Records (last 5):`);
      const recent = utilizationData
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      
      recent.forEach((doc, idx) => {
        console.log(`\n   ${idx + 1}. Date: ${doc.date}, Shift: ${doc.shift_name || 'N/A'}`);
        console.log(`      Scheduled: ${doc.scheduled_hours || 0}h`);
        console.log(`      Utilization: ${doc.utilization || 0}%`);
        console.log(`      Productive: ${doc.productive_hours || 0}h, Idle: ${doc.idle_hours || 0}h`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
    console.log('\n\n✅ Connection closed');
  }
}

checkNissin1Data().catch(console.error);

