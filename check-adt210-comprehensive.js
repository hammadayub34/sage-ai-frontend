const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const macAddress = '2C:BC:BB:06:7D:6C'; // ADT210+ MAC
const machineId = '69369c3c2e35591ba5135455'; // ADT210+ machineId

// Try different MAC formats
const macVariants = [
  '2C:BC:BB:06:7D:6C',  // Original
  '2c:bc:bb:06:7d:6c',  // Lowercase
  '2C-BC-BB-06-7D-6C',  // Dashes
  '2c-bc-bb-06-7d-6c',  // Lowercase dashes
  '2CBCBB067D6C',       // No separators
  '2cbcbb067d6c',       // Lowercase no separators
];

const buckets = ['wisermachines-test', 'plc_data_new', 'cnc_machine_data'];

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkComprehensive() {
  console.log(`=== Comprehensive InfluxDB Check for ADT210+ ===\n`);
  console.log(`MAC: ${macAddress}`);
  console.log(`MachineId: ${machineId}\n`);
  
  for (const bucket of buckets) {
    console.log(`\n📦 Checking bucket: ${bucket}`);
    console.log('='.repeat(60));
    
    // 1. Check by machineId (last 3 months)
    console.log(`\n1. Checking by machineId (last 3 months)...`);
    const machineIdQuery = `
      from(bucket: "${bucket}")
        |> range(start: -90d)
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 5)
    `;
    
    const machineIdRecords = [];
    try {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('   ⏱️  Query timed out');
          resolve();
        }, 10000);
        
        queryApi.queryRows(machineIdQuery, {
          next(row, tableMeta) {
            clearTimeout(timeout);
            const record = tableMeta.toObject(row);
            machineIdRecords.push(record);
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
    } catch (e) {
      console.log('   Query failed');
    }
    
    if (machineIdRecords.length > 0) {
      console.log(`   ✅ Found ${machineIdRecords.length} records by machineId!`);
      machineIdRecords.slice(0, 3).forEach((r, idx) => {
        console.log(`      ${idx + 1}. ${r._time}: ${r._measurement || 'N/A'} - ${r._field || 'N/A'} = ${r._value}`);
      });
    } else {
      console.log(`   ❌ No data by machineId`);
    }
    
    // 2. Check by MAC address variants (last 3 months)
    console.log(`\n2. Checking by MAC address variants (last 3 months)...`);
    for (const macVariant of macVariants) {
      const macQuery = `
        from(bucket: "${bucket}")
          |> range(start: -90d)
          |> filter(fn: (r) => exists r.mac and r.mac == "${macVariant}")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n: 3)
      `;
      
      const macRecords = [];
      try {
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 8000);
          
          queryApi.queryRows(macQuery, {
            next(row, tableMeta) {
              clearTimeout(timeout);
              const record = tableMeta.toObject(row);
              macRecords.push(record);
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
      } catch (e) {
        // Ignore errors
      }
      
      if (macRecords.length > 0) {
        console.log(`   ✅ Found data with MAC format: ${macVariant}`);
        macRecords.slice(0, 2).forEach((r, idx) => {
          console.log(`      ${idx + 1}. ${r._time}: ${r._measurement || 'N/A'} - ${r._field || 'N/A'} = ${r._value} (machineId: ${r.machineId || 'N/A'})`);
        });
        break; // Found it, no need to check other variants
      }
    }
    
    // 3. Check all measurements in this bucket for any reference to this machine
    console.log(`\n3. Checking all measurements in bucket...`);
    const allMeasurementsQuery = `
      from(bucket: "${bucket}")
        |> range(start: -90d)
        |> group(columns: ["_measurement"])
        |> distinct(column: "_measurement")
        |> limit(n: 20)
    `;
    
    const measurements = new Set();
    try {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(), 8000);
        queryApi.queryRows(allMeasurementsQuery, {
          next(row, tableMeta) {
            clearTimeout(timeout);
            const record = tableMeta.toObject(row);
            measurements.add(record._measurement || record._value);
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
    } catch (e) {
      // Ignore
    }
    
    if (measurements.size > 0) {
      console.log(`   Found ${measurements.size} measurement(s): ${Array.from(measurements).join(', ')}`);
    }
    
    // 4. Count total records for this machineId in last month
    console.log(`\n4. Counting total records for machineId (last 30 days)...`);
    const countQuery = `
      from(bucket: "${bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> group()
        |> count()
    `;
    
    let count = 0;
    try {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(), 8000);
        queryApi.queryRows(countQuery, {
          next(row, tableMeta) {
            clearTimeout(timeout);
            const record = tableMeta.toObject(row);
            count = record._value || 0;
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
    } catch (e) {
      // Ignore
    }
    
    if (count > 0) {
      console.log(`   ✅ Total records in last 30 days: ${count}`);
    } else {
      console.log(`   ❌ No records in last 30 days`);
    }
    
    // 5. Check for any machineId that contains part of our ID
    console.log(`\n5. Checking for similar machineIds...`);
    const similarQuery = `
      from(bucket: "${bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => exists r.machineId)
        |> group(columns: ["machineId"])
        |> distinct(column: "machineId")
        |> filter(fn: (r) => strings.containsStr(v: r.machineId, substr: "69369c3c"))
        |> limit(n: 10)
    `;
    
    const similarIds = [];
    try {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(), 8000);
        queryApi.queryRows(similarQuery, {
          next(row, tableMeta) {
            clearTimeout(timeout);
            const record = tableMeta.toObject(row);
            similarIds.push(record.machineId || record._value);
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
    } catch (e) {
      // Ignore
    }
    
    if (similarIds.length > 0) {
      console.log(`   Found similar machineIds: ${similarIds.join(', ')}`);
    }
  }
  
  console.log(`\n\n=== FINAL SUMMARY ===`);
  console.log(`Checked buckets: ${buckets.join(', ')}`);
  console.log(`Time range: Last 90 days`);
  console.log(`MAC variants checked: ${macVariants.length}`);
}

checkComprehensive().catch(console.error);

