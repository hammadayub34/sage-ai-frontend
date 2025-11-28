'use client';

import { useVibrationData } from '@/hooks/useVibrationData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface VibrationChartProps {
  machineId?: string;
  timeRange?: string;
}

export function VibrationChart({ 
  machineId = 'lathe01',
  timeRange = '-24h'
}: VibrationChartProps) {
  const { data, isLoading, error } = useVibrationData(machineId, timeRange, '5m');

  if (isLoading) {
    return (
      <div>
        <h3 className="heading-inter heading-inter-sm mb-4">Vibration (mm/s)</h3>
        <div className="text-gray-400">Loading vibration data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h3 className="heading-inter heading-inter-sm mb-4">Vibration (mm/s)</h3>
        <div className="text-red-400">
          <div className="mb-2">Error loading vibration data</div>
          <div className="text-sm text-gray-500">{error instanceof Error ? error.message : String(error)}</div>
        </div>
      </div>
    );
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div>
        <h3 className="heading-inter heading-inter-sm mb-4">Vibration (mm/s)</h3>
        <div className="text-gray-400">No vibration data available</div>
      </div>
    );
  }

  const chartData = data.map(point => ({
    time: new Date(point.time).toLocaleString(),
    value: point.value,
  }));

  return (
    <>
      <h3 className="heading-inter heading-inter-sm mb-4">Vibration (mm/s)</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis 
            dataKey="time" 
            stroke="#e0e0e0"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#e0e0e0"
            style={{ fontSize: '12px' }}
            label={{ value: 'mm/s', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#e0e0e0' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#2d2d2d', 
              border: '1px solid #404040',
              color: '#e0e0e0'
            }}
            formatter={(value: number) => [`${value.toFixed(2)} mm/s`, 'Vibration']}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#437874" 
            strokeWidth={2}
            dot={{ fill: '#437874', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

