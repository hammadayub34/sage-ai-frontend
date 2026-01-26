const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkNodesRelationship() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    
    // Check machines collection structure
    console.log('📦 Checking machines collection...');
    const machinesCollection = db.collection('machines');
    
    // Get sample machines with nodeId
    const machinesWithNodes = await machinesCollection.find({ 
      nodeId: { $ne: null } 
    }).limit(5).toArray();
    
    const machinesWithoutNodes = await machinesCollection.find({ 
      nodeId: null 
    }).limit(5).toArray();
    
    console.log(`\n   Machines with nodeId: ${await machinesCollection.countDocuments({ nodeId: { $ne: null } })}`);
    console.log(`   Machines without nodeId: ${await machinesCollection.countDocuments({ nodeId: null })}`);
    
    if (machinesWithNodes.length > 0) {
      console.log('\n📄 Sample machines WITH nodeId:');
      machinesWithNodes.forEach((machine, idx) => {
        console.log(`\n   ${idx + 1}. ${machine.machineName}`);
        console.log(`      Machine ID: ${machine._id}`);
        console.log(`      Node ID: ${machine.nodeId}`);
        console.log(`      Status: ${machine.status}`);
      });
    }
    
    if (machinesWithoutNodes.length > 0) {
      console.log('\n📄 Sample machines WITHOUT nodeId:');
      machinesWithoutNodes.forEach((machine, idx) => {
        console.log(`\n   ${idx + 1}. ${machine.machineName}`);
        console.log(`      Machine ID: ${machine._id}`);
        console.log(`      Node ID: ${machine.nodeId} (null)`);
        console.log(`      Status: ${machine.status}`);
      });
    }
    
    // Check nodes collection
    console.log('\n\n📦 Checking nodes collection...');
    const nodesCollection = db.collection('nodes');
    const nodeCount = await nodesCollection.countDocuments();
    console.log(`   Total nodes: ${nodeCount}`);
    
    if (nodeCount > 0) {
      // Get sample nodes
      const sampleNodes = await nodesCollection.find({}).limit(5).toArray();
      console.log('\n📄 Sample nodes:');
      sampleNodes.forEach((node, idx) => {
        console.log(`\n   ${idx + 1}. Node ID: ${node._id}`);
        console.log(`      Node data:`, JSON.stringify(node, null, 2));
      });
      
      // Check if nodes have machineId field
      const nodeWithMachineId = await nodesCollection.findOne({ machineId: { $exists: true } });
      if (nodeWithMachineId) {
        console.log('\n✅ Nodes have machineId field!');
        console.log('   Sample node with machineId:');
        console.log(JSON.stringify(nodeWithMachineId, null, 2));
        
        // Count how many nodes per machine
        const nodesByMachine = await nodesCollection.aggregate([
          { $match: { machineId: { $exists: true } } },
          { $group: { _id: '$machineId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]).toArray();
        
        console.log('\n📊 Machines with multiple nodes:');
        nodesByMachine.forEach(item => {
          console.log(`   Machine ID: ${item._id} -> ${item.count} node(s)`);
        });
      } else {
        // Check if nodes reference machines differently
        const nodeFields = await nodesCollection.findOne({});
        if (nodeFields) {
          console.log('\n📋 Node fields:', Object.keys(nodeFields));
        }
      }
    }
    
    // Check if there's a relationship collection or array
    console.log('\n\n🔍 Checking for machine-node relationships...');
    
    // Check if machines have nodes array
    const machineWithNodesArray = await machinesCollection.findOne({ 
      nodes: { $exists: true } 
    });
    if (machineWithNodesArray) {
      console.log('✅ Found machine with nodes array:');
      console.log(JSON.stringify(machineWithNodesArray, null, 2));
    }
    
    // Check connections collection
    const connectionsCollection = db.collection('connections');
    const connectionCount = await connectionsCollection.countDocuments();
    if (connectionCount > 0) {
      console.log(`\n📦 Connections collection: ${connectionCount} documents`);
      const sampleConnection = await connectionsCollection.findOne({});
      if (sampleConnection) {
        console.log('   Sample connection:');
        console.log(JSON.stringify(sampleConnection, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

checkNodesRelationship().catch(console.error);

