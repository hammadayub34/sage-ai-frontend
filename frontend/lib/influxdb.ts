/**
 * InfluxDB client and query functions
 * Uses Next.js API routes to proxy queries (browser-compatible)
 */

// Configuration - can be moved to environment variables
const INFLUXDB_BUCKET = process.env.NEXT_PUBLIC_INFLUXDB_BUCKET || 'plc_data_new';
const API_BASE = '/api/influxdb/query';

/**
 * Execute a Flux query via API route
 */
async function executeQuery(fluxQuery: string): Promise<any[]> {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fluxQuery }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error);
      throw new Error(error.error || 'Query failed');
    }

    const result = await response.json();
    const data = result.data || [];
    
    // Debug logging
    if (data.length > 0) {
      console.log('✅ Query successful, got', data.length, 'records');
    } else {
      console.warn('⚠️ Query returned empty results');
    }
    
    return data;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

/**
 * Query a single field value (latest)
 */
export async function queryFieldValue(
  field: string,
  machineId: string = 'machine-01',
  timeRange: string = '-24h',
  machineType?: string
): Promise<number | boolean | null> {
  const machineTypeFilter = machineType 
    ? `|> filter(fn: (r) => r["machine_type"] == "${machineType}")`
    : '';

  const fluxQuery = `
    from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: ${timeRange})
      |> filter(fn: (r) => r["machine_id"] == "${machineId}")
      ${machineTypeFilter}
      |> filter(fn: (r) => r["_field"] == "${field}")
      |> last()
  `;

  const results = await executeQuery(fluxQuery);
  return results.length > 0 ? (results[0]._value as number | boolean) : null;
}

/**
 * Query multiple fields (latest values)
 */
export async function queryMultipleFields(
  fields: string[],
  machineId: string = 'machine-01',
  timeRange: string = '-24h',
  machineType?: string
): Promise<Record<string, number | boolean>> {
  const fieldFilter = fields.map(f => `r["_field"] == "${f}"`).join(' or ');
  const machineTypeFilter = machineType 
    ? `|> filter(fn: (r) => r["machine_type"] == "${machineType}")`
    : '';
  
  const fluxQuery = `
    from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: ${timeRange})
      |> filter(fn: (r) => r["machine_id"] == "${machineId}")
      ${machineTypeFilter}
      |> filter(fn: (r) => ${fieldFilter})
      |> last()
  `;

  const results = await executeQuery(fluxQuery);
  const data: Record<string, number | boolean> = {};
  
  for (const record of results) {
    const field = record._field as string;
    data[field] = record._value as number | boolean;
  }
  
  return data;
}

/**
 * Query all tags in a pivoted table format (latest row)
 * Uses GET endpoint for simpler machineId switching
 */
export async function queryAllTags(
  machineId: string = 'machine-01',
  timeRange: string = '-24h',
  machineType?: string
): Promise<Record<string, any>> {
  try {
    // Use GET endpoint - simpler and cleaner
    let url = `/api/influxdb/latest?machineId=${machineId}&timeRange=${timeRange}`;
    if (machineType) {
      url += `&machineType=${machineType}`;
    }
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        // No data found - return empty object
        return {};
      }
      const error = await response.json();
      console.error('API Error:', error);
      throw new Error(error.error || 'Query failed');
    }

    const result = await response.json();
    
    if (!result.data) {
      return {};
    }
    
    // Return the data object directly (already cleaned by the API)
    return result.data;
  } catch (error) {
    console.error('Error fetching all tags:', error);
    throw error;
  }
}

/**
 * Query time series data for charts
 */
export async function queryTimeSeries(
  field: string,
  machineId: string = 'machine-01',
  timeRange: string = '-1h',
  windowPeriod?: string,
  machineType?: string
): Promise<Array<{ time: string; value: number; field: string }>> {
  // Auto-determine window period based on time range if not provided
  // For shorter ranges, use smaller windows for better granularity
  let effectiveWindowPeriod = windowPeriod;
  if (!effectiveWindowPeriod) {
    if (timeRange.includes('-1h') || timeRange.includes('-30m')) {
      effectiveWindowPeriod = '1m'; // 1 minute windows for last hour
    } else if (timeRange.includes('-24h') || timeRange.includes('-12h')) {
      effectiveWindowPeriod = '5m'; // 5 minute windows for last 24 hours
    } else {
      effectiveWindowPeriod = '5m'; // Default
    }
  }

  // Build machine_type filter if provided
  const machineTypeFilter = machineType 
    ? `|> filter(fn: (r) => r["machine_type"] == "${machineType}")`
    : '';

  const fluxQuery = `
    from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: ${timeRange})
      |> filter(fn: (r) => r["machine_id"] == "${machineId}")
      ${machineTypeFilter}
      |> filter(fn: (r) => r["_field"] == "${field}")
      |> aggregateWindow(every: ${effectiveWindowPeriod}, fn: mean, createEmpty: false)
  `;

  console.log(`[TimeSeries] Querying ${field} for ${machineId}, range: ${timeRange}, window: ${effectiveWindowPeriod}`);

  const results = await executeQuery(fluxQuery);
  
  console.log(`[TimeSeries] Got ${results.length} data points for ${field}`);
  
  return results.map((record) => ({
    time: new Date(record._time as string).toISOString(),
    value: record._value as number,
    field: field,
  }));
}

