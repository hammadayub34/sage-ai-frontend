const { MongoClient, ObjectId } = require('mongodb');
const { InfluxDB } = require('@influxdata/influxdb-client');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const screenshotMAC = '10:06:1C:86:F9:54';
const screenshotMachineID = '12345';

async function checkScreenshotMachine() {
  const client = new MongoClient(uri);
  const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
  const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    const connectionsCollection = db.collection('connections');
    const machinesCollection = db.collection('machines');
    const labsCollection = db.collection('labs');
    
    // Find connection with screenshot MAC
    console.log(`🔍 Checking connection with MAC ${screenshotMAC}...\n`);
    
    const connection = await connectionsCollection.findOne({
      mac: screenshotMAC
    });
    
    if (connection) {
      console.log('✅ Found connection:');
      console.log(`  MAC: ${connection.mac}`);
      console.log(`  Node Type: ${connection.nodeType || 'N/A'}`);
      console.log(`  Sensor Type: ${connection.sensorType || 'N/A'}`);
      console.log(`  Machine ID: ${connection.machineId || 'N/A'}\n`);
      
      if (connection.machineId) {
        const machine = await machinesCollection.findOne({
          _id: new ObjectId(connection.machineId)
        });
        
        if (machine) {
          console.log('📊 Machine Details:');
          console.log(`  Name: ${machine.machineName}`);
          console.log(`  Lab ID: ${machine.labId}`);
          console.log(`  Status: ${machine.status || 'N/A'}\n`);
          
          if (machine.labId) {
            const lab = await labsCollection.findOne({
              _id: new ObjectId(machine.labId)
            });
            
            if (lab) {
              console.log('🏢 Lab Details:');
              console.log(`  Name: ${lab.name}`);
              console.log(`  Description: ${lab.description || 'N/A'}\n`);
            }
          }
        }
      }
    } else {
      console.log('❌ No connection found\n');
    }
    
    // Check InfluxDB for data with this MAC or machine ID
    console.log('🔍 Checking InfluxDB for data...\n');
    
    const machineIdFromMongo = connection?.machineId;
    
    // Check by MAC address
    console.log('📊 Searching by MAC address...\n');
    const macQuery = `
      from(bucket: "wisermachines-test")
        |> range(start: -7d)
        |> filter(fn: (r) => exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${screenshotMAC}")
        |> group(columns: ["_measurement", "_field"])
        |> keep(columns: ["_measurement", "_field", "_time", "_value", "MAC_ADDRESS", "machineID", "machineId"])
        |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
        |> limit(n: 200)
    `;
    
    const macData = new Map();
    
    await new Promise((resolve) => {
      queryApi.queryRows(macQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const key = `${record._measurement}::${record._field}`;
          if (!macData.has(key)) {
            macData.set(key, {
              measurement: record._measurement,
              field: record._field,
              latestTime: record._time,
              sampleValue: record._value,
              machineID: record.machineID || record.machineId
            });
          }
        },
        error(err) {
          console.log(`  ⚠️  Error: ${err.message}`);
          resolve();
        },
        complete() {
          resolve();
        }
      });
    });
    
    if (macData.size > 0) {
      console.log(`✅ Found ${macData.size} unique fields with MAC ${screenshotMAC}:\n`);
      for (const [key, data] of macData.entries()) {
        console.log(`  • ${data.measurement} -> ${data.field}`);
        console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
        if (data.machineID) console.log(`    Machine ID: ${data.machineID}`);
      }
    } else {
      console.log(`❌ No data found with MAC ${screenshotMAC}\n`);
    }
    
    // Check by machine ID from MongoDB
    if (machineIdFromMongo) {
      console.log(`\n📊 Searching by Machine ID from MongoDB (${machineIdFromMongo})...\n`);
      
      const mongoMachineQuery = `
        from(bucket: "wisermachines-test")
          |> range(start: -7d)
          |> filter(fn: (r) => 
            (exists r.machineId and r.machineId == "${machineIdFromMongo}") or
            (exists r.machineID and r.machineID == "${machineIdFromMongo}")
          )
          |> group(columns: ["_measurement", "_field"])
          |> keep(columns: ["_measurement", "_field", "_time", "_value"])
          |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
          |> limit(n: 200)
      `;
      
      const mongoMachineData = new Map();
      
      await new Promise((resolve) => {
        queryApi.queryRows(mongoMachineQuery, {
          next(row, tableMeta) {
            const record = tableMeta.toObject(row);
            const key = `${record._measurement}::${record._field}`;
            if (!mongoMachineData.has(key)) {
              mongoMachineData.set(key, {
                measurement: record._measurement,
                field: record._field,
                latestTime: record._time,
                sampleValue: record._value
              });
            }
          },
          error(err) {
            console.log(`  ⚠️  Error: ${err.message}`);
            resolve();
          },
          complete() {
            resolve();
          }
        });
      });
      
      if (mongoMachineData.size > 0) {
        console.log(`✅ Found ${mongoMachineData.size} unique fields:\n`);
        for (const [key, data] of mongoMachineData.entries()) {
          console.log(`  • ${data.measurement} -> ${data.field}`);
          console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
        }
      } else {
        console.log(`❌ No data found with Machine ID ${machineIdFromMongo}\n`);
      }
    }
    
    // Check for screenshot machineID "12345"
    console.log(`\n📊 Searching for machineID "12345" from screenshot...\n`);
    
    const screenshotIDQuery = `
      from(bucket: "wisermachines-test")
        |> range(start: -30d)
        |> filter(fn: (r) => 
          (exists r.machineID and r.machineID == "${screenshotMachineID}") or
          (exists r.machineId and r.machineId == "${screenshotMachineID}")
        )
        |> group(columns: ["_measurement", "_field"])
        |> keep(columns: ["_measurement", "_field", "_time", "_value", "MAC_ADDRESS", "machineID", "machineId"])
        |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
        |> limit(n: 200)
    `;
    
    const screenshotIDData = new Map();
    
    await new Promise((resolve) => {
      queryApi.queryRows(screenshotIDQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const key = `${record._measurement}::${record._field}`;
          if (!screenshotIDData.has(key)) {
            screenshotIDData.set(key, {
              measurement: record._measurement,
              field: record._field,
              latestTime: record._time,
              sampleValue: record._value,
              macAddress: record.MAC_ADDRESS,
              machineID: record.machineID || record.machineId
            });
          }
        },
        error(err) {
          console.log(`  ⚠️  Error: ${err.message}`);
          resolve();
        },
        complete() {
          resolve();
        }
      });
    });
    
    if (screenshotIDData.size > 0) {
      console.log(`✅ Found ${screenshotIDData.size} unique fields with machineID "12345":\n`);
      for (const [key, data] of screenshotIDData.entries()) {
        console.log(`  • ${data.measurement} -> ${data.field}`);
        console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
        if (data.macAddress) console.log(`    MAC: ${data.macAddress}`);
      }
    } else {
      console.log(`❌ No data found with machineID "12345"\n`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkScreenshotMachine().catch(console.error);

