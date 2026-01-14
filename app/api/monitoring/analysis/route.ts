import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MonitoringAnalysisRequest {
  machineName: string;
  machineId: string;
  labName: string;
  downtimePercentage: number;
  uptimePercentage: number;
  totalDowntime: number; // in seconds
  totalUptime: number; // in seconds
  incidentCount: number;
  timeRange: string; // e.g., "Last 7 days"
  alertsCount?: number;
  workOrdersCount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const data: MonitoringAnalysisRequest = await request.json();

    // Format duration helper
    const formatDuration = (seconds: number): string => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      
      if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else {
        return `${Math.round(seconds)} second${Math.round(seconds) > 1 ? 's' : ''}`;
      }
    };

    const downtimeFormatted = formatDuration(data.totalDowntime);
    const uptimeFormatted = formatDuration(data.totalUptime);

    // Build additional metrics context
    let additionalMetrics = '';
    if (data.alertsCount !== undefined) {
      additionalMetrics += `\n- Total Alerts: ${data.alertsCount}`;
    }
    if (data.workOrdersCount !== undefined) {
      additionalMetrics += `\n- Work Orders: ${data.workOrdersCount}`;
    }

    // Create a comprehensive prompt for OpenAI
    const prompt = `You are an industrial operations analyst providing a brief analysis of a specific machine's performance data.

Machine Performance Data:
- Machine Name: ${data.machineName}
- Machine ID: ${data.machineId}
- Lab/Shopfloor: ${data.labName}
- Time Period Analyzed: ${data.timeRange}

Performance Metrics:
- Downtime: ${data.downtimePercentage.toFixed(2)}% (${downtimeFormatted})
- Uptime: ${data.uptimePercentage.toFixed(2)}% (${uptimeFormatted})
- Downtime Incidents: ${data.incidentCount}${additionalMetrics}

Please provide a concise analysis (2-4 sentences) focusing on:
1. Overall machine health and performance status
2. Key observations about downtime patterns or uptime efficiency
3. Any notable concerns or positive indicators

Keep it brief, professional, and actionable. Format as plain text without markdown.`;

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create streaming completion
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an expert industrial operations analyst specializing in machine performance analysis. Provide clear, concise insights based on operational data.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 300,
            stream: true,
          });

          // Stream the response chunks
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const data = JSON.stringify({
                type: 'chunk',
                content: content,
              }) + '\n';
              controller.enqueue(new TextEncoder().encode(data));
            }
          }

          // Send completion signal
          const done = JSON.stringify({
            type: 'done',
          }) + '\n';
          controller.enqueue(new TextEncoder().encode(done));
          controller.close();
        } catch (error: any) {
          const errorData = JSON.stringify({
            type: 'error',
            error: error.message || 'Failed to generate analysis',
          }) + '\n';
          controller.enqueue(new TextEncoder().encode(errorData));
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
  } catch (error: any) {
    console.error('Error generating monitoring analysis:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to generate analysis',
        analysis: null
      },
      { status: 500 }
    );
  }
}


