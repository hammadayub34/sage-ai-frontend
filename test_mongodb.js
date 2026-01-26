const { MongoClient } = require('mongodb');

// MongoDB connection string
const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function testConnection() {
  const client = new MongoClient(uri);
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB successfully!\n');
    
    // List all databases
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    console.log('📊 Available databases:');
    databases.databases.forEach(db => {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    console.log('');
    
    // Try to find the machines collection in each database
    for (const dbInfo of databases.databases) {
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      
      // Check if machines collection exists
      const machinesCollection = collections.find(col => 
        col.name.toLowerCase().includes('machine') || 
        col.name.toLowerCase().includes('equipment')
      );
      
      if (machinesCollection) {
        console.log(`📦 Found collection "${machinesCollection.name}" in database "${dbInfo.name}"`);
        const collection = db.collection(machinesCollection.name);
        const count = await collection.countDocuments();
        console.log(`   Total documents: ${count}\n`);
        
        // Get sample documents
        if (count > 0) {
          console.log('📄 Sample documents:');
          const samples = await collection.find({}).limit(3).toArray();
          samples.forEach((doc, index) => {
            console.log(`\n   Document ${index + 1}:`);
            console.log(JSON.stringify(doc, null, 2));
          });
        }
      }
    }
    
    // Also try common database names
    const commonDbNames = ['wiser', 'production', 'iot', 'plc', 'machines', 'equipment'];
    for (const dbName of commonDbNames) {
      try {
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();
        if (collections.length > 0) {
          console.log(`\n📚 Database "${dbName}" has ${collections.length} collection(s):`);
          for (const col of collections) {
            const collection = db.collection(col.name);
            const count = await collection.countDocuments();
            console.log(`   - ${col.name}: ${count} documents`);
            
            // If it's a machines-related collection, show samples
            if (col.name.toLowerCase().includes('machine') || 
                col.name.toLowerCase().includes('equipment')) {
              if (count > 0) {
                const samples = await collection.find({}).limit(2).toArray();
                console.log(`     Sample data:`);
                samples.forEach((doc, idx) => {
                  console.log(`       Doc ${idx + 1}:`, JSON.stringify(doc, null, 6));
                });
              }
            }
          }
        }
      } catch (err) {
        // Database doesn't exist or access denied, skip
      }
    }
    
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    if (error.message.includes('authentication')) {
      console.error('   Authentication failed. Please check username and password.');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('   Connection refused. Please check:');
      console.error('   - Is the MongoDB server running?');
      console.error('   - Is the IP address correct?');
      console.error('   - Is the port (27017) accessible?');
    }
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed.');
  }
}

// Run the test
testConnection().catch(console.error);

