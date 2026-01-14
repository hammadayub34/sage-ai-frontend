const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'wisermachines';
const VIBRATION_BUCKET = 'wisermachines-test';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function testInfluxDB() {
  console.log('=== Testing InfluxDB Vibration Data ===\n');
  
  // First, check what machineIds exist in the Vibration measurement
  const findMachineIdsQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> filter(fn: (r) => exists r.machineId)
      |> group(columns: ["machineId"])
      |> distinct(column: "machineId")
      |> sort(columns: ["machineId"])
      |> limit(n: 20)
  `;
  
  console.log('1. Finding machineIds in InfluxDB...');
  const machineIds = new Set();
  
  await new Promise((resolve) => {
    queryApi.queryRows(findMachineIdsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const machineId = record.machineId || record._value;
        if (machineId) {
          machineIds.add(machineId);
        }
      },
      error(error) {
        console.error('Error:', error);
        resolve();
      },
      complete() {
        resolve();
      },
    });
  });
  
  console.log(`Found ${machineIds.size} unique machineIds:`);
  Array.from(machineIds).forEach(id => console.log(`  - ${id}`));
  
  if (machineIds.size === 0) {
    console.log('\n⚠️  No machineIds found. Checking if there\'s any Vibration data at all...');
    
    const checkDataQuery = `
      from(bucket: "${VIBRATION_BUCKET}")
        |> range(start: -24h)
        |> filter(fn: (r) => r["_measurement"] == "Vibration")
        |> limit(n: 5)
    `;
    
    const sampleRecords = [];
    await new Promise((resolve) => {
      queryApi.queryRows(checkDataQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          sampleRecords.push(record);
        },
        error(error) {
          console.error('Error:', error);
          resolve();
        },
        complete() {
          resolve();
        },
      });
    });
    
    if (sampleRecords.length > 0) {
      console.log(`\nFound ${sampleRecords.length} sample records (showing first 3):`);
      sampleRecords.slice(0, 3).forEach((r, idx) => {
        console.log(`\nRecord ${idx + 1}:`);
        console.log(`  _time: ${r._time}`);
        console.log(`  _value: ${r._value} (type: ${typeof r._value})`);
        console.log(`  _field: ${r._field}`);
        console.log(`  _measurement: ${r._measurement}`);
        console.log(`  All tags:`, Object.keys(r).filter(k => !k.startsWith('_')).reduce((acc, k) => {
          acc[k] = r[k];
          return acc;
        }, {}));
      });
    } else {
      console.log('No Vibration data found in the last 24 hours.');
    }
    return;
  }
  
  // Test with first machineId found
  const testMachineId = Array.from(machineIds)[0];
  console.log(`\n2. Testing with machineId: ${testMachineId}`);
  
  // Check all available fields for this machine
  console.log('\n2a. Checking available fields...');
  const fieldsQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${testMachineId}")
      |> group(columns: ["_field"])
      |> distinct(column: "_field")
  `;
  
  const fields = new Set();
  await new Promise((resolve) => {
    queryApi.queryRows(fieldsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        fields.add(record._field || record._value);
      },
      error(error) {
        console.error('Error:', error);
        resolve();
      },
      complete() {
        resolve();
      },
    });
  });
  
  console.log(`Available fields: ${Array.from(fields).join(', ')}`);
  
  // Check for non-zero values across all fields
  console.log('\n2b. Checking for non-zero values in all fields...');
  const nonZeroQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -7d)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${testMachineId}")
      |> filter(fn: (r) => r._value != 0)
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 10)
  `;
  
  const nonZeroResults = [];
  await new Promise((resolve) => {
    queryApi.queryRows(nonZeroQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        nonZeroResults.push(record);
      },
      error(error) {
        console.error('Error:', error);
        resolve();
      },
      complete() {
        resolve();
      },
    });
  });
  
  if (nonZeroResults.length > 0) {
    console.log(`Found ${nonZeroResults.length} non-zero records:`);
    nonZeroResults.slice(0, 5).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r._field}: ${r._value} at ${r._time}`);
    });
  } else {
    console.log('⚠️  No non-zero values found in the last 7 days');
  }
  
  // Check x_vibration and y_vibration fields specifically
  console.log('\n2c. Checking x_vibration and y_vibration fields...');
  const vibrationFieldsQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${testMachineId}")
      |> filter(fn: (r) => r["_field"] == "x_vibration" or r["_field"] == "y_vibration" or r["_field"] == "vibration")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 20)
  `;
  
  const vibrationResults = [];
  await new Promise((resolve) => {
    queryApi.queryRows(vibrationFieldsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        vibrationResults.push(record);
      },
      error(error) {
        console.error('Error:', error);
        resolve();
      },
      complete() {
        resolve();
      },
    });
  });
  
  console.log(`Found ${vibrationResults.length} records:\n`);
  vibrationResults.slice(0, 15).forEach((r, idx) => {
    console.log(`Record ${idx + 1}:`);
    console.log(`  _time: ${r._time}`);
    console.log(`  _field: ${r._field}`);
    console.log(`  _value: ${r._value} (type: ${typeof r._value}, string: "${String(r._value)}")`);
    console.log(`  machineId: ${r.machineId}`);
    console.log('');
  });
  
  // Group by field to see value ranges
  const byField = {};
  vibrationResults.forEach(r => {
    const field = r._field;
    if (!byField[field]) {
      byField[field] = [];
    }
    byField[field].push(r._value);
  });
  
  console.log('\nValue statistics by field:');
  Object.keys(byField).forEach(field => {
    const values = byField[field];
    const nonZero = values.filter(v => v !== 0);
    console.log(`  ${field}:`);
    console.log(`    Total: ${values.length}, Non-zero: ${nonZero.length}`);
    if (nonZero.length > 0) {
      console.log(`    Min: ${Math.min(...nonZero)}, Max: ${Math.max(...nonZero)}, Avg: ${(nonZero.reduce((a, b) => a + b, 0) / nonZero.length).toFixed(4)}`);
    }
  });
}

testInfluxDB().catch(console.error);

