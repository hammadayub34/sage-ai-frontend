const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function checkModbusInfluxDB() {
  console.log(`🔍 Checking InfluxDB for Modbus-related data...\n`);
  
  // Check for Modbus tags in all measurements
  console.log('📊 Checking for Modbus tags/fields...\n');
  
  const modbusQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -7d)
      |> filter(fn: (r) => 
        exists r.modbus or
        exists r.MODBUS or
        exists r.Modbus or
        r._field =~ /modbus/i or
        r._measurement =~ /modbus/i
      )
      |> keep(columns: ["_measurement", "_field", "_time", "_value", "machineId", "machineID", "MAC_ADDRESS", "modbus", "MODBUS", "Modbus"])
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 100)
  `;
  
  const modbusData = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(modbusQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const key = `${record._measurement}::${record._field}`;
        if (!modbusData.has(key)) {
          modbusData.set(key, {
            measurement: record._measurement,
            field: record._field,
            latestTime: record._time,
            sampleValue: record._value,
            machineId: record.machineId || record.machineID,
            macAddress: record.MAC_ADDRESS,
            modbusTag: record.modbus || record.MODBUS || record.Modbus
          });
        }
      },
      error(err) {
        // Continue if no Modbus data found
        resolve();
      },
      complete() {
        resolve();
      }
    });
  });
  
  if (modbusData.size > 0) {
    console.log(`✅ Found ${modbusData.size} Modbus-related data points:\n`);
    for (const [key, data] of modbusData.entries()) {
      console.log(`  • ${data.measurement} -> ${data.field}`);
      console.log(`    Value: ${data.sampleValue}, Time: ${data.latestTime}`);
      if (data.machineId) console.log(`    Machine ID: ${data.machineId}`);
      if (data.macAddress) console.log(`    MAC: ${data.macAddress}`);
      if (data.modbusTag) console.log(`    Modbus Tag: ${data.modbusTag}`);
      console.log('');
    }
  } else {
    console.log('❌ No explicit Modbus tags found\n');
  }
  
  // Check AcrylData, Ambient, CT for all tags to see if they have Modbus or connection info
  console.log('\n📊 Checking AcrylData, Ambient, CT for all tags...\n');
  
  const measurements = ['AcrylData', 'Ambient', 'CT'];
  
  for (const measurement of measurements) {
    console.log(`\nMeasurement: ${measurement}`);
    console.log('─'.repeat(60));
    
    // Get all tags by grouping and getting distinct tag values
    const tagsQuery = `
      from(bucket: "wisermachines-test")
        |> range(start: -7d)
        |> filter(fn: (r) => r["_measurement"] == "${measurement}")
        |> group()
        |> limit(n: 5)
    `;
    
    console.log('Sample data points with all tags:');
    let count = 0;
    await new Promise((resolve) => {
      queryApi.queryRows(tagsQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          if (count < 3) {
            console.log(`\n  Row ${count + 1}:`);
            // Get all column names from tableMeta
            const columns = tableMeta.columns();
            columns.forEach(col => {
              const value = record[col.label];
              if (value !== undefined && value !== null && col.label !== '_start' && col.label !== '_stop') {
                console.log(`    ${col.label}: ${value}`);
              }
            });
            count++;
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
  }
  
  // Check for fields matching screenshot (Pressure, Flow, Density, etc.)
  console.log('\n\n🔍 Checking for screenshot fields (Pressure, Flow, Density, Temperature)...\n');
  
  const screenshotFieldsQuery = `
    from(bucket: "wisermachines-test")
      |> range(start: -7d)
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
        r._field == "instantaneous_flow"
      )
      |> keep(columns: ["_measurement", "_field", "_time", "_value"])
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 50)
  `;
  
  const screenshotFields = new Map();
  
  await new Promise((resolve) => {
    queryApi.queryRows(screenshotFieldsQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const key = `${record._measurement}::${record._field}`;
        if (!screenshotFields.has(key)) {
          screenshotFields.set(key, {
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
  
  if (screenshotFields.size > 0) {
    console.log(`✅ Found ${screenshotFields.size} fields matching screenshot:\n`);
    for (const [key, data] of screenshotFields.entries()) {
      console.log(`  • ${data.measurement} -> ${data.field}`);
      console.log(`    Latest: ${data.latestTime}, Value: ${data.sampleValue}`);
    }
  } else {
    console.log('❌ No exact field names matching screenshot found');
    console.log('   (But we have P1, P2, P3 in AcrylData which might be pressure)');
  }
}

checkModbusInfluxDB().catch(console.error);

