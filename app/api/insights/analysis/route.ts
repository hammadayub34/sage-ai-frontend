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
    console.log('[Insights Analysis API] ===== RECEIVED DATA FROM FRONTEND =====');
    console.log('[Insights Analysis API] Selected Machine:', {
      name: pageData.selections?.machine?.name || 'All machines',
      isSelected: pageData.selections?.machine?.isSelected,
      selectionType: pageData.selections?.machine?.selectionType,
    });
    console.log('[Insights Analysis API] Lab:', {
      id: pageData.selections?.lab?.id,
      name: pageData.selections?.lab?.name,
    });
    console.log('[Insights Analysis API] Shift:', {
      name: pageData.selections?.shift?.name,
      startTime: pageData.selections?.shift?.startTime,
      endTime: pageData.selections?.shift?.endTime,
    });
    console.log('[Insights Analysis API] Date Range:', pageData.selections?.dateRange?.displayText);
    console.log('[Insights Analysis API] Machine-Specific Data:', {
      totalMachines: pageData.apiResults?.utilization?.machineSpecificData?.length || 0,
      selectedMachineData: pageData.apiResults?.utilization?.selectedMachineData ? {
        machineName: pageData.apiResults.utilization.selectedMachineData.machineName,
        averageUtilization: pageData.apiResults.utilization.selectedMachineData.averageUtilization,
      } : null,
      allMachineNames: pageData.apiResults?.utilization?.allMachineNames || [],
    });
    console.log('[Insights Analysis API] Has Scheduled Hours:', !!pageData.apiResults?.scheduledHours?.data);
    console.log('[Insights Analysis API] Has Utilization Data:', !!pageData.apiResults?.utilization?.data);
    console.log('[Insights Analysis API] ===========================================');

    // Extract key information for prompt clarity - ALL FROM API RESPONSES
    const labName = pageData.selections?.lab?.name || 'N/A'; // From labs API response
    const selectedMachineName = pageData.selections?.machine?.name || null; // From CURRENT dropdown selection
    const isSpecificMachine = pageData.selections?.machine?.isSelected || false; // From CURRENT dropdown selection
    const machineSelectionType = pageData.selections?.machine?.selectionType || 'All Machines';
    const shiftName = pageData.selections?.shift?.name || 'N/A'; // From scheduled-hours API
    const shiftTime = pageData.selections?.shift?.startTime && pageData.selections?.shift?.endTime
      ? `${pageData.selections.shift.startTime} - ${pageData.selections.shift.endTime}` // From scheduled-hours API
      : 'N/A';
    const dateRange = pageData.selections?.dateRange?.displayText || 
      `${pageData.selections?.dateRange?.startDate} to ${pageData.selections?.dateRange?.endDate}`;

    // Extract machine-specific data from utilization API response (API Call #6)
    const machineUtilizations = pageData.apiResults?.utilization?.machineSpecificData || [];
    const selectedMachineData = pageData.apiResults?.utilization?.selectedMachineData || null;
    const overallTotals = pageData.apiResults?.utilization?.overallTotals || null;
    const allMachineNames = pageData.apiResults?.utilization?.allMachineNames || [];
    
    // Log what we're extracting for the prompt
    console.log('[Insights Analysis API] Extracted for prompt:', {
      labName,
      selectedMachineName,
      isSpecificMachine,
      machineSelectionType,
    });

    // Create a comprehensive prompt for OpenAI
    const prompt = `You are an industrial operations analyst reviewing comprehensive data from a manufacturing insights dashboard.

**CRITICAL CONTEXT - READ THIS FIRST:**
- **Lab/Shopfloor:** ${labName}
- **Machine Selection in Dropdown:** ${isSpecificMachine ? `SPECIFIC MACHINE SELECTED: "${selectedMachineName}"` : 'ALL MACHINES IN LAB'}
- **Selected Machine Name:** ${selectedMachineName || 'None (All Machines)'}
- **Shift:** ${shiftName} (${shiftTime})
- **Date Range:** ${dateRange}

**MACHINE-SPECIFIC DATA FROM API RESPONSE:**
${isSpecificMachine && selectedMachineData
  ? `The user has selected a SPECIFIC machine in the dropdown: "${selectedMachineName}". Here is the detailed data for this machine from the utilization API response:

**Selected Machine: ${selectedMachineName}**
- Average Utilization: ${selectedMachineData.averageUtilization.toFixed(2)}%
- Total Productive Hours: ${selectedMachineData.totalProductiveHours.toFixed(2)}h
- Total Idle Hours: ${selectedMachineData.totalIdleHours.toFixed(2)}h
- Total Scheduled Hours: ${selectedMachineData.totalScheduledHours.toFixed(2)}h
- Total Non-Productive Hours: ${selectedMachineData.totalNonProductiveHours.toFixed(2)}h
- Total Node Off Hours: ${selectedMachineData.totalNodeOffHours.toFixed(2)}h
- Record Count: ${selectedMachineData.recordCount} days

COMPARE this machine's performance against the overall lab performance and identify specific issues or strengths.`
  : `The user is analyzing ALL MACHINES in the lab. Here is data for EACH machine from the utilization API response (machineUtilizations array):

${machineUtilizations.map((m: any, idx: number) => `
**Machine ${idx + 1}: ${m.machineName}**
- Average Utilization: ${m.averageUtilization.toFixed(2)}%
- Total Productive Hours: ${m.totalProductiveHours.toFixed(2)}h
- Total Idle Hours: ${m.totalIdleHours.toFixed(2)}h
- Total Scheduled Hours: ${m.totalScheduledHours.toFixed(2)}h
- Total Non-Productive Hours: ${m.totalNonProductiveHours.toFixed(2)}h
- Total Node Off Hours: ${m.totalNodeOffHours.toFixed(2)}h
- Record Count: ${m.recordCount} days`).join('\n')}

COMPARE performance across all machines. Identify top performers, underperformers, and patterns.`}

**OVERALL TOTALS (All Machines Combined):**
${overallTotals ? `
- Total Machines in Lab: ${overallTotals.totalMachines}
- Machines with Data: ${overallTotals.machinesWithData}
- Overall Average Utilization: ${overallTotals.averageUtilization.toFixed(2)}%
- Total Productive Hours: ${overallTotals.totalProductiveHours.toFixed(2)}h
- Total Idle Hours: ${overallTotals.totalIdleHours.toFixed(2)}h
- Total Scheduled Hours: ${overallTotals.totalScheduledHours.toFixed(2)}h
- Total Non-Productive Hours: ${overallTotals.totalNonProductiveHours.toFixed(2)}h
- Total Node Off Hours: ${overallTotals.totalNodeOffHours.toFixed(2)}h` : 'N/A'}

Analyze the following JSON data and provide a detailed, actionable analysis covering:

1. **Context Summary**: 
            - Start by clearly stating: "Analyzing ${labName} - ${isSpecificMachine ? `Machine: ${selectedMachineName}` : 'All Machines'} - Shift: ${shiftName} - Date Range: ${dateRange}"
            - Explicitly mention which machine is selected in the dropdown (if any)

2. **Machine-Specific Analysis**:
   ${isSpecificMachine
     ? `- Focus on the selected machine: "${selectedMachineName}"
            - Compare its performance against the overall lab average
            - Identify specific strengths and weaknesses
            - Calculate: Utilization Rate = (Productive Hours / Scheduled Hours) × 100
            - Note any anomalies or patterns specific to this machine`
     : `- Compare performance across ALL machines listed above
            - Rank machines by utilization rate
            - Identify top 3 performers and bottom 3 performers
            - Calculate utilization for each machine: (Productive Hours / Scheduled Hours) × 100
            - Highlight machines that significantly deviate from the average`}

