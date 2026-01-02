'use client';

import { useState, useMemo, useEffect } from 'react';
import { useVibrationData } from '@/hooks/useVibrationData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface VibrationChartProps {
  machineId?: string;
  timeRange?: string;
  onTimeRangeChange?: (range: '24h' | '7d' | '30d') => void;
}

type TimeRangeOption = '24h' | '7d' | '30d';
type VibrationAxis = 'vibration' | 'x_vibration' | 'y_vibration' | 'x_acc' | 'y_acc' | 'z_acc';

const AXIS_COLORS: Record<VibrationAxis, string> = {
  vibration: '#437874', // Sage green (overall) - matches app theme
  x_vibration: '#6b9e78', // Lighter sage green (X-axis)
  y_vibration: '#5a8a6a', // Darker sage green (Y-axis)
  x_acc: '#7ab08a', // Sage green variant (X acceleration)
  y_acc: '#4a6b5a', // Dark sage green (Y acceleration)
  z_acc: '#8fb89a', // Light sage green (Z acceleration)
};

const AXIS_LABELS: Record<VibrationAxis, string> = {
  vibration: 'Overall Vibration',
  x_vibration: 'X-Axis Vibration',
  y_vibration: 'Y-Axis Vibration',
  x_acc: 'X-Axis Acceleration',
  y_acc: 'Y-Axis Acceleration',
  z_acc: 'Z-Axis Acceleration',
};

export function VibrationChart({ 
  machineId = 'lathe01',
  timeRange = '-7d',
  onTimeRangeChange
}: VibrationChartProps) {
  // Parse initial time range from prop or default to '7d'
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
  // Default to showing all three vibration axes
  const [selectedAxes, setSelectedAxes] = useState<VibrationAxis[]>(['vibration', 'x_vibration', 'y_vibration']);
  
  // Convert selected range to API format and adjust aggregation window
  const apiTimeRange = `-${selectedTimeRange}`;
  const windowPeriod = selectedTimeRange === '24h' ? '5m' : selectedTimeRange === '7d' ? '30m' : '2h';
  
  // Fetch data for all selected axes
  const axisData = selectedAxes.map(axis => ({
    axis,
    ...useVibrationData(machineId, apiTimeRange, windowPeriod, axis)
  }));
  
  const isLoading = axisData.some(d => d.isLoading);
  const error = axisData.find(d => d.error)?.error;

  const timeRangeOptions: { value: TimeRangeOption; label: string }[] = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last Week' },
    { value: '30d', label: 'Last Month' },
  ];

  // Combine data from all axes into a single chart dataset
  const chartData = useMemo(() => {
    if (isLoading || error || !axisData.length) return [];

    // Get all unique timestamps from all axes
    const allTimestamps = new Set<number>();
    axisData.forEach(({ data }) => {
      if (data && Array.isArray(data)) {
        data.forEach(point => {
          allTimestamps.add(new Date(point.time).getTime());
        });
      }
    });

    // Create a map for each axis's data by timestamp
    const dataByAxis = new Map<VibrationAxis, Map<number, number>>();
    axisData.forEach(({ axis, data }) => {
      const map = new Map<number, number>();
      if (data && Array.isArray(data)) {
        data.forEach(point => {
          map.set(new Date(point.time).getTime(), point.value);
        });
      }
      dataByAxis.set(axis, map);
    });

    // Combine into single dataset
    return Array.from(allTimestamps)
      .sort((a, b) => a - b)
      .map(timestamp => {
        const date = new Date(timestamp);
        let timeLabel: string;
        
        if (selectedTimeRange === '24h') {
          timeLabel = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          });
        } else if (selectedTimeRange === '7d') {
          const day = date.getDate();
          const month = date.toLocaleDateString('en-US', { month: 'short' });
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          timeLabel = `${month} ${day}, ${hours}:${minutes}`;
        } else {
          const day = date.getDate();
          const month = date.toLocaleDateString('en-US', { month: 'short' });
          timeLabel = `${month} ${day}`;
        }
        
        const dataPoint: any = {
          time: timeLabel,
          timestamp,
          fullTime: date.toISOString(),
        };

        // Add value for each selected axis
        selectedAxes.forEach(axis => {
          const axisMap = dataByAxis.get(axis);
          dataPoint[axis] = axisMap?.get(timestamp) ?? null;
        });

        return dataPoint;
      });
  }, [axisData, selectedAxes, selectedTimeRange, isLoading, error]);

  const availableAxes: { value: VibrationAxis; label: string }[] = [
    { value: 'vibration', label: 'Overall Vibration' },
    { value: 'x_vibration', label: 'X-Axis Vibration' },
    { value: 'y_vibration', label: 'Y-Axis Vibration' },
    { value: 'x_acc', label: 'X-Axis Acceleration' },
    { value: 'y_acc', label: 'Y-Axis Acceleration' },
    { value: 'z_acc', label: 'Z-Axis Acceleration' },
  ];

  const toggleAxis = (axis: VibrationAxis) => {
    setSelectedAxes(prev => 
      prev.includes(axis) 
        ? prev.filter(a => a !== axis)
        : [...prev, axis]
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="heading-inter heading-inter-sm">Vibration Time Series</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Time Range:</label>
            <select
              value={selectedTimeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value as TimeRangeOption)}
              className="bg-dark-panel border border-dark-border rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-center py-8">Loading vibration data...</div>
      ) : error ? (
        <div className="text-red-400 text-center py-8">
          <div className="mb-2">Error loading vibration data</div>
          <div className="text-sm text-gray-500">{error instanceof Error ? error.message : String(error)}</div>
        </div>
      ) : chartData.length > 0 && selectedAxes.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
            <XAxis 
              dataKey="time" 
              stroke="#e0e0e0"
              style={{ fontSize: '11px' }}
              angle={selectedTimeRange === '30d' ? 0 : -45}
              textAnchor={selectedTimeRange === '30d' ? 'middle' : 'end'}
              height={selectedTimeRange === '30d' ? 60 : 80}
              interval={selectedTimeRange === '24h' ? 'preserveStartEnd' : selectedTimeRange === '7d' ? Math.ceil(chartData.length / 10) : Math.ceil(chartData.length / 15)}
              tick={{ fill: '#9ca3af' }}
            />
            <YAxis 
              stroke="#e0e0e0"
              style={{ fontSize: '12px' }}
              label={{ value: 'Vibration (mm/s) / Acceleration (g)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#e0e0e0' } }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: '1px solid #437874',
                color: '#e0e0e0',
                borderRadius: '6px',
                padding: '8px 12px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
              }}
              formatter={(value: number, name: string) => {
                const axis = name as VibrationAxis;
                const unit = axis.includes('acc') ? 'g' : 'mm/s';
                return [`${value !== null ? value.toFixed(2) : 'N/A'} ${unit}`, AXIS_LABELS[axis] || name];
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0] && payload[0].payload.fullTime) {
                  const date = new Date(payload[0].payload.fullTime);
                  return date.toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  });
                }
                return `Time: ${label}`;
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            {selectedAxes.map(axis => (
              <Line 
                key={axis}
                type="monotone" 
                dataKey={axis}
                name={AXIS_LABELS[axis]}
                stroke={AXIS_COLORS[axis]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: AXIS_COLORS[axis] }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : selectedAxes.length === 0 ? (
        <div className="text-gray-400 text-center py-8">Please select at least one axis to display</div>
      ) : (
        <div className="text-gray-400 text-center py-8">No vibration data points to display</div>
      )}
    </div>
  );
}
