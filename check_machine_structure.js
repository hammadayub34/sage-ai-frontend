const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkMachineStructure() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    const machinesCollection = db.collection('machines');
    
    // Get a few sample machines to see all possible fields
    console.log('📦 Checking machine structure...');
    const sampleMachines = await machinesCollection.find({}).limit(5).toArray();
    
    console.log('\n📄 Sample machines with all fields:');
    sampleMachines.forEach((machine, idx) => {
      console.log(`\n   Machine ${idx + 1}: ${machine.machineName}`);
      console.log(`   Fields: ${Object.keys(machine).join(', ')}`);
      console.log(`   Full data:`, JSON.stringify(machine, null, 2));
    });
    
    // Check if there are any machines with node-related fields
    const machineWithNode = await machinesCollection.findOne({
      $or: [
        { nodeId: { $ne: null } },
        { nodeType: { $exists: true } },
        { sensorType: { $exists: true } },
        { sensor: { $exists: true } }
      ]
    });
    
    if (machineWithNode) {
      console.log('\n✅ Machine with node/sensor info:');
      console.log(JSON.stringify(machineWithNode, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkMachineStructure().catch(console.error);

