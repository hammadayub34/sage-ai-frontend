const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkUsers() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📦 All collections in database:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    // Check for user-related collections
    const userCollections = collections.filter(col => 
      col.name.toLowerCase().includes('user') || 
      col.name.toLowerCase().includes('auth') ||
      col.name.toLowerCase().includes('role') ||
      col.name.toLowerCase().includes('permission')
    );
    
    if (userCollections.length > 0) {
      console.log('\n👤 User-related collections found:');
      userCollections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
    } else {
      console.log('\n⚠️  No obvious user-related collections found');
    }
    
    // Check users collection specifically
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();
    
    if (userCount > 0) {
      console.log(`\n✅ Found 'users' collection with ${userCount} users\n`);
      
      // Get sample users
      const sampleUsers = await usersCollection.find({}).limit(5).toArray();
      
      console.log('📄 Sample user structure:');
      sampleUsers.forEach((user, idx) => {
        console.log(`\n   User ${idx + 1}:`);
        console.log(`   Fields: ${Object.keys(user).join(', ')}`);
        console.log(`   Full data:`, JSON.stringify(user, null, 2));
      });
      
      // Check for user types/roles
      const userTypes = await usersCollection.distinct('role');
      const userTypes2 = await usersCollection.distinct('userType');
      const userTypes3 = await usersCollection.distinct('type');
      const userTypes4 = await usersCollection.distinct('permissions');
      
      console.log('\n🔍 Checking for user types/roles:');
      if (userTypes.length > 0) {
        console.log(`   'role' field values:`, userTypes);
      }
      if (userTypes2.length > 0) {
        console.log(`   'userType' field values:`, userTypes2);
      }
      if (userTypes3.length > 0) {
        console.log(`   'type' field values:`, userTypes3);
      }
      if (userTypes4.length > 0) {
        console.log(`   'permissions' field values:`, userTypes4);
      }
      
      // Count by role/type if exists
      if (userTypes.length > 0) {
        const roleCounts = await usersCollection.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ]).toArray();
        console.log('\n📊 Users by role:');
        roleCounts.forEach(item => {
          console.log(`   ${item._id || 'null'}: ${item.count}`);
        });
      }
    } else {
      console.log('\n⚠️  No users found in "users" collection');
    }
    
    // Check for other potential user collections
    const otherUserCollections = ['auth', 'roles', 'permissions', 'accounts'];
    for (const colName of otherUserCollections) {
      try {
        const col = db.collection(colName);
        const count = await col.countDocuments();
        if (count > 0) {
          console.log(`\n✅ Found '${colName}' collection with ${count} documents`);
          const sample = await col.findOne({});
          if (sample) {
            console.log(`   Sample fields: ${Object.keys(sample).join(', ')}`);
          }
        }
      } catch (e) {
        // Collection might not exist, that's okay
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkUsers().catch(console.error);

