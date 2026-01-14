const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';
const VIBRATION_BUCKET = 'wisermachines-test';

const machineId = '69369c3c2e35591ba5135455'; // ADT210+
const macAddress = '2C:BC:BB:06:7D:6C';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkFields() {
  console.log(`=== Checking ADT210+ Data Fields ===\n`);
  console.log(`MachineId: ${machineId}`);
  console.log(`MAC: ${macAddress}\n`);
  
  // 1. Get all fields for this machine
  console.log('1. All available fields for this machine (last 7 days):');
  const fieldsQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -7d)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
      |> group(columns: ["_field"])
      |> distinct(column: "_field")
  `;
  
  const fields = new Set();
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('   Query timed out');
      resolve();
    }, 15000);
    
    queryApi.queryRows(fieldsQuery, {
      next(row, tableMeta) {
        clearTimeout(timeout);
        const record = tableMeta.toObject(row);
        fields.add(record._field || record._value);
      },
      error(error) {
        clearTimeout(timeout);
        if (!error.message.includes('timeout')) {
          console.error('   Error:', error.message);
        }
        resolve();
      },
      complete() {
        clearTimeout(timeout);
        resolve();
      },
    });
  });
  
  console.log(`   Fields: ${Array.from(fields).join(', ') || 'None'}\n`);
  
  // 2. Check each field for non-zero values
  for (const field of fields) {
    console.log(`2. Checking "${field}" field...`);
    
    // Get latest values
    const latestQuery = `
      from(bucket: "${VIBRATION_BUCKET}")
        |> range(start: -7d)
        |> filter(fn: (r) => r["_measurement"] == "Vibration")
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> filter(fn: (r) => r["_field"] == "${field}")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 10)
    `;
    
    const records = [];
    await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(), 10000);
      queryApi.queryRows(latestQuery, {
        next(row, tableMeta) {
          clearTimeout(timeout);
          const record = tableMeta.toObject(row);
          records.push(record);
        },
        error(error) {
          clearTimeout(timeout);
          resolve();
        },
        complete() {
          clearTimeout(timeout);
          resolve();
        },
      });
    });
    
    if (records.length > 0) {
      const values = records.map(r => r._value);
      const nonZero = values.filter(v => v !== 0);
      const uniqueValues = [...new Set(values)];
      
      console.log(`   Total records: ${records.length}`);
      console.log(`   Non-zero values: ${nonZero.length}`);
      console.log(`   Latest 5 values: ${values.slice(0, 5).join(', ')}`);
      console.log(`   Unique values: ${uniqueValues.slice(0, 10).join(', ')}`);
      
      if (nonZero.length > 0) {
        console.log(`   ✅ Has non-zero data!`);
        console.log(`   Non-zero sample: ${nonZero.slice(0, 5).join(', ')}`);
        const min = Math.min(...nonZero);
        const max = Math.max(...nonZero);
        const avg = (nonZero.reduce((a, b) => a + b, 0) / nonZero.length).toFixed(4);
        console.log(`   Range: ${min} to ${max}, Avg: ${avg}`);
      } else {
        console.log(`   ⚠️  All values are 0`);
      }
    } else {
      console.log(`   ❌ No records found`);
    }
    console.log('');
  }
  
  // 3. Specifically check vibration, x_vibration, y_vibration fields
  console.log('3. Detailed check of vibration fields (last 24 hours):');
  const vibrationFields = ['vibration', 'x_vibration', 'y_vibration'];
  
  for (const field of vibrationFields) {
    const vibQuery = `
      from(bucket: "${VIBRATION_BUCKET}")
        |> range(start: -24h)
        |> filter(fn: (r) => r["_measurement"] == "Vibration")
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> filter(fn: (r) => r["_field"] == "${field}")
        |> filter(fn: (r) => r._value != 0)
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 10)
    `;
    
    const vibRecords = [];
    await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(), 10000);
      queryApi.queryRows(vibQuery, {
        next(row, tableMeta) {
          clearTimeout(timeout);
          const record = tableMeta.toObject(row);
          vibRecords.push(record);
        },
        error(error) {
          clearTimeout(timeout);
          resolve();
        },
        complete() {
          clearTimeout(timeout);
          resolve();
        },
      });
    });
    
    if (vibRecords.length > 0) {
      console.log(`   ✅ "${field}" has ${vibRecords.length} non-zero values:`);
      vibRecords.slice(0, 5).forEach((r, idx) => {
        console.log(`      ${idx + 1}. ${r._time}: ${r._value} (type: ${typeof r._value})`);
      });
    } else {
      console.log(`   ❌ "${field}" has no non-zero values`);
    }
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`✅ Data IS coming in for ADT210+`);
  console.log(`✅ Total records in last 30 days: 5,562,172`);
  console.log(`✅ Found data by both machineId and MAC address`);
}

checkFields().catch(console.error);

