const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

async function checkMaheenTextiles() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const labsCollection = db.collection('labs');
    const machinesCollection = db.collection('machines');
    
    // Find maheen textiles lab
    const labs = await labsCollection.find({
      name: { $regex: /maheen/i }
    }).toArray();
    
    console.log(`📋 Found ${labs.length} lab(s) matching "maheen":\n`);
    
    for (const lab of labs) {
      console.log(`Lab: ${lab.name}`);
      console.log(`  ID: ${lab._id}`);
      console.log(`  Description: ${lab.description || 'N/A'}`);
      console.log(`  User IDs: ${JSON.stringify(lab.user_id || [])}\n`);
      
      // Find machines in this lab
      const machines = await machinesCollection.find({
        $or: [
          { labId: lab._id.toString() },
          { labId: lab._id }
        ]
      }).toArray();
      
      console.log(`  Machines: ${machines.length}`);
      machines.forEach(m => {
        console.log(`    - ${m.machineName} (ID: ${m._id})`);
        console.log(`      Status: ${m.status}`);
        console.log(`      Description: ${m.description || 'N/A'}`);
      });
      console.log('');
    }
    
    // Check InfluxDB for data from these machines
    if (labs.length > 0) {
      console.log('🔍 Checking InfluxDB for machine data...\n');
      const { InfluxDB } = require('@influxdata/influxdb-client');
      
      const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
      const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
      const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';
      
      const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
      const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);
      
      for (const lab of labs) {
        const machines = await machinesCollection.find({
          $or: [
            { labId: lab._id.toString() },
            { labId: lab._id }
          ]
        }).toArray();
        
        for (const machine of machines) {
          const machineId = machine._id.toString();
          console.log(`Checking machine: ${machine.machineName} (${machineId})`);
          
          // Check for vibration data
          const vibrationQuery = `
            from(bucket: "wisermachines-test")
              |> range(start: -30d)
              |> filter(fn: (r) => r["_measurement"] == "Vibration")
              |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
              |> limit(n: 1)
          `;
          
          let hasData = false;
          await new Promise((resolve) => {
            queryApi.queryRows(vibrationQuery, {
              next() {
                hasData = true;
              },
              error(err) {
                console.log(`    ⚠️  Query error: ${err.message}`);
                resolve();
              },
              complete() {
                if (hasData) {
                  console.log(`    ✅ Has vibration data in InfluxDB`);
                } else {
                  console.log(`    ❌ No vibration data found`);
                }
                resolve();
              }
            });
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkMaheenTextiles();

