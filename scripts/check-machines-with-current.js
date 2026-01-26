const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';
const CURRENT_BUCKET = process.env.INFLUXDB_BUCKET || 'wisermachines-test';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkMachinesWithCurrent() {
  console.log(`🔍 Checking which machines have Current (CT) data...\n`);
  
  const query = `
    from(bucket: "${CURRENT_BUCKET}")
      |> range(start: -365d)
      |> filter(fn: (r) => r["_measurement"] == "CT")
      |> filter(fn: (r) => r["_field"] == "ct")
      |> group(columns: ["machineId"])
      |> distinct(column: "machineId")
      |> sort(columns: ["machineId"])
  `;
  
  const machines = new Map();
  
  await new Promise((resolve, reject) => {
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const machineId = record.machineId;
        if (machineId && !machines.has(machineId)) {
          machines.set(machineId, {
            machineId: machineId,
            latestTime: null,
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
  
  console.log(`Found ${machines.size} machine(s) with CT measurement:\n`);
  
  if (machines.size === 0) {
    console.log('  No machines found with current data.');
    return;
  }
  
  // For each machine, get latest data point and count
  for (const [machineId, machineInfo] of machines) {
    const latestQuery = `
      from(bucket: "${CURRENT_BUCKET}")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "CT")
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> filter(fn: (r) => r["_field"] == "ct")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;
    
    const countQuery = `
      from(bucket: "${CURRENT_BUCKET}")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "CT")
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> filter(fn: (r) => r["_field"] == "ct")
        |> count()
    `;
    
    // Get latest time
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
    
    console.log(`  📊 Machine ID: ${machineId}`);
    console.log(`     Latest data: ${latestDate ? latestDate.toISOString() : 'N/A'} (${timeAgo})`);
    console.log(`     Latest value: ${machineInfo.latestValue !== undefined ? machineInfo.latestValue : 'N/A'}`);
    console.log(`     Total data points (last 365 days): ${machineInfo.dataPoints}`);
    console.log('');
  }
  
  console.log(`\n✅ Summary: ${machines.size} machine(s) have current (CT) data in InfluxDB`);
}

checkMachinesWithCurrent().catch(console.error);


