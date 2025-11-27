'use client';

import { usePLCData } from '@/hooks/usePLCData';
import { WarningIcon, CheckIcon } from './Icons';

interface AlarmsPanelProps {
  machineId?: string;
}

export function AlarmsPanel({ machineId = 'machine-01' }: AlarmsPanelProps) {
  const { data, isLoading, error } = usePLCData(machineId);

  if (isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="heading-inter heading-inter-sm mb-4">Alarms</h3>
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="heading-inter heading-inter-sm mb-4">Alarms</h3>
        <div className="text-red-400">Error loading data</div>
      </div>
    );
  }

  const alarms = [
    { label: 'Fault', value: data?.AlarmFault ?? false },
    { label: 'Overfill', value: data?.AlarmOverfill ?? false },
    { label: 'Underfill', value: data?.AlarmUnderfill ?? false },
    { label: 'Low Product Level', value: data?.AlarmLowProductLevel ?? false },
    { label: 'Cap Missing', value: data?.AlarmCapMissing ?? false },
  ];

  const activeAlarms = alarms.filter(a => a.value).length;

  return (
    <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="heading-inter heading-inter-sm">Alarms</h3>
        {activeAlarms > 0 && (
          <span className="bg-red-500 text-white px-2 py-1 rounded text-sm">
            {activeAlarms} Active
          </span>
        )}
      </div>
      <div className="space-y-2">
        {alarms.map((alarm) => (
          <AlarmItem 
            key={alarm.label}
            label={alarm.label} 
            active={alarm.value}
          />
        ))}
      </div>
    </div>
  );
}

function AlarmItem({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-dark-text text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${active ? 'text-red-400' : 'text-green-400'}`}>
          <span className="flex items-center gap-1">
            {active ? (
              <>
                <WarningIcon className="w-3 h-3" />
                ACTIVE
              </>
            ) : (
              <>
                <CheckIcon className="w-3 h-3" />
                OK
              </>
            )}
          </span>
        </span>
        <div className={`w-2 h-2 rounded-full ${active ? 'bg-red-500' : 'bg-green-500'}`} />
      </div>
    </div>
  );
}

