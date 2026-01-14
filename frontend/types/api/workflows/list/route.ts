import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows/list
 * List all saved workflows
 */
export async function GET(request: NextRequest) {
  try {
    const workflowsDir = path.join(process.cwd(), 'data', 'workflows');
    
    // Check if directory exists
    if (!existsSync(workflowsDir)) {
      return NextResponse.json({
        success: true,
        workflows: [],
      });
    }

    // Read all JSON files in the workflows directory
    const files = await readdir(workflowsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    // Read and parse each workflow file
    const workflows = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(workflowsDir, file);
          const content = await readFile(filePath, 'utf-8');
          const workflow = JSON.parse(content);
          
          // Return only metadata (not full nodes/edges)
          return {
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            schedule: workflow.schedule,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt,
            nodeCount: workflow.nodes?.length || 0,
            edgeCount: workflow.edges?.length || 0,
          };
        } catch (error) {
          console.error(`[Workflow List] Error reading ${file}:`, error);
          return null;
        }
      })
    );

    // Filter out null values (failed reads)
    const validWorkflows = workflows.filter(w => w !== null);

    // Sort by updatedAt (newest first)
    validWorkflows.sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });

    console.log(`[Workflow List] Found ${validWorkflows.length} workflow(s)`);

    return NextResponse.json({
      success: true,
      workflows: validWorkflows,
    });
  } catch (error: any) {
    console.error('[Workflow List] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list workflows',
        workflows: [],
      },
      { status: 500 }
    );
  }
}
