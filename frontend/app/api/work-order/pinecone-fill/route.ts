import { NextRequest, NextResponse } from 'next/server';
import { getPineconeIndex } from '@/lib/pinecone';
import { createEmbedding } from '@/lib/embeddings';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let embeddingTime = 0;
  let pineconeTime = 0;
  let llmTime = 0;
  
  try {
    const { machineId, alarmType, machineType } = await request.json();
    console.log(`[WorkOrder Fill] Starting for ${alarmType} on ${machineId}`);

    if (!machineId || !alarmType) {
      return NextResponse.json(
        { error: 'Machine ID and alarm type are required' },
        { status: 400 }
      );
    }

    // Step 1: Create embedding for the query
    const embeddingStart = Date.now();
    const queryText = `${alarmType} ${machineType || ''} maintenance work order parts materials task number frequency hours work description special instructions`;
    const queryEmbedding = await createEmbedding(queryText);
    embeddingTime = Date.now() - embeddingStart;
    console.log(`[WorkOrder Fill] Embedding created in ${embeddingTime}ms`);

    // Step 2: Query Pinecone with filter for maintenance work orders
    const pineconeStart = Date.now();
    const index = await getPineconeIndex();
    const filter: any = {
      document_type: { $eq: 'maintenance_work_order' }
    };
    
    // Filter by machine type if available
    if (machineType) {
      filter.machine_type = { $eq: machineType };
    }

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 1, // Get the most relevant match
      includeMetadata: true,
      filter,
    });
    pineconeTime = Date.now() - pineconeStart;
    console.log(`[WorkOrder Fill] Pinecone query completed in ${pineconeTime}ms`);

    if (queryResponse.matches.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No maintenance work order information found in Pinecone for this alarm type.',
      });
    }

    // Step 3: Get full content from Pinecone matches
    const context = queryResponse.matches
      .map(match => {
        const meta = match.metadata || {};
        return meta.content || '';
      })
      .join('\n\n');

    if (!context) {
      return NextResponse.json({
        success: false,
        error: 'No content found in Pinecone results.',
      });
    }

    // Step 4: Use LLM to extract and format structured data
    const prompt = `Based on the following maintenance work order manual information, extract and structure work order details for ${alarmType} on ${machineId}.

Maintenance Manual Context:
${context}

Please extract and return a JSON object with the following structure. Format work descriptions and instructions as clear, well-structured sentences or bullet points:
{
  "taskNumber": "Task number from manual (e.g., PM-BF-001)",
  "frequency": "Frequency from manual",
  "workPerformedBy": "Department/shop from manual (default: Maintenance Department)",
  "standardHours": "Standard hours as number (e.g., 2.0)",
  "overtimeHours": "Overtime hours as number (e.g., 0.5)",
  "priority": "Priority from manual (High, Medium, Low, Critical)",
  "workDescription": "Detailed work description formatted as clear sentences or bullet points. Make it professional and easy to read.",
  "specialInstructions": "Special instructions MUST be formatted as bullet points. Each instruction should be on a new line starting with a dash (-) or bullet (•). Format like:\n- First instruction\n- Second instruction\n- Third instruction\n\nEach instruction should be a complete sentence.",
  "parts": [
    {
      "partNumber": "Part number",
      "description": "Part description",
      "quantity": "Quantity needed",
      "qtyInStock": "Check stock or leave empty",
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

Return ONLY the JSON object, no additional text or markdown formatting.`;

    // Step 4: Use LLM to extract and format structured data
    const llmStart = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Faster model for better performance
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts structured work order information from maintenance manuals. Always return valid JSON only, no markdown code blocks. IMPORTANT: Format specialInstructions as bullet points with each instruction on a new line starting with "-" (dash).',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000, // Limit tokens for faster response
    });
    llmTime = Date.now() - llmStart;
    console.log(`[WorkOrder Fill] LLM completion in ${llmTime}ms`);

    const responseText = completion.choices[0]?.message?.content || '{}';
    
    // Extract JSON from response
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
      console.error('Response text:', responseText);
      return NextResponse.json({
        success: false,
        error: 'Failed to parse work order data from LLM response',
      });
    }

    const totalTime = Date.now() - startTime;
    console.log(`[WorkOrder Fill] Total time: ${totalTime}ms (Embedding: ${embeddingTime}ms, Pinecone: ${pineconeTime}ms, LLM: ${llmTime}ms)`);
    console.log('Extracted work order data:', workOrderData);

    return NextResponse.json({
      success: true,
      workOrder: workOrderData,
      timings: {
        total: totalTime,
        embedding: embeddingTime,
        pinecone: pineconeTime,
        llm: llmTime,
      },
    });
  } catch (error: any) {
    console.error('Error querying Pinecone:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to query Pinecone',
        success: false,
      },
      { status: 500 }
    );
  }
}

