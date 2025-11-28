import { NextRequest, NextResponse } from 'next/server';

const INFLUXDB_URL = process.env.NEXT_PUBLIC_INFLUXDB_URL || process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.NEXT_PUBLIC_INFLUXDB_TOKEN || process.env.INFLUXDB_TOKEN || 'my-super-secret-auth-token';
const INFLUXDB_ORG = process.env.NEXT_PUBLIC_INFLUXDB_ORG || process.env.INFLUXDB_ORG || 'myorg';
const WORK_ORDERS_BUCKET = process.env.NEXT_PUBLIC_WORK_ORDERS_BUCKET || 'work_orders';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workOrderNo: string } }
) {
  try {
    const { workOrderNo } = params;
    
    if (!workOrderNo) {
      return NextResponse.json(
        { error: 'Work order number is required' },
        { status: 400 }
      );
    }

    console.log('[WorkOrders Delete API] Deleting work order:', workOrderNo);

    // Use InfluxDB HTTP API to delete data
    const deleteUrl = `${INFLUXDB_URL}/api/v2/delete?org=${encodeURIComponent(INFLUXDB_ORG)}&bucket=${encodeURIComponent(WORK_ORDERS_BUCKET)}`;
    
    // Delete all points with this work order number
    // Start from beginning of time to now
    const start = new Date(0).toISOString(); // Beginning of time
    const stop = new Date().toISOString(); // Now
    
    const deleteBody = {
      start,
      stop,
      predicate: `_measurement="work_order" AND workOrderNo="${workOrderNo}"`,
    };

    const response = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUXDB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deleteBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WorkOrders Delete API] InfluxDB delete error:', errorText);
      throw new Error(`Failed to delete from InfluxDB: ${response.status} ${errorText}`);
    }

    console.log('[WorkOrders Delete API] Work order deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Work order deleted successfully',
      workOrderNo,
    });
  } catch (error: any) {
    console.error('[WorkOrders Delete API] Error deleting work order:', error);
    console.error('[WorkOrders Delete API] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to delete work order' },
      { status: 500 }
    );
  }
}

