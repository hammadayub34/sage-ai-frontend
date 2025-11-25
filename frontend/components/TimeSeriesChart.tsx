'use client';

import { useTimeSeries } from '@/hooks/usePLCData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TimeSeriesChartProps {
  field: string;
  label: string;
  machineId?: string;
  timeRange?: string;
}

export function TimeSeriesChart({ 
  field, 
  label, 
  machineId = 'machine-01',
  timeRange = '-1h'
}: TimeSeriesChartProps) {
  const { data, isLoading, error } = useTimeSeries(field, machineId, timeRange);

  if (isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="text-white text-lg font-semibold mb-4">{label}</h3>
        <div className="text-gray-400">Loading chart data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="text-white text-lg font-semibold mb-4">{label}</h3>
        <div className="text-red-400">
          <div className="mb-2">Error loading chart data</div>
          <div className="text-sm text-gray-500">{error instanceof Error ? error.message : String(error)}</div>
          <div className="text-sm text-gray-500 mt-2">
            Make sure InfluxDB is running and data is being written.
          </div>
        </div>
      </div>
    );
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="text-white text-lg font-semibold mb-4">{label}</h3>
        <div className="text-yellow-400">
          <div className="mb-2">No data available for this time range</div>
          <div className="text-sm text-gray-500">
            Time range: {timeRange} | Machine: {machineId} | Field: {field}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Make sure:
            <ul className="list-disc list-inside mt-1 ml-2">
              <li>InfluxDB is running</li>
              <li>Data is being written to InfluxDB</li>
              <li>The mock PLC agent is publishing data</li>
              <li>Click "🔄 Refresh Data" after starting services</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Format data for Recharts
  const chartData = data.map(point => ({
    time: new Date(point.time).toLocaleTimeString(),
    value: point.value,
  }));

  return (
    <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
      <h3 className="text-white text-lg font-semibold mb-4">{label}</h3>
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
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#2d2d2d', 
              border: '1px solid #404040',
              color: '#e0e0e0'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#4caf50" 
            strokeWidth={2}
            dot={{ fill: '#4caf50', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

