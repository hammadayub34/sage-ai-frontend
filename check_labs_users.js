const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkLabsUsers() {
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
      // Get sample labs
      const sampleLabs = await labsCollection.find({}).limit(5).toArray();
      console.log('📄 Sample labs with full structure:');
      sampleLabs.forEach((lab, idx) => {
        console.log(`\n   Lab ${idx + 1}:`);
        console.log(`   ID: ${lab._id}`);
        console.log(`   All fields: ${Object.keys(lab).join(', ')}`);
        console.log(`   Full data:`, JSON.stringify(lab, null, 2));
      });
      
      // Check for user-related fields
      console.log('\n🔍 Checking for user-related fields in labs:');
      const userFields = [];
      sampleLabs.forEach(lab => {
        Object.keys(lab).forEach(key => {
          if (key.toLowerCase().includes('user') || 
              key.toLowerCase().includes('member') ||
              key.toLowerCase().includes('owner') ||
              key.toLowerCase().includes('admin') ||
              key.toLowerCase().includes('student')) {
            if (!userFields.includes(key)) {
              userFields.push(key);
            }
          }
        });
      });
      
      if (userFields.length > 0) {
        console.log(`   ✅ Found user-related fields: ${userFields.join(', ')}`);
        
        // Check how many labs have these fields
        userFields.forEach(field => {
          const labsWithField = sampleLabs.filter(lab => lab[field] !== undefined && lab[field] !== null);
          if (labsWithField.length > 0) {
            console.log(`\n   Field "${field}":`);
            labsWithField.forEach(lab => {
              const value = lab[field];
              if (Array.isArray(value)) {
                console.log(`      Lab ${lab.name || lab._id}: ${value.length} items - ${JSON.stringify(value)}`);
              } else if (typeof value === 'object') {
                console.log(`      Lab ${lab.name || lab._id}: ${JSON.stringify(value)}`);
              } else {
                console.log(`      Lab ${lab.name || lab._id}: ${value}`);
              }
            });
          }
        });
      } else {
        console.log(`   ⚠️  No obvious user-related fields found`);
      }
      
      // Check if there are any ObjectId references that might be users
      console.log('\n🔍 Checking for ObjectId references that might be users:');
      const usersCollection = db.collection('users');
      sampleLabs.forEach(lab => {
        Object.keys(lab).forEach(key => {
          const value = lab[key];
          if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectId') {
            // Check if this ObjectId exists in users collection
            usersCollection.findOne({ _id: value }).then(user => {
              if (user) {
                console.log(`   ✅ Lab "${lab.name || lab._id}" has field "${key}" that references user: ${user.email} (${user.user_type})`);
              }
            }).catch(() => {});
          } else if (Array.isArray(value) && value.length > 0 && value[0] && typeof value[0] === 'object' && value[0].constructor && value[0].constructor.name === 'ObjectId') {
            // Array of ObjectIds
            const userIds = value.map(v => v.toString ? v.toString() : v);
            usersCollection.find({ _id: { $in: value } }).toArray().then(users => {
              if (users.length > 0) {
                console.log(`   ✅ Lab "${lab.name || lab._id}" has field "${key}" with ${users.length} user(s):`);
                users.forEach(u => {
                  console.log(`      - ${u.email} (${u.user_type})`);
                });
              }
            }).catch(() => {});
          }
        });
      });
      
    } else {
      console.log('⚠️  No labs found in collection');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkLabsUsers().catch(console.error);

