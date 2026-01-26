import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB, Point } from '@influxdata/influxdb-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const machineId = searchParams.get('machineId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Use NEXT_PUBLIC_ vars if available, otherwise fallback to defaults (same pattern as other API routes)
    const url = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
    const token = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
    const org = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'wisermachines';
    const bucket = process.env.INFLUXDB_BUCKET_ALARMS || 'wisermachines-test';

    const client = new InfluxDB({ url, token });
    const queryApi = client.getQueryApi(org);

    // Build Flux query
    let query = `from(bucket: "${bucket}")
      |> range(start: ${startDate ? `time(v: "${startDate}")` : '-30d'}, stop: ${endDate ? `time(v: "${endDate}")` : 'now()'})
      |> filter(fn: (r) => r._measurement == "alarm_events")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: ${limit})`;

    if (machineId) {
      query = query.replace(
        '|> filter(fn: (r) => r._measurement == "alarm_events")',
        `|> filter(fn: (r) => r._measurement == "alarm_events" and r.machine_id == "${machineId}")`
      );
    }

    const alerts: any[] = [];
    const alertMap = new Map<string, any>();

    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row: string[], tableMeta: any) {
          const record: any = {};
          tableMeta.columns.forEach((col: any, index: number) => {
            record[col.label] = row[index];
          });

          const timeKey = record._time;
          if (!alertMap.has(timeKey)) {
            alertMap.set(timeKey, {
              timestamp: record._time,
              machine_id: record.machine_id || '',
              alarm_type: record.alarm_type || '',
              alarm_name: record.alarm_name || record.alarm_type || '',
              alarm_label: record.alarm_label || record.alarm_type || '',
              state: record.state || 'RAISED',
              value: record.value !== undefined ? record.value : (record.state === 'RAISED'),
            });
          }
        },
        error(error: Error) {
          console.error('InfluxDB query error:', error);
          reject(error);
        },
        complete() {
          resolve();
        },
      });
    });

    // Convert map to array and sort
    const results = Array.from(alertMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ alerts: results });
  } catch (error: any) {
    console.error('Error fetching alarm events:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch alarm events' },
      { status: 500 }
    );
  }
}

