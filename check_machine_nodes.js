const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkMachineNodes() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    
    // Check connections collection - this seems to link machines to nodes via MAC
    const connectionsCollection = db.collection('connections');
    const nodesCollection = db.collection('nodes');
    const machinesCollection = db.collection('machines');
    
    // Get a sample machine
    const sampleMachine = await machinesCollection.findOne({ nodeId: { $ne: null } });
    if (sampleMachine) {
      console.log(`📦 Sample Machine: ${sampleMachine.machineName}`);
      console.log(`   Machine ID: ${sampleMachine._id}`);
      console.log(`   Node ID (from machine): ${sampleMachine.nodeId}\n`);
      
      // Find all connections for this machine
      const machineConnections = await connectionsCollection.find({ 
        machineId: sampleMachine._id.toString() 
      }).toArray();
      
      console.log(`   Connections for this machine: ${machineConnections.length}`);
      if (machineConnections.length > 0) {
        console.log('   Connection MACs:');
        machineConnections.forEach((conn, idx) => {
          console.log(`     ${idx + 1}. MAC: ${conn.mac}`);
        });
        
        // Try to find nodes by MAC
        const macs = machineConnections.map(c => c.mac);
        const nodes = await nodesCollection.find({ mac: { $in: macs } }).toArray();
        console.log(`\n   Nodes found by MAC: ${nodes.length}`);
        nodes.forEach((node, idx) => {
          console.log(`     ${idx + 1}. Node ID: ${node._id}, MAC: ${node.mac}, Status: ${node.status}`);
        });
      }
    }
    
    // Check if any machine has multiple connections
    console.log('\n\n📊 Checking machines with multiple connections...');
    const machinesWithMultipleConnections = await connectionsCollection.aggregate([
      { $group: { _id: '$machineId', count: { $sum: 1 }, macs: { $push: '$mac' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    console.log(`   Found ${machinesWithMultipleConnections.length} machines with multiple connections\n`);
    
    for (const item of machinesWithMultipleConnections.slice(0, 5)) {
      const machine = await machinesCollection.findOne({ _id: item._id });
      if (machine) {
        console.log(`   ${machine.machineName} (${machine._id})`);
        console.log(`      Connections: ${item.count}`);
        console.log(`      MACs: ${item.macs.join(', ')}`);
        
        // Find nodes for these MACs
        const nodes = await nodesCollection.find({ mac: { $in: item.macs } }).toArray();
        console.log(`      Nodes: ${nodes.length}`);
        nodes.forEach(node => {
          console.log(`        - Node ID: ${node._id}, MAC: ${node.mac}`);
        });
        console.log('');
      }
    }
    
    // Check reverse: nodes that might be linked to multiple machines
    console.log('\n\n📊 Checking if nodes are linked to multiple machines...');
    const nodeMacs = await nodesCollection.find({}).project({ mac: 1, _id: 1 }).toArray();
    const macToNodes = {};
    nodeMacs.forEach(node => {
      if (!macToNodes[node.mac]) {
        macToNodes[node.mac] = [];
      }
      macToNodes[node.mac].push(node._id.toString());
    });
    
    // Check connections for each MAC
    for (const [mac, nodeIds] of Object.entries(macToNodes).slice(0, 10)) {
      const connections = await connectionsCollection.find({ mac }).toArray();
      if (connections.length > 1) {
        const uniqueMachines = [...new Set(connections.map(c => c.machineId.toString()))];
        if (uniqueMachines.length > 1) {
          console.log(`   MAC ${mac} is connected to ${uniqueMachines.length} different machines:`);
          for (const machineId of uniqueMachines) {
            const machine = await machinesCollection.findOne({ _id: machineId });
            if (machine) {
              console.log(`     - ${machine.machineName} (${machineId})`);
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

checkMachineNodes().catch(console.error);

