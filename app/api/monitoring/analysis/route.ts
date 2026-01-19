import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AlarmBreakdown {
  type: string;
  count: number;
}

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
  alarmBreakdown?: AlarmBreakdown[];
  workOrdersCount?: number;
  workOrdersPending?: number;
  workOrdersCompleted?: number;
  hasVibrationData?: boolean;
  vibrationDataPoints?: number;
  vibrationAxesAvailable?: string[];
  vibrationTimeRange?: string | null;
  chartType?: string;
  scheduledHours?: number; // Scheduled hours from MongoDB shift utilization
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

    // Format scheduled hours if available
    const formatScheduledHours = (hours: number): string => {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.floor(hours % 24);
      if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
      } else {
        return `${hours.toFixed(1)} hour${hours !== 1 ? 's' : ''}`;
      }
    };

    // Build additional metrics context
    let additionalMetrics = '';
    if (data.scheduledHours !== undefined && data.scheduledHours > 0) {
      additionalMetrics += `\n- Scheduled Hours: ${formatScheduledHours(data.scheduledHours)}`;
    }
    if (data.alertsCount !== undefined) {
      additionalMetrics += `\n- Total Alerts (Last 24h): ${data.alertsCount}`;
    }
    if (data.alarmBreakdown && data.alarmBreakdown.length > 0) {
      additionalMetrics += `\n- Top Alerts: ${data.alarmBreakdown.map(a => `${a.type} (${a.count})`).join(', ')}`;
    }
    if (data.workOrdersCount !== undefined) {
      additionalMetrics += `\n- Total Work Orders: ${data.workOrdersCount}`;
      if (data.workOrdersPending !== undefined) {
        additionalMetrics += ` (${data.workOrdersPending} pending, ${data.workOrdersCompleted || 0} completed)`;
      }
    }
    if (data.hasVibrationData) {
      const axisLabels: Record<string, string> = {
        'vibration': 'Overall Vibration',
        'x_vibration': 'X-Axis Vibration',
        'y_vibration': 'Y-Axis Vibration',
        'x_acc': 'X-Axis Acceleration',
        'y_acc': 'Y-Axis Acceleration',
        'z_acc': 'Z-Axis Acceleration',
      };
      const availableAxesLabels = data.vibrationAxesAvailable?.map(axis => axisLabels[axis] || axis).join(', ') || 'vibration data';
      additionalMetrics += `\n- Vibration Data: Available (${data.vibrationDataPoints || 0} data points, monitoring: ${availableAxesLabels})`;
    } else if (data.chartType === 'vibration') {
      const timeRangeText = data.vibrationTimeRange ? ` in the past ${data.vibrationTimeRange}` : '';
      additionalMetrics += `\n- Vibration Data: No vibration data points available${timeRangeText}`;
    } else if (data.chartType && data.chartType !== 'vibration' && data.chartType !== 'current') {
      additionalMetrics += `\n- Sensor Data: Monitoring ${data.chartType} (Modbus data)`;
    }

    // Validate required fields
    if (!data.machineName || data.machineName === 'Unknown Machine') {
      console.error('[Monitoring Analysis API] Invalid machine name:', data.machineName);
      return NextResponse.json(
        { success: false, error: 'Invalid machine name provided' },
        { status: 400 }
      );
    }
    
    if (!data.labName || data.labName === 'Unknown Lab') {
      console.error('[Monitoring Analysis API] Invalid lab name:', data.labName);
      return NextResponse.json(
        { success: false, error: 'Invalid lab name provided' },
        { status: 400 }
      );
    }

    // Log the data being sent to OpenAI
    console.log('[Monitoring Analysis API] Generating analysis for:', {
      machineName: data.machineName,
      machineId: data.machineId,
      labName: data.labName,
      timeRange: data.timeRange
    });

    // Create a comprehensive prompt for OpenAI
    const prompt = `You are an industrial operations analyst providing a brief analysis of a specific machine's performance data.

CRITICAL: You MUST start your analysis by clearly stating the machine name and lab name in the first sentence. Use the exact names provided below.

Machine Performance Data:
- Machine Name: ${data.machineName}
- Machine ID: ${data.machineId}
- Lab/Shopfloor: ${data.labName}
- Time Period Analyzed: ${data.timeRange}

Performance Metrics:
- Downtime: ${data.downtimePercentage.toFixed(2)}% (${downtimeFormatted})
- Uptime: ${data.uptimePercentage.toFixed(2)}% (${uptimeFormatted})
- Downtime Incidents: ${data.incidentCount}${data.scheduledHours !== undefined && data.scheduledHours > 0 ? `\n- Scheduled Hours: ${formatScheduledHours(data.scheduledHours)}` : ''}${additionalMetrics}

Please provide a structured analysis with 2-3 clear sections. Format your response as follows:

**Performance Overview**
Start by clearly stating: "The ${data.machineName} at ${data.labName}..." and provide a brief summary including:
- Downtime: ${data.downtimePercentage.toFixed(2)}%
- Uptime: ${data.uptimePercentage.toFixed(2)}%
- Downtime Incidents: ${data.incidentCount}${data.scheduledHours !== undefined && data.scheduledHours > 0 ? `\n- Scheduled Hours: ${formatScheduledHours(data.scheduledHours)}` : ''}
- Time Period: ${data.timeRange}

**Key Observations**
Discuss the most important findings about:
- Downtime patterns and efficiency
- Alert activity and patterns${data.alarmBreakdown && data.alarmBreakdown.length > 0 ? ` (mention specific alerts: ${data.alarmBreakdown.map(a => a.type).join(', ')})` : ''}
- Work order status and maintenance activity${data.hasVibrationData ? `\n- Vibration monitoring status: ${data.vibrationAxesAvailable?.map(axis => {
  const labels: Record<string, string> = {
    'vibration': 'Overall Vibration',
    'x_vibration': 'X-Axis Vibration',
    'y_vibration': 'Y-Axis Vibration',
    'x_acc': 'X-Axis Acceleration',
    'y_acc': 'Y-Axis Acceleration',
    'z_acc': 'Z-Axis Acceleration',
  };
  return labels[axis] || axis;
}).join(', ') || 'vibration data'} (${data.vibrationDataPoints || 0} data points available)` : data.chartType === 'vibration' ? `\n- Vibration monitoring: No vibration data available${data.vibrationTimeRange ? ` in the past ${data.vibrationTimeRange}` : ''} - this indicates the machine may not be operational or sensors are not transmitting data` : data.chartType && data.chartType !== 'vibration' && data.chartType !== 'current' ? `\n- Sensor monitoring: ${data.chartType} data being tracked` : ''}

**Recommendations**
Provide 1-2 actionable recommendations based on the current state.

Use markdown formatting with **bold** for section headers. Keep each section concise (2-3 sentences). 

IMPORTANT: You MUST explicitly mention the machine name "${data.machineName}" and lab name "${data.labName}" in your response, especially in the first sentence.`;

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


