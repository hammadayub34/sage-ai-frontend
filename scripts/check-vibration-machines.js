/**
 * Check which machines have vibration data in InfluxDB
 * Can test both localhost and WiserMachines
 */

const { InfluxDB } = require('@influxdata/influxdb-client');

// Configuration - can be overridden with environment variables
const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || 'my-super-secret-auth-token';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'myorg';
const BUCKETS = ['cnc_machine_data', 'wisermachines-test', 'plc_data_new', 'modbus'];

console.log('🔍 Checking for machines with vibration data...\n');
console.log(`URL: ${INFLUXDB_URL}`);
console.log(`Org: ${INFLUXDB_ORG}\n`);

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkBucket(bucket) {
  console.log(`📦 Checking bucket: ${bucket}`);
  
  // Query for vibration data
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -365d)
      |> filter(fn: (r) => 
        r["sensor_type"] == "vibration" or
        r._field =~ /vibration/i or
        r._field =~ /vib/i or
        r._measurement =~ /vibration/i
      )
      |> group(columns: ["machine_id"])
      |> distinct(column: "machine_id")
  `;

  const machines = new Set();
  
  try {
    await new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const machineId = record.machine_id || record._value;
          if (machineId) {
            machines.add(machineId);
          }
        },
        error(error) {
          // Silently fail for buckets that don't exist or have no data
          resolve();
        },
        complete() {
          resolve();
        },
      });
    });
  } catch (error) {
    // Ignore errors
  }
  
  if (machines.size > 0) {
    console.log(`  ✅ Found ${machines.size} machine(s):`);
    Array.from(machines).forEach((id, i) => {
      console.log(`     ${i + 1}. ${id}`);
    });
  } else {
    console.log(`  ⚠️  No vibration data found`);
  }
  console.log('');
  
  return Array.from(machines);
}

async function main() {
  const allMachines = new Set();
  
  for (const bucket of BUCKETS) {
    const machines = await checkBucket(bucket);
    machines.forEach(m => allMachines.add(m));
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Summary: Found ${allMachines.size} unique machine(s) with vibration data`);
  if (allMachines.size > 0) {
    console.log('\nMachine IDs:');
    Array.from(allMachines).forEach((id, i) => {
      console.log(`  ${i + 1}. ${id}`);
    });
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

