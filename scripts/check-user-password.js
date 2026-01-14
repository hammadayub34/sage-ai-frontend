const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

const userEmail = 'testuser@example.com';

async function checkUserPassword() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    
    // Find user by email
    console.log(`🔍 Finding user: ${userEmail}\n`);
    
    const user = await usersCollection.findOne({
      email: userEmail
    });
    
    if (user) {
      console.log('👤 User Details:');
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name || 'N/A'}`);
      console.log(`  ID: ${user._id}`);
      
      if (user.password) {
        console.log(`\n  Password Hash: ${user.password}`);
        console.log(`  (Password is hashed with bcrypt - cannot retrieve plain text)`);
        console.log(`  Password Length: ${user.password.length} characters`);
        
        // Check if it looks like bcrypt (starts with $2a$, $2b$, or $2y$)
        if (user.password.startsWith('$2')) {
          console.log(`  Hash Type: bcrypt`);
        }
      } else {
        console.log(`\n  ❌ No password found`);
      }
      
      // Check if there's a plain text password field (unlikely but check)
      if (user.plainPassword) {
        console.log(`\n  ⚠️  Plain text password found: ${user.plainPassword}`);
      }
      
      // Check other fields
      console.log(`\n  Other fields:`);
      Object.keys(user).forEach(key => {
        if (key !== '_id' && key !== 'password' && key !== 'plainPassword') {
          console.log(`    ${key}: ${user[key]}`);
        }
      });
      
    } else {
      console.log(`❌ User not found`);
      
      // List all users to help identify
      console.log(`\n📋 Listing all users...\n`);
      const allUsers = await usersCollection.find({}).limit(20).toArray();
      console.log(`Found ${allUsers.length} user(s):\n`);
      allUsers.forEach(u => {
        console.log(`  - ${u.email || u.name || u._id}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkUserPassword().catch(console.error);

