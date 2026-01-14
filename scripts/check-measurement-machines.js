const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const monfortsMachineId = '68f0e3f048f7b84b491408b5';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkMeasurementMachines() {
  console.log(`🔍 Checking which machines have data in each measurement...\n`);
  console.log(`Monforts Machine ID: ${monfortsMachineId}\n`);
  
  const measurements = ['AcrylData', 'Ambient', 'CT', 'Thermister', 'Vibration'];
  
  for (const measurement of measurements) {
    console.log(`\n📊 Measurement: ${measurement}`);
    console.log('─'.repeat(60));
    
    // Get all unique machine IDs for this measurement
    const machineQuery = `
      from(bucket: "wisermachines-test")
        |> range(start: -7d)
        |> filter(fn: (r) => r["_measurement"] == "${measurement}")
        |> keep(columns: ["_measurement", "_field", "_time", "_value", "machineId", "machineID"])
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 500)
    `;
    
    const machines = new Set();
    const machineDetails = new Map();
    
    await new Promise((resolve) => {
      queryApi.queryRows(machineQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const machineId = record.machineId || record.machineID;
          
          if (machineId) {
            machines.add(machineId);
            if (!machineDetails.has(machineId)) {
              machineDetails.set(machineId, {
                machineId: machineId,
                latestTime: record._time,
                sampleValue: record._value,
                field: record._field
              });
            } else {
              // Update if this is a more recent time
              const existing = machineDetails.get(machineId);
              if (record._time > existing.latestTime) {
                existing.latestTime = record._time;
                existing.sampleValue = record._value;
                existing.field = record._field;
              }
            }
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
    
    console.log(`  Found ${machines.size} unique machine(s):\n`);
    
    let hasMonforts = false;
    for (const machineId of machines) {
      const details = machineDetails.get(machineId);
      const isMonforts = machineId === monfortsMachineId;
      
      if (isMonforts) {
        hasMonforts = true;
        console.log(`  ✅ ${machineId} (MONFORTS)`);
      } else {
        console.log(`  • ${machineId}`);
      }
      
      if (details) {
        console.log(`     Latest: ${details.latestTime}`);
        console.log(`     Sample: ${details.field} = ${details.sampleValue}`);
      }
      console.log('');
    }
    
    if (!hasMonforts && machines.size > 0) {
      console.log(`  ❌ Monforts machine (${monfortsMachineId}) NOT found in this measurement\n`);
    } else if (hasMonforts) {
      console.log(`  ✅ This measurement contains data for Monforts machine\n`);
    }
  }
  
  // Now specifically check if Monforts has AcrylData, Ambient, or CT
  console.log('\n\n🔍 Checking if Monforts has AcrylData, Ambient, or CT data...\n');
  
  const checkQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -7d)
      |> filter(fn: (r) => 
        (r["_measurement"] == "AcrylData" or 
         r["_measurement"] == "Ambient" or 
         r["_measurement"] == "CT") and
        ((exists r.machineId and r.machineId == "${monfortsMachineId}") or
         (exists r.machineID and r.machineID == "${monfortsMachineId}"))
      )
      |> keep(columns: ["_measurement", "_field", "_time", "_value"])
      |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
      |> limit(n: 100)
  `;
  
  const monfortsOtherData = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(checkQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const key = `${record._measurement}::${record._field}`;
        if (!monfortsOtherData.has(key)) {
          monfortsOtherData.set(key, {
            measurement: record._measurement,
            field: record._field,
            latestTime: record._time,
            sampleValue: record._value
          });
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
  
  if (monfortsOtherData.size > 0) {
    console.log(`  ✅ Monforts HAS data in other measurements:\n`);
    for (const [key, data] of monfortsOtherData.entries()) {
      console.log(`    • ${data.measurement} -> ${data.field}`);
      console.log(`      Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
    }
  } else {
    console.log(`  ❌ Monforts does NOT have AcrylData, Ambient, or CT data`);
    console.log(`     (Only has Vibration and Thermister data)`);
  }
}

checkMeasurementMachines().catch(console.error);

