'use client';

import { useState } from 'react';
import { ChatIcon, SendIcon } from './Icons';
import { formatAlarmName } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface ChatBotProps {
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    alarm_name?: string;
    machine_type?: string;
    score?: number;
  }>;
  relevant?: boolean;
  score?: number;
}

type ChatMode = 'ask' | 'agent' | 'plan';

export function ChatBot({ isMinimized, onToggleMinimize }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('ask');

  const handleSend = async () => {
    if (!input.trim() || loading || chatMode !== 'ask') return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Build conversation history (last 10 messages for context)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: conversationHistory,
          // Optional: can add machine_type filter here if needed
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response || 'Sorry, I could not generate a response.',
        sources: data.sources,
        relevant: data.relevant,
        score: data.score,
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your message. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Custom components for react-markdown styling
  const markdownComponents = {
    p: ({ children }: any) => <p className="text-gray-300 text-sm leading-relaxed mb-2">{children}</p>,
    strong: ({ children }: any) => <strong className="font-semibold text-white text-sm">{children}</strong>,
    em: ({ children }: any) => <em className="italic text-gray-300 text-sm">{children}</em>,
    ul: ({ children }: any) => <ul className="list-disc list-inside space-y-1 ml-4 my-2 text-gray-300 text-sm">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside space-y-1 ml-4 my-2 text-gray-300 text-sm">{children}</ol>,
    li: ({ children }: any) => <li className="text-gray-300 text-sm">{children}</li>,
    code: ({ children, className }: any) => {
      const isInline = !className;
      return isInline ? (
        <code className="bg-dark-border text-sage-400 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
      ) : (
        <code className="block bg-dark-border text-gray-300 p-3 rounded my-2 text-sm font-mono overflow-x-auto">{children}</code>
      );
    },
    pre: ({ children }: any) => <pre className="bg-dark-border p-3 rounded my-2 overflow-x-auto">{children}</pre>,
    h1: ({ children }: any) => <h1 className="text-white text-lg font-semibold mb-2 mt-4">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-white text-base font-semibold mb-2 mt-3">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-white text-sm font-semibold mb-1 mt-2">{children}</h3>,
    blockquote: ({ children }: any) => <blockquote className="border-l-4 border-sage-500 pl-4 my-2 text-gray-300 text-sm italic">{children}</blockquote>,
    a: ({ href, children }: any) => <a href={href} className="text-sage-400 hover:text-sage-300 underline text-sm" target="_blank" rel="noopener noreferrer">{children}</a>,
  };

  // If minimized, show only a small button on the right edge
  if (isMinimized) {
    return (
      <div className="absolute right-0 top-0 z-10">
        <button
          onClick={onToggleMinimize}
          className="bg-dark-panel border border-dark-border border-r-0 rounded-l-lg px-3 py-4 hover:bg-dark-border transition-colors"
          title="Open Chat Assistant"
        >
          <ChatIcon className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-96 bg-dark-panel border-l border-dark-border flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-dark-border flex-shrink-0">
        <div className="p-4 flex items-center justify-center relative">
          <h3 className="heading-inter heading-inter-sm !text-sage-400">Discover Infinite Wisdom</h3>
          <button
            onClick={onToggleMinimize}
            className="absolute right-4 text-gray-400 hover:text-white transition-colors p-1 hover:bg-dark-border rounded"
            title="Minimize"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        
        {/* Mode Tabs */}
        <div className="flex border-t border-dark-border">
          <button
            onClick={() => setChatMode('ask')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              chatMode === 'ask'
                ? 'text-sage-400 border-b-2 border-sage-400 bg-sage-500/5'
                : 'text-gray-500 hover:text-gray-300 hover:bg-dark-border/50'
            }`}
          >
            Ask
          </button>
          <button
            onClick={() => setChatMode('agent')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              chatMode === 'agent'
                ? 'text-sage-400 border-b-2 border-sage-400 bg-sage-500/5'
                : 'text-gray-500 hover:text-gray-300 hover:bg-dark-border/50'
            }`}
          >
            Agent
          </button>
          <button
            onClick={() => setChatMode('plan')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              chatMode === 'plan'
                ? 'text-sage-400 border-b-2 border-sage-400 bg-sage-500/5'
                : 'text-gray-500 hover:text-gray-300 hover:bg-dark-border/50'
            }`}
          >
            Plan
          </button>
        </div>
      </div>

      {/* Messages - Text-based like Cursor */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {chatMode === 'ask' && (
          <div className="p-4 space-y-6">
            {messages.length === 0 && !input.trim() && (
              <div className="text-gray-500 text-sm">
                Ask me about alarm procedures, troubleshooting, or machine operations.
              </div>
            )}
            
            {messages.map((msg, idx) => (
            <div key={idx} className="space-y-2">
              {/* User message */}
              {msg.role === 'user' && (
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 font-medium">You</div>
                  <div className="text-white text-sm">{msg.content}</div>
                </div>
              )}

              {/* Assistant message */}
              {msg.role === 'assistant' && (
                <div className="space-y-3">
                  <div className="text-xs text-gray-500 font-medium">Wise Guy</div>
                  <div className="space-y-2">
                    <ReactMarkdown components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  
                  {/* Sources section - separate section if available */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-dark-border">
                      <div className="text-xs text-gray-500 font-medium mb-2">Sources</div>
                      <div className="space-y-1">
                        {msg.sources.map((source, sourceIdx) => (
                          <div key={sourceIdx} className="text-xs text-gray-400">
                            {source.alarm_name && (
                              <span className="text-gray-300">{formatAlarmName(source.alarm_name)}</span>
                            )}
                            {source.machine_type && (
                              <span className="text-gray-500 ml-2">({source.machine_type})</span>
                            )}
                            {source.score !== undefined && (
                              <span className="text-gray-600 ml-2">
                                {Math.round(source.score * 100)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Relevance indicator */}
                  {msg.relevant === false && (
                    <div className="mt-3 pt-3 border-t border-dark-border">
                      <div className="text-xs text-yellow-400">
                        ⚠️ This response may not be directly related to alarm procedures.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            ))}
            
            {loading && (
              <div className="space-y-2">
                <div className="text-xs text-gray-500 font-medium">Wise Guy</div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </div>
        )}

        {chatMode === 'agent' && (
          <div className="p-4">
            <div className="text-center text-gray-500 text-sm">
              <p className="mb-2">Agent mode coming soon</p>
              <p className="text-xs text-gray-600">This feature will be implemented later</p>
            </div>
          </div>
        )}

        {chatMode === 'plan' && (
          <div className="p-4">
            <div className="text-center text-gray-500 text-sm">
              <p className="mb-2">Plan mode coming soon</p>
              <p className="text-xs text-gray-600">This feature will be implemented later</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-dark-border flex-shrink-0">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={chatMode === 'ask' ? "Ask Wise Guy!" : chatMode === 'agent' ? "Agent mode coming soon..." : "Plan mode coming soon..."}
            disabled={chatMode !== 'ask'}
            className={`flex-1 bg-dark-bg border border-dark-border rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-midnight-300 focus:border-midnight-300 text-sm h-10 ${
              chatMode !== 'ask' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-dark-border hover:bg-dark-border border border-dark-border rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center h-10 w-10 flex-shrink-0"
            title="Send"
          >
            <SendIcon className="w-4 h-4 text-sage-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

