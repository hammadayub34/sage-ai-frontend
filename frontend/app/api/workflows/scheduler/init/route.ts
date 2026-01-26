import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowScheduler } from '@/lib/workflow-scheduler';

export const dynamic = 'force-dynamic';

let schedulerInitialized = false;

/**
 * GET /api/workflows/scheduler/init
 * Initialize the workflow scheduler (called on server startup)
 */
export async function GET(request: NextRequest) {
  try {
    if (schedulerInitialized) {
      return NextResponse.json({
        success: true,
        message: 'Scheduler already initialized',
      });
    }

    const scheduler = getWorkflowScheduler();
    scheduler.start();
    schedulerInitialized = true;

    console.log('[Scheduler Init] Workflow scheduler initialized');

    return NextResponse.json({
      success: true,
      message: 'Workflow scheduler started',
    });
  } catch (error: any) {
    console.error('[Scheduler Init] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to initialize scheduler',
      },
      { status: 500 }
    );
  }
}
