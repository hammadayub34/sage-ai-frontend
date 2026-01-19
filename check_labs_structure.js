const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkLabsStructure() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    const labsCollection = db.collection('labs');
    
    // Check lab structure
    console.log('📦 Checking labs collection...');
    const labCount = await labsCollection.countDocuments();
    console.log(`   Total labs: ${labCount}\n`);
    
    if (labCount > 0) {
      const sampleLabs = await labsCollection.find({}).limit(5).toArray();
      console.log('📄 Sample labs:');
      sampleLabs.forEach((lab, idx) => {
        console.log(`\n   ${idx + 1}. Lab ID: ${lab._id}`);
        console.log(`      Fields: ${Object.keys(lab).join(', ')}`);
        console.log(`      Full data:`, JSON.stringify(lab, null, 2));
      });
      
      // Check what field contains the lab name
      const labWithName = sampleLabs.find(lab => 
        lab.name || lab.labName || lab.title || lab.label
      );
      
      if (labWithName) {
        console.log('\n✅ Lab name field found:');
        const nameField = Object.keys(labWithName).find(key => 
          ['name', 'labName', 'title', 'label'].includes(key)
        );
        console.log(`   Field: "${nameField}"`);
      } else {
        console.log('\n⚠️  No obvious name field found - checking all string fields...');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkLabsStructure().catch(console.error);

