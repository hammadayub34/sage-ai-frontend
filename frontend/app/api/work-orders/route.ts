import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client';

const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || 'my-super-secret-auth-token';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'myorg';
const WORK_ORDERS_BUCKET = process.env.NEXT_PUBLIC_WORK_ORDERS_BUCKET || 'work_orders';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

const queryApi: QueryApi = influxDB.getQueryApi(INFLUXDB_ORG);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machineId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const startDate = searchParams.get('startDate') || '-30d';
    const endDate = searchParams.get('endDate');

    console.log('[WorkOrders API] Fetching work orders:', {
      bucket: WORK_ORDERS_BUCKET,
      machineId,
      status,
      priority,
    });

    // Build Flux query
    let fluxQuery = `
      from(bucket: "${WORK_ORDERS_BUCKET}")
        |> range(start: ${startDate}${endDate ? `, stop: ${endDate}` : ''})
        |> filter(fn: (r) => r["_measurement"] == "work_order")
    `;

    if (machineId) {
      fluxQuery += `|> filter(fn: (r) => r["machineId"] == "${machineId}")`;
    }

    if (status) {
      fluxQuery += `|> filter(fn: (r) => r["status"] == "${status}")`;
    }

    if (priority) {
      fluxQuery += `|> filter(fn: (r) => r["priority"] == "${priority}")`;
    }

    fluxQuery += `
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 100)
    `;

    const results: any[] = [];

    return new Promise<NextResponse>((resolve) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          results.push(record);
        },
        error(error) {
          console.error('[WorkOrders API] InfluxDB query error:', error);
          console.error('[WorkOrders API] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
          });
          resolve(
            NextResponse.json(
              { error: error.message || 'Query failed', data: [] },
              { status: 500 }
            )
          );
        },
        complete() {
          console.log(`[WorkOrders API] Query complete. Found ${results.length} records`);
          // Transform results into work order objects
          const workOrders = results.map(record => ({
            workOrderNo: record.workOrderNo || '',
            machineId: record.machineId || '',
            status: record.status || 'pending',
            priority: record.priority || 'Medium',
            weekNo: record.weekNo || '',
            weekOf: record.weekOf || '',
            alarmType: record.alarmType || '',
            machineType: record.machineType || '',
            companyName: record.companyName || '',
            equipmentName: record.equipmentName || '',
            equipmentNumber: record.equipmentNumber || '',
            equipmentLocation: record.equipmentLocation || '',
            equipmentDescription: record.equipmentDescription || '',
            location: record.location || '',
            building: record.building || '',
            floor: record.floor || '',
            room: record.room || '',
            specialInstructions: record.specialInstructions || '',
            shop: record.shop || '',
            vendor: record.vendor || '',
            vendorAddress: record.vendorAddress || '',
            vendorPhone: record.vendorPhone || '',
            vendorContact: record.vendorContact || '',
            taskNumber: record.taskNumber || '',
            frequency: record.frequency || '',
            workDescription: record.workDescription || '',
            workPerformedBy: record.workPerformedBy || '',
            workPerformed: record.workPerformed || '',
            standardHours: record.standardHours || 0,
            overtimeHours: record.overtimeHours || 0,
            workCompleted: record.workCompleted || false,
            createdAt: record._time,
            parts: record.parts ? JSON.parse(record.parts) : [],
            materials: record.materials ? JSON.parse(record.materials) : [],
          }));

          console.log(`[WorkOrders API] Returning ${workOrders.length} work orders`);
          resolve(NextResponse.json({ data: workOrders }));
        },
      });
    });
  } catch (error: any) {
    console.error('[WorkOrders API] Error fetching work orders:', error);
    console.error('[WorkOrders API] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to fetch work orders', data: [] },
      { status: 500 }
    );
  }
}

