'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
  x_vibration: '#4b5563', // Slate gray-blue (X-axis vibration)
  y_vibration: '#a78bfa', // Muted lavender/purple (Y-axis vibration)
  x_acc: '#4b5563', // Slate gray-blue (X acceleration)
  y_acc: '#437874', // Sage green (Y acceleration)
  z_acc: '#a78bfa', // Muted lavender/purple (Z acceleration)
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
  timeRange = '-5m',
  onTimeRangeChange
}: VibrationChartProps) {
  // Time range options
  type TimeRangeOption = '5m' | '30m' | '1h' | '24h';
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeOption>('5m');
  
  // Convert to API format and determine aggregation
  const apiTimeRange = `-${selectedTimeRange}`;
  // Use raw data for short ranges, aggregated for longer ranges
  const windowPeriod = selectedTimeRange === '24h' ? '1m' : 'raw'; // 1 minute aggregation for 24h, raw for others
  
  const [selectedAxes, setSelectedAxes] = useState<VibrationAxis[]>(['z_acc', 'x_acc', 'y_acc']);
  
  // State for last seen timestamp
  const [lastSeenTime, setLastSeenTime] = useState<string | null>(null);
  
  // Zoom state - indices of data to show
  const [zoomStartIndex, setZoomStartIndex] = useState<number | null>(null);
  const [zoomEndIndex, setZoomEndIndex] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectionStartX, setSelectionStartX] = useState<number | null>(null);
  const [selectionEndX, setSelectionEndX] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Handle time range change
  const handleTimeRangeChange = (range: TimeRangeOption) => {
    setSelectedTimeRange(range);
    // Reset zoom when time range changes
    setZoomStartIndex(null);
    setZoomEndIndex(null);
    setSelectionStartX(null);
    setSelectionEndX(null);
  };
  
  // Reset zoom
  const handleResetZoom = () => {
    setZoomStartIndex(null);
    setZoomEndIndex(null);
    setSelectionStartX(null);
    setSelectionEndX(null);
  };
  
  // Get display text for data type
  const getDataTypeText = () => {
    if (selectedTimeRange === '24h') {
      return `Aggregated (1 minute intervals)`;
    }
    return 'Raw Data';
  };
  
  // Get time range display text
  const getTimeRangeText = () => {
    switch (selectedTimeRange) {
      case '5m': return '5 minutes';
      case '30m': return '30 minutes';
      case '1h': return '1 hour';
      case '24h': return '24 hours';
      default: return '5 minutes';
    }
  };
  
  // Convert X coordinate to data index
  const getIndexFromX = (x: number, containerWidth: number): number => {
    if (allChartData.length === 0 || containerWidth === 0) return 0;
    // Approximate: assume chart takes up most of the container width
    const chartWidth = containerWidth * 0.9; // Account for margins
    const relativeX = Math.max(0, Math.min(1, (x - containerWidth * 0.05) / chartWidth));
    return Math.floor(relativeX * allChartData.length);
  };
  
  // Handle mouse down on chart
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartContainerRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setIsSelecting(true);
    setSelectionStartX(x);
    setSelectionEndX(x);
  };
  
  // Handle mouse move during selection
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !chartContainerRef.current || selectionStartX === null) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setSelectionEndX(x);
  };
  
  // Handle mouse up - finalize selection
  const handleMouseUp = () => {
    if (!isSelecting || !chartContainerRef.current || selectionStartX === null || selectionEndX === null) {
      setIsSelecting(false);
      return;
    }
    
    const rect = chartContainerRef.current.getBoundingClientRect();
    const width = rect.width;
    const startIndex = getIndexFromX(selectionStartX, width);
    const endIndex = getIndexFromX(selectionEndX, width);
    
    if (startIndex !== endIndex) {
      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);
      setZoomStartIndex(minIndex);
      setZoomEndIndex(maxIndex);
    }
    
    setIsSelecting(false);
    setSelectionStartX(null);
    setSelectionEndX(null);
  };
  
  // Fetch data for all selected axes
  const axisData = selectedAxes.map(axis => ({
    axis,
    ...useVibrationData(machineId, apiTimeRange, windowPeriod, axis)
  }));
  
  const isLoading = axisData.some(d => d.isLoading);
  const error = axisData.find(d => d.error)?.error;

  // Get the latest timestamp from all axes
  useEffect(() => {
    if (!isLoading && !error && axisData.length > 0) {
      let latestTime: Date | null = null;
      axisData.forEach(({ data }) => {
        if (data && Array.isArray(data) && data.length > 0) {
          data.forEach((point: { time: string; value: number }) => {
            try {
              const pointTime = new Date(point.time);
              if (!isNaN(pointTime.getTime())) {
                const currentLatest = latestTime;
                if (currentLatest === null || pointTime.getTime() > currentLatest.getTime()) {
                  latestTime = pointTime;
                }
              }
            } catch (e) {
              // Skip invalid dates
            }
          });
        }
      });
      
      setLastSeenTime(latestTime ? (latestTime as Date).toISOString() : null);
    }
  }, [axisData, isLoading, error]);

  // Format last seen time for display
  const formatLastSeenTime = (isoString: string | null) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Combine data from all axes into a single chart dataset (full dataset)
  const allChartData = useMemo(() => {
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
        // For 5-minute view, show time with seconds
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const timeLabel = `${hours}:${minutes}:${seconds}`;
        
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
  }, [axisData, selectedAxes, isLoading, error]);

  // Apply zoom to chart data - use allChartData for Brush, filtered data for display
  const chartData = useMemo(() => {
    if (allChartData.length === 0) return [];
    
    if (zoomStartIndex !== null && zoomEndIndex !== null) {
      const start = Math.max(0, Math.min(zoomStartIndex, zoomEndIndex));
      const end = Math.min(allChartData.length, Math.max(zoomStartIndex, zoomEndIndex));
      return allChartData.slice(start, end);
    }
    
    return allChartData;
  }, [allChartData, zoomStartIndex, zoomEndIndex]);
  
  // Check if zoomed
  const isZoomed = zoomStartIndex !== null && zoomEndIndex !== null && 
                   (zoomStartIndex !== 0 || zoomEndIndex !== allChartData.length - 1);

  const availableAxes: { value: VibrationAxis; label: string }[] = [
    { value: 'vibration', label: 'Overall Vibration' },
    { value: 'x_vibration', label: 'X-Axis Vibration' },
    { value: 'y_vibration', label: 'Y-Axis Vibration' },
    { value: 'x_acc', label: 'X-Axis Acceleration' },
    { value: 'y_acc', label: 'Y-Axis Acceleration' },
    { value: 'z_acc', label: 'Z-Axis Acceleration' },
  ];


  const timeRangeOptions: { value: TimeRangeOption; label: string }[] = [
    { value: '5m', label: 'Last 5 Minutes' },
    { value: '30m', label: 'Last 30 Minutes' },
    { value: '1h', label: 'Last 1 Hour' },
    { value: '24h', label: 'Last 24 Hours' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
        <h3 className="heading-inter heading-inter-sm">Vibration Time Series</h3>
          <div className="text-xs text-gray-500 mt-1">
            {getDataTypeText()} (Last {getTimeRangeText()} of available data)
            {lastSeenTime && (
              <span className="ml-2 text-sage-400">• Last seen: {formatLastSeenTime(lastSeenTime)}</span>
            )}
          </div>
        </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Time Range:</label>
            <select
            value={selectedTimeRange || '5m'}
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

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-sage-400 animate-pulse">
            <div className="w-4 h-4 border-2 border-sage-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="font-medium">Loading vibration data...</span>
          </div>
        </div>
      ) : error ? (
        <div className="text-red-400 text-center py-8">
          <div className="mb-2">Error loading vibration data</div>
          <div className="text-sm text-gray-500">{error instanceof Error ? error.message : String(error)}</div>
        </div>
      ) : chartData.length > 0 && selectedAxes.length > 0 ? (
        <div 
          ref={chartContainerRef} 
          className="relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isSelecting ? 'crosshair' : 'default' }}
        >
          {isZoomed && (
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={handleResetZoom}
                className="px-3 py-1.5 text-xs bg-dark-panel border border-dark-border rounded text-sage-400 hover:text-sage-300 hover:border-sage-500 transition-colors"
              >
                Reset Zoom
              </button>
            </div>
          )}
          
          {/* Selection rectangle overlay */}
          {isSelecting && selectionStartX !== null && selectionEndX !== null && chartContainerRef.current && (
            <div
              className="absolute border-2 border-sage-400 bg-sage-400/10 pointer-events-none z-20"
              style={{
                left: `${Math.min(selectionStartX, selectionEndX)}px`,
                width: `${Math.abs(selectionEndX - selectionStartX)}px`,
                top: '0px',
                height: '400px',
              }}
            />
          )}
          
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
            <XAxis 
              dataKey="time" 
              stroke="#e0e0e0"
              style={{ fontSize: '11px' }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval="preserveStartEnd"
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
        </div>
      ) : selectedAxes.length === 0 ? (
        <div className="text-gray-400 text-center py-8">Please select at least one axis to display</div>
      ) : (
        <div className="text-gray-400 text-center py-8">No vibration data points to display</div>
      )}

      {/* Zoomed Time Range Display */}
      {isZoomed && chartData.length > 0 && (
        <div className="mt-3 text-center">
          <div className="text-xs text-gray-400 inline-block bg-dark-panel border border-dark-border rounded px-3 py-1.5">
            <span className="text-gray-300 font-medium mr-2">Zoomed Range:</span>
            <span className="text-gray-400">
              {(() => {
                const startTime = chartData[0]?.fullTime ? new Date(chartData[0].fullTime) : null;
                const endTime = chartData[chartData.length - 1]?.fullTime ? new Date(chartData[chartData.length - 1].fullTime) : null;
                
                if (startTime && endTime) {
                  const formatTime = (date: Date) => {
                    return date.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });
                  };
                  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
                }
                return 'N/A';
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!isLoading && !error && allChartData.length > 0 && !isZoomed && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Click and drag on the chart to select a time range and zoom in
        </div>
      )}
    </div>
  );
}
