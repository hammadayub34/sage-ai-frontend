const { MongoClient } = require('mongodb');

const uri = 'mongodb://wiser:wiser%40123@3.208.198.4:27017';

async function checkUserPasswords() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('admin');
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();
    
    if (userCount === 0) {
      console.log('⚠️  No users found in "users" collection');
      return;
    }
    
    console.log(`✅ Found ${userCount} user(s) in "users" collection\n`);
    
    // Get sample users
    const sampleUsers = await usersCollection.find({}).limit(3).toArray();
    
    console.log('📄 Sample user documents:');
    sampleUsers.forEach((user, idx) => {
      console.log(`\n   User ${idx + 1}:`);
      console.log(`   Fields: ${Object.keys(user).join(', ')}`);
      
      // Check for password fields
      const passwordFields = Object.keys(user).filter(key => 
        key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('pwd') ||
        key.toLowerCase().includes('hash')
      );
      
      if (passwordFields.length > 0) {
        console.log(`   Password field(s): ${passwordFields.join(', ')}`);
        passwordFields.forEach(field => {
          const passwordValue = user[field];
          if (passwordValue) {
            const pwdStr = String(passwordValue);
            console.log(`   - ${field}: ${pwdStr.substring(0, 20)}... (length: ${pwdStr.length})`);
            
            // Analyze format
            if (pwdStr.startsWith('$2a$') || pwdStr.startsWith('$2b$') || pwdStr.startsWith('$2y$')) {
              console.log(`     Format: bcrypt hash`);
            } else if (pwdStr.startsWith('$argon2')) {
              console.log(`     Format: argon2 hash`);
            } else if (pwdStr.length < 20) {
              console.log(`     Format: Possibly plain text (short length)`);
            } else {
              console.log(`     Format: Unknown (could be hashed or encrypted)`);
            }
          }
        });
      } else {
        console.log(`   ⚠️  No password field found`);
      }
      
      // Show other important fields
      console.log(`   Email: ${user.email || user.username || 'N/A'}`);
      console.log(`   User Type: ${user.user_type || user.role || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkUserPasswords().catch(console.error);

