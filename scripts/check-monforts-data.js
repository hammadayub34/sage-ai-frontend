const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const machineId = '68f0e3f048f7b84b491408b5'; // Monforts machine

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkAllData() {
  console.log(`🔍 Checking all data for Monforts machine (${machineId})\n`);
  
  // Check wisermachines-test bucket
  console.log('📊 Checking wisermachines-test bucket...\n');
  
  // Get all measurements and fields for this machine
  const allDataQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -30d)
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
      |> group(columns: ["_measurement", "_field"])
      |> keep(columns: ["_measurement", "_field", "_time", "_value"])
      |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
  `;
  
  const dataMap = new Map(); // measurement -> Set of fields
  
  await new Promise((resolve) => {
    queryApi.queryRows(allDataQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const measurement = record._measurement;
        const field = record._field;
        
        if (!dataMap.has(measurement)) {
          dataMap.set(measurement, {
            fields: new Set(),
            latestTime: null,
            sampleValue: null
          });
        }
        
        const data = dataMap.get(measurement);
        data.fields.add(field);
        
        // Track latest time and sample value
        if (!data.latestTime || (record._time && record._time > data.latestTime)) {
          data.latestTime = record._time;
          data.sampleValue = record._value;
        }
      },
      error(err) {
        console.log(`⚠️  Error: ${err.message}`);
        resolve();
      },
      complete() {
        resolve();
      }
    });
  });
  
  console.log(`Found ${dataMap.size} measurement(s):\n`);
  
  for (const [measurement, data] of dataMap.entries()) {
    console.log(`📈 Measurement: ${measurement}`);
    console.log(`  Fields (${data.fields.size}):`);
    Array.from(data.fields).sort().forEach(f => console.log(`    - ${f}`));
    console.log(`  Latest data: ${data.latestTime || 'N/A'}`);
    console.log(`  Sample value: ${data.sampleValue !== null ? data.sampleValue : 'N/A'}`);
    console.log('');
  }
  
  // Also check other buckets
  console.log('\n\n📊 Checking other buckets...\n');
  
  const otherBuckets = ['cnc_machine_data', 'plc_data_new'];
  
  for (const bucket of otherBuckets) {
    console.log(`Checking bucket: ${bucket}`);
    
    const checkQuery = `
      from(bucket: "${bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => 
          (exists r.machineId and r.machineId == "${machineId}") or
          (exists r.machine_id and r.machine_id == "${machineId}")
        )
        |> limit(n: 1)
    `;
    
    let hasData = false;
    await new Promise((resolve) => {
      queryApi.queryRows(checkQuery, {
        next() {
          hasData = true;
        },
        error() {
          resolve();
        },
        complete() {
          if (hasData) {
            console.log(`  ✅ Has data in ${bucket}`);
          } else {
            console.log(`  ❌ No data in ${bucket}`);
          }
          resolve();
        }
      });
    });
  }
}

checkAllData().catch(console.error);

