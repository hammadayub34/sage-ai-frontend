/**
 * Test InfluxDB connection and list buckets
 * Run with: node scripts/test-influxdb.js
 * 
 * Make sure to set environment variables:
 *   export NEXT_PUBLIC_INFLUXDB_URL=https://influxtest.wisermachines.com
 *   export NEXT_PUBLIC_INFLUXDB_TOKEN=your-token
 *   export NEXT_PUBLIC_INFLUXDB_ORG=de2169640328f76d
 */

const { InfluxDB } = require('@influxdata/influxdb-client');

// Get InfluxDB configuration from environment
const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || 'my-super-secret-auth-token';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'myorg';

console.log('🔌 Testing InfluxDB Connection...\n');
console.log('Configuration:');
console.log(`  URL: ${INFLUXDB_URL}`);
console.log(`  Org: ${INFLUXDB_ORG}`);
console.log(`  Token: ${INFLUXDB_TOKEN.substring(0, 20)}...${INFLUXDB_TOKEN.substring(INFLUXDB_TOKEN.length - 10)}`);
console.log('');

// Create InfluxDB client
const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

// Get the Buckets API
const bucketsApi = influxDB.getBucketsApi();

async function testConnection() {
  try {
    console.log('📡 Connecting to InfluxDB...');
    
    // List all buckets
    const buckets = await bucketsApi.getBuckets();
    
    console.log(`\n✅ Connection successful!\n`);
    console.log(`📦 Found ${buckets.length} bucket(s):\n`);
    
    if (buckets.length === 0) {
      console.log('  ⚠️  No buckets found');
    } else {
      buckets.forEach((bucket, index) => {
        console.log(`  ${index + 1}. ${bucket.name}`);
        console.log(`     ID: ${bucket.id}`);
        console.log(`     Org ID: ${bucket.orgID}`);
        console.log(`     Retention: ${bucket.retentionRules?.length > 0 ? bucket.retentionRules[0].everySeconds + 's' : 'Infinite'}`);
        console.log(`     Created: ${bucket.createdAt ? new Date(bucket.createdAt).toLocaleString() : 'N/A'}`);
        console.log('');
      });
    }
    
    // Test query to verify we can query data
    console.log('🧪 Testing query capability...');
    const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);
    
    // Try a simple query to list measurements from the first bucket
    if (buckets.length > 0) {
      const testBucket = buckets[0].name;
      const testQuery = `
        from(bucket: "${testBucket}")
          |> range(start: -1h)
          |> limit(n: 1)
      `;
      
      let querySuccess = false;
      await new Promise((resolve, reject) => {
        queryApi.queryRows(testQuery, {
          next(row, tableMeta) {
            querySuccess = true;
            const record = tableMeta.toObject(row);
            console.log(`\n✅ Query test successful!`);
            console.log(`   Sample data from bucket "${testBucket}":`);
            console.log(`   Measurement: ${record._measurement || 'N/A'}`);
            console.log(`   Field: ${record._field || 'N/A'}`);
            console.log(`   Value: ${record._value || 'N/A'}`);
            console.log(`   Time: ${record._time || 'N/A'}`);
            resolve();
          },
          error(error) {
            console.log(`\n⚠️  Query test failed (this might be normal if bucket is empty):`);
            console.log(`   Error: ${error.message}`);
            resolve(); // Don't reject, just note the error
          },
          complete() {
            if (!querySuccess) {
              console.log(`\n⚠️  No data found in bucket "${testBucket}" (bucket might be empty)`);
            }
            resolve();
          },
        });
      });
    }
    
    console.log('\n✅ Connection test complete!\n');
    
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error(`Error: ${error.message}`);
    console.error('\nTroubleshooting:');
    console.error('  1. Check if the URL is correct');
    console.error('  2. Verify the token is valid');
    console.error('  3. Ensure the org ID is correct');
    console.error('  4. Check network connectivity');
    process.exit(1);
  }
}

// Run the test
testConnection().catch(console.error);

