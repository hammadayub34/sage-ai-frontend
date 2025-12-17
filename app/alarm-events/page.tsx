'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatAlarmName } from '@/lib/utils';
import { AlertIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, AlarmEventsIcon } from '@/components/Icons';
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

export default function AlarmEventsPage() {
  const [selectedMachine, setSelectedMachine] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const { data, isLoading, error, refetch } = useQuery<{ alerts: Alert[] }>({
    queryKey: ['alarm-events', selectedMachine, selectedState, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedMachine) {
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

      const response = await fetch(`/api/alarm-events?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch alarm events');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });

  const alerts = data?.alerts || [];
  
  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (selectedMachine && alert.machine_id !== selectedMachine) return false;
    if (selectedState && alert.state !== selectedState) return false;
    return true;
  });

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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

  const toggleExpand = (alert: Alert, alertKey: string) => {
    setExpandedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertKey)) {
        newSet.delete(alertKey);
      } else {
        newSet.add(alertKey);
      }
      return newSet;
    });
  };


  return (
    <div className="bg-dark-bg text-dark-text p-6 min-h-screen">
      <div className="mb-6">
        <div className="flex items-center justify-start mb-4">
          <div className="flex items-center gap-3">
            <AlarmEventsIcon className="w-8 h-8 text-sage-400" />
            <h1 className="heading-inter heading-inter-lg">Events</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <label className="text-gray-400 text-sm mr-2">Machine ID:</label>
            <input
              type="text"
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              placeholder="Filter by machine..."
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mr-2">State:</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
            >
              <option value="">All</option>
              <option value="RAISED">Raised</option>
              <option value="CLEARED">Cleared</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-sm mr-2">Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content - List */}
      <div>
        {/* Alarm Events List */}
        <div className="w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <span className="ml-3 text-gray-400">Loading events...</span>
            </div>
          ) : error ? (
            <div className="p-8 bg-dark-panel border border-dark-border rounded text-center">
              <p className="text-red-400">Error loading alarm events</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-8 bg-dark-panel border border-dark-border rounded text-center">
              <p className="text-gray-400">No events found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAlerts.map((alert, idx) => {
                const alertKey = `${alert.timestamp}-${idx}`;
                const isExpanded = expandedAlerts.has(alertKey);
                return (
                  <div
                    key={alertKey}
                    className="bg-dark-panel border border-dark-border rounded-lg hover:border-midnight-300 transition-colors"
                  >
                    {/* Header - Clickable */}
                    <div
                      className="p-6 cursor-pointer"
                      onClick={() => toggleExpand(alert, alertKey)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {isExpanded ? (
                              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                            )}
                            <h3 className="text-white font-semibold text-lg">
                              {formatAlarmName(alert.alarm_type)}
                            </h3>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium border ${
                                alert.state === 'RAISED'
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                  : 'bg-sage-500/20 text-sage-400 border-sage-500/30'
                              }`}
                            >
                              {alert.state}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>
                              <span className="font-semibold text-gray-300">Machine:</span> {alert.machine_id}
                            </span>
                            <span>
                              <span className="font-semibold text-gray-300">Alarm:</span> {formatAlarmName(alert.alarm_type)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right text-sm text-gray-400">
                            <div>
                              {new Date(alert.timestamp).toLocaleDateString()} {new Date(alert.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details - AI Analysis */}
                    {isExpanded && (
                      <div className="px-6 pb-6 pt-0 border-t border-dark-border">
                        <div className="mt-4">
                          <AlarmInstructions
                            alarmType={alert.alarm_type}
                            machineType={getMachineType(alert.machine_id)}
                            state={alert.state}
                            machineId={alert.machine_id}
                            onClose={undefined}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