/**
 * Query alarm history (count of alarm occurrences in time range)
 * Counts transitions from false -> true (actual alarm events), not just data points where alarm is true
 */
export async function queryAlarmHistory(
  machineId: string = 'machine-01',
  timeRange: string = '-24h',
  machineType?: string
): Promise<Record<string, number>> {
  // Different alarm fields for bottle filler vs lathe
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
  
  const alarmCounts: Record<string, number> = {};
  
  // Initialize all alarms to 0
  alarmFields.forEach(field => {
    alarmCounts[field] = 0;
  });
  
  const machineTypeFilter = machineType 
    ? `|> filter(fn: (r) => r["machine_type"] == "${machineType}")`
    : '';
  
  // For each alarm field, query values and count transitions in JavaScript
  // Since Flux's difference() doesn't work on booleans, we process in JS
  for (const field of alarmFields) {
    const fluxQuery = `
      from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r["machine_id"] == "${machineId}")
        ${machineTypeFilter}
        |> filter(fn: (r) => r["_field"] == "${field}")
        |> sort(columns: ["_time"])
        |> aggregateWindow(every: 1s, fn: last, createEmpty: false)
    `;
    
    try {
      const results = await executeQuery(fluxQuery);
      
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
      
      alarmCounts[field] = transitions;
    } catch (error) {
      console.error(`Error querying ${field}:`, error);
      alarmCounts[field] = 0;
    }
  }
  
  return alarmCounts;
}

/**
 * Downtime period interface
 */
export interface DowntimePeriod {
  startTime: string;
  endTime: string | null; // null if still down
  duration: number; // in seconds
}

/**
 * Downtime statistics
 */
export interface DowntimeStats {
  totalDowntime: number; // total seconds
  totalDowntimeFormatted: string; // formatted as "Xh Ym Zs"
  incidentCount: number;
  averageDowntime: number; // average seconds per incident
  averageDowntimeFormatted: string;
  periods: DowntimePeriod[];
  uptimePercentage: number; // percentage of time machine was up
}

/**
 * Query downtime statistics for a machine
 * Calculates periods where SystemRunning = false OR Fault = true
 */
export async function queryDowntime(
  machineId: string = 'machine-01',
  timeRange: string = '-24h',
  machineType?: string
): Promise<DowntimeStats> {
  const machineTypeFilter = machineType 
    ? `|> filter(fn: (r) => r["machine_type"] == "${machineType}")`
    : '';

  // Query both SystemRunning and Fault fields
  const fluxQuery = `
    from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: ${timeRange})
      |> filter(fn: (r) => r["machine_id"] == "${machineId}")
      ${machineTypeFilter}
      |> filter(fn: (r) => r["_field"] == "SystemRunning" or r["_field"] == "Fault")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"])
      |> map(fn: (r) => ({
          r with
          isDown: if exists r.SystemRunning and exists r.Fault then
            (if r.SystemRunning == false or r.Fault == true then 1 else 0)
          else if exists r.SystemRunning then
            (if r.SystemRunning == false then 1 else 0)
          else if exists r.Fault then
            (if r.Fault == true then 1 else 0)
          else 0
        }))
      |> filter(fn: (r) => exists r.isDown)
  `;

  const results = await executeQuery(fluxQuery);
  
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
  
  return {
    totalDowntime,
    totalDowntimeFormatted: formatDuration(totalDowntime),
    incidentCount,
    averageDowntime,
    averageDowntimeFormatted: formatDuration(averageDowntime),
    periods: periods.slice(0, 10), // Limit to last 10 periods
    uptimePercentage: Math.max(0, Math.min(100, uptimePercentage)),
  };
}

