const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';
const VIBRATION_BUCKET = 'wisermachines-test';

const machineId = '69369c3c2e35591ba5135455'; // ADT210+

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkADT210Data() {
  console.log(`=== Checking InfluxDB Data for ADT210+ (${machineId}) ===\n`);
  
  // 1. Check all measurements for this machine
  console.log('1. Checking all measurements for this machine...');
  const measurementsQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -30d)
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
      |> group(columns: ["_measurement"])
      |> distinct(column: "_measurement")
  `;
  
  const measurements = new Set();
  await new Promise((resolve) => {
    queryApi.queryRows(measurementsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        measurements.add(record._measurement || record._value);
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
  
  console.log(`Found ${measurements.size} measurement(s): ${Array.from(measurements).join(', ') || 'None'}\n`);
  
  if (measurements.size === 0) {
    console.log('⚠️  No data found for this machine in the last 30 days!');
    return;
  }
  
  // 2. For each measurement, check all fields
  for (const measurement of measurements) {
    console.log(`\n2. Checking "${measurement}" measurement...`);
    
    const fieldsQuery = `
      from(bucket: "${VIBRATION_BUCKET}")
        |> range(start: -30d)
        |> filter(fn: (r) => r["_measurement"] == "${measurement}")
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
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
    
    console.log(`   Fields: ${Array.from(fields).join(', ') || 'None'}`);
    
    // 3. Get latest data points for each field
    for (const field of fields) {
      const latestQuery = `
        from(bucket: "${VIBRATION_BUCKET}")
          |> range(start: -30d)
          |> filter(fn: (r) => r["_measurement"] == "${measurement}")
          |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
          |> filter(fn: (r) => r["_field"] == "${field}")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n: 5)
      `;
      
      const latestRecords = [];
      await new Promise((resolve) => {
        queryApi.queryRows(latestQuery, {
          next(row, tableMeta) {
            const record = tableMeta.toObject(row);
            latestRecords.push(record);
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
      
      if (latestRecords.length > 0) {
        console.log(`\n   Latest "${field}" values:`);
        latestRecords.forEach((r, idx) => {
          console.log(`     ${idx + 1}. ${r._time}: ${r._value} (type: ${typeof r._value})`);
        });
        
        // Check for non-zero values
        const nonZero = latestRecords.filter(r => r._value !== 0);
        if (nonZero.length > 0) {
          console.log(`   ✅ Found ${nonZero.length} non-zero values!`);
        } else {
          console.log(`   ⚠️  All values are 0`);
        }
      } else {
        console.log(`   ⚠️  No data for field "${field}"`);
      }
    }
  }
  
  // 4. Check data frequency - how often is data coming in?
  console.log(`\n3. Checking data frequency (last 24 hours)...`);
  const frequencyQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -24h)
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
      |> group()
      |> count()
  `;
  
  let totalCount = 0;
  await new Promise((resolve) => {
    queryApi.queryRows(frequencyQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        totalCount = record._value || 0;
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
  
  console.log(`   Total data points in last 24h: ${totalCount}`);
  
  if (totalCount > 0) {
    const avgPerHour = (totalCount / 24).toFixed(2);
    console.log(`   Average: ~${avgPerHour} points per hour`);
  }
  
  // 5. Check oldest and newest data
  console.log(`\n4. Checking data time range...`);
  const timeRangeQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -30d)
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
      |> sort(columns: ["_time"])
      |> limit(n: 1)
  `;
  
  const oldestRecords = [];
  await new Promise((resolve) => {
    queryApi.queryRows(timeRangeQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        oldestRecords.push(record);
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
  
  const newestQuery = `
    from(bucket: "${VIBRATION_BUCKET}")
      |> range(start: -30d)
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
  `;
  
  const newestRecords = [];
  await new Promise((resolve) => {
    queryApi.queryRows(newestQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        newestRecords.push(record);
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
  
  if (oldestRecords.length > 0) {
    console.log(`   Oldest data: ${oldestRecords[0]._time}`);
  }
  if (newestRecords.length > 0) {
    console.log(`   Newest data: ${newestRecords[0]._time}`);
    const now = new Date();
    const newest = new Date(newestRecords[0]._time);
    const minutesAgo = Math.round((now - newest) / (1000 * 60));
    console.log(`   Last update: ${minutesAgo} minutes ago`);
  }
}

checkADT210Data().catch(console.error);

