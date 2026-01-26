const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const machineId = '6958155ea4f09743147b22ab'; // CNC Machine A
const macAddress = '10:06:1C:86:F9:54'; // CNC Machine A MAC

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkCNCVibration() {
  console.log(`🔍 Checking vibration data for CNC Machine A...\n`);
  console.log(`Machine ID: ${machineId}`);
  console.log(`MAC Address: ${macAddress}\n`);
  
  // Check wisermachines-test bucket for vibration data
  console.log('📊 Checking wisermachines-test bucket for vibration data...\n');
  
  // Check by machineId
  const machineIdQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -30d)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
      |> group(columns: ["_field"])
      |> keep(columns: ["_measurement", "_field", "_time", "_value"])
      |> sort(columns: ["_field", "_time"], desc: true)
      |> limit(n: 100)
  `;
  
  const vibrationFields = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(machineIdQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const field = record._field;
        if (!vibrationFields.has(field)) {
          vibrationFields.set(field, {
            field: field,
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
  
  if (vibrationFields.size > 0) {
    console.log(`✅ Found ${vibrationFields.size} vibration field(s) with machineId:\n`);
    for (const [field, data] of vibrationFields.entries()) {
      console.log(`  • ${field}`);
      console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
    }
  } else {
    console.log(`❌ No vibration data found with machineId ${machineId}\n`);
  }
  
  // Check by MAC address
  console.log('\n📊 Checking by MAC address...\n');
  
  const macQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -30d)
      |> filter(fn: (r) => r["_measurement"] == "Vibration")
      |> filter(fn: (r) => exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${macAddress}")
      |> group(columns: ["_field"])
      |> keep(columns: ["_measurement", "_field", "_time", "_value"])
      |> sort(columns: ["_field", "_time"], desc: true)
      |> limit(n: 100)
  `;
  
  const macVibrationFields = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(macQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const field = record._field;
        if (!macVibrationFields.has(field)) {
          macVibrationFields.set(field, {
            field: field,
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
  
  if (macVibrationFields.size > 0) {
    console.log(`✅ Found ${macVibrationFields.size} vibration field(s) with MAC:\n`);
    for (const [field, data] of macVibrationFields.entries()) {
      console.log(`  • ${field}`);
      console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
    }
  } else {
    console.log(`❌ No vibration data found with MAC ${macAddress}\n`);
  }
  
  // Summary
  console.log('\n📋 Summary:\n');
  if (vibrationFields.size > 0 || macVibrationFields.size > 0) {
    console.log('✅ CNC Machine A HAS vibration data in wisermachines-test bucket');
    console.log(`   Found ${Math.max(vibrationFields.size, macVibrationFields.size)} unique field(s)`);
  } else {
    console.log('❌ CNC Machine A does NOT have vibration data in wisermachines-test bucket');
    console.log('   (But it does have Modbus data: Pressure, Density, Temperature, Flow, etc.)');
  }
}

checkCNCVibration().catch(console.error);

