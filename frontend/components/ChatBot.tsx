'use client';

import { useState } from 'react';
import { ChatIcon } from './Icons';

interface ChatBotProps {
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

export function ChatBot({ isMinimized, onToggleMinimize }: ChatBotProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    // TODO: Implement API call to /api/chat
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Chat functionality will be implemented here...' 
      }]);
      setLoading(false);
    }, 500);
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
      <div className="p-4 border-b border-dark-border flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="heading-inter heading-inter-sm">Discover Infinite Wisdom</h3>
        </div>
        <button
          onClick={onToggleMinimize}
          className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-dark-border rounded"
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-midnight-500 text-white'
                  : 'bg-dark-border text-gray-300'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-dark-border rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-dark-border flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Away!"
            className="flex-1 bg-dark-border border border-dark-border rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-midnight-300 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-midnight-500 hover:bg-midnight-400 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

