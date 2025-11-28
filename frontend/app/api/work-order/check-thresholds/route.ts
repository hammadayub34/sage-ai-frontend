import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client';

const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || 'my-super-secret-auth-token';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'myorg';
const INFLUXDB_BUCKET = process.env.NEXT_PUBLIC_INFLUXDB_BUCKET || process.env.INFLUXDB_BUCKET || 'plc_data_new';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi: QueryApi = influxDB.getQueryApi(INFLUXDB_ORG);

// Thresholds from maintenance manual (can be overridden)
const DEFAULT_THRESHOLDS: Record<string, number> = {
  AlarmFault: 3,
  AlarmOverfill: 5,
  AlarmUnderfill: 5,
  AlarmLowProductLevel: 3,
  AlarmCapMissing: 5,
  AlarmSpindleOverload: 3,
  AlarmChuckNotClamped: 5,
  AlarmDoorOpen: 10,
  AlarmToolWear: 2,
  AlarmCoolantLow: 3,
};

interface AlarmCount {
  alarmType: string;
  count: number;
  threshold: number;
  exceeded: boolean;
}

async function countAlarmOccurrences(
  alarmField: string,
  machineId: string,
  timeRange: string,
  machineType?: string
): Promise<number> {
  const machineTypeFilter = machineType 
    ? `|> filter(fn: (r) => r["machine_type"] == "${machineType}")`
    : '';

  const fluxQuery = `
    from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: ${timeRange})
      |> filter(fn: (r) => r["machine_id"] == "${machineId}")
      ${machineTypeFilter}
      |> filter(fn: (r) => r["_field"] == "${alarmField}")
      |> sort(columns: ["_time"])
      |> aggregateWindow(every: 1s, fn: last, createEmpty: false)
  `;

  const results: any[] = [];

  return new Promise((resolve, reject) => {
    queryApi.queryRows(fluxQuery, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        results.push(record);
      },
      error(error) {
        console.error(`Error querying ${alarmField}:`, error);
        resolve(0);
      },
      complete() {
        // Count transitions from false to true
        let prevValue: boolean | null = null;
        let transitions = 0;

        for (const record of results) {
          const currentValue = record._value as boolean;

          if (prevValue !== null && prevValue === false && currentValue === true) {
            transitions++;
          }

          prevValue = currentValue;
        }

        resolve(transitions);
      },
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const { machineId, machineType, timeRange = '-24h', customThreshold } = await request.json();

    if (!machineId) {
      return NextResponse.json(
        { error: 'Machine ID is required' },
        { status: 400 }
      );
    }

    // Get alarm fields based on machine type
    const alarmFields = machineType === 'lathe' ? [
      'AlarmSpindleOverload',
      'AlarmChuckNotClamped',
      'AlarmDoorOpen',
      'AlarmToolWear',
      'AlarmCoolantLow'
    ] : [
      'AlarmFault',
      'AlarmOverfill',
      'AlarmUnderfill',
      'AlarmLowProductLevel',
      'AlarmCapMissing'
    ];

    // Count occurrences for each alarm
    const alarmCounts: AlarmCount[] = [];
    
    for (const alarmField of alarmFields) {
      const count = await countAlarmOccurrences(alarmField, machineId, timeRange, machineType);
      const threshold = customThreshold || DEFAULT_THRESHOLDS[alarmField] || 50; // Default to 50 if not in manual
      const exceeded = count >= threshold;

      alarmCounts.push({
        alarmType: alarmField,
        count,
        threshold,
        exceeded,
      });
    }

    // Find alarms that exceeded threshold
    const exceededAlarms = alarmCounts.filter(a => a.exceeded);

    return NextResponse.json({
      success: true,
      alarmCounts,
      exceededAlarms: exceededAlarms.map(a => a.alarmType),
      shouldGenerateWorkOrder: exceededAlarms.length > 0,
      summary: exceededAlarms.length > 0
        ? `${exceededAlarms.length} alarm(s) exceeded threshold: ${exceededAlarms.map(a => `${a.alarmType} (${a.count}/${a.threshold})`).join(', ')}`
        : 'No alarms exceeded threshold',
    });
  } catch (error: any) {
    console.error('Error checking alarm thresholds:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check alarm thresholds' },
      { status: 500 }
    );
  }
}

