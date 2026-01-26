const fetch = require('node-fetch');

// Test the vibration API endpoint
async function testVibrationAPI() {
  // Try to find Globrotonics machine ID - you may need to update this
  const testMachineIds = [
    'globrotonics',
    'Globrotonics',
    '6958155ea4f09743147b22ab', // Example machine ID format
  ];

  for (const machineId of testMachineIds) {
    console.log(`\n=== Testing machineId: ${machineId} ===`);
    
    try {
      const url = `http://localhost:3005/api/influxdb/vibration?machineId=${machineId}&timeRange=-24h&windowPeriod=5m&axis=vibration`;
      console.log(`URL: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`Status: ${response.status}`);
      console.log(`Response:`, JSON.stringify(data, null, 2));
      
      if (data.data && data.data.length > 0) {
        console.log(`\nFirst 5 data points:`);
        data.data.slice(0, 5).forEach((point, idx) => {
          console.log(`  ${idx + 1}. time: ${point.time}, value: ${point.value} (type: ${typeof point.value})`);
        });
        
        const values = data.data.map(d => d.value);
        console.log(`\nValue statistics:`);
        console.log(`  Count: ${values.length}`);
        console.log(`  Min: ${Math.min(...values)}`);
        console.log(`  Max: ${Math.max(...values)}`);
        console.log(`  Avg: ${values.reduce((a, b) => a + b, 0) / values.length}`);
        console.log(`  Non-zero count: ${values.filter(v => v !== 0).length}`);
      } else {
        console.log(`No data returned`);
      }
    } catch (error) {
      console.error(`Error testing ${machineId}:`, error.message);
    }
  }
}

testVibrationAPI().catch(console.error);

