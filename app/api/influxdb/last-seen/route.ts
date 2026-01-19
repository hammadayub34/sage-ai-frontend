import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client';

const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'wisermachines';
const VIBRATION_BUCKET = process.env.NEXT_PUBLIC_VIBRATION_BUCKET || 'wisermachines-test';
const INFLUXDB_BUCKET = process.env.NEXT_PUBLIC_INFLUXDB_BUCKET || 'wisermachines-test';
const MODBUS_BUCKET = 'modbus';
const CNC_BUCKET = 'cnc_machines';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi: QueryApi = influxDB.getQueryApi(INFLUXDB_ORG);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machineId');

    if (!machineId) {
      return NextResponse.json(
        { error: 'machineId is required', lastSeen: null },
        { status: 400 }
      );
    }

    console.log(`[Last Seen API] Querying for machineId: ${machineId}`);

    // Query multiple buckets/measurements to find the latest timestamp
    const queries = [
      // Vibration data
      {
        bucket: VIBRATION_BUCKET,
        query: `
          from(bucket: "${VIBRATION_BUCKET}")
            |> range(start: -365d)
            |> filter(fn: (r) => r["_measurement"] == "Vibration")
            |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: 1)
        `
      },
      // General sensor data
      {
        bucket: INFLUXDB_BUCKET,
        query: `
          from(bucket: "${INFLUXDB_BUCKET}")
            |> range(start: -365d)
            |> filter(fn: (r) => r["machine_id"] == "${machineId}" or r["machineId"] == "${machineId}")
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: 1)
        `
      },
      // Modbus data
      {
        bucket: MODBUS_BUCKET,
        query: `
          from(bucket: "${MODBUS_BUCKET}")
            |> range(start: -365d)
            |> filter(fn: (r) => (exists r.machineID and r.machineID == "${machineId}") or (exists r.machineId and r.machineId == "${machineId}"))
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: 1)
        `
      },
      // CNC machines data
      {
        bucket: CNC_BUCKET,
        query: `
          from(bucket: "${CNC_BUCKET}")
            |> range(start: -365d)
            |> filter(fn: (r) => r["machine_id"] == "${machineId}")
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: 1)
        `
      }
    ];

    let latestTime: Date | null = null;

    // Query all buckets and find the latest timestamp
    for (const { bucket, query } of queries) {
      try {
        const results: any[] = [];
        
        await new Promise<void>((resolve) => {
          queryApi.queryRows(query, {
            next(row, tableMeta) {
              const record = tableMeta.toObject(row);
              if (record._time) {
                results.push(record);
              }
            },
            error(error) {
              // Silently fail for buckets that don't exist or have no data
              resolve();
            },
            complete() {
              resolve();
            },
          });
        });

        if (results.length > 0) {
          const recordTime = new Date(results[0]._time as string);
          if (!latestTime || recordTime > latestTime) {
            latestTime = recordTime;
            console.log(`[Last Seen API] Found data in bucket ${bucket}: ${recordTime.toISOString()}`);
          }
        }
      } catch (error) {
        // Continue to next bucket if this one fails
        continue;
      }
    }

    const result = {
      success: true,
      machineId,
      lastSeen: latestTime ? latestTime.toISOString() : null,
    };
    
    console.log(`[Last Seen API] Result for ${machineId}:`, result.lastSeen ? `Found: ${result.lastSeen}` : 'Not found');
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Last Seen API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch last seen timestamp', lastSeen: null },
      { status: 500 }
    );
  }
}

