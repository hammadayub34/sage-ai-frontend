import { NextRequest, NextResponse } from 'next/server';
import { getLabs } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const labs = await getLabs();
    return NextResponse.json({ success: true, labs });
  } catch (error: any) {
    console.error('Error fetching labs:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch labs' }, { status: 500 });
  }
}
