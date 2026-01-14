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

// Use LLM to determine which document types to query based on intent
async function determineDocumentTypes(message: string, conversationHistory: Array<{ role: string; content: string }> = []): Promise<{
  includeAlarmManual: boolean;
  includeMaintenanceManual: boolean;
  includeWorkOrderHistory: boolean;
}> {
  // Build context from conversation history if available
  let contextPrompt = message;
  if (conversationHistory && conversationHistory.length > 0) {
    const recentContext = conversationHistory
      .slice(-4) // Last 2 exchanges
      .map((msg: { role: string; content: string }) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
    contextPrompt = `Previous conversation:\n${recentContext}\n\nCurrent question: ${message}`;
  }
  
  const classificationPrompt = `You are a routing assistant for an industrial automation system knowledge base. Analyze the user's question and determine which document types should be queried to answer it.

Available document types:
1. alarm_response_manual - Contains alarm procedures, troubleshooting steps, and alarm resolution procedures
2. maintenance_work_order - Contains work order templates, parts lists, materials, task numbers, frequencies, and maintenance instructions
3. work_order_history - Contains a chronological record of all generated work orders with their details, status, and completion information

User question: "${contextPrompt}"

Determine which document type(s) should be queried. Consider:
- If asking about EXISTING work orders (e.g., "how many work orders", "what work orders do I have", "show me work orders", "list work orders") -> use work_order_history
- If asking about alarm procedures, troubleshooting, or what to do when an alarm occurs -> use alarm_response_manual
- If asking about maintenance procedures, parts, materials, or how to create/work with work orders -> use maintenance_work_order
- If the question could benefit from multiple sources, include multiple document types

Return ONLY a JSON object with this exact structure:
{
  "alarm_response_manual": true/false,
  "maintenance_work_order": true/false,
  "work_order_history": true/false
}

Do not include any other text, explanations, or markdown formatting. Only return the JSON object.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a precise routing assistant. Always return valid JSON only, no additional text or markdown.',
        },
        {
          role: 'user',
          content: classificationPrompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent routing
      max_tokens: 100,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    
    // Extract JSON from response (handle markdown code blocks if present)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('⚠️ Could not parse LLM routing response, defaulting to all documents');
      return {
        includeAlarmManual: true,
        includeMaintenanceManual: true,
        includeWorkOrderHistory: true,
      };
    }

    const routing = JSON.parse(jsonMatch[0]);
    
    return {
      includeAlarmManual: routing.alarm_response_manual === true,
      includeMaintenanceManual: routing.maintenance_work_order === true,
      includeWorkOrderHistory: routing.work_order_history === true,
    };
  } catch (error: any) {
    console.error('❌ Error in LLM routing:', error);
    // Fallback to querying all documents if LLM fails
    return {
      includeAlarmManual: true,
      includeMaintenanceManual: true,
      includeWorkOrderHistory: true,
    };
  }
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
    
    // Step 2: Use LLM to determine which document types to query based on intent
    const documentTypes = await determineDocumentTypes(message, conversationHistory);
    console.log('🔀 LLM Routing to document types:', {
      alarmManual: documentTypes.includeAlarmManual,
      maintenanceManual: documentTypes.includeMaintenanceManual,
      workOrderHistory: documentTypes.includeWorkOrderHistory,
    });
    
    // Step 3: Create embedding for enhanced query (includes conversation context if available)
    const queryEmbedding = await createEmbedding(enhancedQuery);
    
    // Step 4: Query Pinecone with document type routing
    const index = await getPineconeIndex();
    
    // Build document_type filter based on routing decision
    const documentTypeFilters: string[] = [];
    if (documentTypes.includeAlarmManual) {
      documentTypeFilters.push('alarm_response_manual');
    }
    if (documentTypes.includeMaintenanceManual) {
      documentTypeFilters.push('maintenance_work_order');
    }
    if (documentTypes.includeWorkOrderHistory) {
      documentTypeFilters.push('work_order_history');
    }
    
    // Build filter: combine document_type filter with machine_type filter
    const filter: any = {};
    if (documentTypeFilters.length > 0) {
      // Pinecone filter: document_type must be one of the selected types
      filter.document_type = { $in: documentTypeFilters };
    }
    if (machine_type) {
      filter.machine_type = { $eq: machine_type };
    }
    
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: documentTypes.includeWorkOrderHistory ? 10 : 5, // Get more results for work order history queries
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    // Step 5: Check relevance (adjust threshold based on conversation history)
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

    // Step 6: Build context from retrieved chunks
    const context = queryResponse.matches
      .map((match: any, i: number) => {
        const docType = match.metadata?.document_type || 'alarm_response';
        let docName = 'Alarm Response Manual';
        if (docType === 'maintenance_work_order') {
          docName = 'Maintenance Work Order Manual';
        } else if (docType === 'work_order_history') {
          docName = 'Work Orders History';
        }
        const sourceLabel = match.metadata?.work_order_no 
          || match.metadata?.alarm_name 
          || match.metadata?.task_number 
          || 'General';
        // For work order history, include more metadata in the context
        const woContext = docType === 'work_order_history' 
          ? `Work Order: ${match.metadata?.work_order_no || 'N/A'}\nStatus: ${match.metadata?.status || 'N/A'}\nPriority: ${match.metadata?.priority || 'N/A'}\nMachine: ${match.metadata?.machine_id || 'N/A'}\n\n${match.metadata?.content || ''}`
          : match.metadata?.content || '';
        return `[Source ${i + 1} - ${docName} - ${sourceLabel}]\n${woContext}`;
      })
      .join('\n\n');

    // Step 7: Generate response using LLM with conversation history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
        content: 'You are a helpful assistant for industrial automation systems. You have access to three knowledge bases:\n1. Alarm Response Manual - Contains alarm procedures, troubleshooting steps, and alarm resolution procedures\n2. Maintenance Work Order Manual - Contains work order procedures, parts lists, materials, task numbers, frequencies, and maintenance instructions\n3. Work Orders History - Contains a chronological record of all generated work orders with their details, status, and completion information\n\nAnswer questions based on the provided context from any of these sources. Be concise and practical. Use conversation history to maintain context and provide coherent responses. If the question relates to alarms, use the alarm response manual. If it relates to maintenance work orders, parts, or materials, use the maintenance work order manual. If the question asks about existing work orders (e.g., "how many work orders do I have", "what work orders are pending", "show me work orders for machine X"), use the work orders history.',
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
          // Build sources with proper labels based on document type
          const sources = queryResponse.matches.map((m: any) => {
            const docType = m.metadata?.document_type || 'alarm_response_manual';
            
            // For work order history, show work order number
            if (docType === 'work_order_history') {
              return {
                label: m.metadata?.work_order_no || 'Work Order',
                document_type: 'Work Orders History',
                machine_id: m.metadata?.machine_id,
                status: m.metadata?.status,
                score: m.score,
              };
            }
            
            // For maintenance work order manual, show task number or alarm name
            if (docType === 'maintenance_work_order') {
              return {
                label: m.metadata?.task_number || m.metadata?.alarm_name || 'Maintenance Manual',
                document_type: 'Maintenance Work Order Manual',
                machine_type: m.metadata?.machine_type,
                score: m.score,
              };
            }
            
            // For alarm response manual, show alarm name
            return {
              label: m.metadata?.alarm_name || 'Alarm Procedure',
              document_type: 'Alarm Response Manual',
              machine_type: m.metadata?.machine_type,
              score: m.score,
            };
          });
          
          const metadata = JSON.stringify({
            type: 'metadata',
            relevant: true,
            score: topScore,
            sources: sources,
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

