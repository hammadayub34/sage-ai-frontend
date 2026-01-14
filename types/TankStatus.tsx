'use client';

import { usePLCData } from '@/hooks/usePLCData';

interface TankStatusProps {
  machineId?: string;
}

export function TankStatus({ machineId = 'machine-01' }: TankStatusProps) {
  const { data, isLoading, error } = usePLCData(machineId);

  if (isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="heading-inter heading-inter-sm mb-4">Tank Status</h3>
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="heading-inter heading-inter-sm mb-4">Tank Status</h3>
        <div className="text-red-400">Error loading data</div>
      </div>
    );
  }

  return (
    <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
      <h3 className="heading-inter heading-inter-sm mb-4">Tank Status</h3>
      <div className="space-y-3">
        <MetricItem 
          label="Temperature" 
          value={data?.TankTemperature ?? 0}
          unit="°C"
        />
        <MetricItem 
          label="Pressure" 
          value={data?.TankPressure ?? 0}
          unit="PSI"
        />
      </div>
    </div>
  );
}

function MetricItem({ 
  label, 
  value, 
  unit 
}: { 
  label: string; 
  value: number; 
  unit: string;
}) {
  return (
    <div>
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className="text-white text-xl">
        {value.toFixed(2)}{unit}
      </div>
    </div>
  );
}

