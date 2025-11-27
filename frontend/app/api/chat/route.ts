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
          response: "Hello! I'm here to help you with alarm procedures and troubleshooting for your industrial automation systems. You can ask me about:\n\n• Specific alarm procedures (e.g., 'What should I do when AlarmLowProductLevel is raised?')\n• Troubleshooting steps for alarms\n• Machine operations and alarm handling\n• Alarm resolution procedures\n\nWhat would you like to know?",
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

    // Step 1: Create embedding for user query
    const queryEmbedding = await createEmbedding(message);
    
    // Step 2: Query Pinecone (optional filter by machine_type)
    const index = await getPineconeIndex();
    const filter: any = machine_type 
      ? { machine_type: { $eq: machine_type } }
      : undefined;
    
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 5, // Get top 5 relevant chunks
      includeMetadata: true,
      filter,
    });

    // Step 3: Check relevance (if top score is too low, query might not be related)
    const topScore = queryResponse.matches[0]?.score || 0;
    const RELEVANCE_THRESHOLD = 0.35; // Lowered threshold to be more lenient
    
    if (topScore < RELEVANCE_THRESHOLD) {
      return NextResponse.json({
        response: "I'm sorry, but your question doesn't seem to be related to the alarm response manual. Please ask about:\n\n• Specific alarm procedures (e.g., 'What should I do when AlarmLowProductLevel is raised?')\n• Troubleshooting steps for alarms\n• Machine operations and alarm handling\n• Alarm resolution procedures",
        relevant: false,
        score: topScore,
      });
    }

    // Step 4: Build context from retrieved chunks
    const context = queryResponse.matches
      .map((match: any, i: number) => 
        `[Source ${i + 1} - ${match.metadata?.alarm_name || 'General'}]\n${match.metadata?.content || ''}`
      )
      .join('\n\n');

    // Step 5: Generate response using LLM with conversation history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: 'You are a helpful assistant for industrial automation alarm response procedures. Answer questions based on the provided context from the alarm manual. Be concise and practical. Use conversation history to maintain context and provide coherent responses.',
      },
    ];

    // Add conversation history (last 10 messages)
    conversationHistory.forEach((msg: { role: string; content: string }) => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    });

    // Add current question with context
    messages.push({
      role: 'user',
      content: `User Question: ${message}\n\nRelevant Context from Manual:\n${context}\n\nProvide a helpful answer based on the context above. If the context doesn't fully answer the question, say so. Use the conversation history to understand the context of follow-up questions.`,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: 0.3,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || 'Unable to generate response.';

    return NextResponse.json({
      response,
      relevant: true,
      score: topScore,
      sources: queryResponse.matches.map((m: any) => ({
        alarm_name: m.metadata?.alarm_name,
        machine_type: m.metadata?.machine_type,
        score: m.score,
      })),
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

