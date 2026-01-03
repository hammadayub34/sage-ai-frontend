import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client';

const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'wisermachines';
const MODBUS_BUCKET = 'modbus';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi: QueryApi = influxDB.getQueryApi(INFLUXDB_ORG);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machineId') || '';
    const macAddress = searchParams.get('macAddress') || '';
    const timeRange = searchParams.get('timeRange') || '-7d';
    const windowPeriod = searchParams.get('windowPeriod') || '5m';
    const field = searchParams.get('field') || 'Pressure'; // Pressure, Density, Temperature, Instantaneous flow, Differential pressure/frequency

    if (!machineId && !macAddress) {
      return NextResponse.json(
        { error: 'machineId or macAddress is required', data: [] },
        { status: 400 }
      );
    }

    // Parse time range
    const now = new Date();
    let startTime: Date;
    if (timeRange === '-24h' || timeRange === '24h') {
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (timeRange === '-7d' || timeRange === '7d') {
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '-30d' || timeRange === '30d') {
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days
    }

    const startTimeStr = startTime.toISOString();
    const stopTime = now.toISOString();

    // Build filter based on machineId or MAC address
    // Prefer MAC address if both are provided, as it's more reliable
    let filterCondition = '';
    if (macAddress) {
      filterCondition = `exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${macAddress}"`;
    } else if (machineId) {
      // Try both machineID and machineId (case variations)
      // Note: In modbus bucket, machineID is "12345", not MongoDB ObjectId
      filterCondition = `(exists r.machineID and r.machineID == "${machineId}") or (exists r.machineId and r.machineId == "${machineId}")`;
    }

    // Handle field name variations (with spaces, underscores, etc.)
    // Try exact match first, then try variations
    const fieldVariations = [
      field, // Exact match
      field.replace(/\s+/g, '_'), // Replace spaces with underscores
      field.replace(/_/g, ' '), // Replace underscores with spaces
    ];

    // Query the modbus bucket - try to match any field variation
    const fluxQuery = `
      from(bucket: "${MODBUS_BUCKET}")
        |> range(start: ${startTimeStr}, stop: ${stopTime})
        |> filter(fn: (r) => r["_measurement"] == "modbus")
        |> filter(fn: (r) => ${filterCondition})
        |> filter(fn: (r) => r["_field"] == "${field}" or r["_field"] == "${field.replace(/\s+/g, '_')}" or r["_field"] == "${field.replace(/_/g, ' ')}")
        |> aggregateWindow(every: ${windowPeriod}, fn: mean, createEmpty: false)
        |> sort(columns: ["_time"])
        |> limit(n: 10000)
    `;

    console.log(`[Modbus API] Querying field: ${field}, machineId: ${machineId}, macAddress: ${macAddress}`);

    const results: any[] = [];

    return new Promise<NextResponse>((resolve) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          results.push(record);
        },
        error(error) {
          console.error('[Modbus API] InfluxDB query error:', error);
          resolve(
            NextResponse.json(
              { error: error.message || 'Query failed', data: [] },
              { status: 500 }
            )
          );
        },
        complete() {
          console.log(`[Modbus API] Query complete. Found ${results.length} records for field: ${field}`);
          const data = results.map(record => ({
            time: new Date(record._time as string).toISOString(),
            value: record._value as number,
          }));

          resolve(NextResponse.json({ 
            data, 
            field,
            timeRange: { start: startTimeStr, stop: stopTime }
          }));
        },
      });
    });
  } catch (error: any) {
    console.error('[Modbus API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch modbus data', data: [] },
      { status: 500 }
    );
  }
}

