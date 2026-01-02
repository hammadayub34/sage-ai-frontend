import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client';

const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'wisermachines';
const VIBRATION_BUCKET = process.env.INFLUXDB_BUCKET || 'wisermachines-test';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi: QueryApi = influxDB.getQueryApi(INFLUXDB_ORG);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machineId') || '';
    const timeRange = searchParams.get('timeRange') || '-7d'; // Default to 7 days to catch older data
    const windowPeriod = searchParams.get('windowPeriod') || '5m';
    const axis = searchParams.get('axis') || 'vibration'; // 'vibration', 'x_vibration', 'y_vibration', 'x_acc', 'y_acc', 'z_acc'

    if (!machineId) {
      return NextResponse.json(
        { error: 'machineId is required', data: [] },
        { status: 400 }
      );
    }

    // First, find the latest data point for this machine to determine actual data range
    const findLatestQuery = `
      from(bucket: "${VIBRATION_BUCKET}")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "Vibration")
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> filter(fn: (r) => r["_field"] == "${axis}")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;

    let latestTime: Date | null = null;
    const latestResults: any[] = [];

    // Find latest data point
    await new Promise<void>((resolve) => {
      queryApi.queryRows(findLatestQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          latestResults.push(record);
        },
        error(error) {
          console.warn('[Vibration API] Error finding latest time:', error.message);
          resolve();
        },
        complete() {
          if (latestResults.length > 0) {
            latestTime = new Date(latestResults[0]._time as string);
          }
          resolve();
        },
      });
    });

    // Parse timeRange (e.g., "-24h", "-7d", "-1m")
    let startTime: Date = new Date();
    if (timeRange.startsWith('-')) {
      const timeRangeStr = timeRange.slice(1);
      const unit = timeRangeStr.slice(-1);
      const value = parseInt(timeRangeStr.slice(0, -1));
      
      switch (unit) {
        case 'h':
          startTime.setHours(startTime.getHours() - value);
          break;
        case 'd':
          startTime.setDate(startTime.getDate() - value);
          break;
        case 'm':
          startTime.setMinutes(startTime.getMinutes() - value);
          break;
        case 's':
          startTime.setSeconds(startTime.getSeconds() - value);
          break;
        default:
          startTime.setDate(startTime.getDate() - 7); // Default to 7 days
      }
    }

    // If we found latest data and it's older than our time range, extend the range
    if (latestTime) {
      const timeDiff = startTime.getTime() - latestTime.getTime();
      if (timeDiff > 0) {
        // Latest data is older than requested range, extend to include it
        console.log(`[Vibration API] Latest data is ${Math.round(timeDiff / (1000 * 60 * 60))} hours older than requested range. Extending range.`);
        startTime = new Date(latestTime.getTime() - (24 * 60 * 60 * 1000)); // Go back 1 day from latest data
      }
    }
    
    const startTimeStr = startTime.toISOString();
    const stopTime = latestTime ? latestTime.toISOString() : new Date().toISOString();
    
    console.log(`[Vibration API] Querying for machineId: ${machineId}`);
    console.log(`[Vibration API] Axis: ${axis}`);
    console.log(`[Vibration API] Time range: ${startTimeStr} to ${stopTime}`);
    if (latestTime) {
      console.log(`[Vibration API] Latest data found: ${latestTime.toISOString()}`);
    }
    
    // Query the wisermachines-test bucket with Vibration measurement
    const fluxQuery = `
      from(bucket: "${VIBRATION_BUCKET}")
        |> range(start: ${startTimeStr}, stop: ${stopTime})
        |> filter(fn: (r) => r["_measurement"] == "Vibration")
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> filter(fn: (r) => r["_field"] == "${axis}")
        |> aggregateWindow(every: ${windowPeriod}, fn: mean, createEmpty: false)
        |> sort(columns: ["_time"])
        |> limit(n: 10000)
    `;

    console.log(`[Vibration API] Flux query: ${fluxQuery.substring(0, 200)}...`);

    const results: any[] = [];

    return new Promise<NextResponse>((resolve) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          results.push(record);
        },
        error(error) {
          console.error('[Vibration API] InfluxDB query error:', error);
          resolve(
            NextResponse.json(
              { error: error.message || 'Query failed', data: [] },
              { status: 500 }
            )
          );
        },
        complete() {
          console.log(`[Vibration API] Query complete. Found ${results.length} records`);
          const data = results.map(record => ({
            time: new Date(record._time as string).toISOString(),
            value: record._value as number,
          }));

          console.log(`[Vibration API] Returning ${data.length} data points for axis: ${axis}`);
          resolve(NextResponse.json({ 
            data, 
            axis,
            latestDataTime: latestTime ? latestTime.toISOString() : null,
            timeRange: { start: startTimeStr, stop: stopTime }
          }));
        },
      });
    });
  } catch (error: any) {
    console.error('[Vibration API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch vibration data', data: [] },
      { status: 500 }
    );
  }
}

