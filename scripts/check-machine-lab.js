const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

const screenshotMAC = '10:06:1C:86:F9:54';
const mongoMachineID = '6958155ea4f09743147b22ab';

async function checkMachineLab() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const connectionsCollection = db.collection('connections');
    const machinesCollection = db.collection('machines');
    const labsCollection = db.collection('labs');
    
    // Find connection with screenshot MAC
    console.log(`🔍 Finding machine for MAC ${screenshotMAC}...\n`);
    
    const connection = await connectionsCollection.findOne({
      mac: screenshotMAC
    });
    
    if (connection) {
      console.log('📡 Connection Details:');
      console.log(`  MAC: ${connection.mac}`);
      console.log(`  Node Type: ${connection.nodeType || 'N/A'}`);
      console.log(`  Sensor Type: ${connection.sensorType || 'N/A'}`);
      console.log(`  Machine ID: ${connection.machineId || 'N/A'}\n`);
      
      if (connection.machineId) {
        const machine = await machinesCollection.findOne({
          _id: new ObjectId(connection.machineId)
        });
        
        if (machine) {
          console.log('🤖 Machine Details:');
          console.log(`  Name: ${machine.machineName}`);
          console.log(`  ID: ${machine._id}`);
          console.log(`  Lab ID: ${machine.labId}`);
          console.log(`  Status: ${machine.status || 'N/A'}`);
          console.log(`  Description: ${machine.description || 'N/A'}\n`);
          
          if (machine.labId) {
            const lab = await labsCollection.findOne({
              _id: new ObjectId(machine.labId)
            });
            
            if (lab) {
              console.log('🏢 Lab Details:');
              console.log(`  Name: ${lab.name}`);
              console.log(`  ID: ${lab._id}`);
              console.log(`  Description: ${lab.description || 'N/A'}`);
              
              // Check which users are associated with this lab
              if (lab.user_id && lab.user_id.length > 0) {
                console.log(`\n  Associated Users (${lab.user_id.length}):`);
                const usersCollection = db.collection('users');
                for (const userId of lab.user_id) {
                  const user = await usersCollection.findOne({
                    _id: new ObjectId(userId)
                  });
                  if (user) {
                    console.log(`    - ${user.email || user.name || userId}`);
                  } else {
                    console.log(`    - ${userId}`);
                  }
                }
              }
            } else {
              console.log('❌ Lab not found');
            }
          } else {
            console.log('❌ Machine has no lab ID');
          }
        } else {
          console.log('❌ Machine not found');
        }
      } else {
        console.log('❌ Connection has no machine ID');
      }
    } else {
      console.log('❌ No connection found with this MAC address');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkMachineLab().catch(console.error);

