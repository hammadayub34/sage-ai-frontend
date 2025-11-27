'use client';

import { usePLCData } from '@/hooks/usePLCData';
import { WarningIcon } from './Icons';

interface StatusPanelProps {
  machineId?: string;
}

export function StatusPanel({ machineId = 'machine-01' }: StatusPanelProps) {
  const { data, isLoading, error } = usePLCData(machineId);

  if (isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="heading-inter heading-inter-sm mb-4">System Status</h3>
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="heading-inter heading-inter-sm mb-4">System Status</h3>
        <div className="text-red-400">
          Error loading data: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  // Check if we have actual data
  const hasData = data && data._time;

  if (!hasData && !isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="heading-inter heading-inter-sm mb-4">System Status</h3>
        <div className="text-yellow-400 text-sm">
          <span className="flex items-center gap-1.5">
            <WarningIcon className="w-4 h-4" />
            No data available
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
      <h3 className="heading-inter heading-inter-sm mb-4">System Status</h3>
      <div className="space-y-3">
        <StatusItem 
          label="System Running" 
          value={data?.SystemRunning ?? false}
          color="green"
        />
        <StatusItem 
          label="Fault" 
          value={!data?.Fault} // Invert: no fault = good
          color={data?.Fault ? "red" : "green"}
        />
        <StatusItem 
          label="Filling" 
          value={data?.Filling ?? false}
          color="yellow"
        />
        <StatusItem 
          label="Ready" 
          value={data?.Ready ?? false}
          color="green"
        />
      </div>
    </div>
  );
}

function StatusItem({ 
  label, 
  value, 
  color 
}: { 
  label: string; 
  value: boolean; 
  color: 'green' | 'red' | 'yellow' | 'grey';
}) {
  const colorClasses = {
    green: value ? 'bg-green-500' : 'bg-gray-600',
    red: value ? 'bg-red-500' : 'bg-gray-600',
    yellow: value ? 'bg-yellow-500' : 'bg-gray-600',
    grey: 'bg-gray-600',
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-dark-text">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-dark-text text-sm">
          {value ? '✓' : '✗'}
        </span>
        <div className={`w-3 h-3 rounded-full ${colorClasses[color]}`} />
      </div>
    </div>
  );
}

