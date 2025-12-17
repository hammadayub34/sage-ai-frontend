import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client';

const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || 'my-super-secret-auth-token';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'myorg';
const CNC_BUCKET = 'cnc_machine_data';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi: QueryApi = influxDB.getQueryApi(INFLUXDB_ORG);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machineId') || 'lathe01';
    // Use a longer time range since the data is from March 2024
    const timeRange = searchParams.get('timeRange') || '-24h';
    const windowPeriod = searchParams.get('windowPeriod') || '5s'; // Use 5-second intervals to match raw data

    // Map machineId (lathe01, lathe02, etc.) to the UUID format used in the CSV
    // The CSV has machine_id as UUID: 09ce4fec-8de8-4c1e-a987-9a0080313456
    // This maps to lathe01
    const machineIdMap: Record<string, string> = {
      'lathe01': '09ce4fec-8de8-4c1e-a987-9a0080313456',
      'lathe02': '09ce4fec-8de8-4c1e-a987-9a0080313456', // Update with actual UUID if different
      'lathe03': '09ce4fec-8de8-4c1e-a987-9a0080313456', // Update with actual UUID if different
    };

    // Get the mapped UUID, fallback to the provided machineId if not in map
    const mappedMachineId = machineIdMap[machineId] || machineId;
    
    // First, find the latest data point to use as the "end" time
    // Then calculate start time by going back the requested time range
    const findLatestQuery = `
      from(bucket: "${CNC_BUCKET}")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "sensor_data")
        |> filter(fn: (r) => r["sensor_type"] == "vibration")
        |> filter(fn: (r) => r["machine_id"] == "${mappedMachineId}")
        |> filter(fn: (r) => r["_field"] == "value")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;

    // Get the latest timestamp first
    let latestTime: Date | null = null;
    const latestResults: any[] = [];
    
    await new Promise<void>((resolve) => {
      queryApi.queryRows(findLatestQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          latestResults.push(record);
        },
        error(error) {
          console.error('[Vibration API] Error finding latest time:', error);
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

    // If no data found, use a default range
    if (!latestTime) {
      latestTime = new Date('2024-03-04T07:29:50Z'); // Latest time from CSV
    }

    // Calculate start time based on timeRange parameter
    const stopTime = latestTime.toISOString();
    let startTime: Date = new Date(latestTime);
    
    // Parse timeRange (e.g., "-24h", "-7d", "-365d")
    if (timeRange.startsWith('-')) {
      const timeRangeStr = timeRange.slice(1); // Remove the minus sign
      const unit = timeRangeStr.slice(-1); // Get last character (h, d, m, etc.)
      const value = parseInt(timeRangeStr.slice(0, -1)); // Get the number
      
      switch (unit) {
        case 'h': // hours
          startTime.setHours(startTime.getHours() - value);
          break;
        case 'd': // days
          startTime.setDate(startTime.getDate() - value);
          break;
        case 'm': // minutes
          startTime.setMinutes(startTime.getMinutes() - value);
          break;
        case 's': // seconds
          startTime.setSeconds(startTime.getSeconds() - value);
          break;
        default:
          // Default to 24 hours if format is unknown
          startTime.setHours(startTime.getHours() - 24);
      }
    } else {
      // If not a relative range, try to parse as absolute date
      startTime = new Date(timeRange);
    }
    
    const startTimeStr = startTime.toISOString();
    
    console.log(`[Vibration API] Querying for machineId: ${machineId} -> mapped to: ${mappedMachineId}`);
    console.log(`[Vibration API] Latest data point: ${stopTime}`);
    console.log(`[Vibration API] Time range: ${startTimeStr} to ${stopTime}`);
    
    const fluxQuery = `
      from(bucket: "${CNC_BUCKET}")
        |> range(start: ${startTimeStr}, stop: ${stopTime})
        |> filter(fn: (r) => r["_measurement"] == "sensor_data")
        |> filter(fn: (r) => r["sensor_type"] == "vibration")
        |> filter(fn: (r) => r["machine_id"] == "${mappedMachineId}")
        |> filter(fn: (r) => r["_field"] == "value")
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

          console.log(`[Vibration API] Returning ${data.length} data points`);
          resolve(NextResponse.json({ data }));
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

