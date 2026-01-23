import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const pageData = await request.json();

    if (!pageData) {
      return NextResponse.json(
        { success: false, error: 'No data provided' },
        { status: 400 }
      );
    }

    // Log the received data to verify it includes all selections
    console.log('[Insights Analysis API] Received JSON data with selections:', {
      lab: pageData.selections?.lab?.name || pageData.selections?.lab?.id,
      machine: pageData.selections?.machine?.name || pageData.selections?.machine?.id || 'All machines',
      shift: pageData.selections?.shift?.name,
      dateRange: `${pageData.selections?.dateRange?.startDate} to ${pageData.selections?.dateRange?.endDate}`,
      hasScheduledHours: !!pageData.scheduledHours?.data,
      hasUtilization: !!pageData.utilization?.data
    });

    // Create a comprehensive prompt for OpenAI
    const prompt = `You are an industrial operations analyst reviewing comprehensive data from a manufacturing insights dashboard. 

Analyze the following JSON data and provide a detailed, actionable analysis covering:

1. **Overall Performance Summary**: Key metrics and their significance
2. **Scheduled vs Actual Utilization**: Compare calculated scheduled hours with actual utilization data
3. **Machine Performance**: Identify top performers and machines needing attention
4. **Shift Analysis**: Evaluate shift-specific performance if available
5. **Data Quality Assessment**: Note any data gaps or inconsistencies
6. **Key Insights**: Highlight 3-5 most important findings
7. **Recommendations**: Provide actionable recommendations for improvement

IMPORTANT FORMATTING REQUIREMENTS:
- Use plain text only - NO LaTeX, NO math notation, NO formulas with brackets like \\[ or \\]
- Write calculations in plain English (e.g., "Utilization Rate = (Total Productive Hours / Total Scheduled Hours) × 100 = (5.70 / 182.01) × 100 = 3.13%")
- Use simple text formatting only (headers with ##, bold with **, lists with -)
- Do NOT use any mathematical notation symbols or LaTeX delimiters

Be specific, use numbers from the data, and focus on actionable insights. Format your response in clear sections with headers.

Data to analyze:
${JSON.stringify(pageData, null, 2)}

Provide a comprehensive analysis:`;

    console.log('[Insights Analysis] Sending request to OpenAI...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert industrial operations analyst specializing in manufacturing efficiency, equipment utilization, and production optimization. Provide clear, data-driven insights and actionable recommendations. IMPORTANT: Use plain text only - do NOT use LaTeX notation, math formulas with brackets, or any mathematical notation symbols. Write all calculations in simple plain English format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const analysis = completion.choices[0]?.message?.content || 'No analysis generated';

    console.log('[Insights Analysis] Analysis generated successfully');

    return NextResponse.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Insights Analysis] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate analysis',
      },
      { status: 500 }
    );
  }
}

