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

interface DowntimePeriod {
  startTime: string;
  endTime: string | null;
  duration: number;
}

interface DowntimeStats {
  totalDowntime: number;
  totalDowntimeFormatted: string;
  incidentCount: number;
  averageDowntime: number;
  averageDowntimeFormatted: string;
  periods: DowntimePeriod[];
  uptimePercentage: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const machineId = searchParams.get('machineId') || 'machine-01';
    const timeRange = searchParams.get('timeRange') || '-24h';
    const machineType = searchParams.get('machineType');

    const machineTypeFilter = machineType 
      ? `|> filter(fn: (r) => r["machine_type"] == "${machineType}")`
      : '';

    // Determine which fields to use for downtime detection
    // For bottle filler: Use AlarmLowProductLevel (stops production, actually changes)
    // For lathe: Use Fault field (which does change) and critical alarms
    let downtimeFields: string[];
    if (machineType === 'lathe') {
      // Lathe: Fault field changes, and critical alarms that stop production
      downtimeFields = ['Fault', 'AlarmChuckNotClamped', 'AlarmDoorOpen'];
    } else {
      // Bottle filler: Use AlarmLowProductLevel (critical alarm that stops production and actually changes)
      // Note: AlarmFault is always False (derived from static Fault field), so we use AlarmLowProductLevel
      downtimeFields = ['AlarmLowProductLevel'];
    }

    const fieldFilter = downtimeFields.map(f => `r["_field"] == "${f}"`).join(' or ');

    // Query fields that indicate downtime
    const fluxQuery = `
      from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r["machine_id"] == "${machineId}")
        ${machineTypeFilter}
        |> filter(fn: (r) => ${fieldFilter})
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"])
        |> map(fn: (r) => ({
            r with
            isDown: ${machineType === 'lathe' 
              ? `if exists r.Fault then (if r.Fault == true then 1 else 0) else if exists r.AlarmChuckNotClamped then (if r.AlarmChuckNotClamped == true then 1 else 0) else if exists r.AlarmDoorOpen then (if r.AlarmDoorOpen == true then 1 else 0) else 0`
              : `if exists r.AlarmLowProductLevel then (if r.AlarmLowProductLevel == true then 1 else 0) else 0`
            }
          }))
    `;

    const results: any[] = [];

    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          results.push(record);
        },
        error(error) {
          console.error('InfluxDB query error:', error);
          reject(error);
        },
        complete() {
          resolve();
        },
      });
    });

    // Process results to find downtime periods
    const periods: DowntimePeriod[] = [];
    let currentPeriodStart: string | null = null;
    let prevIsDown = false;
    let totalDowntime = 0;
    
    // Get the time range to calculate total time
    const rangeMatch = timeRange.match(/-(\d+)([hdms])/);
    let totalTimeSeconds = 24 * 3600; // default 24h
    if (rangeMatch) {
      const value = parseInt(rangeMatch[1]);
      const unit = rangeMatch[2];
      if (unit === 'h') totalTimeSeconds = value * 3600;
      else if (unit === 'd') totalTimeSeconds = value * 24 * 3600;
      else if (unit === 'm') totalTimeSeconds = value * 60;
      else if (unit === 's') totalTimeSeconds = value;
    }
    
    for (const record of results) {
      const time = record._time as string;
      const isDown = (record.isDown as number) === 1;
      
      // Detect transition from up to down
      if (!prevIsDown && isDown) {
        currentPeriodStart = time;
      }
      
      // Detect transition from down to up
      if (prevIsDown && !isDown && currentPeriodStart) {
        const startTime = new Date(currentPeriodStart).getTime();
        const endTime = new Date(time).getTime();
        const duration = (endTime - startTime) / 1000; // seconds
        
        periods.push({
          startTime: currentPeriodStart,
          endTime: time,
          duration,
        });
        
        totalDowntime += duration;
        currentPeriodStart = null;
      }
      
      prevIsDown = isDown;
    }
    
    // Handle case where machine is still down at the end
    if (currentPeriodStart) {
      const startTime = new Date(currentPeriodStart).getTime();
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      
      periods.push({
        startTime: currentPeriodStart,
        endTime: null,
        duration,
      });
      
      totalDowntime += duration;
    }
    
    const incidentCount = periods.length;
    const averageDowntime = incidentCount > 0 ? totalDowntime / incidentCount : 0;
    const uptimePercentage = totalTimeSeconds > 0 
      ? ((totalTimeSeconds - totalDowntime) / totalTimeSeconds) * 100 
      : 100;
    
    // Format duration helper
    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    };
    
    const stats: DowntimeStats = {
      totalDowntime,
      totalDowntimeFormatted: formatDuration(totalDowntime),
      incidentCount,
      averageDowntime,
      averageDowntimeFormatted: formatDuration(averageDowntime),
      periods: periods.slice(0, 10), // Limit to last 10 periods
      uptimePercentage: Math.max(0, Math.min(100, uptimePercentage)),
    };

    return NextResponse.json({ data: stats });
  } catch (error: any) {
    console.error('Downtime API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate downtime' },
      { status: 500 }
    );
  }
}

