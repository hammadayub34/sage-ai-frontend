const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function verifyLabUsers() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    const labsCollection = db.collection('labs');
    const usersCollection = db.collection('users');
    
    // Get a lab with users
    const lab = await labsCollection.findOne({ 
      user_id: { $exists: true, $ne: [] } 
    });
    
    if (!lab) {
      console.log('⚠️  No labs with user_id found');
      return;
    }
    
    console.log(`📦 Lab: "${lab.name}"`);
    console.log(`   Lab ID: ${lab._id}`);
    console.log(`   User IDs in lab: ${lab.user_id.length}\n`);
    
    // Convert string IDs to ObjectIds
    const userIds = lab.user_id.map(id => {
      try {
        return typeof id === 'string' ? new ObjectId(id) : id;
      } catch (e) {
        return null;
      }
    }).filter(id => id !== null);
    
    // Find users
    const users = await usersCollection.find({ 
      _id: { $in: userIds } 
    }).toArray();
    
    console.log(`✅ Found ${users.length} user(s) linked to this lab:\n`);
    users.forEach((user, idx) => {
      console.log(`   User ${idx + 1}:`);
      console.log(`      ID: ${user._id}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Name: ${user.name}`);
      console.log(`      User Type: ${user.user_type}`);
      console.log(`      Super User: ${user.super_user || false}`);
      console.log(`      Active: ${user.isActive}`);
      console.log('');
    });
    
    // Summary
    console.log('📊 Summary:');
    console.log(`   Total labs: ${await labsCollection.countDocuments()}`);
    console.log(`   Labs with users (user_id not empty): ${await labsCollection.countDocuments({ user_id: { $exists: true, $ne: [] } })}`);
    console.log(`   Labs with user_id_test: ${await labsCollection.countDocuments({ user_id_test: { $exists: true, $ne: [] } })}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

verifyLabUsers().catch(console.error);