3. **Scheduled vs Actual Utilization Comparison**: 
                - Compare calculated scheduled hours (from shift configuration) with actual utilization data (from MongoDB)
            - Calculate variance: (Actual Scheduled Hours from MongoDB / Calculated Scheduled Hours) × 100
                - Identify gaps or discrepancies
   ${isSpecificMachine ? `- For "${selectedMachineName}": Compare its scheduled hours vs actual` : '- Compare for each machine individually'}

4. **Overall Performance Summary**: 
            - Key metrics and their significance
            - Overall utilization rate across ${isSpecificMachine ? 'the selected machine' : 'all machines'}
            - Total productive time vs idle time vs non-productive time

5. **Shift Analysis**: 
            - Evaluate shift-specific performance patterns
            - Analyze if the shift timing (${shiftTime}) affects utilization

6. **Date Range Insights**: 
            - Analyze trends across the selected date range: ${dateRange}
                - Identify any patterns, anomalies, or notable changes
            - Note if data is complete for all days in the range

7. **Data Quality Assessment**: 
            - Note any data gaps, missing records, or inconsistencies
            - Check if all machines have data for the date range
            - Identify machines with incomplete data

8. **Key Insights**: 
            - Highlight 3-5 most important findings with specific numbers
            - Reference specific machine names and their metrics
   ${isSpecificMachine ? `- Focus on insights specific to "${selectedMachineName}"` : '- Include insights about machine comparisons'}

9. **Comparative Analysis**: 
   ${isSpecificMachine
     ? `- Compare "${selectedMachineName}" against:
                    * Overall lab average
                    * Expected benchmarks
                    * Other machines in the lab (if data available)`
     : `- Compare utilization rates across all machines
            - Compare scheduled vs actual hours for each machine
            - Compare productive vs idle vs non-productive time across machines
            - Create a ranking of machines by performance`}

10. **Recommendations**: 
                - Provide actionable recommendations for improvement
    ${isSpecificMachine ? `- Specific recommendations for "${selectedMachineName}"` : '- Recommendations for underperforming machines'}
                - Suggest optimization strategies

IMPORTANT FORMATTING REQUIREMENTS:
- Use plain text only - NO LaTeX, NO math notation, NO formulas with brackets like [ or ]
- Write calculations in plain English (e.g., "Utilization Rate = (Total Productive Hours / Total Scheduled Hours) × 100 = (5.70 / 182.01) × 100 = 3.13%")
- Use simple text formatting only (headers with ##, bold with **, lists with -)
- Do NOT use any mathematical notation symbols or LaTeX delimiters
- Always reference specific numbers from the data provided
- Always mention machine names when discussing specific machines

Be specific, use numbers from the data, and focus on actionable insights. Format your response in clear sections with headers.

**FULL DATA FOR REFERENCE:**
${JSON.stringify(pageData, null, 2)}

Provide a comprehensive analysis:`;

    console.log('[Insights Analysis API] ===== SENDING TO OPENAI =====');
    console.log('[Insights Analysis API] Machine in prompt:', {
      selectedMachineName,
      isSpecificMachine,
      machineSelectionType,
    });
    console.log('[Insights Analysis API] Lab in prompt:', labName);
    console.log('[Insights Analysis API] Shift in prompt:', shiftName, `(${shiftTime})`);
    console.log('[Insights Analysis API] Date Range in prompt:', dateRange);
    console.log('[Insights Analysis API] Selected Machine Data:', selectedMachineData ? {
      machineName: selectedMachineData.machineName,
      averageUtilization: selectedMachineData.averageUtilization,
    } : 'None (All Machines)');
    console.log('[Insights Analysis API] Total machines in data:', machineUtilizations.length);
    console.log('[Insights Analysis API] Prompt length:', prompt.length, 'characters');
    console.log('[Insights Analysis API] =============================');

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

