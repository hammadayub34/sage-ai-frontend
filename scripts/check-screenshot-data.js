const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const machineId = '68f0e3f048f7b84b491408b5'; // Monforts machine
const macAddress = '10:06:1C:86:F9:54'; // From screenshot

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkScreenshotData() {
  console.log(`🔍 Checking for data matching screenshot...\n`);
  console.log(`Looking for:`);
  console.log(`  - Pressure`);
  console.log(`  - Diff Pressure/Freq`);
  console.log(`  - Instantaneous Flow`);
  console.log(`  - Density`);
  console.log(`  - Temperature`);
  console.log(`\nMachine ID: ${machineId}`);
  console.log(`MAC Address: ${macAddress}\n`);
  
  // Check wisermachines-test bucket
  console.log('📊 Checking wisermachines-test bucket...\n');
  
  // Search by machineId
  const machineQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -7d)
      |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
      |> group(columns: ["_measurement", "_field"])
      |> keep(columns: ["_measurement", "_field", "_time", "_value"])
      |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
      |> limit(n: 100)
  `;
  
  console.log('🔎 Searching by machineId...\n');
  const machineData = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(machineQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const key = `${record._measurement}::${record._field}`;
        if (!machineData.has(key)) {
          machineData.set(key, {
            measurement: record._measurement,
            field: record._field,
            latestTime: record._time,
            sampleValue: record._value,
            tags: record
          });
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
  
  console.log(`Found ${machineData.size} unique measurement/field combinations:\n`);
  for (const [key, data] of machineData.entries()) {
    console.log(`  ${data.measurement} -> ${data.field}`);
    console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
  }
  
  // Search by MAC address
  console.log('\n\n🔎 Searching by MAC address...\n');
  const macQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -7d)
      |> filter(fn: (r) => exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${macAddress}")
      |> group(columns: ["_measurement", "_field"])
      |> keep(columns: ["_measurement", "_field", "_time", "_value", "machineID"])
      |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
      |> limit(n: 100)
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
            machineID: record.machineID,
            tags: record
          });
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
  
  console.log(`Found ${macData.size} unique measurement/field combinations:\n`);
  for (const [key, data] of macData.entries()) {
    console.log(`  ${data.measurement} -> ${data.field}`);
    console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
    if (data.machineID) {
      console.log(`    Machine ID: ${data.machineID}`);
    }
  }
  
  // Search for specific fields from screenshot
  console.log('\n\n🔎 Searching for specific fields from screenshot...\n');
  
  const allFieldsQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -7d)
      |> filter(fn: (r) => 
        strings.containsStr(v: strings.toLower(v: r._field), substr: "pressure") or
        strings.containsStr(v: strings.toLower(v: r._field), substr: "freq") or
        strings.containsStr(v: strings.toLower(v: r._field), substr: "flow") or
        strings.containsStr(v: strings.toLower(v: r._field), substr: "density") or
        (strings.containsStr(v: strings.toLower(v: r._field), substr: "temp") and not strings.containsStr(v: strings.toLower(v: r._field), substr: "therm"))
      )
      |> group(columns: ["_measurement", "_field"])
      |> keep(columns: ["_measurement", "_field", "_time", "_value"])
      |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
      |> limit(n: 500)
  `;
  
  const foundFields = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(allFieldsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const key = `${record._measurement}::${record._field}`;
        if (!foundFields.has(key)) {
          foundFields.set(key, {
            measurement: record._measurement,
            field: record._field,
            latestTime: record._time,
            sampleValue: record._value
          });
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
  
  console.log(`Found ${foundFields.size} fields matching screenshot criteria:\n`);
  for (const [key, data] of foundFields.entries()) {
    console.log(`  📊 ${data.measurement} -> ${data.field}`);
    console.log(`     Latest: ${data.latestTime}`);
    console.log(`     Value: ${data.sampleValue}`);
    console.log('');
  }
  
  // Check all measurements to see what's available
  console.log('\n\n📋 All available measurements in wisermachines-test (last 7 days):\n');
  const allMeasurementsQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -7d)
      |> keep(columns: ["_measurement"])
      |> group(columns: ["_measurement"])
      |> limit(n: 1000)
  `;
  
  const allMeasurements = new Set();
  await new Promise((resolve) => {
    queryApi.queryRows(allMeasurementsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        if (record._measurement) {
          allMeasurements.add(record._measurement);
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
  
  console.log(`Total measurements: ${allMeasurements.size}`);
  Array.from(allMeasurements).sort().forEach(m => console.log(`  - ${m}`));
  
  // Check for data with machineID="12345" (from screenshot)
  console.log('\n\n🔎 Searching for machineID="12345" (from screenshot)...\n');
  const machine12345Query = `
    from(bucket: "wisermachines-test")
      |> range(start: -7d)
      |> filter(fn: (r) => exists r.machineID and r.machineID == "12345")
      |> group(columns: ["_measurement", "_field"])
      |> keep(columns: ["_measurement", "_field", "_time", "_value", "machineID", "MAC_ADDRESS"])
      |> sort(columns: ["_measurement", "_field", "_time"], desc: true)
      |> limit(n: 200)
  `;
  
  const machine12345Data = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(machine12345Query, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const key = `${record._measurement}::${record._field}`;
        if (!machine12345Data.has(key)) {
          machine12345Data.set(key, {
            measurement: record._measurement,
            field: record._field,
            latestTime: record._time,
            sampleValue: record._value,
            machineID: record.machineID,
            macAddress: record.MAC_ADDRESS
          });
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
  
  console.log(`Found ${machine12345Data.size} unique measurement/field combinations:\n`);
  for (const [key, data] of machine12345Data.entries()) {
    console.log(`  📊 ${data.measurement} -> ${data.field}`);
    console.log(`     Latest: ${data.latestTime}`);
    console.log(`     Value: ${data.sampleValue}`);
    if (data.machineID) console.log(`     Machine ID: ${data.machineID}`);
    if (data.macAddress) console.log(`     MAC: ${data.macAddress}`);
    console.log('');
  }
}

checkScreenshotData().catch(console.error);

