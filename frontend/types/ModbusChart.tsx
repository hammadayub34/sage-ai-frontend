'use client';

import { useState, useMemo, useEffect } from 'react';
import { useModbusData } from '@/hooks/useModbusData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ModbusChartProps {
  machineId?: string;
  macAddress?: string;
  field: string; // Pressure, Density, Temperature, Instantaneous flow, Differential pressure/frequency
  fieldLabel: string; // Display label for the field
  timeRange?: string;
  onTimeRangeChange?: (range: '24h' | '7d' | '30d') => void;
}

type TimeRangeOption = '24h' | '7d' | '30d';

const FIELD_COLORS: Record<string, string> = {
  'Pressure': '#437874', // Sage green
  'Density': '#6b9e78', // Lighter sage green
  'Temperature': '#5a8a6a', // Darker sage green
  'Instantaneous flow': '#7ab08a', // Sage green variant
  'Instantaneous_flow': '#7ab08a',
  'Differential pressure/frequency': '#4a6b5a', // Dark sage green
  'Differential_pressure_frequency': '#4a6b5a',
};

export function ModbusChart({ 
  machineId = '',
  macAddress = '',
  field,
  fieldLabel,
  timeRange = '-7d',
  onTimeRangeChange
}: ModbusChartProps) {
  
  const initialRange = timeRange.startsWith('-') ? timeRange.slice(1) as TimeRangeOption : '7d';
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeOption>(initialRange);
  
  // Sync with prop changes
  useEffect(() => {
    const propRange = timeRange.startsWith('-') ? timeRange.slice(1) as TimeRangeOption : '7d';
    if (propRange !== selectedTimeRange) {
      setSelectedTimeRange(propRange);
    }
  }, [timeRange]);
  
  // Update parent when time range changes
  const handleTimeRangeChange = (range: TimeRangeOption) => {
    setSelectedTimeRange(range);
    if (onTimeRangeChange) {
      onTimeRangeChange(range);
    }
  };
  
  // Convert selected range to API format and adjust aggregation window
  const apiTimeRange = `-${selectedTimeRange}`;
  const windowPeriod = selectedTimeRange === '24h' ? '5m' : selectedTimeRange === '7d' ? '30m' : '2h';
  
  // Fetch data
  const { data, isLoading, error } = useModbusData(machineId, macAddress, apiTimeRange, windowPeriod, field);
  
  // Debug logging
  useEffect(() => {
    console.log(`[ModbusChart] ${fieldLabel}:`, {
      machineId,
      macAddress,
      field,
      apiTimeRange,
      windowPeriod,
      dataLength: data?.length || 0,
      isLoading,
      error: error?.message
    });
  }, [machineId, macAddress, field, apiTimeRange, windowPeriod, data, isLoading, error, fieldLabel]);

  const timeRangeOptions: { value: TimeRangeOption; label: string }[] = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last Week' },
    { value: '30d', label: 'Last Month' },
  ];

  // Format chart data
  const chartData = useMemo(() => {
    if (isLoading || error || !data || !Array.isArray(data)) return [];

    return data.map(point => ({
      time: new Date(point.time).getTime(),
      value: point.value,
      formattedTime: formatTime(new Date(point.time), selectedTimeRange),
    }));
  }, [data, isLoading, error, selectedTimeRange]);

  // Format time based on selected range
  function formatTime(date: Date, range: TimeRangeOption): string {
    if (range === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } else if (range === '7d') {
      return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  const color = FIELD_COLORS[field] || FIELD_COLORS[fieldLabel] || '#437874';

  return (
    <div className="bg-dark-panel border border-dark-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">{fieldLabel}</h3>
        <select
          value={selectedTimeRange}
          onChange={(e) => handleTimeRangeChange(e.target.value as TimeRangeOption)}
          className="bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
        >
          {timeRangeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          Loading data...
        </div>
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-red-400">
          Error loading data: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          No data available for {fieldLabel}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => {
                const date = new Date(value);
                // Show fewer, cleaner labels
                if (selectedTimeRange === '24h') {
                  // Show every 4 hours for 24h view
                  return date.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false });
                } else if (selectedTimeRange === '7d') {
                  // Show day and hour for 7d view
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', hour12: false });
                } else {
                  // Show just date for 30d view
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
              }}
              angle={0}
              textAnchor="middle"
              height={50}
              // Show fewer ticks to avoid crowding
              interval="preserveStartEnd"
              tickCount={selectedTimeRange === '24h' ? 6 : selectedTimeRange === '7d' ? 7 : 10}
              stroke="#9CA3AF"
              style={{ fontSize: '11px' }}
            />
            <YAxis
              stroke="#9CA3AF"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#F3F4F6',
                padding: '8px 12px',
              }}
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                });
              }}
              formatter={(value: number) => [value?.toFixed(2) || '0', fieldLabel]}
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              name={fieldLabel}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

