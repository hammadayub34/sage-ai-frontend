const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const screenshotMAC = '10:06:1C:86:F9:54';
const screenshotMachineID = '12345';
const mongoMachineID = '6958155ea4f09743147b22ab';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkModbusBucket() {
  console.log(`🔍 Checking 'modbus' bucket for screenshot data...\n`);
  
  const bucket = 'modbus';
  
  // First, see what measurements exist
  console.log('📊 Checking available measurements...\n');
  
  const measurementsQuery = `
    from(bucket: "${bucket}")
      |> range(start: -7d)
      |> group(columns: ["_measurement"])
      |> limit(n: 1000)
  `;
  
  const measurements = new Set();
  
  await new Promise((resolve) => {
    queryApi.queryRows(measurementsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        if (record._measurement) {
          measurements.add(record._measurement);
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
  
  console.log(`Found ${measurements.size} measurement(s):`);
  Array.from(measurements).sort().forEach(m => console.log(`  • ${m}`));
  console.log('');
  
  // Check for data with MAC address
  console.log(`\n🔍 Checking for MAC ${screenshotMAC}...\n`);
  
  const macQuery = `
    from(bucket: "${bucket}")
      |> range(start: -30d)
      |> filter(fn: (r) => exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${screenshotMAC}")
      |> group(columns: ["_measurement", "_field"])
      |> keep(columns: ["_measurement", "_field", "_time", "_value", "MAC_ADDRESS", "machineID", "machineId"])
      |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
      |> limit(n: 200)
  `;
  
  const macData = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(macQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const key = `${record._measurement}::${record._field}`;
        if (!macData.has(key)) {
          macData.set(key, {
            measurement: record._measurement,
            field: record._field,
            latestTime: record._time,
            sampleValue: record._value,
            machineID: record.machineID || record.machineId,
            macAddress: record.MAC_ADDRESS
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
  
  if (macData.size > 0) {
    console.log(`✅ Found ${macData.size} unique fields with MAC ${screenshotMAC}:\n`);
    for (const [key, data] of macData.entries()) {
      console.log(`  • ${data.measurement} -> ${data.field}`);
      console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
      if (data.machineID) console.log(`    Machine ID: ${data.machineID}`);
      console.log('');
    }
  } else {
    console.log(`❌ No data found with MAC ${screenshotMAC}\n`);
  }
  
  // Check for machineID "12345"
  console.log(`\n🔍 Checking for machineID "12345"...\n`);
  
  const id12345Query = `
    from(bucket: "${bucket}")
      |> range(start: -30d)
      |> filter(fn: (r) => 
        (exists r.machineID and r.machineID == "${screenshotMachineID}") or
        (exists r.machineId and r.machineId == "${screenshotMachineID}")
      )
      |> group(columns: ["_measurement", "_field"])
      |> keep(columns: ["_measurement", "_field", "_time", "_value", "MAC_ADDRESS", "machineID", "machineId"])
      |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
      |> limit(n: 200)
  `;
  
  const id12345Data = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(id12345Query, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const key = `${record._measurement}::${record._field}`;
        if (!id12345Data.has(key)) {
          id12345Data.set(key, {
            measurement: record._measurement,
            field: record._field,
            latestTime: record._time,
            sampleValue: record._value,
            machineID: record.machineID || record.machineId,
            macAddress: record.MAC_ADDRESS
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
  
  if (id12345Data.size > 0) {
    console.log(`✅ Found ${id12345Data.size} unique fields with machineID "12345":\n`);
    for (const [key, data] of id12345Data.entries()) {
      console.log(`  • ${data.measurement} -> ${data.field}`);
      console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
      if (data.macAddress) console.log(`    MAC: ${data.macAddress}`);
      console.log('');
    }
  } else {
    console.log(`❌ No data found with machineID "12345"\n`);
  }
  
  // Check for screenshot fields (Pressure, Flow, Density, Temperature)
  console.log(`\n🔍 Checking for screenshot fields (Pressure, Flow, Density, Temperature)...\n`);
  
  const fieldsQuery = `
    from(bucket: "${bucket}")
      |> range(start: -30d)
      |> filter(fn: (r) => 
        r._field == "Pressure" or
        r._field == "pressure" or
        r._field == "Flow" or
        r._field == "flow" or
        r._field == "Density" or
        r._field == "density" or
        r._field == "Temperature" or
        r._field == "temperature" or
        r._field == "Diff Pressure" or
        r._field == "diff_pressure" or
        r._field == "Instantaneous Flow" or
        r._field == "instantaneous_flow" or
        r._field == "Freq" or
        r._field == "freq" or
        r._field == "Frequency" or
        r._field == "frequency"
      )
      |> group(columns: ["_measurement", "_field"])
      |> keep(columns: ["_measurement", "_field", "_time", "_value", "MAC_ADDRESS", "machineID", "machineId"])
      |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
      |> limit(n: 200)
  `;
  
  const fieldsData = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(fieldsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const key = `${record._measurement}::${record._field}`;
        if (!fieldsData.has(key)) {
          fieldsData.set(key, {
            measurement: record._measurement,
            field: record._field,
            latestTime: record._time,
            sampleValue: record._value,
            machineID: record.machineID || record.machineId,
            macAddress: record.MAC_ADDRESS
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
  
  if (fieldsData.size > 0) {
    console.log(`✅ Found ${fieldsData.size} fields matching screenshot:\n`);
    for (const [key, data] of fieldsData.entries()) {
      console.log(`  • ${data.measurement} -> ${data.field}`);
      console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
      if (data.machineID) console.log(`    Machine ID: ${data.machineID}`);
      if (data.macAddress) console.log(`    MAC: ${data.macAddress}`);
      console.log('');
    }
  } else {
    console.log(`❌ No exact field names matching screenshot found\n`);
    
    // Show all available fields in modbus bucket
    console.log(`\n📋 Checking all available fields in modbus bucket...\n`);
    
    const allFieldsQuery = `
      from(bucket: "${bucket}")
        |> range(start: -7d)
        |> group(columns: ["_field"])
        |> limit(n: 1000)
    `;
    
    const allFields = new Set();
    
    await new Promise((resolve) => {
      queryApi.queryRows(allFieldsQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          if (record._field) {
            allFields.add(record._field);
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
    
    console.log(`Found ${allFields.size} unique field(s):`);
    Array.from(allFields).sort().forEach(f => console.log(`  • ${f}`));
  }
}

checkModbusBucket().catch(console.error);

