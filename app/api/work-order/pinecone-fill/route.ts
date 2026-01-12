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
    const { machineId, alarmType, machineType, documentType = 'maintenance_work_order', issueType = 'alarm' } = await request.json();
    console.log(`[WorkOrder Fill] Starting for ${alarmType || issueType} on ${machineId}, document type: ${documentType}`);

    if (!machineId) {
      return NextResponse.json(
        { error: 'Machine ID is required' },
        { status: 400 }
      );
    }

    // Step 1: Create embedding for the query
    const embeddingStart = Date.now();
    let queryText: string;
    if (documentType === 'vibration' || issueType === 'vibration') {
      // Focus specifically on motor vibration troubleshooting, not general machine maintenance
      queryText = `motor vibration troubleshooting motor bearing replacement motor alignment vibration analysis machine downtime motor failure motor maintenance motor repair vibration sensor motor shaft motor rotor motor stator motor imbalance motor misalignment`;
    } else {
      queryText = `${alarmType || ''} ${machineType || ''} maintenance work order parts materials task number frequency hours work description special instructions`;
    }
    const queryEmbedding = await createEmbedding(queryText);
    embeddingTime = Date.now() - embeddingStart;
    console.log(`[WorkOrder Fill] Embedding created in ${embeddingTime}ms`);

    // Step 2: Query Pinecone with filter
    const pineconeStart = Date.now();
    const index = await getPineconeIndex();
    
    // For vibration issues, try multiple document types since vibration docs might be stored differently
    let filter: any = {};
    if (documentType === 'vibration' || issueType === 'vibration') {
      // For motor vibration, prioritize user_uploaded_document (vibration manuals) over general maintenance
      // Also try maintenance_work_order but be more selective
      filter = {
        document_type: { $in: ['user_uploaded_document', 'maintenance_work_order'] }
      };
      // Don't filter by machine type for vibration - vibration troubleshooting is often generic
      // This allows finding motor vibration docs even if they're not machine-type specific
    } else {
      filter = {
        document_type: { $eq: documentType }
      };
      // Filter by machine type if available for non-vibration issues
      if (machineType) {
        filter.machine_type = { $eq: machineType };
      }
    }

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: documentType === 'vibration' || issueType === 'vibration' ? 5 : 3, // Get more matches for vibration to find motor-specific docs
      includeMetadata: true,
      filter,
    });
    pineconeTime = Date.now() - pineconeStart;
    console.log(`[WorkOrder Fill] Pinecone query completed in ${pineconeTime}ms`);
    console.log(`[WorkOrder Fill] Found ${queryResponse.matches.length} matches`);

    if (queryResponse.matches.length === 0) {
      // If no results with filters, try without document_type filter for vibration
      if (documentType === 'vibration' || issueType === 'vibration') {
        console.log(`[WorkOrder Fill] No results with filters, trying without document_type filter...`);
        const fallbackFilter: any = {};
        if (machineType) {
          fallbackFilter.machine_type = { $eq: machineType };
        }
        
        const fallbackResponse = await index.query({
          vector: queryEmbedding,
          topK: 3,
          includeMetadata: true,
          filter: Object.keys(fallbackFilter).length > 0 ? fallbackFilter : undefined,
        });
        
        if (fallbackResponse.matches.length > 0) {
          console.log(`[WorkOrder Fill] Found ${fallbackResponse.matches.length} matches without document_type filter`);
          // Use the best match from fallback
          queryResponse.matches = [fallbackResponse.matches[0]];
        } else {
          return NextResponse.json({
            success: false,
            error: `No vibration troubleshooting information found in Pinecone. Please ensure vibration maintenance manuals or troubleshooting guides are uploaded to the AI Library.`,
          });
        }
      } else {
        return NextResponse.json({
          success: false,
          error: `No ${documentType} information found in Pinecone for this ${issueType === 'vibration' ? 'vibration issue' : 'alarm type'}.`,
        });
      }
    }

    // Step 3: Get full content from Pinecone matches
    // For vibration, use the best match; for others, use first match
    const bestMatch = queryResponse.matches[0];
    const context = bestMatch.metadata?.content || bestMatch.metadata?.text || '';
    
    // Log what document type was found
    const foundDocType = bestMatch.metadata?.document_type || 'unknown';
    console.log(`[WorkOrder Fill] Using document type: ${foundDocType}`);

    if (!context) {
      return NextResponse.json({
        success: false,
        error: 'No content found in Pinecone results.',
      });
    }

    // Step 4: Use LLM to extract and format structured data
    const issueDescription = issueType === 'vibration' 
      ? `motor vibration issue causing downtime incidents on ${machineId}`
      : `${alarmType} on ${machineId}`;
    
    const prompt = `Based on the following ${documentType === 'vibration' ? 'motor vibration analysis and troubleshooting guide' : 'maintenance work order manual'} information, extract and structure work order details for ${issueDescription}.

Maintenance Manual Context:
${context}

Please extract and return a JSON object with the following structure. Format work descriptions and instructions as clear, well-structured sentences or bullet points. Fill in as many fields as possible from the maintenance manual context:
{
  "priority": "Priority from manual (High, Medium, Low, Critical). Default to Medium if not specified.",
  
  "equipmentName": "Equipment name from manual (can use machine ID: ${machineId})",
  "equipmentNumber": "Equipment number/ID from manual (can use machine ID: ${machineId})",
  "equipmentLocation": "Equipment location from manual",
  "equipmentDescription": "Equipment description from manual",
  
  "location": "General location from manual (e.g., Production Floor, Warehouse)",
  "building": "Building name/number from manual",
  "floor": "Floor number from manual",
  "room": "Room number from manual",
  
  "specialInstructions": "Special instructions MUST be formatted as bullet points. Each instruction should be on a new line starting with a dash (-) or bullet (•). Format like:\n- First instruction\n- Second instruction\n- Third instruction\n\nEach instruction should be a complete sentence. For motor vibration issues, focus on motor-specific troubleshooting steps like bearing inspection, alignment checks, vibration measurements, etc.",
  
  "shop": "Shop or department name from manual (e.g., Maintenance Shop, Electrical Shop)",
  "vendor": "Vendor name from manual if mentioned",
  "vendorAddress": "Vendor address from manual if mentioned",
  "vendorPhone": "Vendor phone from manual if mentioned",
  "vendorContact": "Vendor contact person from manual if mentioned",
  
  "taskNumber": "Task number from manual (e.g., PM-BF-001)",
  "frequency": "Frequency from manual (e.g., Weekly, Monthly, Quarterly)",
  "workPerformedBy": "Department/shop from manual (default: Maintenance Department)",
  "standardHours": "Standard hours as number (e.g., 2.0)",
  "overtimeHours": "Overtime hours as number (e.g., 0.5)",
  
  "workDescription": "Detailed work description formatted as clear sentences or bullet points. Make it professional and easy to read. This should describe what work needs to be performed. For motor vibration issues, describe motor inspection, vibration analysis, bearing replacement, alignment procedures, etc.",
  "workPerformed": "Work performed description - can be similar to workDescription or left empty if not yet performed",
  
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

IMPORTANT:
- Fill in all fields that are available in the maintenance manual context
- If a field is not mentioned in the manual, you can leave it as empty string "" or provide a reasonable default based on context
- For equipment fields, you can use the machine ID (${machineId}) if the manual doesn't specify
- ${issueType === 'vibration' ? 'CRITICAL: This is a MOTOR VIBRATION issue. Focus ONLY on motor vibration troubleshooting, motor bearing replacement, motor alignment, vibration analysis, motor shaft/rotor/stator issues. DO NOT include general machine maintenance steps like capping, filling, or other non-motor operations. If the context does not contain motor vibration information, leave fields empty rather than using unrelated machine maintenance steps.' : ''}
- Return ONLY the JSON object, no additional text or markdown formatting.`;

    // Step 4: Use LLM to extract and format structured data
    const llmStart = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Faster model for better performance
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that extracts structured work order information from maintenance manuals. Always return valid JSON only, no markdown code blocks. IMPORTANT: Format specialInstructions as bullet points with each instruction on a new line starting with "-" (dash).${issueType === 'vibration' ? ' CRITICAL: For motor vibration issues, ONLY extract motor vibration troubleshooting steps. Do NOT include general machine operations like capping, filling, or other non-motor maintenance. If the provided context does not contain motor vibration information, return empty strings for fields rather than using unrelated content.' : ''}`,
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

