import { NextRequest, NextResponse } from 'next/server';
import { getPineconeIndex } from '@/lib/pinecone';
import { createEmbedding } from '@/lib/embeddings';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RAGRequest {
  alarm_type: string;
  machine_type: 'bottlefiller' | 'lathe';
  state: 'RAISED' | 'CLEARED';
  machine_id?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const timings: Record<string, number> = {};
  
  try {
    const body: RAGRequest = await request.json();
    const { alarm_type, machine_type, state, machine_id } = body;

    if (!alarm_type || !machine_type || !state) {
      return NextResponse.json(
        { error: 'Missing required fields: alarm_type, machine_type, state' },
        { status: 400 }
      );
    }

    // Step 1: Create query embedding
    const embeddingStart = Date.now();
    const queryText = `${alarm_type} alarm for ${machine_type} machine ${state}`;
    const queryEmbedding = await createEmbedding(queryText);
    timings.embedding = Date.now() - embeddingStart;
    console.log(`[RAG] Embedding created in ${timings.embedding}ms`);

    // Step 2: Query Pinecone
    const pineconeStart = Date.now();
    const index = await getPineconeIndex();
    
    // Filter by machine type and alarm name (normalize alarm name)
    const normalizedAlarmName = alarm_type.startsWith('Alarm') 
      ? alarm_type 
      : `Alarm${alarm_type}`;
    
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true,
      filter: {
        machine_type: { $eq: machine_type },
        alarm_name: { $eq: normalizedAlarmName },
      },
    });
    timings.pinecone = Date.now() - pineconeStart;
    console.log(`[RAG] Pinecone query completed in ${timings.pinecone}ms`);

    // Extract relevant chunks
    const chunks = queryResponse.matches.map((match: any) => ({
      content: match.metadata?.content || '',
      score: match.score,
      alarm_name: match.metadata?.alarm_name || '',
      severity: match.metadata?.severity || '',
    }));

    if (chunks.length === 0) {
      return NextResponse.json({
        instructions: `No specific instructions found for ${alarm_type} on ${machine_type}. Please refer to the general alarm response procedures.`,
        chunks: [],
      });
    }

    // Step 3: Generate response using LLM
    const llmStart = Date.now();
    const context = chunks.map((c, i) => `[Chunk ${i + 1}]\n${c.content}`).join('\n\n');
    
    const prompt = `Industrial automation expert. Provide alarm response instructions focused specifically on this alarm issue.

Alarm: ${alarm_type} | Machine: ${machine_type} | State: ${state} | ID: ${machine_id || 'N/A'}

Relevant Procedures:
${context}

${state === 'RAISED' 
  ? `Format: **IMMEDIATE ACTIONS** (2-4 actions, full sentences directly related to this alarm), **TROUBLESHOOTING STEPS** (3-5 steps, full sentences focused on this specific issue), **RESOLUTION STEPS** (step-by-step, full sentences addressing this alarm), **IMPORTANT NOTES** (warnings/safety specific to this alarm). Use **bold headers**, full sentences/paragraphs (NOT bullets), numbered lists only for sequential steps. Write clear, concise sentences that directly address this alarm issue.`
  : `Format: **STATUS CONFIRMATION** (cleared status, full sentences about this specific alarm), **VERIFICATION STEPS** (3-5 steps, full sentences verifying this alarm is resolved), **POST-RESOLUTION CHECKS** (monitoring, full sentences about this alarm), **IMPORTANT NOTES** (reminders specific to this alarm). Use **bold headers**, full sentences/paragraphs (NOT bullets). Write clear, concise sentences that directly address this alarm issue.`}`;

    // Check if client wants streaming
    const acceptHeader = request.headers.get('accept') || '';
    const wantsStreaming = acceptHeader.includes('text/event-stream');

    if (wantsStreaming) {
      // Return streaming response
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          // Send initial metadata
          const metadata = {
            chunks: chunks.map(c => ({
              alarm_name: c.alarm_name,
              severity: c.severity,
              score: c.score,
            })),
            alarm_type,
            machine_type,
            state,
            timings: {
              embedding: timings.embedding,
              pinecone: timings.pinecone,
            },
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`));

          // Stream LLM response
          const stream = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a technical documentation expert specializing in industrial automation alarm response procedures.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 800,
            stream: true,
          });

          let fullText = '';
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullText += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`));
            }
          }

          // Send final timing info
          timings.llm = Date.now() - llmStart;
          timings.total = Date.now() - startTime;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', timings })}\n\n`));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming response (backward compatibility)
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a technical documentation expert specializing in industrial automation alarm response procedures.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      const instructions = completion.choices[0]?.message?.content || 'Unable to generate instructions.';
      timings.llm = Date.now() - llmStart;
      timings.total = Date.now() - startTime;
      
      console.log(`[RAG] LLM completion in ${timings.llm}ms`);
      console.log(`[RAG] Total time: ${timings.total}ms (Embedding: ${timings.embedding}ms, Pinecone: ${timings.pinecone}ms, LLM: ${timings.llm}ms)`);

      return NextResponse.json({
        instructions,
        chunks: chunks.map(c => ({
          alarm_name: c.alarm_name,
          severity: c.severity,
          score: c.score,
        })),
        alarm_type,
        machine_type,
        state,
        timings,
      });
    }
  } catch (error: any) {
    console.error('RAG API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve alarm instructions' },
      { status: 500 }
    );
  }
}

