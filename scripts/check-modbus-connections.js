const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

async function checkModbusConnections() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const connectionsCollection = db.collection('connections');
    const machinesCollection = db.collection('machines');
    
    // Search for Modbus-related connections
    console.log('🔍 Searching for Modbus connections...\n');
    
    const modbusConnections = await connectionsCollection.find({
      $or: [
        { nodeType: { $regex: /modbus/i } },
        { sensorType: { $regex: /modbus/i } },
        { mac: { $regex: /modbus/i } },
        { description: { $regex: /modbus/i } }
      ]
    }).toArray();
    
    console.log(`Found ${modbusConnections.length} connections with "modbus" in name/type:\n`);
    modbusConnections.forEach(conn => {
      console.log(`  MAC: ${conn.mac}`);
      console.log(`  Node Type: ${conn.nodeType || 'N/A'}`);
      console.log(`  Sensor Type: ${conn.sensorType || 'N/A'}`);
      console.log(`  Machine ID: ${conn.machineId || 'N/A'}`);
      console.log('');
    });
    
    // Check all connections for the Monforts machine
    const monfortsMachineId = '68f0e3f048f7b84b491408b5';
    console.log(`\n🔍 Checking all connections for Monforts machine (${monfortsMachineId})...\n`);
    
    const monfortsConnections = await connectionsCollection.find({
      machineId: monfortsMachineId
    }).toArray();
    
    console.log(`Found ${monfortsConnections.length} connection(s) for Monforts:\n`);
    monfortsConnections.forEach(conn => {
      console.log(`  MAC: ${conn.mac}`);
      console.log(`  Node Type: ${conn.nodeType || 'N/A'}`);
      console.log(`  Sensor Type: ${conn.sensorType || 'N/A'}`);
      console.log(`  Description: ${conn.description || 'N/A'}`);
      console.log('');
    });
    
    // Check for connections with MAC from screenshot
    const screenshotMAC = '10:06:1C:86:F9:54';
    console.log(`\n🔍 Checking for connection with MAC ${screenshotMAC}...\n`);
    
    const screenshotConnection = await connectionsCollection.findOne({
      mac: screenshotMAC
    });
    
    if (screenshotConnection) {
      console.log('✅ Found connection:');
      console.log(`  MAC: ${screenshotConnection.mac}`);
      console.log(`  Node Type: ${screenshotConnection.nodeType || 'N/A'}`);
      console.log(`  Sensor Type: ${screenshotConnection.sensorType || 'N/A'}`);
      console.log(`  Machine ID: ${screenshotConnection.machineId || 'N/A'}`);
      
      if (screenshotConnection.machineId) {
        const machine = await machinesCollection.findOne({
          $or: [
            { _id: { $oid: screenshotConnection.machineId } },
            { _id: screenshotConnection.machineId }
          ]
        });
        
        if (machine) {
          console.log(`\n  Machine: ${machine.machineName}`);
          console.log(`  Lab ID: ${machine.labId}`);
        }
      }
    } else {
      console.log('❌ No connection found with this MAC address');
    }
    
    // Check all connections to see what types we have
    console.log('\n\n📊 Summary of all connection types...\n');
    
    const allConnections = await connectionsCollection.find({}).limit(100).toArray();
    const nodeTypes = new Set();
    const sensorTypes = new Set();
    
    allConnections.forEach(conn => {
      if (conn.nodeType) nodeTypes.add(conn.nodeType);
      if (conn.sensorType) sensorTypes.add(conn.sensorType);
    });
    
    console.log(`Node Types (${nodeTypes.size}):`);
    Array.from(nodeTypes).sort().forEach(t => console.log(`  - ${t}`));
    
    console.log(`\nSensor Types (${sensorTypes.size}):`);
    Array.from(sensorTypes).sort().forEach(t => console.log(`  - ${t}`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkModbusConnections();

