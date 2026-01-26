import { NextRequest, NextResponse } from 'next/server';
import { getPineconeIndex } from '@/lib/pinecone';
import { createEmbedding } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
  try {
    const { machineId, alarmType, machineType } = await request.json();

    if (!machineId) {
      return NextResponse.json(
        { error: 'Machine ID is required' },
        { status: 400 }
      );
    }

    // Step 1: Create embedding for the query
    const queryText = alarmType 
      ? `${alarmType} ${machineType || ''} maintenance work order parts materials task number frequency hours`
      : `${machineType || ''} maintenance work order parts materials task number frequency hours`;
    const queryEmbedding = await createEmbedding(queryText);

    // Step 2: Query Pinecone with filter for maintenance work orders
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
      topK: 3, // Get top 3 relevant chunks
      includeMetadata: true,
      filter,
    });

    // Step 3: Format the results
    if (queryResponse.matches.length === 0) {
      return NextResponse.json({
        info: 'No maintenance work order information found in Pinecone for this alarm type. Please make sure the maintenance manual has been embedded.',
      });
    }

    // Combine the top matches into a readable format
    const infoParts = queryResponse.matches.map((match, index) => {
      const metadata = match.metadata || {};
      const score = (match.score || 0) * 100;
      
      let info = `\n--- Result ${index + 1} (Relevance: ${score.toFixed(1)}%) ---\n`;
      
      if (metadata.task_number) {
        info += `Task Number: ${metadata.task_number}\n`;
      }
      if (metadata.priority) {
        info += `Priority: ${metadata.priority}\n`;
      }
      if (metadata.threshold) {
        info += `Threshold: ${metadata.threshold}\n`;
      }
      
      // Get the full content from metadata
      if (metadata.content) {
        info += `\nDetails:\n${metadata.content}\n`;
      }
      
      return info;
    });

    const combinedInfo = `Found ${queryResponse.matches.length} relevant maintenance work order section(s):${infoParts.join('\n')}`;

    return NextResponse.json({
      success: true,
      info: combinedInfo,
      matches: queryResponse.matches.length,
    });
  } catch (error: any) {
    console.error('Error querying Pinecone:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to query Pinecone',
        info: 'Error: Failed to query Pinecone. Make sure the maintenance manual is embedded by running: python3 scripts/embed_maintenance_manual.py'
      },
      { status: 500 }
    );
  }
}

