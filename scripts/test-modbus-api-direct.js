const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const macAddress = '10:06:1C:86:F9:54';
const field = 'Density';
const timeRange = '-7d';
const windowPeriod = '30m';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function testQuery() {
  console.log(`🔍 Testing Modbus API query directly...\n`);
  console.log(`MAC: ${macAddress}`);
  console.log(`Field: ${field}`);
  console.log(`Time Range: ${timeRange}`);
  console.log(`Window Period: ${windowPeriod}\n`);
  
  // Parse time range
  const now = new Date();
  let startTime;
  if (timeRange === '-7d') {
    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  const startTimeStr = startTime.toISOString();
  const stopTime = now.toISOString();
  
  // Build query exactly as the API does
  const fluxQuery = `
    from(bucket: "modbus")
      |> range(start: ${startTimeStr}, stop: ${stopTime})
      |> filter(fn: (r) => r["_measurement"] == "modbus")
      |> filter(fn: (r) => exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${macAddress}")
      |> filter(fn: (r) => r["_field"] == "${field}" or r["_field"] == "${field.replace(/\s+/g, '_')}" or r["_field"] == "${field.replace(/_/g, ' ')}")
      |> aggregateWindow(every: ${windowPeriod}, fn: mean, createEmpty: false)
      |> sort(columns: ["_time"])
      |> limit(n: 10000)
  `;
  
  console.log('📊 Flux Query:');
  console.log(fluxQuery);
  console.log('');
  
  const results = [];
  
  await new Promise((resolve) => {
    queryApi.queryRows(fluxQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        results.push(record);
      },
      error(error) {
        console.error('❌ Error:', error);
        resolve();
      },
      complete() {
        resolve();
      }
    });
  });
  
  console.log(`\n✅ Found ${results.length} records\n`);
  
  if (results.length > 0) {
    console.log('Sample records:');
    results.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. Time: ${r._time}, Value: ${r._value}, Field: ${r._field}`);
    });
  } else {
    console.log('❌ No data found. Testing simpler query...\n');
    
    // Test without aggregation
    const simpleQuery = `
      from(bucket: "modbus")
        |> range(start: ${startTimeStr}, stop: ${stopTime})
        |> filter(fn: (r) => r["_measurement"] == "modbus")
        |> filter(fn: (r) => exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${macAddress}")
        |> filter(fn: (r) => r["_field"] == "${field}")
        |> limit(n: 10)
    `;
    
    console.log('Testing simpler query (no aggregation):');
    console.log(simpleQuery);
    console.log('');
    
    const simpleResults = [];
    
    await new Promise((resolve) => {
      queryApi.queryRows(simpleQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          simpleResults.push(record);
        },
        error(error) {
          console.error('❌ Error:', error);
          resolve();
        },
        complete() {
          resolve();
        }
      });
    });
    
    console.log(`Found ${simpleResults.length} records without aggregation\n`);
    if (simpleResults.length > 0) {
      simpleResults.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. Time: ${r._time}, Value: ${r._value}, Field: ${r._field}`);
      });
    }
  }
}

testQuery().catch(console.error);

