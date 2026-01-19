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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fluxQuery } = body;

    if (!fluxQuery) {
      return NextResponse.json(
        { error: 'fluxQuery is required' },
        { status: 400 }
      );
    }

    const results: any[] = [];

    return new Promise<NextResponse>((resolve) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          results.push(record);
        },
        error(error) {
          console.error('InfluxDB query error:', error);
          resolve(
            NextResponse.json(
              { error: error.message || 'Query failed' },
              { status: 500 }
            )
          );
        },
        complete() {
          resolve(NextResponse.json({ data: results }));
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

