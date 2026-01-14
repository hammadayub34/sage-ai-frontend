const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const macAddress = '10:06:1C:86:F9:54'; // CNC Machine A MAC
const machineID = '12345'; // CNC Machine A machineID in InfluxDB

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkLatestData() {
  console.log(`🔍 Checking latest data timestamps for CNC Machine A Modbus fields...\n`);
  console.log(`MAC Address: ${macAddress}`);
  console.log(`Machine ID: ${machineID}\n`);
  
  const fields = [
    'Pressure',
    'Differential pressure/frequency',
    'Instantaneous flow',
    'Density',
    'Temperature'
  ];
  
  for (const field of fields) {
    console.log(`📊 Field: ${field}`);
    console.log('─'.repeat(60));
    
    // Try exact field name first
    const query = `
      from(bucket: "modbus")
        |> range(start: -30d)
        |> filter(fn: (r) => r["_measurement"] == "modbus")
        |> filter(fn: (r) => exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${macAddress}")
        |> filter(fn: (r) => r["_field"] == "${field}" or r["_field"] == "${field.replace(/\s+/g, '_')}" or r["_field"] == "${field.replace(/_/g, ' ')}")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;
    
    let latestTime = null;
    let latestValue = null;
    
    await new Promise((resolve) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          if (!latestTime) {
            latestTime = record._time;
            latestValue = record._value;
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
    
    if (latestTime) {
      const date = new Date(latestTime);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      let timeAgo = '';
      if (diffMinutes < 60) {
        timeAgo = `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      } else {
        timeAgo = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      }
      
      console.log(`  ✅ Latest data: ${date.toISOString()}`);
      console.log(`     Local time: ${date.toLocaleString()}`);
      console.log(`     Value: ${latestValue}`);
      console.log(`     Time ago: ${timeAgo}`);
      
      if (diffMinutes > 60) {
        console.log(`     ⚠️  Data is ${diffHours > 24 ? 'more than a day' : 'more than an hour'} old`);
      }
    } else {
      console.log(`  ❌ No data found for this field`);
    }
    
    console.log('');
  }
  
  // Also check all available fields to see what else we have
  console.log('\n📋 Checking all available Modbus fields for this machine...\n');
  
  const allFieldsQuery = `
    from(bucket: "modbus")
      |> range(start: -7d)
      |> filter(fn: (r) => r["_measurement"] == "modbus")
      |> filter(fn: (r) => exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${macAddress}")
      |> group(columns: ["_field"])
      |> keep(columns: ["_field", "_time"])
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 100)
  `;
  
  const allFields = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(allFieldsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const field = record._field;
        if (!allFields.has(field)) {
          allFields.set(field, record._time);
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
  
  if (allFields.size > 0) {
    console.log(`Found ${allFields.size} unique field(s) with recent data:\n`);
    const sortedFields = Array.from(allFields.entries()).sort((a, b) => {
      return new Date(b[1]).getTime() - new Date(a[1]).getTime();
    });
    
    sortedFields.forEach(([field, time]) => {
      const date = new Date(time);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      let timeAgo = '';
      if (diffMinutes < 60) {
        timeAgo = `${diffMinutes}m ago`;
      } else {
        timeAgo = `${diffHours}h ago`;
      }
      
      console.log(`  • ${field}`);
      console.log(`    Latest: ${date.toLocaleString()} (${timeAgo})`);
    });
  }
}

checkLatestData().catch(console.error);

