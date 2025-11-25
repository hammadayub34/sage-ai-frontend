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
  timeRange: string = '-24h'
): Promise<number | boolean | null> {
  const fluxQuery = `
    from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: ${timeRange})
      |> filter(fn: (r) => r["machine_id"] == "${machineId}")
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
  timeRange: string = '-24h'
): Promise<Record<string, number | boolean>> {
  const fieldFilter = fields.map(f => `r["_field"] == "${f}"`).join(' or ');
  
  const fluxQuery = `
    from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: ${timeRange})
      |> filter(fn: (r) => r["machine_id"] == "${machineId}")
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
  timeRange: string = '-24h'
): Promise<Record<string, any>> {
  try {
    // Use GET endpoint - simpler and cleaner
    const response = await fetch(`/api/influxdb/latest?machineId=${machineId}&timeRange=${timeRange}`);
    
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
  windowPeriod?: string
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

  const fluxQuery = `
    from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: ${timeRange})
      |> filter(fn: (r) => r["machine_id"] == "${machineId}")
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
  timeRange: string = '-24h'
): Promise<Record<string, number>> {
  const alarmFields = [
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
  
  // For each alarm field, query values and count transitions in JavaScript
  // Since Flux's difference() doesn't work on booleans, we process in JS
  for (const field of alarmFields) {
    const fluxQuery = `
      from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r["machine_id"] == "${machineId}")
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

