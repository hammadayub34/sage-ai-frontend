const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const macAddress = '10:06:1C:86:F9:54';
const machineID = '12345';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkExactMatch() {
  console.log(`🔍 Checking for exact match from screenshot...\n`);
  console.log(`MAC Address: ${macAddress}`);
  console.log(`Machine ID: ${machineID}\n`);
  
  // Check all buckets
  const buckets = ['wisermachines-test', 'cnc_machine_data', 'plc_data_new'];
  
  for (const bucket of buckets) {
    console.log(`\n📊 Checking bucket: ${bucket}`);
    console.log('─'.repeat(60));
    
    // Search by MAC_ADDRESS
    const macQuery = `
      from(bucket: "${bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${macAddress}")
        |> keep(columns: ["_measurement", "_field", "_time", "_value", "MAC_ADDRESS", "machineID", "machineId"])
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 100)
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
          // Silently continue if bucket doesn't exist or has no data
          resolve();
        },
        complete() {
          resolve();
        }
      });
    });
    
    if (macData.size > 0) {
      console.log(`  ✅ Found ${macData.size} unique fields with MAC ${macAddress}:`);
      for (const [key, data] of macData.entries()) {
        console.log(`    • ${data.measurement} -> ${data.field}`);
        console.log(`      Value: ${data.sampleValue}, Time: ${data.latestTime}`);
        if (data.machineID) console.log(`      Machine ID: ${data.machineID}`);
      }
    } else {
      console.log(`  ❌ No data found with MAC ${macAddress}`);
    }
    
    // Search by machineID
    const machineQuery = `
      from(bucket: "${bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => 
          (exists r.machineID and r.machineID == "${machineID}") or
          (exists r.machineId and r.machineId == "${machineID}")
        )
        |> keep(columns: ["_measurement", "_field", "_time", "_value", "MAC_ADDRESS", "machineID", "machineId"])
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 100)
    `;
    
    const machineData = new Map();
    
    await new Promise((resolve) => {
      queryApi.queryRows(machineQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const key = `${record._measurement}::${record._field}`;
          if (!machineData.has(key)) {
            machineData.set(key, {
              measurement: record._measurement,
              field: record._field,
              latestTime: record._time,
              sampleValue: record._value,
              machineID: record.machineID || record.machineId,
              macAddress: record.MAC_ADDRESS
            });
          }
        },
        error(err) {
          resolve();
        },
        complete() {
          resolve();
        }
      });
    });
    
    if (machineData.size > 0) {
      console.log(`\n  ✅ Found ${machineData.size} unique fields with Machine ID ${machineID}:`);
      for (const [key, data] of machineData.entries()) {
        console.log(`    • ${data.measurement} -> ${data.field}`);
        console.log(`      Value: ${data.sampleValue}, Time: ${data.latestTime}`);
        if (data.macAddress) console.log(`      MAC: ${data.macAddress}`);
      }
    } else {
      console.log(`\n  ❌ No data found with Machine ID ${machineID}`);
    }
    
    // Search for fields matching screenshot names
    console.log(`\n  🔎 Searching for fields matching screenshot...`);
    const fieldNames = ['Pressure', 'pressure', 'Diff Pressure', 'diff_pressure', 'Flow', 'flow', 'Density', 'density', 'Temperature', 'temperature'];
    
    for (const fieldName of fieldNames) {
      const fieldQuery = `
        from(bucket: "${bucket}")
          |> range(start: -30d)
          |> filter(fn: (r) => r._field == "${fieldName}")
          |> keep(columns: ["_measurement", "_field", "_time", "_value", "MAC_ADDRESS", "machineID", "machineId"])
          |> sort(columns: ["_time"], desc: true)
          |> limit(n: 5)
      `;
      
      let found = false;
      await new Promise((resolve) => {
        queryApi.queryRows(fieldQuery, {
          next(row, tableMeta) {
            const record = tableMeta.toObject(row);
            if (!found) {
              console.log(`    ✅ Found "${fieldName}": ${record._measurement}, Value: ${record._value}, Time: ${record._time}`);
              if (record.MAC_ADDRESS) console.log(`       MAC: ${record.MAC_ADDRESS}`);
              if (record.machineID || record.machineId) console.log(`       Machine ID: ${record.machineID || record.machineId}`);
              found = true;
            }
          },
          error() {
            resolve();
          },
          complete() {
            resolve();
          }
        });
      });
    }
  }
}

checkExactMatch().catch(console.error);

