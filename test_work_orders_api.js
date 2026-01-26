// Test the work orders API
const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('Testing /api/work-orders endpoint...');
    const response = await fetch('http://localhost:3000/api/work-orders');
    
    if (!response.ok) {
      console.error('Error:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Number of work orders:', data.data?.length || 0);
    
    if (data.data && data.data.length > 0) {
      console.log('\nFirst work order:');
      const first = data.data[0];
      console.log('  workOrderNo:', first.workOrderNo);
      console.log('  machineId:', first.machineId);
      console.log('  status:', first.status);
      console.log('  priority:', first.priority);
      console.log('  companyName:', first.companyName);
      console.log('  Total fields:', Object.keys(first).length);
    } else {
      console.log('No work orders in response');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error testing API:', error.message);
  }
}

testAPI();
