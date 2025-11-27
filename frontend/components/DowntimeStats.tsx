'use client';

import { useQuery } from '@tanstack/react-query';
import { ClockIcon, TrendingUpIcon } from './Icons';

interface DowntimeStatsProps {
  machineId: string;
  timeRange?: string;
  machineType?: 'bottlefiller' | 'lathe';
}

interface DowntimePeriod {
  startTime: string;
  endTime: string | null;
  duration: number;
}

interface DowntimeStats {
  totalDowntime: number;
  totalDowntimeFormatted: string;
  incidentCount: number;
  averageDowntime: number;
  averageDowntimeFormatted: string;
  periods: DowntimePeriod[];
  uptimePercentage: number;
}

async function fetchDowntimeStats(
  machineId: string,
  timeRange: string,
  machineType?: string
): Promise<DowntimeStats> {
  let url = `/api/influxdb/downtime?machineId=${machineId}&timeRange=${timeRange}`;
  if (machineType) {
    url += `&machineType=${machineType}`;
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      // No data - return empty stats
      return {
        totalDowntime: 0,
        totalDowntimeFormatted: '0s',
        incidentCount: 0,
        averageDowntime: 0,
        averageDowntimeFormatted: '0s',
        periods: [],
        uptimePercentage: 100,
      };
    }
    throw new Error('Failed to fetch downtime stats');
  }
  
  const result = await response.json();
  return result.data;
}

export function DowntimeStats({ machineId, timeRange = '-24h', machineType }: DowntimeStatsProps) {
  const { data, isLoading, error } = useQuery<DowntimeStats>({
    queryKey: ['downtime', machineId, timeRange, machineType],
    queryFn: () => fetchDowntimeStats(machineId, timeRange, machineType),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-dark-panel border border-dark-border rounded-lg p-6">
        <h2 className="heading-inter heading-inter-sm text-white mb-4 flex items-center gap-2">
          <ClockIcon className="w-5 h-5" />
          Downtime Statistics
        </h2>
        <div className="text-gray-400">Loading downtime data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-panel border border-dark-border rounded-lg p-6">
        <h2 className="heading-inter heading-inter-sm text-white mb-4 flex items-center gap-2">
          <ClockIcon className="w-5 h-5" />
          Downtime Statistics
        </h2>
        <div className="text-red-400">Error loading downtime data</div>
      </div>
    );
  }

  const stats = data || {
    totalDowntime: 0,
    totalDowntimeFormatted: '0s',
    incidentCount: 0,
    averageDowntime: 0,
    averageDowntimeFormatted: '0s',
    periods: [],
    uptimePercentage: 100,
  };

  // Format time range for display
  const formatTimeRange = (range: string): string => {
    const match = range.match(/-(\d+)([hdms])/);
    if (!match) return range;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    if (unit === 'h') {
      return value === 1 ? 'Last hour' : `Last ${value} hours`;
    } else if (unit === 'd') {
      return value === 1 ? 'Last 24 hours' : `Last ${value} days`;
    } else if (unit === 'm') {
      return value === 1 ? 'Last minute' : `Last ${value} minutes`;
    } else if (unit === 's') {
      return value === 1 ? 'Last second' : `Last ${value} seconds`;
    }
    return range;
  };

  const timeRangeLabel = formatTimeRange(timeRange);

  return (
    <div className="bg-dark-panel border border-dark-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="heading-inter heading-inter-sm text-white flex items-center gap-2">
          <ClockIcon className="w-5 h-5" />
          Downtime Statistics
        </h2>
        <span className="text-xs text-gray-500">{timeRangeLabel}</span>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Total Downtime */}
        <div className="bg-dark-bg border border-dark-border rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Total Downtime</div>
          <div className="text-2xl font-bold text-white">{stats.totalDowntimeFormatted}</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.totalDowntime > 0 ? `${(100 - stats.uptimePercentage).toFixed(1)}% of period` : 'No downtime'}
          </div>
        </div>

        {/* Incident Count */}
        <div className="bg-dark-bg border border-dark-border rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Incidents</div>
          <div className="text-2xl font-bold text-white">{stats.incidentCount}</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.incidentCount === 1 ? 'incident' : 'incidents'}
          </div>
        </div>

        {/* Average Downtime */}
        <div className="bg-dark-bg border border-dark-border rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Avg Duration</div>
          <div className="text-2xl font-bold text-white">
            {stats.incidentCount > 0 ? stats.averageDowntimeFormatted : '0s'}
          </div>
          <div className="text-xs text-gray-500 mt-1">per incident</div>
        </div>

        {/* Uptime Percentage */}
        <div className="bg-dark-bg border border-dark-border rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Uptime</div>
          <div className="text-2xl font-bold text-white">{stats.uptimePercentage.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">
            <TrendingUpIcon className="w-3 h-3 inline mr-1" />
            Availability
          </div>
        </div>
      </div>

      {stats.periods.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <ClockIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-white">No downtime incidents</p>
          <p className="text-sm mt-1">Machine has been running continuously</p>
          <p className="text-xs mt-2 text-gray-600">Period: {timeRangeLabel}</p>
        </div>
      )}
    </div>
  );
}

