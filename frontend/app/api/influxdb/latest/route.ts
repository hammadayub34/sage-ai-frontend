import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client';

// Use NEXT_PUBLIC_ vars if available, otherwise fallback to defaults
const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || 'my-super-secret-auth-token';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'myorg';
const INFLUXDB_BUCKET = process.env.NEXT_PUBLIC_INFLUXDB_BUCKET || process.env.INFLUXDB_BUCKET || 'plc_data_new';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi: QueryApi = influxDB.getQueryApi(INFLUXDB_ORG);

/**
 * GET /api/influxdb/latest?machineId=machine-01
 * Returns the latest tag values for a machine in a convenient format
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const machineId = searchParams.get('machineId') || 'machine-01';
    const timeRange = searchParams.get('timeRange') || '-24h';

    // Query to get latest tag values
    // For counters (BottlesFilled, BottlesRejected), calculate total by summing increments
    // This handles counter resets properly
    // For other fields, use last() to get the most recent value
    const counterFields = ['BottlesFilled', 'BottlesRejected'];
    
    // For counters, calculate total by summing increments using difference()
    // Only count small increments (1-10) to ignore large jumps that might be data issues
    // This correctly handles counter resets by only counting actual bottle increments
    const counterTotalQuery = `
      from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r["machine_id"] == "${machineId}")
        |> filter(fn: (r) => r["_field"] == "BottlesFilled" or r["_field"] == "BottlesRejected")
        |> sort(columns: ["_time"])
        |> aggregateWindow(every: 1s, fn: last, createEmpty: false)
        |> difference()
        |> filter(fn: (r) => r["_value"] > 0 and r["_value"] <= 10)
        |> group(columns: ["_field"])
        |> sum()
    `;
    
    // Get latest values for all other fields
    const latestQuery = `
      from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r["machine_id"] == "${machineId}")
        |> filter(fn: (r) => r["_field"] != "BottlesFilled" and r["_field"] != "BottlesRejected")
        |> group(columns: ["_field"])
        |> last()
    `;

    const allResults: Record<string, any> = {};
    let latestTimestamp: string | null = null;

    return new Promise<NextResponse>((resolve) => {
      let queriesCompleted = 0;
      const totalQueries = 2;

      const checkComplete = () => {
        queriesCompleted++;
        if (queriesCompleted === totalQueries) {

          if (Object.keys(allResults).length === 0) {
            resolve(
              NextResponse.json(
                { 
                  message: 'No data found',
                  machineId,
                  data: null 
                },
                { status: 404 }
              )
            );
            return;
          }

          // Build the final data object
          const cleanedData: Record<string, any> = {
            _time: latestTimestamp || new Date().toISOString(),
            machine_id: machineId,
          };

          // Add all field values
          for (const [field, value] of Object.entries(allResults)) {
            cleanedData[field] = value;
          }

          resolve(
            NextResponse.json({
              machineId,
              timestamp: latestTimestamp,
              data: cleanedData,
            })
          );
        }
      };

      // Query 1: Get counter totals by summing small increments (1-10)
      // This counts actual bottle increments while ignoring large jumps/resets
      queryApi.queryRows(counterTotalQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const field = record._field as string;
          const value = record._value as number;
          
          if (counterFields.includes(field)) {
            allResults[field] = value;
          }
        },
        error(error) {
          console.error('InfluxDB counter total query error:', error);
          checkComplete();
        },
        complete() {
          checkComplete();
        },
      });

      // Query 3: Get latest values for other fields
      queryApi.queryRows(latestQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const field = record._field as string;
          const value = record._value;
          const time = record._time as string;
          
          if (!counterFields.includes(field)) {
            allResults[field] = value;
            if (!latestTimestamp || time > latestTimestamp) {
              latestTimestamp = time;
            }
          }
        },
        error(error) {
          console.error('InfluxDB latest query error:', error);
          checkComplete();
        },
        complete() {
          checkComplete();
        },
      });
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

