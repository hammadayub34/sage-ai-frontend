import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB } from '@influxdata/influxdb-client';

export const dynamic = 'force-dynamic';

// Get InfluxDB configuration
const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || 'my-super-secret-auth-token';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'myorg';

/**
 * GET /api/influxdb/test
 * Test InfluxDB connection and list all buckets
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔌 Testing InfluxDB Connection...');
    console.log(`URL: ${INFLUXDB_URL}`);
    console.log(`Org: ${INFLUXDB_ORG}`);
    console.log(`Token: ${INFLUXDB_TOKEN.substring(0, 20)}...`);

    // Create InfluxDB client
    const influxDB = new InfluxDB({
      url: INFLUXDB_URL,
      token: INFLUXDB_TOKEN,
    });

    // Use HTTP API to list buckets
    const bucketsUrl = `${INFLUXDB_URL}/api/v2/buckets?org=${INFLUXDB_ORG}`;
    const bucketsResponse = await fetch(bucketsUrl, {
      headers: {
        'Authorization': `Token ${INFLUXDB_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!bucketsResponse.ok) {
      const errorText = await bucketsResponse.text();
      throw new Error(`Failed to fetch buckets: ${bucketsResponse.status} ${errorText}`);
    }

    const bucketsData = await bucketsResponse.json();
    const buckets = bucketsData.buckets || [];

    const bucketsList = buckets.map((bucket: any) => ({
      name: bucket.name,
      id: bucket.id,
      orgID: bucket.orgID,
      retention: bucket.retentionRules?.length > 0 
        ? `${bucket.retentionRules[0].everySeconds}s` 
        : 'Infinite',
      createdAt: bucket.createdAt ? new Date(bucket.createdAt).toISOString() : null,
    }));

    // Test query capability with the first bucket (if available)
    let queryTest = null;
    if (buckets.length > 0) {
      const testBucket = buckets[0].name;
      const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);
      
      const testQuery = `
        from(bucket: "${testBucket}")
          |> range(start: -1h)
          |> limit(n: 1)
      `;

      try {
        const queryResult = await new Promise<any>((resolve, reject) => {
          const results: any[] = [];
          queryApi.queryRows(testQuery, {
            next(row, tableMeta) {
              const record = tableMeta.toObject(row);
              results.push(record);
            },
            error(error) {
              reject(error);
            },
            complete() {
              resolve(results);
            },
          });
        });

        if (queryResult.length > 0) {
          queryTest = {
            success: true,
            bucket: testBucket,
            sampleData: {
              measurement: queryResult[0]._measurement || 'N/A',
              field: queryResult[0]._field || 'N/A',
              value: queryResult[0]._value || 'N/A',
              time: queryResult[0]._time || 'N/A',
            },
          };
        } else {
          queryTest = {
            success: true,
            bucket: testBucket,
            message: 'Bucket is empty (no data found)',
          };
        }
      } catch (error: any) {
        queryTest = {
          success: false,
          bucket: testBucket,
          error: error.message,
        };
      }
    }

    return NextResponse.json({
      success: true,
      connection: {
        url: INFLUXDB_URL,
        org: INFLUXDB_ORG,
        connected: true,
      },
      buckets: {
        count: buckets.length,
        list: bucketsList,
      },
      queryTest,
    });
  } catch (error: any) {
    console.error('❌ InfluxDB connection failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Connection failed',
        connection: {
          url: INFLUXDB_URL,
          org: INFLUXDB_ORG,
          connected: false,
        },
        troubleshooting: [
          'Check if the URL is correct',
          'Verify the token is valid',
          'Ensure the org ID is correct',
          'Check network connectivity',
        ],
      },
      { status: 500 }
    );
  }
}

