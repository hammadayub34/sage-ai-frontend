import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client';

export const dynamic = 'force-dynamic';

// Get InfluxDB configuration
const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || 'my-super-secret-auth-token';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'myorg';
const INFLUXDB_BUCKET = process.env.NEXT_PUBLIC_INFLUXDB_BUCKET || process.env.INFLUXDB_BUCKET || 'plc_data_new';
const CNC_BUCKET = 'cnc_machine_data';

/**
 * GET /api/influxdb/machines-with-vibration
 * Find all machines that have vibration data in InfluxDB
 */
export async function GET(request: NextRequest) {
  try {
    const influxDB = new InfluxDB({
      url: INFLUXDB_URL,
      token: INFLUXDB_TOKEN,
    });

    const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

    // Query wisermachines-test bucket - uses "Vibration" measurement with "machineId" tag
    const wisermachinesQuery = `
      from(bucket: "wisermachines-test")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "Vibration")
        |> filter(fn: (r) => exists r.machineId)
        |> group(columns: ["machineId"])
        |> distinct(column: "machineId")
        |> sort(columns: ["machineId"])
    `;

    // Query CNC bucket - uses sensor_data measurement
    const cncVibrationQuery = `
      from(bucket: "${CNC_BUCKET}")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "sensor_data")
        |> filter(fn: (r) => r["sensor_type"] == "vibration")
        |> filter(fn: (r) => r["_field"] == "value")
        |> group(columns: ["machine_id"])
        |> distinct(column: "machine_id")
        |> sort(columns: ["machine_id"])
    `;

    // Also check main bucket for other vibration patterns
    const mainBucketQuery = `
      from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: -30d)
        |> filter(fn: (r) => 
          r._field =~ /vibration/i or 
          r._field =~ /vib/i or
          r._field =~ /accel/i
        )
        |> group(columns: ["machine_id"])
        |> distinct(column: "machine_id")
        |> sort(columns: ["machine_id"])
    `;

    const machines: Set<string> = new Set();
    const machineDetails: Record<string, { latestTime: string; field: string; bucket: string }> = {};

    // Query wisermachines-test bucket first (primary source for vibration data)
    try {
      await new Promise<void>((resolve, reject) => {
        queryApi.queryRows(wisermachinesQuery, {
          next(row, tableMeta) {
            const record = tableMeta.toObject(row);
            const machineId = record.machineId || record._value;
            if (machineId) {
              machines.add(machineId);
              if (!machineDetails[machineId]) {
                machineDetails[machineId] = {
                  latestTime: '',
                  field: 'vibration',
                  bucket: 'wisermachines-test',
                };
              }
            }
          },
          error(error) {
            console.warn('Error querying wisermachines-test bucket:', error.message);
            resolve(); // Don't fail, just continue
          },
          complete() {
            resolve();
          },
        });
      });
    } catch (error: any) {
      console.warn('Wisermachines-test bucket query failed:', error.message);
    }

    // Query CNC bucket
    try {
      await new Promise<void>((resolve, reject) => {
        queryApi.queryRows(cncVibrationQuery, {
          next(row, tableMeta) {
            const record = tableMeta.toObject(row);
            const machineId = record.machine_id || record._value;
            if (machineId) {
              machines.add(machineId);
              if (!machineDetails[machineId]) {
                machineDetails[machineId] = {
                  latestTime: '',
                  field: record._field || '',
                  bucket: CNC_BUCKET,
                };
              }
            }
          },
          error(error) {
            console.warn('Error querying CNC bucket:', error.message);
            resolve();
          },
          complete() {
            resolve();
          },
        });
      });
    } catch (error: any) {
      console.warn('CNC bucket query failed:', error.message);
    }

    // Query main bucket for other vibration patterns
    try {
      await new Promise<void>((resolve, reject) => {
        queryApi.queryRows(mainBucketQuery, {
          next(row, tableMeta) {
            const record = tableMeta.toObject(row);
            const machineId = record.machine_id || record._value;
            if (machineId) {
              machines.add(machineId);
              if (!machineDetails[machineId] || machineDetails[machineId].bucket === INFLUXDB_BUCKET) {
                machineDetails[machineId] = {
                  latestTime: '',
                  field: record._field || '',
                  bucket: CNC_BUCKET,
                };
              }
            }
          },
          error(error) {
            console.warn('Error querying CNC bucket:', error.message);
            resolve();
          },
          complete() {
            resolve();
          },
        });
      });
    } catch (error: any) {
      console.warn('CNC bucket query failed:', error.message);
    }

    // Get latest timestamp for each machine
    const machineList = Array.from(machines);
    for (const machineId of machineList) {
      const bucket = machineDetails[machineId]?.bucket || INFLUXDB_BUCKET;
      let latestQuery = '';
      if (bucket === 'wisermachines-test') {
        latestQuery = `
          from(bucket: "${bucket}")
            |> range(start: -365d)
            |> filter(fn: (r) => 
              r["_measurement"] == "Vibration" and
              r["machineId"] == "${machineId}" and
              (r["_field"] == "vibration" or r["_field"] == "x_vibration" or r["_field"] == "y_vibration")
            )
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: 1)
        `;
      } else if (bucket === CNC_BUCKET) {
        latestQuery = `
          from(bucket: "${bucket}")
            |> range(start: -365d)
            |> filter(fn: (r) => 
              r["_measurement"] == "sensor_data" and
              r["sensor_type"] == "vibration" and
              r["_field"] == "value" and
              r["machine_id"] == "${machineId}"
            )
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: 1)
        `;
      } else {
        latestQuery = `
          from(bucket: "${bucket}")
            |> range(start: -30d)
            |> filter(fn: (r) => 
              (r._field =~ /vibration/i or r._field =~ /vib/i or r._field =~ /accel/i) and
              r.machine_id == "${machineId}"
            )
            |> group(columns: ["machine_id"])
            |> last()
        `;
      }

      try {
        await new Promise<void>((resolve) => {
          queryApi.queryRows(latestQuery, {
            next(row, tableMeta) {
              const record = tableMeta.toObject(row);
              if (machineDetails[machineId]) {
                machineDetails[machineId].latestTime = record._time || '';
                machineDetails[machineId].field = record._field || machineDetails[machineId].field;
              }
            },
            error() {
              resolve();
            },
            complete() {
              resolve();
            },
          });
        });
      } catch (error) {
        // Ignore errors
      }
    }

    const result = machineList.map(machineId => ({
      machineId,
      bucket: machineDetails[machineId]?.bucket || INFLUXDB_BUCKET,
      field: machineDetails[machineId]?.field || 'vibration',
      latestDataTime: machineDetails[machineId]?.latestTime || 'Unknown',
    }));

    return NextResponse.json({
      success: true,
      connection: {
        url: INFLUXDB_URL,
        org: INFLUXDB_ORG,
        bucket: INFLUXDB_BUCKET,
      },
      machines: result,
      count: result.length,
    });
  } catch (error: any) {
    console.error('Error finding machines with vibration data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to query vibration data',
        connection: {
          url: INFLUXDB_URL,
          org: INFLUXDB_ORG,
        },
      },
      { status: 500 }
    );
  }
}

