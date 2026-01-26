const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

async function checkCollectionStructure() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    
    // Check acryl_nodes collection
    console.log('📦 Checking acryl_nodes collection...\n');
    const acrylNodes = db.collection('acryl_nodes');
    const sampleAcrylNode = await acrylNodes.findOne({});
    if (sampleAcrylNode) {
      console.log('Sample acryl_nodes document:');
      console.log(JSON.stringify(sampleAcrylNode, null, 2));
      console.log('\n');
    } else {
      console.log('No documents in acryl_nodes\n');
    }
    
    // Check nodes collection
    console.log('📦 Checking nodes collection...\n');
    const nodes = db.collection('nodes');
    const sampleNode = await nodes.findOne({});
    if (sampleNode) {
      console.log('Sample nodes document:');
      console.log(JSON.stringify(sampleNode, null, 2));
      console.log('\n');
    } else {
      console.log('No documents in nodes\n');
    }
    
    // Check recommendedThresholds collection
    console.log('📦 Checking recommendedThresholds collection...\n');
    const recommendedThresholds = db.collection('recommendedThresholds');
    const sampleThreshold = await recommendedThresholds.findOne({});
    if (sampleThreshold) {
      console.log('Sample recommendedThresholds document:');
      console.log(JSON.stringify(sampleThreshold, null, 2));
      console.log('\n');
    } else {
      console.log('No documents in recommendedThresholds\n');
    }
    
    // Check thermisters collection
    console.log('📦 Checking thermisters collection...\n');
    const thermisters = db.collection('thermisters');
    const sampleThermister = await thermisters.findOne({});
    if (sampleThermister) {
      console.log('Sample thermisters document:');
      console.log(JSON.stringify(sampleThermister, null, 2));
      console.log('\n');
    } else {
      console.log('No documents in thermisters\n');
    }
    
    // Check vibrations collection
    console.log('📦 Checking vibrations collection...\n');
    const vibrations = db.collection('vibrations');
    const sampleVibration = await vibrations.findOne({});
    if (sampleVibration) {
      console.log('Sample vibrations document:');
      console.log(JSON.stringify(sampleVibration, null, 2));
      console.log('\n');
    } else {
      console.log('No documents in vibrations\n');
    }
    
    // Check cts collection
    console.log('📦 Checking cts collection...\n');
    const cts = db.collection('cts');
    const sampleCt = await cts.findOne({});
    if (sampleCt) {
      console.log('Sample cts document:');
      console.log(JSON.stringify(sampleCt, null, 2));
      console.log('\n');
    } else {
      console.log('No documents in cts\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkCollectionStructure();

