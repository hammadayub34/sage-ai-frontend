const https = require('https');

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'wisermachines';
const BUCKET_NAME = 'work_orders';

// First, get the org ID
const getOrgId = () => {
  return new Promise((resolve, reject) => {
    const url = `${INFLUXDB_URL}/api/v2/orgs?org=${INFLUXDB_ORG}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Token ${INFLUXDB_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const orgs = JSON.parse(data).orgs || [];
          if (orgs.length > 0) {
            resolve(orgs[0].id);
          } else {
            reject(new Error('Organization not found'));
          }
        } else {
          reject(new Error(`Failed to get org ID: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

// Create the bucket
const createBucket = (orgId) => {
  return new Promise((resolve, reject) => {
    const url = `${INFLUXDB_URL}/api/v2/buckets`;
    const urlObj = new URL(url);
    
    const bucketData = {
      name: BUCKET_NAME,
      orgID: orgId,
      retentionRules: [], // No retention (infinite)
    };

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUXDB_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          console.log(`✅ Bucket "${BUCKET_NAME}" created successfully!`);
          console.log(JSON.parse(data));
          resolve(JSON.parse(data));
        } else {
          if (data.includes('already exists')) {
            console.log(`ℹ️  Bucket "${BUCKET_NAME}" already exists`);
            resolve({ exists: true });
          } else {
            reject(new Error(`Failed to create bucket: ${res.statusCode} ${data}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(bucketData));
    req.end();
  });
};

// Main execution
(async () => {
  try {
    console.log(`Creating bucket "${BUCKET_NAME}" in org "${INFLUXDB_ORG}"...`);
    const orgId = await getOrgId();
    console.log(`Found org ID: ${orgId}`);
    await createBucket(orgId);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();

