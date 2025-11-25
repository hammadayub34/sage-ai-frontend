'use client';

import { usePLCData } from '@/hooks/usePLCData';

interface ProductionCountersProps {
  machineId?: string;
}

export function ProductionCounters({ machineId = 'machine-01' }: ProductionCountersProps) {
  const { data, isLoading, error } = usePLCData(machineId);

  if (isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="text-white text-lg font-semibold mb-4">Production</h3>
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="text-white text-lg font-semibold mb-4">Production</h3>
        <div className="text-red-400">Error loading data</div>
      </div>
    );
  }

  // Check if we have actual data (not just defaults)
  const hasData = data && data._time && (
    data.BottlesFilled > 0 || 
    data.BottlesRejected > 0 || 
    data.BottlesPerMinute > 0 ||
    data.SystemRunning !== undefined
  );

  if (!hasData && !isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="text-white text-lg font-semibold mb-4">Production</h3>
        <div className="text-yellow-400 text-sm">
          ⚠️ No data available for this machine
          <br />
          <span className="text-gray-500 text-xs mt-2 block">
            Start mock PLC agent for this machine to see data
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
      <h3 className="text-white text-lg font-semibold mb-4">Production</h3>
      <div className="space-y-4">
        <CounterItem 
          label="Bottles Filled" 
          value={data?.BottlesFilled ?? 0}
          large
        />
        <div className="grid grid-cols-2 gap-4">
          <CounterItem 
            label="Rejected" 
            value={data?.BottlesRejected ?? 0}
          />
          <CounterItem 
            label="Per Minute" 
            value={data?.BottlesPerMinute ?? 0}
            unit="/min"
          />
        </div>
      </div>
    </div>
  );
}

function CounterItem({ 
  label, 
  value, 
  unit = '',
  large = false 
}: { 
  label: string; 
  value: number; 
  unit?: string;
  large?: boolean;
}) {
  return (
    <div>
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className={`text-white ${large ? 'text-3xl font-bold' : 'text-xl'}`}>
        {value.toLocaleString()}{unit && ` ${unit}`}
      </div>
    </div>
  );
}

