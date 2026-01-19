const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkExistingMachineWithNode() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    const machinesCollection = db.collection('machines');
    const connectionsCollection = db.collection('connections');
    const nodesCollection = db.collection('nodes');
    
    // Find a machine that has a nodeId
    const machineWithNode = await machinesCollection.findOne({ 
      nodeId: { $ne: null } 
    });
    
    if (machineWithNode) {
      console.log('📦 Machine with nodeId:');
      console.log(JSON.stringify(machineWithNode, null, 2));
      
      // Check if there are connections for this machine
      const connections = await connectionsCollection.find({ 
        machineId: machineWithNode._id.toString() 
      }).limit(3).toArray();
      
      console.log(`\n📡 Connections for this machine: ${connections.length}`);
      if (connections.length > 0) {
        console.log('Sample connection:');
        console.log(JSON.stringify(connections[0], null, 2));
      }
      
      // Check the node
      if (machineWithNode.nodeId) {
        const node = await nodesCollection.findOne({ 
          _id: machineWithNode.nodeId 
        });
        if (node) {
          console.log('\n📦 Associated node:');
          console.log('Node status:', node.status);
          console.log('Node MAC:', node.mac);
        }
      }
    }
    
    // Check if connections have nodeType or sensorType fields
    const connectionWithType = await connectionsCollection.findOne({
      $or: [
        { nodeType: { $exists: true } },
        { sensorType: { $exists: true } }
      ]
    });
    
    if (connectionWithType) {
      console.log('\n✅ Found connection with nodeType/sensorType:');
      console.log(JSON.stringify(connectionWithType, null, 2));
    } else {
      console.log('\n⚠️  No connections found with nodeType/sensorType fields');
      console.log('   We will need to add these fields when creating connections');
    }
    
    // Check if machines have nodeType or sensorType
    const machineWithType = await machinesCollection.findOne({
      $or: [
        { nodeType: { $exists: true } },
        { sensorType: { $exists: true } }
      ]
    });
    
    if (machineWithType) {
      console.log('\n✅ Found machine with nodeType/sensorType:');
      console.log(JSON.stringify(machineWithType, null, 2));
    } else {
      console.log('\n⚠️  No machines found with nodeType/sensorType fields');
      console.log('   We will NOT add these to machines collection');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkExistingMachineWithNode().catch(console.error);

