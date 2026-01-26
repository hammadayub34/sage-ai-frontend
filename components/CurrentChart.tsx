'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CurrentChartProps {
  machineId?: string;
  timeRange?: string;
  onTimeRangeChange?: (range: '24h' | '7d' | '30d') => void;
}

type TimeRangeOption = '5m' | '30m' | '1h' | '24h';
type CTField = 'CT1' | 'CT2' | 'CT3' | 'CT_Avg' | 'total_current';

const CT_FIELD_COLORS: Record<CTField, string> = {
  CT1: '#437874', // Sage green
  CT2: '#a78bfa', // Muted lavender/purple
  CT3: '#4b5563', // Slate gray-blue
  CT_Avg: '#f59e0b', // Amber
  total_current: '#10b981', // Green
};

const CT_FIELD_LABELS: Record<CTField, string> = {
  CT1: 'CT1',
  CT2: 'CT2',
  CT3: 'CT3',
  CT_Avg: 'CT Average',
  total_current: 'Total Current',
};

export function CurrentChart({ 
  machineId = 'machine-01',
  timeRange = '-5m',
  onTimeRangeChange
}: CurrentChartProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeOption>('5m');
  const [selectedFields, setSelectedFields] = useState<CTField[]>(['CT1', 'CT2', 'CT3']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fieldData, setFieldData] = useState<Map<CTField, Array<{ time: string; value: number }>>>(new Map());
  const [lastSeenTime, setLastSeenTime] = useState<string | null>(null);
  
  // Zoom state - indices of data to show
  const [zoomStartIndex, setZoomStartIndex] = useState<number | null>(null);
  const [zoomEndIndex, setZoomEndIndex] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectionStartX, setSelectionStartX] = useState<number | null>(null);
  const [selectionEndX, setSelectionEndX] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Convert to API format and determine aggregation
  const apiTimeRange = `-${selectedTimeRange}`;
  // Use raw data for 5m, 30m, 1h; aggregated for 24h
  const windowPeriod = selectedTimeRange === '24h' ? '1m' : 'raw';
  
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

  // Format last seen time - match VibrationChart format
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

  // Fetch current data for all selected fields
  useEffect(() => {
    if (!machineId || selectedFields.length === 0) return;

    setIsLoading(true);
    setError(null);
    setFieldData(new Map());

    // Fetch data for each field
    const fetchPromises = selectedFields.map(async (field) => {
      try {
        const response = await fetch(
          `/api/influxdb/current?machineId=${encodeURIComponent(machineId)}&timeRange=${apiTimeRange}&windowPeriod=${windowPeriod}&field=${field}`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${field} data: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        return { field, data: result.data || [], latestTime: result.latestDataTime };
      } catch (err) {
        console.error(`Error fetching ${field} data:`, err);
        return { field, data: [], latestTime: null };
      }
    });

    Promise.all(fetchPromises)
      .then((results) => {
        const newFieldData = new Map<CTField, Array<{ time: string; value: number }>>();
        let latestTime: string | null = null;

        results.forEach(({ field, data, latestTime: fieldLatestTime }) => {
          if (data.length > 0) {
            newFieldData.set(field, data);
          }
          // Track the most recent latestTime across all fields
          if (fieldLatestTime && (!latestTime || new Date(fieldLatestTime) > new Date(latestTime))) {
            latestTime = fieldLatestTime;
          }
        });

        setFieldData(newFieldData);
        // Store as ISO string for consistent formatting (match VibrationChart)
        setLastSeenTime(latestTime ? new Date(latestTime).toISOString() : null);
      })
      .catch((err) => {
        console.error('Error fetching current data:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [machineId, apiTimeRange, windowPeriod, selectedFields]);

  // Format chart data - combine all fields into single dataset (full dataset)
  const allChartData = useMemo(() => {
    if (fieldData.size === 0) return [];

    // Get all unique timestamps from all fields
    const allTimestamps = new Set<number>();
    fieldData.forEach((data) => {
      if (data && Array.isArray(data)) {
        data.forEach(point => {
          allTimestamps.add(new Date(point.time).getTime());
        });
      }
    });

    // Create a map for each field's data by timestamp
    const dataByField = new Map<CTField, Map<number, number>>();
    fieldData.forEach((data, field) => {
      const map = new Map<number, number>();
      if (data && Array.isArray(data)) {
        data.forEach(point => {
          map.set(new Date(point.time).getTime(), point.value);
        });
      }
      dataByField.set(field, map);
    });

    // Combine into single dataset
    return Array.from(allTimestamps)
      .sort((a, b) => a - b)
      .map(timestamp => {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const timeLabel = `${hours}:${minutes}:${seconds}`;
        
        const dataPoint: any = {
          time: timeLabel,
          timestamp,
          fullTime: date.toISOString(),
        };

        // Add value for each selected field
        selectedFields.forEach(field => {
          const fieldMap = dataByField.get(field);
          dataPoint[field] = fieldMap?.get(timestamp) ?? null;
        });

        return dataPoint;
      });
  }, [fieldData, selectedFields]);

  // Convert X coordinate to data index
  const getIndexFromX = (x: number, containerWidth: number, dataLength: number): number => {
    if (dataLength === 0 || containerWidth === 0) return 0;
    // Approximate: assume chart takes up most of the container width
    const chartWidth = containerWidth * 0.9; // Account for margins
    const relativeX = Math.max(0, Math.min(1, (x - containerWidth * 0.05) / chartWidth));
    return Math.floor(relativeX * dataLength);
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
    if (!isSelecting || !chartContainerRef.current || selectionStartX === null || selectionEndX === null || allChartData.length === 0) {
      setIsSelecting(false);
      return;
    }
    
    const rect = chartContainerRef.current.getBoundingClientRect();
    const width = rect.width;
    const startIndex = getIndexFromX(selectionStartX, width, allChartData.length);
    const endIndex = getIndexFromX(selectionEndX, width, allChartData.length);
    
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

  // Apply zoom to chart data - use allChartData for selection, filtered data for display
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

  const availableFields: { value: CTField; label: string }[] = [
    { value: 'CT1', label: 'CT1' },
    { value: 'CT2', label: 'CT2' },
    { value: 'CT3', label: 'CT3' },
    { value: 'CT_Avg', label: 'CT Average' },
    { value: 'total_current', label: 'Total Current' },
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
          <h3 className="heading-inter heading-inter-sm">Current (CT) Time Series</h3>
          <div className="text-xs text-gray-500 mt-1">
            {getDataTypeText()} (Last {getTimeRangeText()} of available data)
            {lastSeenTime && (
              <span className="ml-2 text-sage-400">• Last Seen: {formatLastSeenTime(lastSeenTime)}</span>
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
            <span className="font-medium">Loading current data...</span>
          </div>
        </div>
      ) : error ? (
        <div className="text-red-400 text-center py-8">
          <div className="mb-2">Error loading current data</div>
          <div className="text-sm text-gray-500">{error instanceof Error ? error.message : String(error)}</div>
        </div>
      ) : chartData.length > 0 && selectedFields.length > 0 ? (
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
              label={{ value: 'Current (A)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#e0e0e0' } }}
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
                const field = name as CTField;
                return [`${value !== null ? value.toFixed(2) : 'N/A'} A`, CT_FIELD_LABELS[field] || name];
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
                    second: '2-digit',
                    hour12: true
                  });
                }
                return label;
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => CT_FIELD_LABELS[value as CTField] || value}
            />
            {selectedFields.map(field => (
              <Line 
                key={field}
                type="monotone" 
                dataKey={field} 
                stroke={CT_FIELD_COLORS[field]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: CT_FIELD_COLORS[field] }}
                name={field}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <div className="mb-2">No current data available</div>
          <div className="text-sm text-gray-500">
            Time range: {getTimeRangeText()} | Machine: {machineId}
          </div>
        </div>
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

      {/* Field Selection - Centered below graph */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {availableFields.map(field => {
          const isSelected = selectedFields.includes(field.value);
          return (
            <button
              key={field.value}
              onClick={() => {
                if (isSelected) {
                  setSelectedFields(prev => prev.filter(f => f !== field.value));
                } else {
                  setSelectedFields(prev => [...prev, field.value]);
                }
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors border ${
                isSelected
                  ? 'bg-dark-panel border-sage-500 text-sage-400'
                  : 'bg-dark-panel border-dark-border text-gray-400 hover:text-gray-300 hover:border-dark-border'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                style={{ backgroundColor: CT_FIELD_COLORS[field.value] }}
              />
              {field.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
