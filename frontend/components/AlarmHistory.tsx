'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, CheckIcon, WarningIcon } from './Icons';
import { useQuery } from '@tanstack/react-query';
import { queryAlarmHistory } from '@/lib/influxdb';

interface AlarmHistoryProps {
  machineId?: string;
  timeRange?: string;
  machineType?: string;
}

export function AlarmHistory({ machineId = 'machine-01', timeRange = '-24h', machineType }: AlarmHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data, isLoading, error } = useQuery<Record<string, number>>({
    queryKey: ['alarm-history', machineId, timeRange, machineType],
    queryFn: async () => {
      try {
        return await queryAlarmHistory(machineId, timeRange, machineType);
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
          <div>
            <h3 className="heading-inter heading-inter-sm">Alarm History</h3>
            <p className="text-xs text-gray-500 mt-0.5">Last 24 hours</p>
          </div>
          {isExpanded ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
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
          <div>
            <h3 className="heading-inter heading-inter-sm">Alarm History</h3>
            <p className="text-xs text-gray-500 mt-0.5">Last 24 hours</p>
          </div>
          {isExpanded ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
        </div>
        {isExpanded && <div className="text-red-400">Error loading alarm history</div>}
      </div>
    );
  }

  // Different alarm labels for bottle filler vs lathe
  const alarms = machineType === 'lathe' ? [
    { label: 'Spindle Overload', field: 'AlarmSpindleOverload' },
    { label: 'Chuck Not Clamped', field: 'AlarmChuckNotClamped' },
    { label: 'Door Open', field: 'AlarmDoorOpen' },
    { label: 'Tool Wear', field: 'AlarmToolWear' },
    { label: 'Coolant Low', field: 'AlarmCoolantLow' },
  ] : [
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
          <div>
            <span className="heading-inter heading-inter-sm">Alarm History</span>
            <p className="text-xs text-gray-500 mt-0.5">Last 24 hours</p>
          </div>
          {isExpanded ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
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
                      <WarningIcon className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${count > 0 ? 'text-red-400' : 'text-sage-400'}`}>
                      {count}
                    </span>
                    <span className="text-gray-500 text-sm">occurrences</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          {totalAlarms === 0 && (
            <div className="mt-4 p-4 bg-sage-500/10 border border-sage-500/30 rounded text-center">
              <span className="text-sage-400 text-sm flex items-center gap-1.5">
                <CheckIcon className="w-4 h-4" />
                No alarms triggered in last 24 hours
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

