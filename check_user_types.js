const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkUserTypes() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    const usersCollection = db.collection('users');
    
    // Get all distinct user types
    const userTypes = await usersCollection.distinct('user_type');
    console.log('👤 User types found:', userTypes);
    
    // Count users by type
    const typeCounts = await usersCollection.aggregate([
      { $group: { _id: '$user_type', count: { $sum: 1 } } }
    ]).toArray();
    
    console.log('\n📊 Users by type:');
    typeCounts.forEach(item => {
      console.log(`   ${item._id || 'null'}: ${item.count}`);
    });
    
    // Check super_user distribution
    const superUserCount = await usersCollection.countDocuments({ super_user: true });
    const regularUserCount = await usersCollection.countDocuments({ super_user: false });
    console.log(`\n🔑 Super users: ${superUserCount}`);
    console.log(`   Regular users: ${regularUserCount}`);
    
    // Check active/inactive
    const activeCount = await usersCollection.countDocuments({ isActive: true });
    const inactiveCount = await usersCollection.countDocuments({ isActive: false });
    console.log(`\n✅ Active users: ${activeCount}`);
    console.log(`   Inactive users: ${inactiveCount}`);
    
    // Check validated users
    const validatedCount = await usersCollection.countDocuments({ is_validated: true });
    const unvalidatedCount = await usersCollection.countDocuments({ 
      $or: [
        { is_validated: false },
        { is_validated: { $exists: false } }
      ]
    });
    console.log(`\n✓ Validated users: ${validatedCount}`);
    console.log(`   Unvalidated users: ${unvalidatedCount}`);
    
    // Sample admin user
    const adminUser = await usersCollection.findOne({ user_type: 'admin' });
    if (adminUser) {
      console.log('\n📄 Sample admin user structure:');
      console.log(JSON.stringify(adminUser, null, 2));
    }
    
    // Sample student user
    const studentUser = await usersCollection.findOne({ user_type: 'student' });
    if (studentUser) {
      console.log('\n📄 Sample student user structure:');
      console.log(JSON.stringify(studentUser, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkUserTypes().catch(console.error);

