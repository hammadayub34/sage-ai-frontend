import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Create a comprehensive prompt for OpenAI
    const prompt = `You are an industrial operations analyst providing insights and recommendations for a manufacturing lab/shopfloor.

Lab Performance Data:
- Lab Name: ${data.labName}
- Total Machines: ${data.totalMachines}
- Scheduled Maintenance (Past Month): ${data.scheduledMaintenanceCount} work orders
- Machines with Maintenance: ${data.machinesWithMaintenance} out of ${data.totalMachines}
- Time Period Analyzed: ${data.timePeriod}

Performance Metrics:
- Total Downtime: ${data.downtimePercentage.toFixed(2)}% (${downtimeFormatted})
- Total Uptime: ${data.uptimePercentage.toFixed(2)}% (${uptimeFormatted})

Please provide a comprehensive analysis with the following structure:

1. **Key Insights** (2-4 bullet points):
   - Analyze the performance metrics and identify notable patterns or observations
   - Consider the relationship between maintenance frequency and downtime
   - Highlight any areas of concern or positive trends

2. **Recommendations** (2-4 actionable recommendations):
   - Provide specific, actionable recommendations to improve operations
   - Consider maintenance scheduling, downtime reduction, and efficiency improvements
   - Prioritize recommendations based on potential impact

Format your response in a clear, professional manner suitable for manufacturing operations management. Use bullet points for clarity.`;

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

