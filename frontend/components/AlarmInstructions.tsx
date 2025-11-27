'use client';

import { useState, useEffect } from 'react';

function formatInstructions(text: string) {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  let key = 0;

  // Helper function to format inline markdown (bold, etc.)
  const formatInlineMarkdown = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let currentIndex = 0;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    let lastIndex = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the bold
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // Add bold text
      parts.push(
        <strong key={`bold-${currentIndex++}`} className="text-white font-semibold">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
  };

  const flushList = () => {
    if (listItems.length > 0) {
      const list = (
        <ol key={key++} className="list-decimal list-inside space-y-2 ml-4 mb-4">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-gray-300 leading-relaxed">
              <span className="text-white">{formatInlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>
      );
      listItems = [];
      return list;
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Skip markdown headers (##)
    if (line.startsWith('##')) {
      continue; // Skip markdown headers
    }
    
    // Section headers (bold text with **)
    if (line.startsWith('**') && line.endsWith('**')) {
      const flushed = flushList();
      if (flushed) elements.push(flushed);
      
      const headerText = line.replace(/\*\*/g, '').trim();
      const isMainSection = headerText === headerText.toUpperCase() || 
                           ['IMMEDIATE ACTIONS', 'TROUBLESHOOTING', 'RESOLUTION', 'VERIFICATION', 'STATUS', 'POST-RESOLUTION', 'IMPORTANT NOTES'].some(h => headerText.includes(h));
      elements.push(
        <div key={key++} className={`mt-6 mb-3 ${i > 0 ? 'pt-4 border-t border-dark-border' : ''}`}>
          <h4 className={`${isMainSection ? 'heading-inter-sm' : 'heading-inter heading-inter-sm'} flex items-center gap-2`}>
            {isMainSection && (
              <span className="text-midnight-300">
                {headerText.includes('IMMEDIATE') ? '🚨' : 
                 headerText.includes('TROUBLESHOOTING') ? '🔧' :
                 headerText.includes('RESOLUTION') ? '✅' :
                 headerText.includes('VERIFICATION') ? '✔️' :
                 headerText.includes('STATUS') ? '📊' :
                 headerText.includes('POST-RESOLUTION') ? '🔍' :
                 headerText.includes('IMPORTANT') ? '⚠️' : '📋'}
              </span>
            )}
            {headerText}
          </h4>
        </div>
      );
    }
    // Numbered list items
    else if (line.match(/^\d+\./)) {
      const itemText = line.replace(/^\d+\.\s*/, '').trim();
      if (itemText) {
        listItems.push(itemText);
      }
    }
    // Bullet points
    else if (line.match(/^[-•*]\s/)) {
      const itemText = line.replace(/^[-•*]\s*/, '').trim();
      if (itemText) {
        listItems.push(itemText);
      }
    }
    // Empty line - flush list if we have items
    else if (line === '') {
      const flushed = flushList();
      if (flushed) elements.push(flushed);
    }
    // Regular text - format inline markdown
    else if (line) {
      const flushed = flushList();
      if (flushed) elements.push(flushed);
      
      elements.push(
        <p key={key++} className="text-gray-300 mb-2 leading-relaxed">
          {formatInlineMarkdown(line)}
        </p>
      );
    }
  }
  
  // Flush any remaining list items
  const flushed = flushList();
  if (flushed) elements.push(flushed);
  
  return elements.length > 0 ? elements : <p className="text-gray-400">No instructions available.</p>;
}

interface AlarmInstructionsProps {
  alarmType: string;
  machineType: 'bottlefiller' | 'lathe';
  state: 'RAISED' | 'CLEARED';
  machineId?: string;
  onClose?: () => void;
}

interface RAGResponse {
  instructions: string;
  chunks: Array<{
    alarm_name: string;
    severity: string;
    score: number;
  }>;
  alarm_type: string;
  machine_type: string;
  state: string;
  timings?: {
    embedding: number;
    pinecone: number;
    llm: number;
    total: number;
  };
}

export function AlarmInstructions({
  alarmType,
  machineType,
  state,
  machineId,
  onClose,
}: AlarmInstructionsProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInstructions() {
      const clientStartTime = performance.now();
      try {
        setLoading(true);
        const response = await fetch('/api/alarms/rag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            alarm_type: alarmType,
            machine_type: machineType,
            state,
            machine_id: machineId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch instructions');
        }

        const result = await response.json();
        const clientEndTime = performance.now();
        const clientTotalTime = clientEndTime - clientStartTime;
        
        // Log timing information
        console.log('⏱️ [RAG Client] Total client-side time:', clientTotalTime.toFixed(2), 'ms');
        if (result.timings) {
          console.log('⏱️ [RAG Server] Breakdown:', {
            embedding: `${result.timings.embedding}ms`,
            pinecone: `${result.timings.pinecone}ms`,
            llm: `${result.timings.llm}ms`,
            serverTotal: `${result.timings.total}ms`,
            clientTotal: `${clientTotalTime.toFixed(2)}ms`,
          });
        }
        
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load instructions');
      } finally {
        setLoading(false);
      }
    }

    fetchInstructions();
  }, [alarmType, machineType, state, machineId]);

  if (loading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span className="text-gray-400">Loading instructions...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-red-500/30">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="bg-dark-panel rounded-lg border border-dark-border max-w-4xl max-h-[85vh] flex flex-col">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-dark-border flex-shrink-0">
        <div>
          <h3 className="heading-inter heading-inter-md flex items-center gap-2">
            {state === 'RAISED' ? (
              <>
                <span className="text-red-400">🚨</span>
                <span>Alarm Response Instructions</span>
              </>
            ) : (
              <>
                <span className="text-green-400">✅</span>
                <span>Issue Resolved</span>
              </>
            )}
          </h3>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-gray-400 text-sm">
              <span className="font-semibold text-gray-300">Alarm:</span> {alarmType}
            </span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400 text-sm">
              <span className="font-semibold text-gray-300">Machine:</span> {machineId || 'N/A'}
            </span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400 text-sm capitalize">
              {machineType}
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl font-light leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-dark-border"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="prose prose-invert max-w-none">
          <div className="text-gray-300 leading-relaxed space-y-4">
            {formatInstructions(data.instructions)}
          </div>
        </div>
      </div>

      {data.chunks.length > 0 && (
        <div className="mt-auto pt-4 px-6 pb-6 border-t border-dark-border flex-shrink-0">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span className="text-gray-400">📚</span>
            <span>Based on {data.chunks.length} relevant procedure section(s) from the alarm manual</span>
          </div>
          {data.chunks.some(c => c.severity) && (
            <div className="mt-2 flex items-center gap-4 text-xs">
              {data.chunks.map((chunk, idx) => (
                <span key={idx} className="text-gray-500">
                  {chunk.severity && (
                    <span className="text-gray-400">
                      Severity: <span className="font-semibold">{chunk.severity}</span>
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

