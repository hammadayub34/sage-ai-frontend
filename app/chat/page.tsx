'use client';

import { Canvas } from '@/components/Canvas';
import { ChatDock } from '@/components/ChatDock';

export default function ChatPage() {
  return (
    <ChatDock>
      <Canvas />
    </ChatDock>
  );
}

