const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';
const VIBRATION_BUCKET = 'wisermachines-test';

const macAddress = '2C:BC:BB:06:7D:6C'; // ADT210+ MAC
const machineId = '69369c3c2e35591ba5135455'; // ADT210+ machineId

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkADT210ByMAC() {
  console.log(`=== Checking InfluxDB for ADT210+ by MAC: ${macAddress} ===\n`);
  
  // 1. Check data by MAC address
  console.log('1. Checking data by MAC address...');
  const macQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -30d)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> filter(fn: (r) => exists r.mac and r.mac == "${macAddress}")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 10)
  `;
  
  const macRecords = [];
  await new Promise((resolve) => {
    queryApi.queryRows(macQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        macRecords.push(record);
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
  
  console.log(`Found ${macRecords.length} records by MAC address`);
  if (macRecords.length > 0) {
    console.log('\nLatest records by MAC:');
    macRecords.slice(0, 5).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r._time}: ${r._field} = ${r._value} (machineId: ${r.machineId || 'N/A'})`);
    });
    
    // Check what machineId is associated with this MAC
    const machineIds = new Set(macRecords.map(r => r.machineId).filter(Boolean));
    console.log(`\nMachineIds associated with this MAC: ${Array.from(machineIds).join(', ') || 'None'}`);
  } else {
    console.log('❌ No data found by MAC address');
  }
  
  // 2. Check data by machineId
  console.log(`\n2. Checking data by machineId: ${machineId}...`);
  const machineIdQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -30d)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 10)
  `;
  
  const machineIdRecords = [];
  await new Promise((resolve) => {
    queryApi.queryRows(machineIdQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        machineIdRecords.push(record);
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
  
  console.log(`Found ${machineIdRecords.length} records by machineId`);
  if (machineIdRecords.length > 0) {
    console.log('\nLatest records by machineId:');
    machineIdRecords.slice(0, 5).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r._time}: ${r._field} = ${r._value} (mac: ${r.mac || 'N/A'})`);
    });
  } else {
    console.log('❌ No data found by machineId');
  }
  
  // 3. Check all fields available for this MAC
  if (macRecords.length > 0) {
    console.log(`\n3. Available fields for MAC ${macAddress}:`);
    const fields = new Set(macRecords.map(r => r._field));
    fields.forEach(field => {
      const fieldRecords = macRecords.filter(r => r._field === field);
      const nonZero = fieldRecords.filter(r => r._value !== 0);
      console.log(`  ${field}: ${fieldRecords.length} records, ${nonZero.length} non-zero`);
      if (nonZero.length > 0) {
        console.log(`    Sample values: ${nonZero.slice(0, 3).map(r => r._value).join(', ')}`);
      }
    });
  }
  
  // 4. Check data frequency
  if (macRecords.length > 0) {
    console.log(`\n4. Data frequency (last 24 hours)...`);
    const frequencyQuery = `
      from(bucket: "${VIBRATION_BUCKET}")
        |> range(start: -24h)
        |> filter(fn: (r) => r["_measurement"] == "Vibration")
        |> filter(fn: (r) => exists r.mac and r.mac == "${macAddress}")
        |> group()
        |> count()
    `;
    
    let count = 0;
    await new Promise((resolve) => {
      queryApi.queryRows(frequencyQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          count = record._value || 0;
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
    
    console.log(`   Total data points in last 24h: ${count}`);
    if (count > 0) {
      const avgPerHour = (count / 24).toFixed(2);
      console.log(`   Average: ~${avgPerHour} points per hour`);
    }
  }
  
  // 5. Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`MAC Address: ${macAddress}`);
  console.log(`MachineId: ${machineId}`);
  console.log(`Data by MAC: ${macRecords.length > 0 ? '✅ YES' : '❌ NO'}`);
  console.log(`Data by machineId: ${machineIdRecords.length > 0 ? '✅ YES' : '❌ NO'}`);
  
  if (macRecords.length > 0 && machineIdRecords.length === 0) {
    console.log(`\n⚠️  ISSUE: Data is coming in by MAC address but NOT by machineId!`);
    console.log(`   The data writer might not be setting the machineId tag correctly.`);
  }
}

checkADT210ByMAC().catch(console.error);

