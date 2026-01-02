import { NextRequest, NextResponse } from 'next/server';
import { getLabsForUser } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('[Labs User API] Fetching labs for user:', userId);

    const labs = await getLabsForUser(userId);

    console.log('[Labs User API] Found labs:', labs.length);

    return NextResponse.json({
      success: true,
      labs,
    });
  } catch (error: any) {
    console.error('[Labs User API] Error fetching labs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch labs' 
      },
      { status: 500 }
    );
  }
}