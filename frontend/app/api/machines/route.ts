import { NextRequest, NextResponse } from 'next/server';
import { getMachines, getMachineById, getMachinesByStatus, getMachinesByLabId, createMachineWithNodes } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machineId');
    const status = searchParams.get('status');
    const labId = searchParams.get('labId');

    if (machineId) {
      const machine = await getMachineById(machineId);
      if (!machine) {
        return NextResponse.json({ success: false, error: 'Machine not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, machine });
    }

    if (status) {
      const machines = await getMachinesByStatus(status as 'active' | 'inactive');
      return NextResponse.json({ success: true, machines });
    }

    if (labId) {
      const machines = await getMachinesByLabId(labId);
      return NextResponse.json({ success: true, machines });
    }

    const machines = await getMachines();
    return NextResponse.json({ success: true, machines });
  } catch (error: any) {
    console.error('Error fetching machines:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch machines' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createMachineWithNodes(body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating machine:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create machine' }, { status: 500 });
  }
}

