import { NextRequest, NextResponse } from 'next/server';
import { buildWorkflow } from '@/lib/workflow-builder';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workflows/execute
 * Execute a workflow defined by nodes and edges
 * Supports streaming via Accept: text/event-stream header
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodes, edges } = body;

    // These will be logged to terminal and UI (if streaming)
    const initialLogs: string[] = [];
    initialLogs.push('\n🚀 [WORKFLOW] Execution started');
    initialLogs.push(`📊 [WORKFLOW] Nodes: ${nodes.map(n => `${n.data.label || n.data.type} (${n.id})`).join(', ')}`);
    initialLogs.push(`🔗 [WORKFLOW] Edges: ${edges.map(e => `${e.source} → ${e.target}`).join(', ')}`);
    
    // Log to terminal
    console.log(initialLogs[0]);
    console.log(initialLogs[1]);
    console.log(initialLogs[2]);

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { error: 'Nodes array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!edges || !Array.isArray(edges)) {
      return NextResponse.json(
        { error: 'Edges array is required' },
        { status: 400 }
      );
    }

    // Check if client wants streaming
    const acceptHeader = request.headers.get('accept') || '';
    const wantsStreaming = acceptHeader.includes('text/event-stream');

    if (wantsStreaming) {
      // Return streaming response
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          try {
            // Send initial logs to UI
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', message: 'Starting workflow execution...' })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message: '\n🚀 [WORKFLOW] Execution started' })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message: `📊 [WORKFLOW] Nodes: ${nodes.map((n: any) => `${n.data.label || n.data.type} (${n.id})`).join(', ')}` })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message: `🔗 [WORKFLOW] Edges: ${edges.map((e: any) => `${e.source} → ${e.target}`).join(', ')}` })}\n\n`));
            
            // Build workflow with streaming callback that logs to both terminal and UI
            const onLog = (message: string) => {
              console.log(message); // Terminal
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message })}\n\n`)); // UI
            };
            
            const logToBoth = (message: string) => {
              console.log(message);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message })}\n\n`));
            };
            
            logToBoth('🔨 [WORKFLOW] Building workflow...');
            const workflow = buildWorkflow({ nodes, edges }, onLog);
            logToBoth('▶️  [WORKFLOW] Starting execution...');
            const result = await workflow.execute();
            logToBoth('✅ [WORKFLOW] Execution completed');
            logToBoth(`📋 [WORKFLOW] Final state: machineId=${result.machineId}, hasAlarmData=${!!result.alarmData}, hasPineconeData=${!!result.pineconeData}, hasWorkOrderData=${!!result.workOrderData}, hasSavedWorkOrder=${!!result.savedWorkOrder}`);
            if (result.error) {
              logToBoth(`❌ [WORKFLOW] Error: ${result.error}`);
            }
            
            // Send final result
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'result', 
              data: {
                machineId: result.machineId,
                alarmData: result.alarmData,
                pineconeData: result.pineconeData,
                workOrderData: result.workOrderData,
                savedWorkOrder: result.savedWorkOrder,
              },
              error: result.error,
            })}\n\n`));
            
            // Send completion
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (error: any) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              message: error.message || 'Workflow execution failed' 
            })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming response (backward compatibility)
      console.log('🔨 [WORKFLOW] Building workflow (non-streaming)...');
      const workflow = buildWorkflow({ nodes, edges });
      console.log('▶️  [WORKFLOW] Starting execution...');
      const result = await workflow.execute();
      console.log('✅ [WORKFLOW] Execution completed');
      console.log('📋 [WORKFLOW] Final state:', {
        machineId: result.machineId,
        hasAlarmData: !!result.alarmData,
        hasPineconeData: !!result.pineconeData,
        hasWorkOrderData: !!result.workOrderData,
        hasSavedWorkOrder: !!result.savedWorkOrder,
        error: result.error,
      });

      return NextResponse.json({
        success: true,
        result: {
          machineId: result.machineId,
          alarmData: result.alarmData,
          pineconeData: result.pineconeData,
          workOrderData: result.workOrderData,
          savedWorkOrder: result.savedWorkOrder,
          executionLog: result.executionLog || [],
        },
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error('Workflow execution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Workflow execution failed',
      },
      { status: 500 }
    );
  }
}

