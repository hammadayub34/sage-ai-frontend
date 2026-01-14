import { NextRequest, NextResponse } from 'next/server';
import { getLabsForUser } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/labs/user?userId=xxx
 * Get labs for a specific user
 */
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

    console.log(`[Labs API] Fetching labs for userId: ${userId}`);
    console.log(`[Labs API] MONGODB_URI is ${process.env.MONGODB_URI ? 'set' : 'NOT set'}`);
    
    const labs = await getLabsForUser(userId);
    console.log(`[Labs API] Found ${labs.length} labs for user`);
    
    return NextResponse.json({ success: true, labs });
  } catch (error: any) {
    console.error('[Labs API] Error fetching labs for user:', error);
    console.error('[Labs API] Error stack:', error.stack);
    console.error('[Labs API] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch labs',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

