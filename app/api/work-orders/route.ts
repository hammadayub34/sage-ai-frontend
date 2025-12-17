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
      |> limit(n: 1000)
    `;

    const results: any[] = [];
    const workOrderMap = new Map<string, any>();

    return new Promise<NextResponse>((resolve) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const record = tableMeta.toObject(row);
          const workOrderNo = record.workOrderNo || '';
          
          // Debug logging
          if (workOrderMap.size < 2) {
            console.log('[WorkOrders API] Sample record:', {
              workOrderNo,
              hasFields: Object.keys(record).length,
              sampleFields: Object.keys(record).slice(0, 10),
            });
          }
          
          // Group by workOrderNo to handle any duplicates from pivot
          if (workOrderNo) {
            if (!workOrderMap.has(workOrderNo)) {
              workOrderMap.set(workOrderNo, record);
            } else {
              // Merge fields if duplicate (take the most recent one based on _time)
              const existing = workOrderMap.get(workOrderNo);
              const existingTime = new Date(existing._time || 0).getTime();
              const newTime = new Date(record._time || 0).getTime();
              if (newTime > existingTime) {
                workOrderMap.set(workOrderNo, record);
              }
            }
          } else {
            // If no workOrderNo, just add it (shouldn't happen, but handle it)
            results.push(record);
          }
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
          // Convert map to array
          const uniqueResults = Array.from(workOrderMap.values()).concat(results);
          console.log(`[WorkOrders API] Query complete. Found ${uniqueResults.length} unique work orders`);
          // Transform results into work order objects
          const workOrders = uniqueResults.map(record => ({
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

