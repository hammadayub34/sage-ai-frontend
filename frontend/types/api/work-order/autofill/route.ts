import { NextRequest, NextResponse } from 'next/server';
import { getPineconeIndex } from '@/lib/pinecone';
import { createEmbedding } from '@/lib/embeddings';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { machineId, alarmType, machineType } = await request.json();

    if (!machineId || !alarmType) {
      return NextResponse.json(
        { error: 'Machine ID and alarm type are required' },
        { status: 400 }
      );
    }

    // Step 1: Query Pinecone for maintenance manual information
    const queryText = `${alarmType} ${machineType || ''} maintenance work order parts materials`;
    const queryEmbedding = await createEmbedding(queryText);

    const index = await getPineconeIndex();
    const filter: any = {
      document_type: { $eq: 'maintenance_work_order' }
    };
    
    // Try to filter by machine type if available
    if (machineType) {
      filter.machine_type = { $eq: machineType };
    }

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    // Step 2: Extract relevant context from Pinecone results
    const context = queryResponse.matches
      .map(match => match.metadata?.text || '')
      .join('\n\n');

    if (!context) {
      return NextResponse.json(
        { error: 'No maintenance information found for this alarm type' },
        { status: 404 }
      );
    }

    // Step 3: Use LLM to structure the work order data
    const prompt = `Based on the following maintenance manual information, extract and structure work order details for ${alarmType} on ${machineId}.

Maintenance Manual Context:
${context}

Please extract and return a JSON object with the following structure:
{
  "taskNumber": "Task number from manual (e.g., PM-BF-001)",
  "frequency": "Frequency from manual",
  "workPerformedBy": "Department/shop from manual",
  "standardHours": "Standard hours as number (e.g., 2.0)",
  "overtimeHours": "Overtime hours as number (e.g., 0.5)",
  "workDescription": "Detailed work description from manual",
  "specialInstructions": "Special instructions from manual",
  "parts": [
    {
      "partNumber": "Part number",
      "description": "Part description",
      "quantity": "Quantity needed",
      "qtyInStock": "Check stock",
      "location": "Warehouse location"
    }
  ],
  "materials": [
    {
      "description": "Material description",
      "quantity": "Quantity needed",
      "partNumber": "Material part number if available"
    }
  ]
}

Return ONLY the JSON object, no additional text.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts structured work order information from maintenance manuals. Always return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    
    // Try to extract JSON from response (handle cases where LLM adds markdown formatting)
    let workOrderData;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workOrderData = JSON.parse(jsonMatch[0]);
      } else {
        workOrderData = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse work order data from maintenance manual' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workOrder: workOrderData,
    });
  } catch (error: any) {
    console.error('Error auto-filling work order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-fill work order' },
      { status: 500 }
    );
  }
}

