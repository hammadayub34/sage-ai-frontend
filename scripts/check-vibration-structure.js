/**
 * Check vibration data structure in InfluxDB
 */

const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = 'wisermachines';
const BUCKET = 'wisermachines-test';

console.log('🔍 Checking Vibration Data Structure...\n');

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

// Get all unique fields for vibration measurement
const fieldsQuery = `
  from(bucket: "${BUCKET}")
    |> range(start: -7d)
    |> filter(fn: (r) => r._measurement == "Vibration")
    |> group(columns: ["_field"])
    |> distinct(column: "_field")
    |> sort(columns: ["_field"])
`;

const fields = new Set();

await new Promise((resolve) => {
  queryApi.queryRows(fieldsQuery, {
    next(row, tableMeta) {
      const record = tableMeta.toObject(row);
      if (record._field) {
        fields.add(record._field);
      }
    },
    error(error) {
      console.error('Error:', error.message);
      resolve();
    },
    complete() {
      resolve();
    },
  });
});

console.log(`📊 Found ${fields.size} vibration field(s):\n`);

// Categorize fields
const accFields = Array.from(fields).filter(f => f.includes('acc'));
const vibFields = Array.from(fields).filter(f => f.includes('vibration') && !f.includes('acc'));
const otherFields = Array.from(fields).filter(f => !f.includes('acc') && !f.includes('vibration'));

if (accFields.length > 0) {
  console.log('🔹 Acceleration Fields (g-force):');
  accFields.forEach(f => console.log(`   • ${f}`));
  console.log();
}

if (vibFields.length > 0) {
  console.log('🔹 Vibration Fields (mm/s or counts):');
  vibFields.forEach(f => console.log(`   • ${f}`));
  console.log();
}

if (otherFields.length > 0) {
  console.log('🔹 Other Fields:');
  otherFields.forEach(f => console.log(`   • ${f}`));
  console.log();
}

// Get sample data for one machine
const sampleQuery = `
  from(bucket: "${BUCKET}")
    |> range(start: -1d)
    |> filter(fn: (r) => r._measurement == "Vibration" and exists r.machineId)
    |> filter(fn: (r) => r._field == "x_acc" or r._field == "y_acc" or r._field == "z_acc" or r._field == "x_vibration" or r._field == "y_vibration" or r._field == "vibration")
    |> group(columns: ["machineId", "_field"])
    |> first()
    |> limit(n: 20)
`;

console.log('📋 Sample Data Structure:\n');

const samples = {};

await new Promise((resolve) => {
  queryApi.queryRows(sampleQuery, {
    next(row, tableMeta) {
      const record = tableMeta.toObject(row);
      const machineId = record.machineId;
      const field = record._field;
      const value = record._value;
      
      if (!samples[machineId]) {
        samples[machineId] = {};
      }
      samples[machineId][field] = value;
    },
    error(error) {
      console.error('Error:', error.message);
      resolve();
    },
    complete() {
      resolve();
    },
  });
});

if (Object.keys(samples).length > 0) {
  const firstMachine = Object.keys(samples)[0];
  console.log(`Machine: ${firstMachine}\n`);
  console.log('Available axes/data:');
  Object.entries(samples[firstMachine]).forEach(([field, value]) => {
    console.log(`  ${field}: ${value}`);
  });
  console.log();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (accFields.length >= 3) {
    console.log('✅ 3-Axis Acceleration Data Available:');
    console.log('   • X-axis acceleration (x_acc)');
    console.log('   • Y-axis acceleration (y_acc)');
    console.log('   • Z-axis acceleration (z_acc)');
    console.log();
  }
  
  if (vibFields.length >= 2) {
    console.log('✅ Multi-Axis Vibration Data Available:');
    vibFields.forEach(f => {
      const axis = f.includes('x') ? 'X-axis' : f.includes('y') ? 'Y-axis' : f.includes('z') ? 'Z-axis' : 'Overall';
      console.log(`   • ${axis} vibration (${f})`);
    });
    console.log();
  }
} else {
  console.log('⚠️  No sample data found');
}

