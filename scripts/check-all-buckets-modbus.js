const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const screenshotMAC = '10:06:1C:86:F9:54';
const screenshotMachineID = '12345';
const mongoMachineID = '6958155ea4f09743147b22ab';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkAllBuckets() {
  console.log(`🔍 Checking all buckets for Modbus/screenshot data...\n`);
  
  // First, list all available buckets
  console.log('📋 Fetching available buckets...\n');
  
  try {
    const response = await fetch(`${INFLUXDB_URL}/api/v2/buckets?org=${INFLUXDB_ORG}`, {
      headers: {
        'Authorization': `Token ${INFLUXDB_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const buckets = await response.json();
      console.log(`Found ${buckets.buckets?.length || 0} bucket(s):\n`);
      buckets.buckets?.forEach(bucket => {
        console.log(`  • ${bucket.name} (ID: ${bucket.id})`);
      });
      console.log('');
    } else {
      console.log('⚠️  Could not fetch bucket list\n');
    }
  } catch (error) {
    console.log(`⚠️  Error fetching buckets: ${error.message}\n`);
  }
  
  // Check all known buckets
  const buckets = ['wisermachines-test', 'cnc_machine_data', 'plc_data_new', 'plc_data'];
  
  for (const bucket of buckets) {
    console.log(`\n📊 Checking bucket: ${bucket}`);
    console.log('─'.repeat(60));
    
    // Check for Pressure, Flow, Density, Temperature fields
    const fieldsQuery = `
      from(bucket: "${bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => 
          r._field == "Pressure" or
          r._field == "pressure" or
          r._field == "Flow" or
          r._field == "flow" or
          r._field == "Density" or
          r._field == "density" or
          r._field == "Temperature" or
          r._field == "temperature" or
          r._field == "Diff Pressure" or
          r._field == "diff_pressure" or
          r._field == "Instantaneous Flow" or
          r._field == "instantaneous_flow" or
          r._field == "Freq" or
          r._field == "freq" or
          r._field == "Frequency" or
          r._field == "frequency"
        )
        |> keep(columns: ["_measurement", "_field", "_time", "_value"])
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 50)
    `;
    
    const foundFields = new Map();
    
    await new Promise((resolve) => {
      queryApi.queryRows(fieldsQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const key = `${record._measurement}::${record._field}`;
          if (!foundFields.has(key)) {
            foundFields.set(key, {
              measurement: record._measurement,
              field: record._field,
              latestTime: record._time,
              sampleValue: record._value
            });
          }
        },
        error(err) {
          // Silently continue if bucket doesn't exist
          resolve();
        },
        complete() {
          resolve();
        }
      });
    });
    
    if (foundFields.size > 0) {
      console.log(`✅ Found ${foundFields.size} fields matching screenshot:\n`);
      for (const [key, data] of foundFields.entries()) {
        console.log(`  • ${data.measurement} -> ${data.field}`);
        console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
      }
    } else {
      console.log(`❌ No exact field names found`);
    }
    
    // Check for data with MAC or machine IDs
    console.log(`\n  Checking for MAC ${screenshotMAC}...`);
    const macQuery = `
      from(bucket: "${bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${screenshotMAC}")
        |> limit(n: 1)
    `;
    
    let hasMacData = false;
    await new Promise((resolve) => {
      queryApi.queryRows(macQuery, {
        next() {
          hasMacData = true;
        },
        error() {
          resolve();
        },
        complete() {
          if (hasMacData) {
            console.log(`    ✅ Found data with MAC ${screenshotMAC}`);
          } else {
            console.log(`    ❌ No data with MAC ${screenshotMAC}`);
          }
          resolve();
        }
      });
    });
    
    // Check for machineID "12345"
    console.log(`  Checking for machineID "12345"...`);
    const id12345Query = `
      from(bucket: "${bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => 
          (exists r.machineID and r.machineID == "${screenshotMachineID}") or
          (exists r.machineId and r.machineId == "${screenshotMachineID}")
        )
        |> limit(n: 1)
    `;
    
    let hasID12345 = false;
    await new Promise((resolve) => {
      queryApi.queryRows(id12345Query, {
        next() {
          hasID12345 = true;
        },
        error() {
          resolve();
        },
        complete() {
          if (hasID12345) {
            console.log(`    ✅ Found data with machineID "12345"`);
          } else {
            console.log(`    ❌ No data with machineID "12345"`);
          }
          resolve();
        }
      });
    });
    
    // Check for MongoDB machine ID
    console.log(`  Checking for MongoDB machine ID ${mongoMachineID}...`);
    const mongoIDQuery = `
      from(bucket: "${bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => 
          (exists r.machineID and r.machineID == "${mongoMachineID}") or
          (exists r.machineId and r.machineId == "${mongoMachineID}")
        )
        |> limit(n: 1)
    `;
    
    let hasMongoID = false;
    await new Promise((resolve) => {
      queryApi.queryRows(mongoIDQuery, {
        next() {
          hasMongoID = true;
        },
        error() {
          resolve();
        },
        complete() {
          if (hasMongoID) {
            console.log(`    ✅ Found data with MongoDB machine ID`);
          } else {
            console.log(`    ❌ No data with MongoDB machine ID`);
          }
          resolve();
        }
      });
    });
  }
}

checkAllBuckets().catch(console.error);

