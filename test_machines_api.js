// Test script to verify MongoDB connection and data retrieval
const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function testMachinesAPI() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    const collection = db.collection('machines');
    
    // Get total count
    const totalCount = await collection.countDocuments();
    console.log(`📊 Total machines: ${totalCount}\n`);
    
    // Get active machines
    const activeCount = await collection.countDocuments({ status: 'active' });
    const inactiveCount = await collection.countDocuments({ status: 'inactive' });
    console.log(`   Active: ${activeCount}`);
    console.log(`   Inactive: ${inactiveCount}\n`);
    
    // Get sample machines
    console.log('📄 Sample machines:');
    const samples = await collection.find({}).limit(3).toArray();
    samples.forEach((machine, index) => {
      console.log(`\n   ${index + 1}. ${machine.machineName}`);
      console.log(`      ID: ${machine._id}`);
      console.log(`      Status: ${machine.status}`);
      console.log(`      Lab ID: ${machine.labId}`);
      if (machine.tags && machine.tags.length > 0) {
        console.log(`      Tags: ${machine.tags.join(', ')}`);
      }
    });
    
    // Get unique lab IDs
    const labs = await collection.distinct('labId');
    console.log(`\n🏢 Unique Labs: ${labs.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

testMachinesAPI().catch(console.error);

