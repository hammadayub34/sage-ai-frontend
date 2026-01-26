const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkNodeStructure() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    const nodesCollection = db.collection('nodes');
    const machinesCollection = db.collection('machines');
    const connectionsCollection = db.collection('connections');
    
    // Check node structure
    console.log('📦 Checking node structure...');
    const sampleNode = await nodesCollection.findOne({});
    if (sampleNode) {
      console.log('Sample node fields:', Object.keys(sampleNode));
      console.log('Sample node:', JSON.stringify(sampleNode, null, 2));
    }
    
    // Check what "unassigned" means - check status field
    console.log('\n📊 Node statuses:');
    const statuses = await nodesCollection.distinct('status');
    console.log('   Statuses:', statuses);
    
    const statusCounts = await nodesCollection.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    statusCounts.forEach(item => {
      console.log(`   ${item._id}: ${item.count}`);
    });
    
    // Check which nodes are assigned to machines
    const assignedMacs = await connectionsCollection.distinct('mac');
    console.log(`\n📡 Assigned MACs (in connections): ${assignedMacs.length}`);
    
    // Get unassigned nodes
    const allNodes = await nodesCollection.find({}).toArray();
    const unassignedNodes = allNodes.filter(node => !assignedMacs.includes(node.mac));
    console.log(`   Unassigned nodes: ${unassignedNodes.length}`);
    
    if (unassignedNodes.length > 0) {
      console.log('\n📄 Sample unassigned nodes:');
      unassignedNodes.slice(0, 3).forEach((node, idx) => {
        console.log(`\n   ${idx + 1}. MAC: ${node.mac}`);
        console.log(`      Status: ${node.status}`);
        console.log(`      Node ID: ${node._id}`);
      });
    }
    
    // Check if nodes have a type field or if we need to determine from MAC/other fields
    const nodeWithType = await nodesCollection.findOne({ 
      $or: [
        { type: { $exists: true } },
        { nodeType: { $exists: true } },
        { model: { $exists: true } }
      ]
    });
    if (nodeWithType) {
      console.log('\n✅ Found node with type/model field:');
      console.log(JSON.stringify(nodeWithType, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkNodeStructure().catch(console.error);

