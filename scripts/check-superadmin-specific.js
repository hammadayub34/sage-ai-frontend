const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

const labId = '694422642e35591ba55f3e20'; // EPIC STUDIO BU LAB

async function checkSuperadminSpecific() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    const labsCollection = db.collection('labs');
    
    // Search for superadmin specifically by email
    console.log('🔍 Searching for superadmin user...\n');
    
    const superadminEmail = 'superadmin@gmail.com';
    const superadmin = await usersCollection.findOne({
      email: superadminEmail
    });
    
    if (superadmin) {
      console.log('👤 Superadmin User Found:');
      console.log(`  Email: ${superadmin.email}`);
      console.log(`  Name: ${superadmin.name || 'N/A'}`);
      console.log(`  ID: ${superadmin._id}`);
      console.log(`  Super User: ${superadmin.super_user || false}`);
      console.log(`  User Type: ${superadmin.user_type || 'N/A'}\n`);
    } else {
      console.log(`❌ No user found with email: ${superadminEmail}\n`);
      
      // Check for any user with super_user: true
      console.log('🔍 Checking for users with super_user: true...\n');
      const superUsers = await usersCollection.find({
        super_user: true
      }).toArray();
      
      if (superUsers.length > 0) {
        console.log(`Found ${superUsers.length} super user(s):\n`);
        superUsers.forEach(u => {
          console.log(`  - ${u.email || u.name || u._id}`);
          console.log(`    Super User: ${u.super_user}, Type: ${u.user_type || 'N/A'}`);
        });
      } else {
        console.log('❌ No users with super_user: true found\n');
      }
      
      // List all users for reference
      console.log('\n📋 All users in database:\n');
      const allUsers = await usersCollection.find({}).limit(100).toArray();
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
        }
      } else {
        console.log('  ❌ Lab has no associated users\n');
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

checkSuperadminSpecific().catch(console.error);

