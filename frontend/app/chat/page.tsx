'use client';

import { useState } from 'react';
import { Canvas } from '@/components/Canvas';
import { ChatBot } from '@/components/ChatBot';

export default function ChatPage() {
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden relative">
      {/* Canvas in the middle */}
      <Canvas />
      
      {/* Chatbot on the right side */}
      <ChatBot 
        isMinimized={isChatMinimized} 
        onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)} 
      />
    </div>
  );
}

