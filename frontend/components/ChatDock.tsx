'use client';

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { ChatBot } from './ChatBot';

const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH_PERCENT = 0.85; // 85% of window width - allows for much larger expansion
const DEFAULT_CHAT_WIDTH = 384; // w-96 = 384px

interface ChatDockProps {
  children: ReactNode;
}

/**
 * ChatDock
 * Reusable layout wrapper that adds the resizable chat panel on the right.
 * Use this on any page where you want the floating chat icon / panel behavior.
 */
export function ChatDock({ children }: ChatDockProps) {
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [chatWidth, setChatWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chat-width');
      return saved ? parseInt(saved, 10) : DEFAULT_CHAT_WIDTH;
    }
    return DEFAULT_CHAT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Save width to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chat-width', chatWidth.toString());
    }
  }, [chatWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = window.innerWidth - e.clientX;
    const maxWidth = window.innerWidth * MAX_CHAT_WIDTH_PERCENT;
    const clampedWidth = Math.max(MIN_CHAT_WIDTH, Math.min(maxWidth, newWidth));
    setChatWidth(clampedWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex h-full bg-dark-bg overflow-hidden relative">
      {/* Main content on the left */}
      <div className="flex-1">
        {children}
      </div>

      {/* Resize handle */}
      {!isChatMinimized && (
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          className={`absolute top-0 bottom-0 cursor-col-resize z-20 transition-all ${
            isResizing ? 'bg-sage-500 w-1' : 'bg-dark-border hover:bg-sage-400 w-0.5 hover:w-1'
          }`}
          style={{ right: `${chatWidth}px` }}
        />
      )}

      {/* Chatbot on the right side */}
      <ChatBot
        isMinimized={isChatMinimized}
        onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)}
        width={chatWidth}
      />
    </div>
  );
}
