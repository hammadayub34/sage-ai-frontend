const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

const superadminEmail = 'superadmin@gmail.com';
const labId = '694422642e35591ba55f3e20'; // EPIC STUDIO BU LAB

async function addSuperadminToLab() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    const labsCollection = db.collection('labs');
    
    // Find superadmin user
    console.log(`🔍 Finding superadmin user: ${superadminEmail}...\n`);
    
    const superadmin = await usersCollection.findOne({
      email: superadminEmail
    });
    
    if (!superadmin) {
      console.log(`❌ Superadmin user not found: ${superadminEmail}`);
      return;
    }
    
    console.log('👤 Superadmin User:');
    console.log(`  Email: ${superadmin.email}`);
    console.log(`  Name: ${superadmin.name}`);
    console.log(`  ID: ${superadmin._id}\n`);
    
    // Find the lab
    console.log(`🏢 Finding lab: EPIC STUDIO BU LAB...\n`);
    
    const lab = await labsCollection.findOne({
      _id: new ObjectId(labId)
    });
    
    if (!lab) {
      console.log(`❌ Lab not found: ${labId}`);
      return;
    }
    
    console.log('Lab Details:');
    console.log(`  Name: ${lab.name}`);
    console.log(`  ID: ${lab._id}\n`);
    
    // Check if superadmin is already in the lab
    const superadminId = superadmin._id;
    const currentUserIds = lab.user_id || [];
    
    // Convert to strings for comparison
    const currentUserIdsStr = currentUserIds.map(id => id.toString());
    const superadminIdStr = superadminId.toString();
    
    if (currentUserIdsStr.includes(superadminIdStr)) {
      console.log('✅ Superadmin is already associated with this lab\n');
      return;
    }
    
    // Add superadmin to the lab
    console.log('➕ Adding superadmin to lab...\n');
    
    const result = await labsCollection.updateOne(
      { _id: new ObjectId(labId) },
      { 
        $addToSet: { user_id: superadminId }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Successfully added superadmin to the lab!\n');
      
      // Verify the update
      const updatedLab = await labsCollection.findOne({
        _id: new ObjectId(labId)
      });
      
      console.log('📋 Updated Lab Users:');
      if (updatedLab.user_id && updatedLab.user_id.length > 0) {
        for (const userId of updatedLab.user_id) {
          const user = await usersCollection.findOne({
            _id: new ObjectId(userId)
          });
          if (user) {
            const isSuperadmin = userId.toString() === superadminIdStr;
            if (isSuperadmin) {
              console.log(`  ✅ ${user.email || user.name} (SUPERADMIN)`);
            } else {
              console.log(`  • ${user.email || user.name}`);
            }
          } else {
            console.log(`  • ${userId}`);
          }
        }
      }
    } else {
      console.log('⚠️  No changes made (superadmin may already be in the lab)\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

addSuperadminToLab().catch(console.error);

