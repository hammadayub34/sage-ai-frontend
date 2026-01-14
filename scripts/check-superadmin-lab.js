const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

const labId = '694422642e35591ba55f3e20'; // EPIC STUDIO BU LAB

async function checkSuperadminLab() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    const labsCollection = db.collection('labs');
    
    // Find superadmin user
    console.log('🔍 Searching for superadmin user...\n');
    
    const superadmin = await usersCollection.findOne({
      $or: [
        { email: { $regex: /superadmin/i } },
        { super_user: true },
        { user_type: 'admin' },
        { name: { $regex: /superadmin/i } }
      ]
    });
    
    if (superadmin) {
      console.log('👤 Superadmin User Found:');
      console.log(`  Email: ${superadmin.email}`);
      console.log(`  Name: ${superadmin.name || 'N/A'}`);
      console.log(`  ID: ${superadmin._id}`);
      console.log(`  Super User: ${superadmin.super_user || false}`);
      console.log(`  User Type: ${superadmin.user_type || 'N/A'}\n`);
    } else {
      console.log('❌ No superadmin user found with those criteria\n');
      
      // List all users to see what we have
      console.log('📋 Listing all users...\n');
      const allUsers = await usersCollection.find({}).limit(50).toArray();
      console.log(`Found ${allUsers.length} user(s):\n`);
      allUsers.forEach(u => {
        console.log(`  - ${u.email || u.name || u._id}`);
        console.log(`    Super User: ${u.super_user || false}, Type: ${u.user_type || 'N/A'}`);
      });
      return;
    }
    
    // Get the lab
    console.log(`\n🏢 Checking EPIC STUDIO BU LAB (${labId})...\n`);
    
    const lab = await labsCollection.findOne({
      _id: new ObjectId(labId)
    });
    
    if (lab) {
      console.log('Lab Details:');
      console.log(`  Name: ${lab.name}`);
      console.log(`  ID: ${lab._id}`);
      console.log(`  Description: ${lab.description || 'N/A'}\n`);
      
      // Check if superadmin is in the user_id array
      if (lab.user_id && lab.user_id.length > 0) {
        console.log(`  Associated Users (${lab.user_id.length}):`);
        
        const superadminId = superadmin._id.toString();
        let isSuperadminInLab = false;
        
        for (const userId of lab.user_id) {
          const userIdStr = userId.toString();
          const user = await usersCollection.findOne({
            _id: new ObjectId(userId)
          });
          
          if (user) {
            const isSuperadmin = userIdStr === superadminId;
            if (isSuperadmin) {
              isSuperadminInLab = true;
              console.log(`    ✅ ${user.email || user.name || userIdStr} (SUPERADMIN)`);
            } else {
              console.log(`    • ${user.email || user.name || userIdStr}`);
            }
          } else {
            console.log(`    • ${userIdStr}`);
          }
        }
        
        console.log('');
        
        if (isSuperadminInLab) {
          console.log('✅ Superadmin IS associated with this lab\n');
        } else {
          console.log('❌ Superadmin is NOT associated with this lab\n');
          console.log('💡 To add superadmin to this lab, you would need to:');
          console.log(`   Add ${superadmin._id} to the user_id array in the labs collection\n`);
        }
      } else {
        console.log('  ❌ Lab has no associated users\n');
        console.log('💡 To add superadmin to this lab, you would need to:');
        console.log(`   Add ${superadmin._id} to the user_id array in the labs collection\n`);
      }
    } else {
      console.log('❌ Lab not found\n');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkSuperadminLab().catch(console.error);

