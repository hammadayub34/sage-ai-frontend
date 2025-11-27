'use client';

import { usePLCData } from '@/hooks/usePLCData';

interface GaugePanelProps {
  field: keyof import('@/types/plc-data').PLCData;
  label: string;
  max: number;
  unit?: string;
  machineId?: string;
}

export function GaugePanel({ field, label, max, unit = '', machineId = 'machine-01' }: GaugePanelProps) {
  const { data, isLoading, error } = usePLCData(machineId);

  if (isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="heading-inter heading-inter-sm mb-4">{label}</h3>
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="heading-inter heading-inter-sm mb-4">{label}</h3>
        <div className="text-red-400">Error loading data</div>
      </div>
    );
  }

  const value = (data?.[field] as number) ?? 0;
  const percentage = Math.min((value / max) * 100, 100);
  
  // Determine color based on percentage
  let color = '#4caf50'; // green
  if (percentage > 80) color = '#ffc107'; // yellow
  if (percentage > 95) color = '#f44336'; // red

  return (
    <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
      <h3 className="heading-inter heading-inter-sm mb-4 text-center">{label}</h3>
      <div className="flex flex-col items-center justify-center">
        {/* Circular Gauge */}
        <div className="relative w-32 h-32 mb-4">
          <svg className="transform -rotate-90" width="128" height="128">
            {/* Background circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="#404040"
              strokeWidth="12"
            />
            {/* Value circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-white text-2xl font-bold">
                {value.toFixed(1)}
              </div>
              {unit && (
                <div className="text-gray-400 text-sm">{unit}</div>
              )}
            </div>
          </div>
        </div>
        <div className="text-gray-400 text-sm">
          {percentage.toFixed(1)}% of max
        </div>
      </div>
    </div>
  );
}

