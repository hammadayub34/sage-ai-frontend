import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows/load?id={workflowId}
 * Load a specific workflow by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('id');

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    const workflowsDir = path.join(process.cwd(), 'data', 'workflows');
    const filePath = path.join(workflowsDir, `${workflowId}.json`);

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Read and parse workflow file
    const content = await readFile(filePath, 'utf-8');
    const workflow = JSON.parse(content);

    console.log(`[Workflow Load] Loaded workflow: ${workflowId} - ${workflow.name}`);

    return NextResponse.json({
      success: true,
      workflow,
    });
  } catch (error: any) {
    console.error('[Workflow Load] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load workflow',
      },
      { status: 500 }
    );
  }
}
