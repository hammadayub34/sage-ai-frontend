import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workflows/update-name
 * Update the name of an existing workflow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, name } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Workflow name is required' },
        { status: 400 }
      );
    }

    const workflowsDir = path.join(process.cwd(), 'data', 'workflows');
    const filePath = path.join(workflowsDir, `${workflowId}.json`);

    // Check if workflow file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Read existing workflow
    const content = await readFile(filePath, 'utf-8');
    const workflow = JSON.parse(content);

    // Update name and updatedAt
    workflow.name = name.trim();
    workflow.updatedAt = new Date().toISOString();

    // Save updated workflow
    await writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf-8');

    console.log(`[Workflow Update Name] Updated workflow: ${workflowId} - ${name}`);

    return NextResponse.json({
      success: true,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        schedule: workflow.schedule,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        nodeCount: workflow.nodes?.length || 0,
        edgeCount: workflow.edges?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('[Workflow Update Name] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update workflow name',
      },
      { status: 500 }
    );
  }
}

