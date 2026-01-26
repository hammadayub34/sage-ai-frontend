const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkMachines() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    // Check admin database for machines collection
    const adminDb = client.db('admin');
    const adminCollections = await adminDb.listCollections().toArray();
    console.log('📦 Collections in "admin" database:');
    adminCollections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    console.log('');
    
    // Check if machines collection exists in admin
    const machinesCollection = adminCollections.find(col => col.name === 'machines');
    if (machinesCollection) {
      const collection = adminDb.collection('machines');
      const count = await collection.countDocuments();
      console.log(`📊 Found "machines" collection in admin database`);
      console.log(`   Total documents: ${count}\n`);
      
      if (count > 0) {
        console.log('📄 Sample machine documents:');
        const samples = await collection.find({}).limit(5).toArray();
        samples.forEach((doc, index) => {
          console.log(`\n   Machine ${index + 1}:`);
          console.log(JSON.stringify(doc, null, 2));
        });
      }
    } else {
      console.log('⚠️  No "machines" collection found in admin database');
      console.log('   Checking machineschedules for machine references...\n');
      
      // Check machineschedules for machine IDs
      const schedulesCollection = adminDb.collection('machineschedules');
      const sampleSchedule = await schedulesCollection.findOne({});
      if (sampleSchedule && sampleSchedule.machineId) {
        console.log('📋 Sample machineschedule document:');
        console.log(JSON.stringify(sampleSchedule, null, 2));
        console.log('\n   Note: machineId is an ObjectId reference');
      }
    }
    
    // Also check test database
    const testDb = client.db('test');
    const testCollections = await testDb.listCollections().toArray();
    console.log('\n📦 Collections in "test" database:');
    testCollections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    const testMachines = testCollections.find(col => col.name === 'machines');
    if (testMachines) {
      const collection = testDb.collection('machines');
      const count = await collection.countDocuments();
      console.log(`\n📊 "machines" collection in test database: ${count} documents`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkMachines().catch(console.error);

