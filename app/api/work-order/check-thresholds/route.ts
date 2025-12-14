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
  // Safety tags (counts transitions from safe to unsafe)
  DoorClosed: 5,  // Counts when door was open (false)
  EStopOK: 3,     // Counts when E-stop was not OK (false)
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

// Function to count safety tag occurrences (counts when tag is false/unsafe)
async function countSafetyTagOccurrences(
  safetyField: string,
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
      |> filter(fn: (r) => r["_field"] == "${safetyField}")
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
        console.error(`Error querying ${safetyField}:`, error);
        resolve(0);
      },
      complete() {
        // Count transitions from true to false (safe to unsafe)
        let prevValue: boolean | null = null;
        let transitions = 0;

        for (const record of results) {
          const currentValue = record._value as boolean;

          if (prevValue !== null && prevValue === true && currentValue === false) {
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
    const { 
      machineId, 
      machineType, 
      timeRange = '-24h', 
      customThreshold,
      safetyTags,  // Array of safety tags to check (optional)
      alarmTags    // Array of alarm tags to check (optional)
    } = await request.json();

    if (!machineId) {
      return NextResponse.json(
        { error: 'Machine ID is required' },
        { status: 400 }
      );
    }

    // Determine which tags to check
    let tagsToCheck: string[] = [];
    const isSafetyTag: Record<string, boolean> = {};

    // Add safety tags if provided (only for lathe)
    if (machineType === 'lathe' && safetyTags && Array.isArray(safetyTags) && safetyTags.length > 0) {
      // Remove duplicates and add to tagsToCheck
      const uniqueSafetyTags = [...new Set(safetyTags)];
      tagsToCheck.push(...uniqueSafetyTags);
      uniqueSafetyTags.forEach((tag: string) => {
        isSafetyTag[tag] = true;
      });
    }

    // Add alarm tags if provided
    if (alarmTags && Array.isArray(alarmTags) && alarmTags.length > 0) {
      // Remove duplicates and add to tagsToCheck
      const uniqueAlarmTags = [...new Set(alarmTags)];
      tagsToCheck.push(...uniqueAlarmTags);
    } else if (!safetyTags || (Array.isArray(safetyTags) && safetyTags.length === 0)) {
      // Fallback to all alarm tags if not specified (backward compatible)
      const allAlarmFields = machineType === 'lathe' ? [
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
      tagsToCheck.push(...allAlarmFields);
    }

    // Remove any duplicates from tagsToCheck (in case a tag appears in both safety and alarm arrays)
    tagsToCheck = [...new Set(tagsToCheck)];

    // Count occurrences for each tag
    const alarmCounts: AlarmCount[] = [];
    
    for (const tagField of tagsToCheck) {
      let count: number;
      
      // Use different counting logic for safety tags vs alarm tags
      if (isSafetyTag[tagField]) {
        count = await countSafetyTagOccurrences(tagField, machineId, timeRange, machineType);
      } else {
        count = await countAlarmOccurrences(tagField, machineId, timeRange, machineType);
      }
      
      const threshold = customThreshold || DEFAULT_THRESHOLDS[tagField] || 50; // Default to 50 if not in manual
      const exceeded = count >= threshold;

      alarmCounts.push({
        alarmType: tagField,
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

