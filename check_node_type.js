const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkNodeType() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    const nodesCollection = db.collection('nodes');
    
    // Check for node type fields
    console.log('📦 Checking for node type fields...');
    
    // Get a sample of nodes and check all fields
    const sampleNodes = await nodesCollection.find({}).limit(10).toArray();
    
    console.log('\n📄 Sample node structure:');
    if (sampleNodes.length > 0) {
      console.log('All fields:', Object.keys(sampleNodes[0]));
      console.log('\nFull sample node:');
      console.log(JSON.stringify(sampleNodes[0], null, 2));
    }
    
    // Search for nodes with type-related fields
    const nodeWithType = await nodesCollection.findOne({
      $or: [
        { type: { $exists: true } },
        { nodeType: { $exists: true } },
        { model: { $exists: true } },
        { version: { $exists: true } },
        { 'beacon': { $exists: true } },
        { 'ct3': { $exists: true } },
        { 'v3': { $exists: true } },
        { 't3': { $exists: true } }
      ]
    });
    
    if (nodeWithType) {
      console.log('\n✅ Found node with type-related field:');
      console.log(JSON.stringify(nodeWithType, null, 2));
    } else {
      console.log('\n⚠️  No type field found in nodes collection');
    }
    
    // Check connections collection for node type
    console.log('\n\n📦 Checking connections collection for node type...');
    const connectionsCollection = db.collection('connections');
    const sampleConnection = await connectionsCollection.findOne({});
    if (sampleConnection) {
      console.log('Connection fields:', Object.keys(sampleConnection));
      console.log('\nSample connection:');
      console.log(JSON.stringify(sampleConnection, null, 2));
    }
    
    // Check machines collection for node type reference
    console.log('\n\n📦 Checking machines collection for node type...');
    const machinesCollection = db.collection('machines');
    const machineWithNodeType = await machinesCollection.findOne({
      $or: [
        { nodeType: { $exists: true } },
        { sensorType: { $exists: true } },
        { sensor: { $exists: true } }
      ]
    });
    
    if (machineWithNodeType) {
      console.log('✅ Found machine with node/sensor type:');
      console.log(JSON.stringify(machineWithNodeType, null, 2));
    } else {
      console.log('⚠️  No node/sensor type found in machines');
    }
    
    // Check all collections for "beacon", "ct3", "v3", "t3"
    console.log('\n\n🔍 Searching all collections for beacon/ct3/v3/t3...');
    const collections = await db.listCollections().toArray();
    
    for (const colInfo of collections) {
      const collection = db.collection(colInfo.name);
      const hasBeacon = await collection.findOne({ 
        $or: [
          { type: /beacon/i },
          { nodeType: /beacon/i },
          { model: /beacon/i },
          { beacon: { $exists: true } },
          { ct3: { $exists: true } },
          { v3: { $exists: true } },
          { t3: { $exists: true } }
        ]
      });
      
      if (hasBeacon) {
        console.log(`\n✅ Found in collection "${colInfo.name}":`);
        console.log(JSON.stringify(hasBeacon, null, 2));
      }
    }
    
    // Check if there's a separate node types/config collection
    const nodeTypesCollection = db.collection('nodetypes');
    const nodeTypesCount = await nodeTypesCollection.countDocuments();
    if (nodeTypesCount > 0) {
      console.log(`\n📦 Found nodetypes collection with ${nodeTypesCount} documents`);
      const sample = await nodeTypesCollection.findOne({});
      console.log(JSON.stringify(sample, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkNodeType().catch(console.error);

