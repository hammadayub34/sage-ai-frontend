const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';
const CURRENT_BUCKET = process.env.INFLUXDB_BUCKET || 'wisermachines-test';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkCTStructure() {
  console.log(`🔍 Checking CT measurement structure...\n`);
  
  // First, check if CT measurement exists at all
  const checkExistsQuery = `
    from(bucket: "${CURRENT_BUCKET}")
      |> range(start: -365d)
      |> filter(fn: (r) => r["_measurement"] == "CT")
      |> limit(n: 10)
  `;
  
  console.log('Checking if CT measurement exists...\n');
  let hasData = false;
  const sampleRecords = [];
  
  await new Promise((resolve) => {
    queryApi.queryRows(checkExistsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        hasData = true;
        if (sampleRecords.length < 5) {
          sampleRecords.push(record);
        }
      },
      error(err) {
        console.error(`  ⚠️  Error: ${err.message}`);
        resolve();
      },
      complete() {
        resolve();
      }
    });
  });
  
  if (!hasData) {
    console.log('❌ No CT measurement data found in the last 365 days.\n');
    console.log('Checking all measurements in bucket...\n');
    
    const allMeasurementsQuery = `
      from(bucket: "${CURRENT_BUCKET}")
        |> range(start: -365d)
        |> group(columns: ["_measurement"])
        |> distinct(column: "_measurement")
    `;
    
    const measurements = new Set();
    await new Promise((resolve) => {
      queryApi.queryRows(allMeasurementsQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          if (record._measurement) {
            measurements.add(record._measurement);
          }
        },
        error(err) {
          console.error(`  ⚠️  Error: ${err.message}`);
          resolve();
        },
        complete() {
          resolve();
        }
      });
    });
    
    console.log(`Found ${measurements.size} measurement(s):`);
    for (const measurement of Array.from(measurements).sort()) {
      console.log(`  • ${measurement}`);
    }
    return;
  }
  
  console.log(`✅ CT measurement exists! Found sample records.\n`);
  console.log('Sample record structure:');
  if (sampleRecords.length > 0) {
    const sample = sampleRecords[0];
    console.log(JSON.stringify(sample, null, 2));
    console.log('\n');
  }
  
  // Check all fields in CT measurement
  console.log('Checking all fields in CT measurement...\n');
  const fieldsQuery = `
    from(bucket: "${CURRENT_BUCKET}")
      |> range(start: -365d)
      |> filter(fn: (r) => r["_measurement"] == "CT")
      |> group(columns: ["_field"])
      |> distinct(column: "_field")
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
      error(err) {
        console.error(`  ⚠️  Error: ${err.message}`);
        resolve();
      },
      complete() {
        resolve();
      }
    });
  });
  
  console.log(`Found ${fields.size} field(s) in CT measurement:`);
  for (const field of Array.from(fields).sort()) {
    console.log(`  • ${field}`);
  }
  console.log('\n');
  
  // Check all tag keys (like machineId, machineID, etc.)
  console.log('Checking tag keys (machine identifiers)...\n');
  const tagsQuery = `
    from(bucket: "${CURRENT_BUCKET}")
      |> range(start: -365d)
      |> filter(fn: (r) => r["_measurement"] == "CT")
      |> limit(n: 100)
  `;
  
  const tagKeys = new Set();
  await new Promise((resolve) => {
    queryApi.queryRows(tagsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        // Get all keys that are not standard InfluxDB fields
        Object.keys(record).forEach(key => {
          if (!key.startsWith('_') && key !== 'result' && key !== 'table') {
            tagKeys.add(key);
          }
        });
      },
      error(err) {
        console.error(`  ⚠️  Error: ${err.message}`);
        resolve();
      },
      complete() {
        resolve();
      }
    });
  });
  
  console.log(`Found ${tagKeys.size} tag key(s):`);
  for (const tagKey of Array.from(tagKeys).sort()) {
    console.log(`  • ${tagKey}`);
  }
  console.log('\n');
  
  // Try to find machines using different tag names
  const possibleMachineIdTags = ['machineId', 'machineID', 'machine_id', 'machine', 'id'];
  console.log('Checking for machines using different tag names...\n');
  
  for (const tagName of possibleMachineIdTags) {
    const machineQuery = `
      from(bucket: "${CURRENT_BUCKET}")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "CT")
        |> filter(fn: (r) => exists r.${tagName})
        |> group(columns: ["${tagName}"])
        |> distinct(column: "${tagName}")
        |> limit(n: 20)
    `;
    
    const machines = new Set();
    await new Promise((resolve) => {
      queryApi.queryRows(machineQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const machineId = record[tagName];
          if (machineId) {
            machines.add(machineId);
          }
        },
        error(err) {
          // Tag might not exist, ignore
          resolve();
        },
        complete() {
          resolve();
        }
      });
    });
    
    if (machines.size > 0) {
      console.log(`  ✅ Found ${machines.size} machine(s) using tag "${tagName}":`);
      for (const machineId of Array.from(machines).sort()) {
        console.log(`     • ${machineId}`);
      }
      console.log('');
    }
  }
}

checkCTStructure().catch(console.error);


