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

interface DowntimePeriod {
  startTime: string;
  endTime: string | null;
  duration: number;
}

interface DowntimeStats {
  downtimePercentage: number;
  uptimePercentage: number;
  totalDowntime: number;
  totalUptime: number;
  incidentCount: number;
  periods: DowntimePeriod[];
  comparison?: {
    previousDowntimePercentage: number;
    change: number;
    trend: 'increasing' | 'decreasing' | 'same';
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const machineId = searchParams.get('machineId') || '';
    const timeRange = searchParams.get('timeRange') || '-7d';

    if (!machineId) {
      return NextResponse.json(
        { error: 'machineId is required' },
        { status: 400 }
      );
    }

    // Parse timeRange to get start time
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
          startTime.setDate(startTime.getDate() - 7);
      }
    }
    
    const startTimeStr = startTime.toISOString();
    const endTime = new Date();
    const totalTimeSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
    
    console.log(`[Downtime API] Time Range Calculation:`);
    console.log(`  Input: ${timeRange}`);
    console.log(`  Start: ${startTimeStr}`);
    console.log(`  End: ${endTime.toISOString()}`);
    console.log(`  Total seconds: ${totalTimeSeconds.toFixed(0)} (${(totalTimeSeconds/3600).toFixed(2)} hours)`);
    console.log(`[Downtime API] Querying for machineId: ${machineId}`);

    // Query vibration data to find gaps (downtime = no data)
    // First, find the latest data point to ensure we're querying the right range
    const findLatestQuery = `
      from(bucket: "${VIBRATION_BUCKET}")
        |> range(start: -365d)
        |> filter(fn: (r) => r["_measurement"] == "Vibration")
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> filter(fn: (r) => r["_field"] == "vibration" or r["_field"] == "x_vibration" or r["_field"] == "y_vibration")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;

    const latestResults: any[] = [];

    // Find latest data point - explicitly type the result
    await new Promise<void>((resolve) => {
      queryApi.queryRows(findLatestQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          latestResults.push(record);
        },
        error(error) {
          console.warn('[Downtime API] Error finding latest time:', error.message);
          resolve();
        },
        complete() {
          resolve();
        },
      });
    });

    // Extract latestTime after the Promise completes
    let latestTime: Date | null = null;
    if (latestResults.length > 0) {
      latestTime = new Date(latestResults[0]._time as string);
      console.log(`[Downtime API] Latest data point found: ${latestTime.toISOString()}`);
    } else {
      console.log(`[Downtime API] No latest data point found`);
    }

    // Match vibration API logic: use latestTime for end time and extend start time if needed
    // This ensures downtime calculates for the same period that vibration chart shows
    let actualStartTime = startTime;
    
    // If we found latest data and it's older than our time range, extend the range (like vibration API)
    if (latestTime) {
      const timeDiff = startTime.getTime() - latestTime.getTime();
      if (timeDiff > 0) {
        // Latest data is older than requested range, extend to include it
        console.log(`[Downtime API] Latest data is ${Math.round(timeDiff / (1000 * 60 * 60))} hours older than requested range. Extending range.`);
        const extendedStart = new Date(latestTime.getTime() - (24 * 60 * 60 * 1000)); // Go back 1 day from latest data
        // Ensure extended start is before latestTime
        if (extendedStart.getTime() < latestTime.getTime()) {
          actualStartTime = extendedStart;
        } else {
          // Fallback: use latestTime - 1 hour if extension would be invalid
          actualStartTime = new Date(latestTime.getTime() - (60 * 60 * 1000));
          console.warn(`[Downtime API] Extended start time would be invalid, using 1 hour before latestTime`);
        }
      }
    }
    
    const actualStartTimeStr = actualStartTime.toISOString();
    // For downtime calculation, always use the requested endTime (NOW or specified end date)
    // Don't use latestTime as end time because that would make old data look like current downtime
    // Instead, use the requested endTime so we calculate downtime for the actual requested period
    const actualEndTime = endTime; // Always use the requested end time, not latestTime
    const actualEndTimeStr = actualEndTime.toISOString();
    const actualTotalTimeSeconds = (actualEndTime.getTime() - actualStartTime.getTime()) / 1000;
    
    // Validate time range
    if (actualTotalTimeSeconds <= 0) {
      console.error(`[Downtime API] Invalid time range: start (${actualStartTimeStr}) is after end (${actualEndTimeStr})`);
      return NextResponse.json({
        data: {
          downtimePercentage: 100,
          uptimePercentage: 0,
          totalDowntime: 0,
          totalUptime: 0,
          incidentCount: 0,
          periods: [],
        },
      });
    }
    
    console.log(`[Downtime API] Using adjusted time range (matching vibration API logic):`);
    if (latestTime) {
      console.log(`[Downtime API] Latest data found: ${latestTime.toISOString()}`);
      console.log(`[Downtime API] Using latest data as end time (matching vibration chart)`);
    } else {
      console.log(`[Downtime API] No latest data found, using NOW as end time`);
    }
    console.log(`[Downtime API] Adjusted time range: ${actualStartTimeStr} to ${actualEndTimeStr}`);
    console.log(`[Downtime API] Adjusted total seconds: ${actualTotalTimeSeconds.toFixed(0)} (${(actualTotalTimeSeconds/3600).toFixed(2)} hours)`);

    // Query vibration data - get all timestamps where data exists
    const fluxQuery = `
      from(bucket: "${VIBRATION_BUCKET}")
        |> range(start: ${actualStartTimeStr}, stop: ${actualEndTimeStr})
        |> filter(fn: (r) => r["_measurement"] == "Vibration")
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> filter(fn: (r) => r["_field"] == "vibration" or r["_field"] == "x_vibration" or r["_field"] == "y_vibration")
        |> keep(columns: ["_time"])
        |> group()
        |> distinct(column: "_time")
        |> sort(columns: ["_time"])
    `;

    console.log(`[Downtime API] Flux query: ${fluxQuery.substring(0, 200)}...`);

    const results: any[] = [];

    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          results.push(record);
        },
        error(error) {
          console.error('[Downtime API] InfluxDB query error:', error);
          reject(error);
        },
        complete() {
          console.log(`[Downtime API] Found ${results.length} data points`);
          resolve();
        },
      });
    });

    // If no data at all, machine is 100% down
    if (results.length === 0) {
      console.log(`[Downtime API] ⚠️  No vibration data found for machineId: ${machineId}`);
      console.log(`[Downtime API] This could mean:`);
      console.log(`  1. Machine has no data in the selected time range`);
      console.log(`  2. MachineId format doesn't match InfluxDB`);
      console.log(`  3. Data exists but query isn't finding it`);
      console.log(`[Downtime API] Returning 100% downtime for ${actualTotalTimeSeconds.toFixed(0)}s period`);
      
      return NextResponse.json({
        data: {
          downtimePercentage: 100,
          uptimePercentage: 0,
          totalDowntime: actualTotalTimeSeconds,
          totalUptime: 0,
          incidentCount: 1,
          periods: [{
            startTime: actualStartTimeStr,
            endTime: null,
            duration: actualTotalTimeSeconds,
          }],
        },
      });
    }

    // Find gaps in data (downtime periods)
    const periods: DowntimePeriod[] = [];
    
    // Extract unique timestamps from results
    const timestampSet = new Set<number>();
    results.forEach(r => {
      const timeStr = r._time || r._value || (r as any).time;
      if (timeStr) {
        try {
          const timestamp = typeof timeStr === 'string' ? new Date(timeStr).getTime() : timeStr;
          if (!isNaN(timestamp)) {
            timestampSet.add(timestamp);
          }
        } catch (e) {
          // Skip invalid timestamps
        }
      }
    });
    
    const dataPoints = Array.from(timestampSet).sort((a, b) => a - b);
    
    console.log(`[Downtime API] Extracted ${dataPoints.length} unique timestamps from ${results.length} results`);
    console.log(`[Downtime API] Processing ${dataPoints.length} data points`);
    console.log(`[Downtime API] First data point: ${new Date(dataPoints[0]).toISOString()}`);
    console.log(`[Downtime API] Last data point: ${new Date(dataPoints[dataPoints.length - 1]).toISOString()}`);

    // Expected interval between data points - vibration data typically comes every minute or so
    // Consider it downtime if gap > 5 minutes (more lenient threshold)
    const gapThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds

    let totalDowntime = 0;
    const startTimeMs = actualStartTime.getTime();
    const endTimeMs = actualEndTime.getTime();

    // Check for initial gap (from start to first data point)
    if (dataPoints.length > 0) {
      const firstDataTime = dataPoints[0];
      if (firstDataTime - startTimeMs > gapThreshold) {
        const duration = (firstDataTime - startTimeMs) / 1000;
        periods.push({
          startTime: new Date(startTimeMs).toISOString(),
          endTime: new Date(firstDataTime).toISOString(),
          duration,
        });
        totalDowntime += duration;
        console.log(`[Downtime API] Initial gap: ${duration.toFixed(0)}s`);
      }
    }

    // Find gaps between data points
    for (let i = 0; i < dataPoints.length - 1; i++) {
      const currentTime = dataPoints[i];
      const nextTime = dataPoints[i + 1];
      const gap = nextTime - currentTime;

      if (gap > gapThreshold) {
        const duration = gap / 1000;
        periods.push({
          startTime: new Date(currentTime).toISOString(),
          endTime: new Date(nextTime).toISOString(),
          duration,
        });
        totalDowntime += duration;
        console.log(`[Downtime API] Gap found: ${duration.toFixed(0)}s between ${new Date(currentTime).toISOString()} and ${new Date(nextTime).toISOString()}`);
      }
    }

    // Check for final gap (from last data point to now)
    if (dataPoints.length > 0) {
      const lastDataPointTime = dataPoints[dataPoints.length - 1];
      const timeSinceLastData = endTimeMs - lastDataPointTime;
      if (timeSinceLastData > gapThreshold) {
        const duration = timeSinceLastData / 1000;
        periods.push({
          startTime: new Date(lastDataPointTime).toISOString(),
          endTime: null,
          duration,
        });
        totalDowntime += duration;
        console.log(`[Downtime API] Final gap: ${duration.toFixed(0)}s since last data`);
      }
    }

    console.log(`[Downtime API] Total downtime: ${totalDowntime.toFixed(0)}s out of ${actualTotalTimeSeconds.toFixed(0)}s`);

    // Calculate uptime: time periods where data exists
    const totalUptime = actualTotalTimeSeconds - totalDowntime;
    const downtimePercentage = actualTotalTimeSeconds > 0 ? (totalDowntime / actualTotalTimeSeconds) * 100 : 0;
    const uptimePercentage = actualTotalTimeSeconds > 0 ? (totalUptime / actualTotalTimeSeconds) * 100 : 100;

    console.log(`[Downtime API] Calculation Summary:`);
    console.log(`  Total time period: ${actualTotalTimeSeconds.toFixed(0)}s (${(actualTotalTimeSeconds/3600).toFixed(1)} hours)`);
    console.log(`  Total downtime: ${totalDowntime.toFixed(0)}s (${(totalDowntime/3600).toFixed(1)} hours)`);
    console.log(`  Total uptime: ${totalUptime.toFixed(0)}s (${(totalUptime/3600).toFixed(1)} hours)`);
    console.log(`  Downtime %: ${downtimePercentage.toFixed(2)}%`);
    console.log(`  Uptime %: ${uptimePercentage.toFixed(2)}%`);
    console.log(`  Incidents: ${periods.length}`);

    // Calculate comparison with previous period
    let comparison: DowntimeStats['comparison'] | undefined;
    
    // Calculate previous period time range
    const previousEndTime = actualStartTime;
    const previousStartTime = new Date(previousEndTime.getTime() - actualTotalTimeSeconds * 1000);
    const previousStartTimeStr = previousStartTime.toISOString();
    const previousEndTimeStr = previousEndTime.toISOString();
    
    console.log(`[Downtime API] Calculating comparison for previous period: ${previousStartTimeStr} to ${previousEndTimeStr}`);
    console.log(`[Downtime API] Using machineId: ${machineId} for comparison query`);
    
    // Query previous period data
    const previousFluxQuery = `
      from(bucket: "${VIBRATION_BUCKET}")
        |> range(start: ${previousStartTimeStr}, stop: ${previousEndTimeStr})
        |> filter(fn: (r) => r["_measurement"] == "Vibration")
        |> filter(fn: (r) => exists r.machineId and r.machineId == "${machineId}")
        |> filter(fn: (r) => r["_field"] == "vibration" or r["_field"] == "x_vibration" or r["_field"] == "y_vibration")
        |> keep(columns: ["_time"])
        |> group()
        |> distinct(column: "_time")
        |> sort(columns: ["_time"])
    `;

    console.log(`[Downtime API] Previous period query: ${previousFluxQuery.substring(0, 200)}...`);

    const previousResults: any[] = [];
    
    await new Promise<void>((resolve) => {
      queryApi.queryRows(previousFluxQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          previousResults.push(record);
        },
        error(error) {
          console.error('[Downtime API] Error querying previous period:', error);
          console.error('[Downtime API] Error details:', error.message);
          resolve();
        },
        complete() {
          console.log(`[Downtime API] Found ${previousResults.length} data points in previous period for machineId: ${machineId}`);
          if (previousResults.length === 0) {
            console.log(`[Downtime API] ⚠️  No data found in previous period - comparison will not be available`);
          }
          resolve();
        },
      });
    });

    // Calculate downtime for previous period
    let previousDowntimePercentage: number = 0;
    
    if (previousResults.length > 0) {
      const previousTimestampSet = new Set<number>();
      previousResults.forEach(r => {
        const timeStr = r._time || r._value || (r as any).time;
        if (timeStr) {
          try {
            const timestamp = typeof timeStr === 'string' ? new Date(timeStr).getTime() : timeStr;
            if (!isNaN(timestamp)) {
              previousTimestampSet.add(timestamp);
            }
          } catch (e) {
            // Skip invalid timestamps
          }
        }
      });
      
      const previousDataPoints = Array.from(previousTimestampSet).sort((a, b) => a - b);
      
      let previousTotalDowntime = 0;
      const previousStartTimeMs = previousStartTime.getTime();
      const previousEndTimeMs = previousEndTime.getTime();
      
      // Initial gap
      if (previousDataPoints.length > 0) {
        const firstDataTime = previousDataPoints[0];
        if (firstDataTime - previousStartTimeMs > gapThreshold) {
          previousTotalDowntime += (firstDataTime - previousStartTimeMs) / 1000;
        }
      }
      
      // Gaps between data points
      for (let i = 0; i < previousDataPoints.length - 1; i++) {
        const gap = previousDataPoints[i + 1] - previousDataPoints[i];
        if (gap > gapThreshold) {
          previousTotalDowntime += gap / 1000;
        }
      }
      
      // Final gap
      if (previousDataPoints.length > 0) {
        const lastDataPointTime = previousDataPoints[previousDataPoints.length - 1];
        const timeSinceLastData = previousEndTimeMs - lastDataPointTime;
        if (timeSinceLastData > gapThreshold) {
          previousTotalDowntime += timeSinceLastData / 1000;
        }
      }
      
      previousDowntimePercentage = actualTotalTimeSeconds > 0 
        ? (previousTotalDowntime / actualTotalTimeSeconds) * 100 
        : 0;
    } else {
      previousDowntimePercentage = 100;
      console.log(`[Downtime API] ⚠️  No data found in previous period - assuming 100% downtime`);
    }
    
    const change = downtimePercentage - previousDowntimePercentage;
    const trend = Math.abs(change) < 0.1 ? 'same' : (change > 0 ? 'increasing' : 'decreasing');
    
    comparison = {
      previousDowntimePercentage: Math.max(0, Math.min(100, previousDowntimePercentage)),
      change: Math.abs(change),
      trend,
    };
    
    console.log(`[Downtime API] Comparison calculated:`);
    console.log(`  Previous period downtime: ${previousDowntimePercentage.toFixed(2)}%`);
    console.log(`  Current period downtime: ${downtimePercentage.toFixed(2)}%`);
    console.log(`  Change: ${change > 0 ? '+' : ''}${change.toFixed(2)}%`);
    console.log(`  Trend: ${trend}`);

    const stats: DowntimeStats = {
      downtimePercentage: Math.max(0, Math.min(100, downtimePercentage)),
      uptimePercentage: Math.max(0, Math.min(100, uptimePercentage)),
      totalDowntime,
      totalUptime,
      incidentCount: periods.length,
      periods: periods.slice(0, 10),
      comparison,
    };

    return NextResponse.json({ data: stats });
  } catch (error: any) {
    console.error('[Downtime API] Error:', error);
    console.error('[Downtime API] Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to calculate downtime',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}