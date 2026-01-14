const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkAllMeasurements() {
  console.log(`🔍 Checking all measurements and their fields...\n`);
  
  const measurements = ['AcrylData', 'Ambient', 'CT', 'Thermister', 'Vibration'];
  
  for (const measurement of measurements) {
    console.log(`\n📊 Measurement: ${measurement}`);
    console.log('─'.repeat(50));
    
    const fieldsQuery = `
      from(bucket: "wisermachines-test")
        |> range(start: -7d)
        |> filter(fn: (r) => r["_measurement"] == "${measurement}")
        |> group(columns: ["_field"])
        |> keep(columns: ["_measurement", "_field", "_time", "_value", "machineId", "machineID", "MAC_ADDRESS"])
        |> sort(columns: ["_field", "_time"], desc: true)
        |> limit(n: 500)
    `;
    
    const fields = new Map();
    
    await new Promise((resolve) => {
      queryApi.queryRows(fieldsQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const field = record._field;
          if (!fields.has(field)) {
            fields.set(field, {
              field: field,
              latestTime: record._time,
              sampleValue: record._value,
              machineId: record.machineId || record.machineID,
              macAddress: record.MAC_ADDRESS
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
    
    console.log(`  Found ${fields.size} field(s):\n`);
    for (const [field, data] of fields.entries()) {
      console.log(`    • ${field}`);
      console.log(`      Latest: ${data.latestTime}`);
      console.log(`      Sample Value: ${data.sampleValue}`);
      if (data.machineId) console.log(`      Machine ID: ${data.machineId}`);
      if (data.macAddress) console.log(`      MAC: ${data.macAddress}`);
      console.log('');
    }
  }
  
  // Specifically check AcrylData for pressure, flow, density
  console.log('\n\n🔍 Detailed check of AcrylData (likely contains pressure/flow/density)...\n');
  
  const acrylQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -7d)
      |> filter(fn: (r) => r["_measurement"] == "AcrylData")
      |> keep(columns: ["_measurement", "_field", "_time", "_value", "machineId", "machineID", "MAC_ADDRESS"])
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 50)
  `;
  
  console.log('Sample data points from AcrylData:\n');
  let count = 0;
  await new Promise((resolve) => {
    queryApi.queryRows(acrylQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        if (count < 10) {
          console.log(`  Field: ${record._field}, Value: ${record._value}, Time: ${record._time}`);
          if (record.machineId) console.log(`    Machine ID: ${record.machineId}`);
          if (record.machineID) console.log(`    Machine ID (alt): ${record.machineID}`);
          if (record.MAC_ADDRESS) console.log(`    MAC: ${record.MAC_ADDRESS}`);
          console.log('');
          count++;
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
}

checkAllMeasurements().catch(console.error);

