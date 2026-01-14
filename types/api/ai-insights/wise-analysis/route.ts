import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ShiftUtilizationData {
  averageUtilization: number;
  totalProductiveHours: number;
  totalDowntimeHours: number;
  totalIdleHours: number;
  totalScheduledHours: number;
  machinesWithData: number;
}

interface WiseAnalysisRequest {
  labName: string;
  totalMachines: number;
  scheduledMaintenanceCount: number;
  machinesWithMaintenance: number;
  totalDowntime: number; // in seconds
  totalUptime: number; // in seconds
  downtimePercentage: number;
  uptimePercentage: number;
  timePeriod: string; // e.g., "Last 7 Days"
  alertsCount?: number;
  downtimeIncidentsCount?: number;
  shiftName?: string;
  shiftUtilization?: ShiftUtilizationData;
}

export async function POST(request: NextRequest) {
  try {
    const data: WiseAnalysisRequest = await request.json();

    // Format duration helper
    const formatDuration = (seconds: number): string => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      
      if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes > 1 ? 's' : ''}`;
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

    // Format shift name: convert underscores to spaces and capitalize properly
    const formatShiftName = (shiftName: string): string => {
      if (!shiftName) return '';
      return shiftName
        .replace(/_/g, ' ')  // Replace underscores with spaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    // Build shift-specific context
    let shiftContext = '';
    if (data.shiftName && data.shiftUtilization) {
      const util = data.shiftUtilization;
      const formattedShiftName = formatShiftName(data.shiftName);
      shiftContext = `

Shift-Specific Analysis (${formattedShiftName}):
- Average Machine Utilization: ${util.averageUtilization.toFixed(1)}%
- Productive Hours: ${util.totalProductiveHours.toFixed(1)} hours
- Downtime Hours: ${util.totalDowntimeHours.toFixed(1)} hours
- Idle Hours: ${util.totalIdleHours.toFixed(1)} hours
- Scheduled Hours: ${util.totalScheduledHours.toFixed(1)} hours
- Machines with Data: ${util.machinesWithData} out of ${data.totalMachines}

The analysis below should focus on this specific shift's performance.`;
    }

    // Build additional metrics context
    let additionalMetrics = '';
    if (data.alertsCount !== undefined || data.downtimeIncidentsCount !== undefined) {
      additionalMetrics = '\n\nAdditional Metrics:';
      if (data.alertsCount !== undefined) {
        additionalMetrics += `\n- Total Alerts: ${data.alertsCount}`;
      }
      if (data.downtimeIncidentsCount !== undefined) {
        additionalMetrics += `\n- Downtime Incidents: ${data.downtimeIncidentsCount}`;
      }
    }

    // Create a comprehensive prompt for OpenAI
    const prompt = `You are an industrial operations analyst providing insights and recommendations for a manufacturing lab/shopfloor.

Lab Performance Data:
- Lab Name: ${data.labName}
- Total Machines: ${data.totalMachines}
- Scheduled Maintenance (Past Month): ${data.scheduledMaintenanceCount} work orders
- Machines with Maintenance: ${data.machinesWithMaintenance} out of ${data.totalMachines}
- Time Period Analyzed: ${data.timePeriod}${shiftContext}

Performance Metrics:
- Total Downtime: ${data.downtimePercentage.toFixed(2)}% (${downtimeFormatted})
- Total Uptime: ${data.uptimePercentage.toFixed(2)}% (${uptimeFormatted})${additionalMetrics}

Please provide a comprehensive analysis with the following structure:

1. **Key Insights** (2-4 bullet points):
   - Analyze the performance metrics and identify notable patterns or observations
   ${data.shiftName ? '- Focus on shift-specific utilization patterns and efficiency' : ''}
   - Consider the relationship between maintenance frequency and downtime
   - Highlight any areas of concern or positive trends
   ${data.shiftUtilization ? '- Analyze utilization rates, productive vs idle time, and downtime patterns for this shift' : ''}

2. **Recommendations** (2-4 actionable recommendations):
   - Provide specific, actionable recommendations to improve operations
   ${data.shiftName ? '- Include shift-specific recommendations based on utilization data' : ''}
   - Consider maintenance scheduling, downtime reduction, and efficiency improvements
   - Prioritize recommendations based on potential impact
   ${data.shiftUtilization ? '- Address utilization optimization, reduce idle time, and minimize downtime for this shift' : ''}

Format your response in a clear, professional manner suitable for manufacturing operations management. Use bullet points for clarity.${data.shiftName ? ` Make sure to reference the shift name "${formatShiftName(data.shiftName)}" (not "${data.shiftName}") and provide shift-specific insights.` : ''}`;

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
                content: 'You are an expert industrial operations analyst specializing in manufacturing efficiency, maintenance optimization, and production performance analysis. Provide clear, actionable insights and recommendations based on operational data.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 800,
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
    console.error('Error generating wise analysis:', error);
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

