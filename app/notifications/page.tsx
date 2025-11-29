'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatAlarmName } from '@/lib/utils';
import { AlertIcon, CheckIcon, FileIcon } from '@/components/Icons';
import { AlarmInstructions } from '@/components/AlarmInstructions';

interface Alert {
  timestamp: string;
  machine_id: string;
  alarm_type: string;
  alarm_name: string;
  alarm_label: string;
  state: 'RAISED' | 'CLEARED';
  value: boolean;
}

export default function NotificationsPage() {
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [selectedAlarm, setSelectedAlarm] = useState<{ 
    alarmType: string; 
    machineType: 'bottlefiller' | 'lathe'; 
    state: 'RAISED' | 'CLEARED';
    machineId: string;
  } | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ alerts: Alert[] }>({
    queryKey: ['notifications', selectedMachine, selectedState, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedMachine !== 'all') {
        params.append('machineId', selectedMachine);
      }
      params.append('limit', '500');
      
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      switch (timeRange) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      params.append('startDate', startDate.toISOString());
      params.append('endDate', now.toISOString());

      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refetch every 60 seconds (only saved alarms, not real-time)
  });

  const alerts = data?.alerts || [];
  
  // Filter by state if needed
  const filteredAlerts = selectedState === 'all' 
    ? alerts 
    : alerts.filter(a => a.state === selectedState);

  // Group by date
  const groupedAlerts = filteredAlerts.reduce((acc, alert) => {
    const date = new Date(alert.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(alert);
    return acc;
  }, {} as Record<string, Alert[]>);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getMachineOptions = () => {
    const machines = new Set(alerts.map(a => a.machine_id));
    return Array.from(machines).sort();
  };

  // Determine machine type from machine_id
  const getMachineType = (machineId: string): 'bottlefiller' | 'lathe' => {
    return machineId.startsWith('lathe') ? 'lathe' : 'bottlefiller';
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="heading-inter heading-inter-lg mb-2">Notifications</h1>
          <p className="text-gray-400 text-sm">View all alarm events and notifications</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Machine:</label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
            >
              <option value="all">All Machines</option>
              {getMachineOptions().map((machine) => (
                <option key={machine} value={machine}>
                  {machine}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">State:</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
            >
              <option value="all">All</option>
              <option value="RAISED">Raised</option>
              <option value="CLEARED">Cleared</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-sage-500 focus:border-sage-500"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>

          <button
            onClick={() => refetch()}
            className="ml-auto px-4 py-1 bg-sage-500 hover:bg-sage-600 text-white rounded text-sm font-medium transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading notifications...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-400">Error loading notifications</div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400">No notifications found</div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAlerts)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([date, dateAlerts]) => (
                <div key={date} className="bg-dark-panel border border-dark-border rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-4 pb-2 border-b border-dark-border">
                    {date}
                  </h3>
                  <div className="space-y-2">
                    {dateAlerts.map((alert, idx) => (
                      <div
                        key={`${alert.timestamp}-${idx}`}
                        className={`flex items-center gap-4 p-3 rounded ${
                          alert.state === 'RAISED'
                            ? 'bg-red-500/10 border border-red-500/30'
                            : 'bg-sage-500/10 border border-sage-500/30'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {alert.state === 'RAISED' ? (
                            <AlertIcon className="w-5 h-5 text-red-400" />
                          ) : (
                            <CheckIcon className="w-5 h-5 text-sage-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium">
                              {formatAlarmName(alert.alarm_type)}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                alert.state === 'RAISED'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-sage-500/20 text-sage-400'
                              }`}
                            >
                              {alert.state}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            {alert.machine_id} • {formatTime(alert.timestamp)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedAlarm({
                              alarmType: alert.alarm_type,
                              machineType: getMachineType(alert.machine_id),
                              state: alert.state,
                              machineId: alert.machine_id,
                            })}
                            className="flex items-center gap-1.5 text-xs bg-midnight-300 hover:bg-midnight-400 text-dark-text px-2 py-1 rounded transition-colors"
                          >
                            <FileIcon className="w-3 h-3" />
                            AI Instructions
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Alarm Instructions Modal */}
      {selectedAlarm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <AlarmInstructions
              alarmType={selectedAlarm.alarmType}
              machineType={selectedAlarm.machineType}
              state={selectedAlarm.state}
              machineId={selectedAlarm.machineId}
              onClose={() => setSelectedAlarm(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

