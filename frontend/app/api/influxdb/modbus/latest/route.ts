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

    if (!machineId && !macAddress) {
      return NextResponse.json(
        { error: 'machineId or macAddress is required', data: {} },
        { status: 400 }
      );
    }

    // Build filter based on machineId or MAC address
    let filterCondition = '';
    if (macAddress) {
      filterCondition = `exists r.MAC_ADDRESS and r.MAC_ADDRESS == "${macAddress}"`;
    } else if (machineId) {
      filterCondition = `(exists r.machineID and r.machineID == "${machineId}") or (exists r.machineId and r.machineId == "${machineId}")`;
    }

    // Fields to fetch latest values for
    const fields = [
      'Pressure',
      'Differential pressure/frequency',
      'Instantaneous flow',
      'Instantaneous_flow',
      'Density',
      'Temperature'
    ];

    const latestValues: Record<string, { value: number; time: string }> = {};

    // Query each field to get the latest value
    for (const field of fields) {
      const fluxQuery = `
        from(bucket: "${MODBUS_BUCKET}")
          |> range(start: -7d)
          |> filter(fn: (r) => r["_measurement"] == "modbus")
          |> filter(fn: (r) => ${filterCondition})
          |> filter(fn: (r) => r["_field"] == "${field}" or r["_field"] == "${field.replace(/\s+/g, '_')}" or r["_field"] == "${field.replace(/_/g, ' ')}")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n: 1)
      `;

      await new Promise<void>((resolve) => {
        queryApi.queryRows(fluxQuery, {
          next(row, tableMeta) {
            const record = tableMeta.toObject(row);
            const fieldName = record._field as string;
            if (!latestValues[fieldName]) {
              latestValues[fieldName] = {
                value: record._value as number,
                time: record._time as string,
              };
            }
          },
          error(error) {
            console.error(`[Modbus Latest API] Error querying ${field}:`, error);
            resolve();
          },
          complete() {
            resolve();
          },
        });
      });
    }

    // Map to standardized field names
    const result: Record<string, { value: number; time: string }> = {};
    
    // Pressure
    if (latestValues['Pressure']) {
      result['Pressure'] = latestValues['Pressure'];
    }
    
    // Diff Pressure/Freq
    if (latestValues['Differential pressure/frequency']) {
      result['Diff Pressure/Freq'] = latestValues['Differential pressure/frequency'];
    } else if (latestValues['Differential_pressure_frequency']) {
      result['Diff Pressure/Freq'] = latestValues['Differential_pressure_frequency'];
    }
    
    // Instantaneous Flow
    if (latestValues['Instantaneous_flow']) {
      result['Instantaneous Flow'] = latestValues['Instantaneous_flow'];
    } else if (latestValues['Instantaneous flow']) {
      result['Instantaneous Flow'] = latestValues['Instantaneous flow'];
    }
    
    // Density
    if (latestValues['Density']) {
      result['Density'] = latestValues['Density'];
    }
    
    // Temperature (optional)
    if (latestValues['Temperature']) {
      result['Temperature'] = latestValues['Temperature'];
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Modbus Latest API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch latest modbus values', data: {} },
      { status: 500 }
    );
  }
}

