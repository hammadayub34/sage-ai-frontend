import { NextRequest, NextResponse } from 'next/server';
import { InfluxDB, Point } from '@influxdata/influxdb-client';

const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'https://influxtest.wisermachines.com';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || '1MrRJ8q-zSnlt9HRZMeY5YNhOQZWbi6Xk-oU6pFFTSbJRv4V32cTJutWMJota0r6t_F6N5zXOfE6IXHYmcUk4Q==';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'wisermachines';
const WORK_ORDERS_BUCKET = process.env.NEXT_PUBLIC_WORK_ORDERS_BUCKET || 'work_orders';

const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    const workOrderData = await request.json();
    console.log('[WorkOrder API] Received work order data:', {
      workOrderNo: workOrderData.workOrderNo,
      machineId: workOrderData.machineId,
      alarmType: workOrderData.alarmType,
    });

    if (!workOrderData.workOrderNo) {
      console.error('[WorkOrder API] Missing work order number');
      return NextResponse.json(
        { error: 'Work order number is required' },
        { status: 400 }
      );
    }

    console.log('[WorkOrder API] Writing to bucket:', WORK_ORDERS_BUCKET);
    const writeApi = influxDB.getWriteApi(INFLUXDB_ORG, WORK_ORDERS_BUCKET, 'ns');

    // Create InfluxDB point - use method chaining
    const point = new Point('work_order')
      .tag('machineId', workOrderData.machineId || '')
      .tag('workOrderNo', workOrderData.workOrderNo)
      .tag('status', workOrderData.workCompleted ? 'completed' : 'pending')
      .tag('priority', workOrderData.priority || 'Medium')
      .tag('weekNo', workOrderData.weekNo || '')
      .tag('alarmType', workOrderData.alarmType || '')
      .tag('machineType', workOrderData.machineType || '')
      .stringField('companyName', workOrderData.companyName || '')
      .stringField('weekOf', workOrderData.weekOf || '')
      .stringField('equipmentName', workOrderData.equipmentName || '')
      .stringField('equipmentNumber', workOrderData.equipmentNumber || '')
      .stringField('equipmentLocation', workOrderData.equipmentLocation || '')
      .stringField('equipmentDescription', workOrderData.equipmentDescription || '')
      .stringField('location', workOrderData.location || '')
      .stringField('building', workOrderData.building || '')
      .stringField('floor', workOrderData.floor || '')
      .stringField('room', workOrderData.room || '')
      .stringField('specialInstructions', workOrderData.specialInstructions || '')
      .stringField('shop', workOrderData.shop || '')
      .stringField('vendor', workOrderData.vendor || '')
      .stringField('vendorAddress', workOrderData.vendorAddress || '')
      .stringField('vendorPhone', workOrderData.vendorPhone || '')
      .stringField('vendorContact', workOrderData.vendorContact || '')
      .stringField('taskNumber', workOrderData.taskNumber || '')
      .stringField('frequency', workOrderData.frequency || '')
      .stringField('workPerformedBy', workOrderData.workPerformedBy || '')
      .floatField('standardHours', parseFloat(workOrderData.standardHours) || 0)
      .floatField('overtimeHours', parseFloat(workOrderData.overtimeHours) || 0)
      .stringField('workDescription', workOrderData.workDescription || '')
      .stringField('workPerformed', workOrderData.workPerformed || '')
      .booleanField('workCompleted', workOrderData.workCompleted || false)
      .stringField('parts', JSON.stringify(workOrderData.parts || []))
      .stringField('materials', JSON.stringify(workOrderData.materials || []))
      .timestamp(new Date());

    // Write to InfluxDB
    console.log('[WorkOrder API] Writing point to InfluxDB...');
    writeApi.writePoint(point);
    await writeApi.close();
    console.log('[WorkOrder API] Work order saved successfully');

    // Append to markdown document and embed into Pinecone (async, don't wait)
    try {
      const { exec } = require('child_process');
      const path = require('path');
      const fs = require('fs');
      const projectRoot = path.resolve(process.cwd(), '..');
      const scriptPath = path.join(projectRoot, 'scripts', 'append_work_order_to_doc.py');
      
      // Write work order data to temp file for Python script
      const tmpDir = path.join(projectRoot, 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const tempFile = path.join(tmpDir, `work_order_${workOrderData.workOrderNo}.json`);
      fs.writeFileSync(tempFile, JSON.stringify(workOrderData), 'utf-8');
      
      // Run Python script to append to doc and embed (async, don't block response)
      exec(`cd "${projectRoot}" && python3 scripts/append_work_order_to_doc.py "${tempFile}" && python3 scripts/embed_work_orders_history.py`, 
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            console.error('[WorkOrder API] Error appending to doc/embedding:', error);
          } else {
            console.log('[WorkOrder API] Work order appended to doc and embedded into Pinecone');
          }
          // Clean up temp file
          try {
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      );
    } catch (err) {
      console.error('[WorkOrder API] Error setting up doc append/embed:', err);
      // Don't fail the request if this fails
    }

    return NextResponse.json({
      success: true,
      workOrderNo: workOrderData.workOrderNo,
      message: 'Work order saved successfully',
    });
  } catch (error: any) {
    console.error('[WorkOrder API] Error saving work order:', error);
    console.error('[WorkOrder API] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to save work order' },
      { status: 500 }
    );
  }
}

