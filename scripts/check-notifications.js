const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

async function checkNotifications() {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(uri);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📋 Available collections:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    console.log('');
    
    // Check for notifications collection
    const notificationsCollection = db.collection('notifications');
    const notificationCount = await notificationsCollection.countDocuments();
    
    if (notificationCount > 0) {
      console.log(`✅ Found ${notificationCount} notification(s) in 'notifications' collection\n`);
      
      // Get sample notifications
      const sampleNotifications = await notificationsCollection.find({}).limit(5).toArray();
      console.log('📄 Sample notifications:');
      sampleNotifications.forEach((notif, index) => {
        console.log(`\n  Notification ${index + 1}:`);
        console.log(`    ID: ${notif._id}`);
        console.log(`    Data: ${JSON.stringify(notif, null, 2)}`);
      });
    } else {
      console.log('❌ No notifications found in "notifications" collection');
      console.log('   (Collection may not exist or is empty)\n');
    }
    
    // Check other possible collection names
    const possibleNames = ['notification', 'alerts', 'alarm_events', 'events'];
    for (const name of possibleNames) {
      const collection = db.collection(name);
      const count = await collection.countDocuments();
      if (count > 0) {
        console.log(`ℹ️  Found ${count} document(s) in "${name}" collection`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n✅ Connection closed');
    }
  }
}

checkNotifications();


