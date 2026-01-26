const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

async function checkMacThresholdScale(macAddress) {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    
    // List of collections to check (including actual collections found in DB)
    const collectionsToCheck = [
      'nodes',
      'acryl_nodes',  // This looks like the actual nodes collection!
      'beacons',
      'connections',
      'sensors',
      'thermisters',  // Temperature sensors
      'vibrations',   // Vibration sensors
      'cts',         // Current sensors
      'proximities', // Proximity sensors
      'ambients',    // Ambient sensors
      'recommendedThresholds', // Thresholds collection
      'nodeConfig',
      'node_config',
      'sensorConfig',
      'sensor_config',
      'beaconConfig',
      'beacon_config'
    ];
    
    console.log(`🔍 Checking for threshold/scale data for MAC: ${macAddress}\n`);
    console.log('='.repeat(60));
    
    let found = false;
    
    for (const collectionName of collectionsToCheck) {
      try {
        const collection = db.collection(collectionName);
        
        // Check if collection exists by trying to count documents
        const count = await collection.countDocuments();
        
        // Search for documents with this MAC
        const docs = await collection.find({ mac: macAddress }).toArray();
        
        if (docs.length > 0) {
          console.log(`\n📦 Collection: ${collectionName}`);
          console.log(`   Found ${docs.length} document(s) with MAC: ${macAddress}`);
          
          docs.forEach((doc, idx) => {
            console.log(`\n   Document ${idx + 1}:`);
            console.log(`   - _id: ${doc._id}`);
            
            // Check for threshold
            if (doc.threshold !== undefined) {
              console.log(`   - threshold: ${doc.threshold}`);
              found = true;
            }
            
            // Check for scale
            if (doc.scale !== undefined) {
              console.log(`   - scale: ${doc.scale}`);
              found = true;
            }
            
            // Check for sensorType
            if (doc.sensorType !== undefined) {
              console.log(`   - sensorType: ${doc.sensorType}`);
            }
            if (doc.sensor_type !== undefined) {
              console.log(`   - sensor_type: ${doc.sensor_type}`);
            }
            
            // Check for nodeType
            if (doc.nodeType !== undefined) {
              console.log(`   - nodeType: ${doc.nodeType}`);
            }
            
            // Check for config object
            if (doc.config) {
              console.log(`   - config:`, JSON.stringify(doc.config, null, 2));
              if (doc.config.threshold !== undefined || doc.config.scale !== undefined) {
                found = true;
              }
            }
            
            // Show all fields to help identify structure
            console.log(`   - All fields:`, Object.keys(doc).join(', '));
          });
        }
      } catch (error) {
        // Collection might not exist, skip it
        if (error.code !== 26) { // 26 = namespace not found
          console.log(`   ⚠️  Error checking ${collectionName}: ${error.message}`);
        }
      }
    }
    
    if (!found) {
      console.log('\n❌ No threshold or scale data found for this MAC address in any collection.');
      console.log('\n💡 Let me check what collections exist in the database...\n');
      
      // List all collections
      const collections = await db.listCollections().toArray();
      console.log('Available collections:');
      collections.forEach(col => {
        console.log(`  - ${col.name}`);
      });
    } else {
      console.log('\n✅ Found threshold/scale data!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Get MAC address from command line argument
const macAddress = process.argv[2];

if (!macAddress) {
  console.log('Usage: node check-mac-threshold-scale.js <MAC_ADDRESS>');
  console.log('Example: node check-mac-threshold-scale.js "AA:BB:CC:DD:EE:FF"');
  process.exit(1);
}

checkMacThresholdScale(macAddress);

