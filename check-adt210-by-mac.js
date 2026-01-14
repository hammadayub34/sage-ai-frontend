const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';
const VIBRATION_BUCKET = 'wisermachines-test';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkByAllIdentifiers() {
  console.log('=== Checking InfluxDB for ADT210+ data by different identifiers ===\n');
  
  // 1. Check what machineIds actually exist in the last 30 days
  console.log('1. All machineIds in InfluxDB (last 30 days):');
  const allMachineIdsQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -30d)
      |> filter(fn: (r) => exists r.machineId)
      |> group(columns: ["machineId"])
      |> distinct(column: "machineId")
      |> sort(columns: ["machineId"])
  `;
  
  const machineIds = [];
  await new Promise((resolve) => {
    queryApi.queryRows(allMachineIdsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const id = record.machineId || record._value;
        if (id) machineIds.push(id);
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
  
  console.log(`Found ${machineIds.length} machineIds:`);
  machineIds.forEach((id, idx) => {
    console.log(`  ${idx + 1}. ${id}`);
  });
  
  // 2. Check if ADT210+ machineId exists (maybe with different format)
  const targetId = '69369c3c2e35591ba5135455';
  const found = machineIds.find(id => id === targetId || id.includes('69369c3c'));
  console.log(`\n2. Looking for ADT210+ (${targetId}): ${found ? '✅ Found' : '❌ Not found'}`);
  
  // 3. Check all tags/fields to see what identifiers are used
  console.log('\n3. Checking what tags exist in Vibration measurement...');
  const tagsQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -7d)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> limit(n: 10)
  `;
  
  const sampleRecords = [];
  await new Promise((resolve) => {
    queryApi.queryRows(tagsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        if (sampleRecords.length < 3) {
          sampleRecords.push(record);
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
  
  if (sampleRecords.length > 0) {
    console.log('Sample record structure:');
    const sample = sampleRecords[0];
    Object.keys(sample).forEach(key => {
      if (!key.startsWith('_')) {
        console.log(`  ${key}: ${sample[key]}`);
      }
    });
    console.log('\nAll fields in sample:');
    Object.keys(sample).forEach(key => {
      console.log(`  ${key}: ${sample[key]} (${typeof sample[key]})`);
    });
  }
  
  // 4. Check if there's data by MAC address or other identifier
  console.log('\n4. Checking for any data in the last 24 hours (any identifier)...');
  const anyDataQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 5)
  `;
  
  const recentRecords = [];
  await new Promise((resolve) => {
    queryApi.queryRows(anyDataQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        recentRecords.push(record);
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
  
  if (recentRecords.length > 0) {
    console.log(`Found ${recentRecords.length} recent records. Sample:`);
    recentRecords.slice(0, 2).forEach((r, idx) => {
      console.log(`\nRecord ${idx + 1}:`);
      console.log(`  _time: ${r._time}`);
      console.log(`  _field: ${r._field}`);
      console.log(`  _value: ${r._value}`);
      console.log(`  machineId: ${r.machineId || 'N/A'}`);
      // Show all tags
      Object.keys(r).forEach(key => {
        if (!key.startsWith('_') && key !== 'result' && key !== 'table') {
          console.log(`  ${key}: ${r[key]}`);
        }
      });
    });
  } else {
    console.log('No recent data found in last 24 hours');
  }
}

checkByAllIdentifiers().catch(console.error);

