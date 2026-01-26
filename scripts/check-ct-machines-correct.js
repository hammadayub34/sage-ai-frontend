const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';
const CURRENT_BUCKET = process.env.INFLUXDB_BUCKET || 'wisermachines-test';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkCTMachines() {
  console.log(`🔍 Checking which machines have Current (CT) data...\n`);
  
  // CT measurement uses "mac" as a tag and "machineId" as a field
  // Let's check by MAC address first
  const macQuery = `
    from(bucket: "${CURRENT_BUCKET}")
      |> range(start: -365d)
      |> filter(fn: (r) => r["_measurement"] == "CT")
      |> filter(fn: (r) => r["_field"] == "total_current" or r["_field"] == "CT_Avg")
      |> group(columns: ["mac"])
      |> distinct(column: "mac")
  `;
  
  const machines = new Map();
  
  await new Promise((resolve, reject) => {
    queryApi.queryRows(macQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const mac = record.mac;
        if (mac && !machines.has(mac)) {
          machines.set(mac, {
            mac: mac,
            machineId: null,
            latestTime: null,
            latestValue: null,
            dataPoints: 0
          });
        }
      },
      error(err) {
        console.error(`  ⚠️  Error: ${err.message}`);
        reject(err);
      },
      complete() {
        resolve();
      }
    });
  });
  
  console.log(`Found ${machines.size} machine(s) with CT data (by MAC address):\n`);
  
  if (machines.size === 0) {
    console.log('  No machines found with current data.');
    return;
  }
  
  // For each machine, get details
  for (const [mac, machineInfo] of machines) {
    // Get latest data point with machineId
    const latestQuery = `
      from(bucket: "${CURRENT_BUCKET}")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "CT")
        |> filter(fn: (r) => r.mac == "${mac}")
        |> filter(fn: (r) => r["_field"] == "total_current" or r["_field"] == "CT_Avg")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;
    
    const countQuery = `
      from(bucket: "${CURRENT_BUCKET}")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "CT")
        |> filter(fn: (r) => r.mac == "${mac}")
        |> filter(fn: (r) => r["_field"] == "total_current" or r["_field"] == "CT_Avg")
        |> count()
    `;
    
    // Get machineId from a sample record
    const machineIdQuery = `
      from(bucket: "${CURRENT_BUCKET}")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "CT")
        |> filter(fn: (r) => r.mac == "${mac}")
        |> filter(fn: (r) => r["_field"] == "machineId")
        |> limit(n: 1)
    `;
    
    // Get latest time and value
    await new Promise((resolve) => {
      queryApi.queryRows(latestQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          machineInfo.latestTime = record._time;
          machineInfo.latestValue = record._value;
        },
        error(err) {
          // Ignore errors
        },
        complete() {
          resolve();
        }
      });
    });
    
    // Get machineId
    await new Promise((resolve) => {
      queryApi.queryRows(machineIdQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          if (record._value) {
            machineInfo.machineId = record._value;
          }
        },
        error(err) {
          // Ignore errors
        },
        complete() {
          resolve();
        }
      });
    });
    
    // Get count
    await new Promise((resolve) => {
      queryApi.queryRows(countQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          machineInfo.dataPoints = record._value || 0;
        },
        error(err) {
          // Ignore errors
        },
        complete() {
          resolve();
        }
      });
    });
    
    const latestDate = machineInfo.latestTime ? new Date(machineInfo.latestTime) : null;
    const now = new Date();
    const diffMs = latestDate ? now.getTime() - latestDate.getTime() : null;
    const diffMins = diffMs ? Math.floor(diffMs / 60000) : null;
    
    let timeAgo = 'Unknown';
    if (diffMins !== null) {
      if (diffMins < 1) timeAgo = 'Just now';
      else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
      else {
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) timeAgo = `${diffHours}h ago`;
        else {
          const diffDays = Math.floor(diffHours / 24);
          timeAgo = `${diffDays}d ago`;
        }
      }
    }
    
    console.log(`  📊 MAC Address: ${mac}`);
    if (machineInfo.machineId) {
      console.log(`     Machine ID: ${machineInfo.machineId}`);
    }
    console.log(`     Latest data: ${latestDate ? latestDate.toISOString() : 'N/A'} (${timeAgo})`);
    console.log(`     Latest value: ${machineInfo.latestValue !== undefined ? machineInfo.latestValue.toFixed(2) + ' A' : 'N/A'}`);
    console.log(`     Total data points (last 365 days): ${machineInfo.dataPoints}`);
    console.log('');
  }
  
  console.log(`\n✅ Summary: ${machines.size} machine(s) have current (CT) data in InfluxDB`);
  console.log(`\n📝 Note: CT data uses "mac" as a tag identifier and fields like "total_current" or "CT_Avg" for current values.`);
  console.log(`   The API needs to be updated to query by MAC address or use machineId as a field filter.`);
}

checkCTMachines().catch(console.error);


