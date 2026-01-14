/**
 * Check what data exists in wisermachines-test bucket
 */

const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = 'de2169640328f76d';
const BUCKET = 'wisermachines-test';

console.log('🔍 Checking wisermachines-test bucket...\n');
console.log(`URL: ${INFLUXDB_URL}`);
console.log(`Bucket: ${BUCKET}\n`);

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

// 1. Check what measurements exist
async function checkMeasurements() {
  console.log('📊 Checking measurements...');
  const query = `
    import "influxdata/influxdb/schema"
    schema.measurements(bucket: "${BUCKET}")
  `;
  
  const measurements = new Set();
  try {
    await new Promise((resolve) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          if (record._value) {
            measurements.add(record._value);
          }
        },
        error(error) {
          console.log(`  ⚠️  Error: ${error.message}`);
          resolve();
        },
        complete() {
          resolve();
        },
      });
    });
  } catch (error) {
    console.log(`  ⚠️  Error: ${error.message}`);
  }
  
  if (measurements.size > 0) {
    console.log(`  ✅ Found ${measurements.size} measurement(s):`);
    Array.from(measurements).forEach((m, i) => {
      console.log(`     ${i + 1}. ${m}`);
    });
  } else {
    console.log(`  ⚠️  No measurements found`);
  }
  console.log('');
  return Array.from(measurements);
}

// 2. Check what fields exist
async function checkFields() {
  console.log('📋 Checking fields...');
  const query = `
    from(bucket: "${BUCKET}")
      |> range(start: -365d)
      |> keys()
      |> keep(columns: ["_field"])
      |> distinct()
      |> limit(n: 100)
  `;
  
  const fields = new Set();
  try {
    await new Promise((resolve) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          if (record._field) {
            fields.add(record._field);
          }
        },
        error(error) {
          console.log(`  ⚠️  Error: ${error.message}`);
          resolve();
        },
        complete() {
          resolve();
        },
      });
    });
  } catch (error) {
    console.log(`  ⚠️  Error: ${error.message}`);
  }
  
  if (fields.size > 0) {
    console.log(`  ✅ Found ${fields.size} field(s):`);
    Array.from(fields).slice(0, 20).forEach((f, i) => {
      console.log(`     ${i + 1}. ${f}`);
    });
    if (fields.size > 20) {
      console.log(`     ... and ${fields.size - 20} more`);
    }
  } else {
    console.log(`  ⚠️  No fields found`);
  }
  console.log('');
  return Array.from(fields);
}

// 3. Check what machine_ids exist
async function checkMachineIds() {
  console.log('🏭 Checking machine IDs...');
  const query = `
    from(bucket: "${BUCKET}")
      |> range(start: -365d)
      |> keys()
      |> keep(columns: ["machine_id"])
      |> filter(fn: (r) => exists r.machine_id)
      |> distinct()
      |> limit(n: 50)
  `;
  
  const machineIds = new Set();
  try {
    await new Promise((resolve) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          if (record.machine_id) {
            machineIds.add(record.machine_id);
          }
        },
        error(error) {
          console.log(`  ⚠️  Error: ${error.message}`);
          resolve();
        },
        complete() {
          resolve();
        },
      });
    });
  } catch (error) {
    console.log(`  ⚠️  Error: ${error.message}`);
  }
  
  if (machineIds.size > 0) {
    console.log(`  ✅ Found ${machineIds.size} machine ID(s):`);
    Array.from(machineIds).forEach((id, i) => {
      console.log(`     ${i + 1}. ${id}`);
    });
  } else {
    console.log(`  ⚠️  No machine IDs found`);
  }
  console.log('');
  return Array.from(machineIds);
}

// 4. Get sample data
async function getSampleData() {
  console.log(' Sample data (last 5 records)...');
  const query = `
    from(bucket: "${BUCKET}")
      |> range(start: -365d)
      |> limit(n: 5)
  `;
  
  const samples = [];
  try {
    await new Promise((resolve) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          samples.push(record);
        },
        error(error) {
          console.log(`  ⚠️  Error: ${error.message}`);
          resolve();
        },
        complete() {
          resolve();
        },
      });
    });
  } catch (error) {
    console.log(`  ⚠️  Error: ${error.message}`);
  }
  
  if (samples.length > 0) {
    samples.forEach((sample, i) => {
      console.log(`  ${i + 1}.`);
      console.log(`     Time: ${sample._time || 'N/A'}`);
      console.log(`     Measurement: ${sample._measurement || 'N/A'}`);
      console.log(`     Field: ${sample._field || 'N/A'}`);
      console.log(`     Value: ${sample._value || 'N/A'}`);
      console.log(`     Machine ID: ${sample.machine_id || 'N/A'}`);
      console.log(`     Tags: ${JSON.stringify(Object.keys(sample).filter(k => !k.startsWith('_') && k !== 'result' && k !== 'table'))}`);
      console.log('');
    });
  } else {
    console.log(`  ⚠️  No sample data found`);
  }
  console.log('');
}

// 5. Check for vibration-related data
async function checkVibrationData() {
  console.log('🔊 Checking for vibration data...');
  const query = `
    from(bucket: "${BUCKET}")
      |> range(start: -365d)
      |> filter(fn: (r) => 
        r._field =~ /vibration/i or
        r._field =~ /vib/i or
        r._field =~ /accel/i or
        r._measurement =~ /vibration/i or
        r.sensor_type == "vibration" or
        r.sensor_type =~ /vibration/i
      )
      |> group(columns: ["machine_id"])
      |> distinct(column: "machine_id")
      |> limit(n: 50)
  `;
  
  const machines = new Set();
  try {
    await new Promise((resolve) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const machineId = record.machine_id || record._value;
          if (machineId) {
            machines.add(machineId);
          }
        },
        error(error) {
          console.log(`  ⚠️  Error: ${error.message}`);
          resolve();
        },
        complete() {
          resolve();
        },
      });
    });
  } catch (error) {
    console.log(`  ⚠️  Error: ${error.message}`);
  }
  
  if (machines.size > 0) {
    console.log(`  ✅ Found ${machines.size} machine(s) with vibration data:`);
    Array.from(machines).forEach((id, i) => {
      console.log(`     ${i + 1}. ${id}`);
    });
  } else {
    console.log(`  ⚠️  No vibration data found with standard patterns`);
  }
  console.log('');
  return Array.from(machines);
}

async function main() {
  try {
    await checkMeasurements();
    await checkFields();
    await checkMachineIds();
    await getSampleData();
    await checkVibrationData();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Bucket analysis complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);

