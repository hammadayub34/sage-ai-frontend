import { NextRequest, NextResponse } from 'next/server';
import { getPineconeIndex } from '@/lib/pinecone';
import { createEmbedding } from '@/lib/embeddings';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Detect if message is a greeting or casual conversation
function isGreetingOrCasual(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const greetings = [
    'hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 
    'good evening', 'howdy', 'sup', 'what\'s up', 'yo', 'hi there',
    'hello there', 'hey there'
  ];
  const casual = [
    'thanks', 'thank you', 'thank', 'appreciate it', 'thanks a lot',
    'ok', 'okay', 'got it', 'understood', 'cool', 'nice', 'awesome',
    'great', 'perfect', 'sounds good'
  ];
  
  // Check if it's a greeting
  if (greetings.some(g => normalized.startsWith(g) || normalized === g)) {
    return true;
  }
  
  // Check if it's casual acknowledgment
  if (casual.some(c => normalized === c || normalized.startsWith(c))) {
    return true;
  }
  
  // Check if it's very short (likely casual)
  if (normalized.length < 10 && !normalized.includes('?')) {
    return true;
  }
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const { message, machine_type, conversationHistory = [] } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Check if it's a greeting or casual conversation
    if (isGreetingOrCasual(message)) {
      const normalized = message.toLowerCase().trim();
      
      // Handle greetings
      if (normalized.match(/^(hello|hi|hey|greetings|good morning|good afternoon|good evening|howdy|sup|what's up|yo)/)) {
        return NextResponse.json({
          response: "Hello! I'm here to help you with alarm procedures, troubleshooting, and maintenance work orders for your industrial automation systems. You can ask me about:\n\n• Specific alarm procedures (e.g., 'What should I do when AlarmLowProductLevel is raised?')\n• Troubleshooting steps for alarms\n• Machine operations and alarm handling\n• Alarm resolution procedures\n• Maintenance work orders\n• Parts and materials needed for maintenance\n• Work order procedures and task numbers\n\nWhat would you like to know?",
          relevant: true,
          score: 1.0,
          isGreeting: true,
        });
      }
      
      // Handle thanks/acknowledgments
      if (normalized.match(/^(thanks|thank you|thank|appreciate)/)) {
        return NextResponse.json({
          response: "You're welcome! Feel free to ask if you need help with any alarm procedures or troubleshooting.",
          relevant: true,
          score: 1.0,
          isGreeting: true,
        });
      }
      
      // Handle other casual responses
      return NextResponse.json({
        response: "I'm here to help with alarm procedures and troubleshooting. What would you like to know?",
        relevant: true,
        score: 1.0,
        isGreeting: true,
      });
    }

    // Step 1: Enhance query with conversation context for better relevance
    // If there's conversation history, include it in the query to improve context understanding
    let enhancedQuery = message;
    if (conversationHistory && conversationHistory.length > 0) {
      // Build context from recent conversation to help with follow-up questions
      const recentContext = conversationHistory
        .slice(-4) // Last 2 exchanges (4 messages: user + assistant pairs)
        .map((msg: { role: string; content: string }) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');
      enhancedQuery = `Previous conversation context:\n${recentContext}\n\nCurrent question: ${message}`;
      console.log('📊 Enhanced query with conversation context for better relevance');
    }
    
    // Step 2: Create embedding for enhanced query (includes conversation context if available)
    const queryEmbedding = await createEmbedding(enhancedQuery);
    
    // Step 3: Query Pinecone (optional filter by machine_type, but query ALL document types)
    const index = await getPineconeIndex();
    const filter: any = machine_type 
      ? { machine_type: { $eq: machine_type } }
      : undefined;
    // Note: No document_type filter - this allows querying both:
    // - ALARM_RESPONSE_MANUAL.md (alarm procedures)
    // - MAINTENANCE_WORK_ORDERS.md (work order procedures)
    
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 5, // Get top 5 relevant chunks from both documents
      includeMetadata: true,
      filter,
    });

    // Step 4: Check relevance (adjust threshold based on conversation history)
    const topScore = queryResponse.matches[0]?.score || 0;
    const BASE_RELEVANCE_THRESHOLD = 0.35;
    // If there's conversation history, be more lenient (follow-up questions might have lower scores)
    const hasConversationHistory = conversationHistory && conversationHistory.length > 0;
    const RELEVANCE_THRESHOLD = hasConversationHistory 
      ? 0.25 // Lower threshold for follow-up questions
      : BASE_RELEVANCE_THRESHOLD;
    
    if (topScore < RELEVANCE_THRESHOLD) {
      // If we have conversation history, still allow the query through but with a warning
      // The LLM can use conversation history to answer even if Pinecone score is low
      if (hasConversationHistory) {
        console.log(`⚠️ Low Pinecone score (${topScore}) but conversation history exists - allowing query`);
        // Continue processing - the LLM will use conversation history
      } else {
        // No conversation history and low score - likely unrelated question
      return NextResponse.json({
          response: "I'm sorry, but your question doesn't seem to be related to the available documentation. Please ask about:\n\n• Specific alarm procedures (e.g., 'What should I do when AlarmLowProductLevel is raised?')\n• Troubleshooting steps for alarms\n• Machine operations and alarm handling\n• Alarm resolution procedures\n• Maintenance work orders\n• Parts and materials needed for maintenance\n• Work order procedures",
        relevant: false,
        score: topScore,
      });
      }
    }

    // Step 5: Build context from retrieved chunks
    const context = queryResponse.matches
      .map((match: any, i: number) => {
        const docType = match.metadata?.document_type || 'alarm_response';
        const docName = docType === 'maintenance_work_order' 
          ? 'Maintenance Work Order Manual' 
          : 'Alarm Response Manual';
        const sourceLabel = match.metadata?.alarm_name || match.metadata?.task_number || 'General';
        return `[Source ${i + 1} - ${docName} - ${sourceLabel}]\n${match.metadata?.content || ''}`;
      })
      .join('\n\n');

    // Step 6: Generate response using LLM with conversation history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
        content: 'You are a helpful assistant for industrial automation systems. You have access to two knowledge bases:\n1. Alarm Response Manual - Contains alarm procedures, troubleshooting steps, and alarm resolution procedures\n2. Maintenance Work Order Manual - Contains work order procedures, parts lists, materials, task numbers, frequencies, and maintenance instructions\n\nAnswer questions based on the provided context from either or both manuals. Be concise and practical. Use conversation history to maintain context and provide coherent responses. If the question relates to alarms, use the alarm response manual. If it relates to maintenance work orders, parts, or materials, use the maintenance work order manual.',
      },
    ];

    // Add conversation history from FIFO queue (last 10 messages)
    // This maintains context by including previous user questions and assistant responses
    if (conversationHistory && conversationHistory.length > 0) {
      console.log(`📊 FIFO Queue: Processing ${conversationHistory.length} messages from conversation history`);
      conversationHistory.forEach((msg: { role: string; content: string }, index: number) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      });
    }

    // Add current question with context
    // The conversation history above provides context for follow-up questions
    // The manual context below provides specific information from the knowledge base
    messages.push({
          role: 'user',
      content: `User Question: ${message}\n\nRelevant Context from Manual:\n${context}\n\nProvide a helpful answer based on the context above. Use the conversation history to understand the context of follow-up questions (e.g., if the user asks "What about that one?" or "Tell me more", refer to previous messages in the conversation history).`,
    });

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata (sources, score, etc.)
          const metadata = JSON.stringify({
            type: 'metadata',
      relevant: true,
      score: topScore,
      sources: queryResponse.matches.map((m: any) => ({
        alarm_name: m.metadata?.alarm_name,
        machine_type: m.metadata?.machine_type,
        score: m.score,
      })),
          }) + '\n';
          controller.enqueue(new TextEncoder().encode(metadata));

          // Create streaming completion
          const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
            temperature: 0.3,
            max_tokens: 500,
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
            error: error.message || 'Failed to generate response',
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
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

