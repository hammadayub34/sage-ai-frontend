/**
 * Check which machines have vibration data and match with MongoDB
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

async function checkMachines() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    const machinesCollection = db.collection('machines');
    
    // Get machines with vibration data from InfluxDB API
    const response = await fetch('http://localhost:3005/api/influxdb/machines-with-vibration');
    const influxData = await response.json();
    
    if (!influxData.success) {
      console.log('❌ Error fetching InfluxDB machines:', influxData.error);
      return;
    }
    
    const influxMachines = influxData.machines || [];
    const influxMachineIds = new Set(influxMachines.map(m => m.machineId));
    
    console.log('📊 Machines with Vibration Data in InfluxDB:\n');
    console.log(`Found ${influxMachines.length} machine(s) with data:\n`);
    
    // Get all machines from MongoDB
    const mongoMachines = await machinesCollection.find({}).toArray();
    
    // Match InfluxDB machine IDs with MongoDB machines
    const matchedMachines = [];
    const unmatchedInfluxIds = [];
    
    for (const influxMachine of influxMachines) {
      const machineId = influxMachine.machineId;
      
      // Try to find matching MongoDB machine
      // Check if machineId matches MongoDB _id (as string or ObjectId)
      const mongoMachine = mongoMachines.find(m => 
        m._id.toString() === machineId || 
        m._id.toString().toLowerCase() === machineId.toLowerCase()
      );
      
      if (mongoMachine) {
        matchedMachines.push({
          influxId: machineId,
          mongoId: mongoMachine._id.toString(),
          machineName: mongoMachine.machineName,
          labId: mongoMachine.labId?.toString() || 'N/A',
          status: mongoMachine.status,
          lastDataTime: influxMachine.latestDataTime || 'N/A'
        });
      } else {
        unmatchedInfluxIds.push({
          machineId: machineId,
          lastDataTime: influxMachine.latestDataTime || 'N/A'
        });
      }
    }
    
    // Display matched machines
    if (matchedMachines.length > 0) {
      console.log('✅ Machines in MongoDB with Vibration Data:\n');
      matchedMachines.forEach((m, i) => {
        console.log(`${i + 1}. ${m.machineName}`);
        console.log(`   Machine ID: ${m.mongoId}`);
        console.log(`   Lab ID: ${m.labId}`);
        console.log(`   Status: ${m.status}`);
        console.log(`   Last Data: ${m.lastDataTime}`);
        console.log();
      });
    }
    
    // Display unmatched InfluxDB IDs
    if (unmatchedInfluxIds.length > 0) {
      console.log('⚠️  InfluxDB Machine IDs not found in MongoDB:\n');
      unmatchedInfluxIds.forEach((m, i) => {
        console.log(`${i + 1}. Machine ID: ${m.machineId}`);
        console.log(`   Last Data: ${m.lastDataTime}`);
        console.log();
      });
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 To view vibration data:');
    console.log('   1. Go to AI Insights page');
    console.log('   2. Select the shopfloor/lab that contains one of the machines above');
    console.log('   3. Select the machine from the Equipment dropdown');
    console.log('   4. Click the "Vibration" tab to see the time series graph');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkMachines();

