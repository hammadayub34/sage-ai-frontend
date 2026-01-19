const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function testMachineCreation() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    const machinesCollection = db.collection('machines');
    const connectionsCollection = db.collection('connections');
    const nodesCollection = db.collection('nodes');
    
    // Get the most recently created machine
    const latestMachine = await machinesCollection
      .find()
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    if (latestMachine.length === 0) {
      console.log('⚠️  No machines found');
      return;
    }
    
    const machine = latestMachine[0];
    console.log('📦 Latest Machine:');
    console.log(`   ID: ${machine._id}`);
    console.log(`   Name: ${machine.machineName}`);
    console.log(`   Lab ID: ${machine.labId}`);
    console.log(`   Status: ${machine.status}`);
    console.log(`   Created: ${machine.created_at}`);
    console.log(`   Description: ${machine.description || 'N/A'}`);
    console.log(`   Tags: ${machine.tags?.join(', ') || 'N/A'}`);
    console.log(`   nodeId: ${machine.nodeId || 'null'}`);
    
    // Get connections for this machine
    const machineIdStr = machine._id.toString();
    const connections = await connectionsCollection
      .find({ machineId: machineIdStr })
      .toArray();
    
    console.log(`\n📡 Connections for this machine: ${connections.length}`);
    
    if (connections.length > 0) {
      connections.forEach((conn, idx) => {
        console.log(`\n   Connection ${idx + 1}:`);
        console.log(`      ID: ${conn._id}`);
        console.log(`      MAC: ${conn.mac}`);
        console.log(`      Node Type: ${conn.nodeType || 'N/A'}`);
        console.log(`      Sensor Type: ${conn.sensorType || 'N/A'}`);
        console.log(`      Created: ${conn.created_at}`);
      });
      
      // Get the nodes
      const macs = connections.map(c => c.mac);
      const nodes = await nodesCollection
        .find({ mac: { $in: macs } })
        .toArray();
      
      console.log(`\n📦 Associated Nodes: ${nodes.length}`);
      nodes.forEach((node, idx) => {
        console.log(`\n   Node ${idx + 1}:`);
        console.log(`      ID: ${node._id}`);
        console.log(`      MAC: ${node.mac}`);
        console.log(`      Status: ${node.status}`);
        console.log(`      Last Seen: ${node.last_seen || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️  No connections found for this machine');
    }
    
    // Summary
    console.log('\n\n📊 Summary:');
    console.log(`   ✅ Machine created: ${machine.machineName}`);
    console.log(`   ✅ Connections created: ${connections.length}`);
    console.log(`   ✅ Nodes updated: ${connections.length}`);
    
    if (connections.length > 0) {
      const nodeTypes = connections.map(c => c.nodeType).filter(Boolean);
      const sensorTypes = connections.map(c => c.sensorType).filter(Boolean);
      console.log(`   ✅ Node Types: ${[...new Set(nodeTypes)].join(', ')}`);
      console.log(`   ✅ Sensor Types: ${[...new Set(sensorTypes)].join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

testMachineCreation().catch(console.error);

