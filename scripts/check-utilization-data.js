#!/usr/bin/env node

/**
 * Script to check what data is stored in the labShiftUtilization collection in MongoDB
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

async function checkUtilizationData() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const collection = db.collection('labShiftUtilization');
    
    // Get total count
    const totalCount = await collection.countDocuments();
    console.log(`📊 Total documents in labShiftUtilization: ${totalCount}\n`);
    
    if (totalCount === 0) {
      console.log('⚠️  No utilization data found in the collection.');
      return;
    }
    
    // Get sample documents
    console.log('📄 Sample Documents (first 10):');
    console.log('='.repeat(80));
    const samples = await collection.find({}).limit(10).toArray();
    samples.forEach((doc, idx) => {
      console.log(`\n${idx + 1}. Document:`);
      console.log(JSON.stringify(doc, null, 2));
    });
    
    // Get unique values for key fields
    console.log('\n\n📋 Collection Statistics:');
    console.log('='.repeat(80));
    
    // Unique machine names
    const uniqueMachines = await collection.distinct('machine_name');
    console.log(`\n🔧 Unique Machines: ${uniqueMachines.length}`);
    if (uniqueMachines.length > 0) {
      console.log(`   Machines: ${uniqueMachines.slice(0, 10).join(', ')}${uniqueMachines.length > 10 ? '...' : ''}`);
    }
    
    // Unique shift names
    const uniqueShifts = await collection.distinct('shift_name');
    console.log(`\n⏰ Unique Shifts: ${uniqueShifts.length}`);
    if (uniqueShifts.length > 0) {
      console.log(`   Shifts: ${uniqueShifts.join(', ')}`);
    }
    
    // Date range
    const dates = await collection.distinct('date');
    dates.sort();
    console.log(`\n📅 Date Range:`);
    if (dates.length > 0) {
      console.log(`   First Date: ${dates[0]}`);
      console.log(`   Last Date: ${dates[dates.length - 1]}`);
      console.log(`   Total Unique Dates: ${dates.length}`);
    }
    
    // Field structure analysis
    console.log(`\n📐 Document Structure:`);
    const sampleDoc = samples[0];
    if (sampleDoc) {
      console.log(`   Fields: ${Object.keys(sampleDoc).join(', ')}`);
      console.log(`\n   Field Types:`);
      Object.keys(sampleDoc).forEach(key => {
        const value = sampleDoc[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        console.log(`     - ${key}: ${type}${value !== null && value !== undefined ? ` (example: ${JSON.stringify(value).substring(0, 50)}${JSON.stringify(value).length > 50 ? '...' : ''})` : ''}`);
      });
    }
    
    // Aggregate statistics
    console.log(`\n📈 Aggregate Statistics:`);
    console.log('='.repeat(80));
    
    const stats = await collection.aggregate([
      {
        $group: {
          _id: null,
          totalUtilization: { $sum: '$utilization' },
          totalProductiveHours: { $sum: '$productive_hours' },
          totalIdleHours: { $sum: '$idle_hours' },
          totalNonProductiveHours: { $sum: '$non_productive_hours' },
          totalScheduledHours: { $sum: '$scheduled_hours' },
          totalNodeOffHours: { $sum: '$node_off_hours' },
          count: { $sum: 1 },
          avgUtilization: { $avg: '$utilization' },
          avgProductiveHours: { $avg: '$productive_hours' },
          avgIdleHours: { $avg: '$idle_hours' },
          avgNonProductiveHours: { $avg: '$non_productive_hours' },
          avgScheduledHours: { $avg: '$scheduled_hours' },
        }
      }
    ]).toArray();
    
    if (stats.length > 0) {
      const s = stats[0];
      console.log(`\n   Total Records: ${s.count}`);
      console.log(`   Average Utilization: ${s.avgUtilization?.toFixed(2) || 0}%`);
      console.log(`   Total Scheduled Hours: ${s.totalScheduledHours?.toFixed(2) || 0}`);
      console.log(`   Average Scheduled Hours per Record: ${s.avgScheduledHours?.toFixed(2) || 0}`);
      console.log(`   Total Productive Hours: ${s.totalProductiveHours?.toFixed(2) || 0}`);
      console.log(`   Total Idle Hours: ${s.totalIdleHours?.toFixed(2) || 0}`);
      console.log(`   Total Non-Productive Hours: ${s.totalNonProductiveHours?.toFixed(2) || 0}`);
      console.log(`   Total Node Off Hours: ${s.totalNodeOffHours?.toFixed(2) || 0}`);
    }
    
    // Group by shift
    console.log(`\n\n📊 Data by Shift:`);
    console.log('='.repeat(80));
    const shiftStats = await collection.aggregate([
      {
        $group: {
          _id: '$shift_name',
          count: { $sum: 1 },
          totalScheduledHours: { $sum: '$scheduled_hours' },
          avgUtilization: { $avg: '$utilization' },
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    shiftStats.forEach(stat => {
      console.log(`\n   Shift: ${stat._id || '(null)'}`);
      console.log(`     Records: ${stat.count}`);
      console.log(`     Total Scheduled Hours: ${stat.totalScheduledHours?.toFixed(2) || 0}`);
      console.log(`     Average Utilization: ${stat.avgUtilization?.toFixed(2) || 0}%`);
    });
    
    // Group by machine
    console.log(`\n\n📊 Data by Machine (top 10):`);
    console.log('='.repeat(80));
    const machineStats = await collection.aggregate([
      {
        $group: {
          _id: '$machine_name',
          count: { $sum: 1 },
          totalScheduledHours: { $sum: '$scheduled_hours' },
          avgUtilization: { $avg: '$utilization' },
        }
      },
      { $sort: { totalScheduledHours: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    machineStats.forEach(stat => {
      console.log(`\n   Machine: ${stat._id || '(null)'}`);
      console.log(`     Records: ${stat.count}`);
      console.log(`     Total Scheduled Hours: ${stat.totalScheduledHours?.toFixed(2) || 0}`);
      console.log(`     Average Utilization: ${stat.avgUtilization?.toFixed(2) || 0}%`);
    });
    
    // Recent data
    console.log(`\n\n📅 Recent Data (last 5 records by date):`);
    console.log('='.repeat(80));
    const recentData = await collection.find({})
      .sort({ date: -1 })
      .limit(5)
      .toArray();
    
    recentData.forEach((doc, idx) => {
      console.log(`\n${idx + 1}. ${doc.date || 'No date'} - ${doc.machine_name || 'No machine'} - ${doc.shift_name || 'No shift'}`);
      console.log(`   Utilization: ${doc.utilization || 0}%`);
      console.log(`   Scheduled Hours: ${doc.scheduled_hours || 0}`);
      console.log(`   Productive: ${doc.productive_hours || 0}h, Idle: ${doc.idle_hours || 0}h, Non-Productive: ${doc.non_productive_hours || 0}h`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
    console.log('\n\n✅ Connection closed');
  }
}

checkUtilizationData().catch(console.error);

