'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryAlarmHistory } from '@/lib/influxdb';

interface AlarmHistoryProps {
  machineId?: string;
  timeRange?: string;
}

export function AlarmHistory({ machineId = 'machine-01', timeRange = '-24h' }: AlarmHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data, isLoading, error } = useQuery<Record<string, number>>({
    queryKey: ['alarm-history', machineId, timeRange],
    queryFn: async () => {
      try {
        return await queryAlarmHistory(machineId, timeRange);
      } catch (error) {
        console.error('Error fetching alarm history:', error);
        return {};
      }
    },
  });

  if (isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity mb-4"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="text-white text-lg font-semibold">Alarm History (Last 24h)</h3>
          <span className="text-xs text-gray-500">{isExpanded ? '▼' : '▶'}</span>
        </div>
        {isExpanded && <div className="text-gray-400">Loading...</div>}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity mb-4"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="text-white text-lg font-semibold">Alarm History (Last 24h)</h3>
          <span className="text-xs text-gray-500">{isExpanded ? '▼' : '▶'}</span>
        </div>
        {isExpanded && <div className="text-red-400">Error loading alarm history</div>}
      </div>
    );
  }

  const alarms = [
    { label: 'Fault', field: 'AlarmFault' },
    { label: 'Overfill', field: 'AlarmOverfill' },
    { label: 'Underfill', field: 'AlarmUnderfill' },
    { label: 'Low Product Level', field: 'AlarmLowProductLevel' },
    { label: 'Cap Missing', field: 'AlarmCapMissing' },
  ];

  const totalAlarms = data ? Object.values(data).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
      <div 
        className="flex items-center justify-between mb-4 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-white text-lg font-semibold">Alarm History (Last 24h)</span>
          <span className="text-xs text-gray-500">{isExpanded ? '▼' : '▶'}</span>
        </div>
        {totalAlarms > 0 && (
          <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded text-sm font-medium border border-red-500/50">
            {totalAlarms} Total
          </span>
        )}
      </div>
      
      {isExpanded && (
        <>
          <div className="space-y-3">
            {alarms.map((alarm) => {
              const count = data?.[alarm.field] || 0;
              return (
                <div key={alarm.field} className="flex items-center justify-between p-3 bg-dark-bg/50 rounded border border-dark-border">
                  <div className="flex items-center gap-3">
                    <span className="text-dark-text font-medium">{alarm.label}</span>
                    {count > 0 && (
                      <span className="text-red-400 text-xs">⚠️</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${count > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {count}
                    </span>
                    <span className="text-gray-500 text-sm">occurrences</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          {totalAlarms === 0 && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded text-center">
              <span className="text-green-400 text-sm">✅ No alarms triggered in last 24 hours</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

