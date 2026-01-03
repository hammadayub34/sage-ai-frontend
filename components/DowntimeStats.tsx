'use client';

import { useQuery } from '@tanstack/react-query';
import { ClockIcon, TrendingUpIcon, ArrowUpIcon, ArrowDownIcon, ArrowRightIcon } from './Icons';

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
  downtimePercentage: number;
  uptimePercentage: number;
  totalDowntime: number;
  totalUptime: number;
  incidentCount: number;
  periods: DowntimePeriod[];
  comparison?: {
    previousDowntimePercentage: number;
    change: number;
    trend: 'increasing' | 'decreasing' | 'same';
  };
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
        downtimePercentage: 0,
        uptimePercentage: 100,
        totalDowntime: 0,
        totalUptime: 0,
        incidentCount: 0,
        periods: [],
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
          Performance
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
          Performance
        </h2>
        <div className="text-red-400">Error loading downtime data</div>
      </div>
    );
  }

  const stats = data || {
    downtimePercentage: 0,
    uptimePercentage: 100,
    totalDowntime: 0,
    totalUptime: 0,
    incidentCount: 0,
    periods: [],
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
          Performance
        </h2>
        <span className="text-xs text-gray-500">{timeRangeLabel}</span>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {/* Downtime Percentage */}
        <div className="bg-dark-bg border border-dark-border rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Downtime</div>
          <div className="flex items-center gap-2">
            <div className="text-3xl font-bold text-red-400">{stats.downtimePercentage.toFixed(1)}%</div>
            {stats.comparison && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                stats.comparison.trend === 'increasing' 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : stats.comparison.trend === 'decreasing'
                  ? 'bg-sage-500/20 text-sage-400 border border-sage-500/30'
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
              }`}>
                {stats.comparison.trend === 'increasing' && <ArrowUpIcon className="w-4 h-4" />}
                {stats.comparison.trend === 'decreasing' && <ArrowDownIcon className="w-4 h-4" />}
                {stats.comparison.trend === 'same' && <ArrowRightIcon className="w-4 h-4" />}
                <span className="text-xs font-medium">
                  {stats.comparison.change.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.incidentCount > 0 ? `${stats.incidentCount} incident${stats.incidentCount === 1 ? '' : 's'}` : 'No downtime'}
          </div>
          {stats.comparison && (
            <div className="text-xs text-gray-600 mt-1">
              Previous: {stats.comparison.previousDowntimePercentage.toFixed(1)}%
            </div>
          )}
        </div>

        {/* Uptime Percentage */}
        <div className="bg-dark-bg border border-dark-border rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Uptime</div>
          <div className="text-3xl font-bold text-sage-400">{stats.uptimePercentage.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">
            <TrendingUpIcon className="w-3 h-3 inline mr-1" />
            Availability
          </div>
        </div>

        {/* Incident Count */}
        <div className="bg-dark-bg border border-dark-border rounded p-4">
          <div className="text-gray-400 text-sm mb-1">Downtime Incidents</div>
          <div className="text-3xl font-bold text-white">{stats.incidentCount}</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.incidentCount === 1 ? 'incident' : 'incidents'}
          </div>
        </div>
      </div>

      {stats.periods.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <ClockIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-white">No downtime incidents</p>
          <p className="text-xs mt-2 text-gray-600">Period: {timeRangeLabel}</p>
        </div>
      )}
    </div>
  );
}


