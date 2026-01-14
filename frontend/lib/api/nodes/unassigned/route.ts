import { NextRequest, NextResponse } from 'next/server';
import { getUnassignedNodes } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const unassignedNodes = await getUnassignedNodes();
    return NextResponse.json({ success: true, unassignedNodes });
  } catch (error: any) {
    console.error('Error fetching unassigned nodes:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch unassigned nodes' }, { status: 500 });
  }
}
