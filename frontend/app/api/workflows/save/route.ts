import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workflows/save
 * Save a workflow to JSON file
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, nodes, edges, schedule } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Workflow name is required' },
        { status: 400 }
      );
    }

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { error: 'Workflow must have at least one node' },
        { status: 400 }
      );
    }

    // Generate unique workflow ID
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create workflows directory if it doesn't exist
    // In Next.js API routes, process.cwd() is the frontend directory
    // But we'll use the same pattern as other routes - store in frontend/data/workflows
    const workflowsDir = path.join(process.cwd(), 'data', 'workflows');
    if (!existsSync(workflowsDir)) {
      await mkdir(workflowsDir, { recursive: true });
    }

    // Validate and process schedule
    let processedSchedule = {
      type: 'none' as 'deferred' | 'recurring' | 'none',
      enabled: false,
    };

    if (schedule) {
      processedSchedule = {
        type: schedule.type || 'none',
        enabled: schedule.enabled || false,
        executeAt: schedule.executeAt,
        interval: schedule.interval,
      };
    }

    // Create workflow object
    const workflow = {
      id: workflowId,
      name: name.trim(),
      description: description || '',
      nodes,
      edges: edges || [],
      schedule: processedSchedule,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to JSON file
    const filePath = path.join(workflowsDir, `${workflowId}.json`);
    await writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf-8');

    console.log(`[Workflow Save] Saved workflow: ${workflowId} - ${name}`);
    if (processedSchedule.enabled) {
      console.log(`[Workflow Save] Schedule: ${processedSchedule.type}, executeAt: ${processedSchedule.executeAt}`);
    }

    // Initialize scheduler if not already running (lazy initialization)
    try {
      const { getWorkflowScheduler } = await import('@/lib/workflow-scheduler');
      const scheduler = getWorkflowScheduler();
      if (!scheduler.running) {
        scheduler.start();
      }
    } catch (error) {
      console.error('[Workflow Save] Error initializing scheduler:', error);
    }

    return NextResponse.json({
      success: true,
      workflowId,
      workflow,
    });
  } catch (error: any) {
    console.error('[Workflow Save] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to save workflow',
      },
      { status: 500 }
    );
  }
}
