'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatAlarmName } from '@/lib/utils';
import { AlertIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, NotificationIcon } from '@/components/Icons';
import { AlarmInstructions } from '@/components/AlarmInstructions';
import { toast } from 'react-toastify';

interface Alert {
  timestamp: string;
  machine_id: string;
  alarm_type: string;
  alarm_name: string;
  alarm_label: string;
  state: 'RAISED' | 'CLEARED';
  value: boolean;
}

interface Lab {
  _id: string;
  name: string;
}

interface Machine {
  _id: string;
  machineName: string;
  labId: string;
  status: 'active' | 'inactive';
}

export default function AlarmEventsPage() {
  const router = useRouter();
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [labs, setLabs] = useState<Lab[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedState, setSelectedState] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  // Check if user is logged in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const userStr = localStorage.getItem('user');
      
      if (!isLoggedIn || !userStr) {
        router.push('/login');
        return;
      }
      
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        fetchUserLabs(userData._id);
      } catch (error) {
        console.error('Error parsing user data:', error);
        router.push('/login');
      }
    }
  }, [router]);

  // Fetch labs for the logged-in user
  const fetchUserLabs = async (userId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/labs/user?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch labs');
      }
      const data = await response.json();
      if (data.success) {
        setLabs(data.labs || []);
        // Auto-select first lab if available
        if (data.labs && data.labs.length > 0) {
          setSelectedLabId(data.labs[0]._id);
          fetchMachinesForLab(data.labs[0]._id);
        }
      } else {
        toast.error('Failed to fetch labs');
      }
    } catch (error: any) {
      console.error('Error fetching labs:', error);
      toast.error('Failed to load labs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch machines for selected lab
  useEffect(() => {
    if (selectedLabId) {
      fetchMachinesForLab(selectedLabId);
    } else {
      setMachines([]);
      setSelectedMachineId('');
    }
  }, [selectedLabId]);

  const fetchMachinesForLab = async (labId: string) => {
    try {
      const response = await fetch(`/api/machines?labId=${labId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch machines');
      }
      const data = await response.json();
      setMachines(data.machines || []);
      // Auto-select first machine if available
      if (data.machines && data.machines.length > 0) {
        setSelectedMachineId(data.machines[0]._id);
      } else {
        setSelectedMachineId('');
      }
    } catch (error: any) {
      console.error('Error fetching machines:', error);
      toast.error('Failed to load machines');
      setMachines([]);
    }
  };

  const handleLabChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const labId = e.target.value;
    setSelectedLabId(labId);
    setSelectedMachineId(''); // Reset machine selection when lab changes
  };

  const handleMachineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMachineId(e.target.value);
  };

  const { data, isLoading, error, refetch } = useQuery<{ alerts: Alert[] }>({
    queryKey: ['alarm-events', selectedMachineId, selectedState, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedMachineId) {
        params.append('machineId', selectedMachineId);
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
    if (selectedMachineId && alert.machine_id !== selectedMachineId) return false;
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <NotificationIcon className="w-8 h-8 text-sage-400" />
            <h1 className="heading-inter heading-inter-lg">Notifications</h1>
          </div>
        </div>

        {/* Shopfloor/Lab, Machine, State, and Time Range Selection */}
        <div className="flex items-center gap-4 mt-4 mb-6">
          <label className="text-gray-400">Shopfloor/Lab:</label>
          <select
            value={selectedLabId}
            onChange={handleLabChange}
            className="bg-dark-panel border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500 min-w-[200px]"
            disabled={loading || labs.length === 0}
          >
            <option value="">
              {loading ? 'Loading labs...' : labs.length === 0 ? 'No labs available' : 'Select a lab...'}
            </option>
            {labs.map((lab) => (
              <option key={lab._id} value={lab._id}>
                {lab.name}
              </option>
            ))}
          </select>
          
          <label className="text-gray-400">Equipment:</label>
          <select
            value={selectedMachineId}
            onChange={handleMachineChange}
            className="bg-dark-panel border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500 min-w-[200px]"
            disabled={loading || !selectedLabId || machines.length === 0}
          >
            <option value="">
              {!selectedLabId ? 'Select a lab first...' : loading ? 'Loading machines...' : machines.length === 0 ? 'No machines in this lab' : 'Select a machine...'}
            </option>
            {machines.map((machine) => (
              <option key={machine._id} value={machine._id}>
                {machine.machineName}
              </option>
            ))}
          </select>

          <label className="text-gray-400">State:</label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="bg-dark-panel border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500 min-w-[150px]"
          >
            <option value="">All</option>
            <option value="RAISED">Raised</option>
            <option value="CLEARED">Cleared</option>
          </select>

          <label className="text-gray-400">Time Range:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-dark-panel border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500 min-w-[150px]"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
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
