'use client';

import { TagsTable } from '@/components/TagsTable';
import { ServiceControlsButton } from '@/components/ServiceControlsButton';
import { TimeSeriesChart } from '@/components/TimeSeriesChart';
import { AlarmHistory } from '@/components/AlarmHistory';
import { AlarmEvents } from '@/components/AlarmEvents';
import { DowntimeStats } from '@/components/DowntimeStats';
import { WorkOrderForm } from '@/components/WorkOrderForm';
import { RefreshIcon, ChartIcon } from '@/components/Icons';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { VibrationChart } from '@/components/VibrationChart';
import { toast } from 'react-toastify';

interface Lab {
  _id: string;
  name: string;
  description?: string;
}

interface Machine {
  _id: string;
  machineName: string;
  labId: string;
  status: 'active' | 'inactive';
  description?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [labs, setLabs] = useState<Lab[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
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
    } catch (error) {
      console.error('Error fetching labs:', error);
      toast.error('Error loading labs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch machines for selected lab
  const fetchMachinesForLab = async (labId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/machines?labId=${labId}`);
      const data = await response.json();

      if (data.success) {
        setMachines(data.machines || []);
        // Auto-select first machine if available
        if (data.machines && data.machines.length > 0) {
          setSelectedMachineId(data.machines[0]._id);
        } else {
          setSelectedMachineId('');
        }
      } else {
        toast.error('Failed to fetch machines');
        setMachines([]);
        setSelectedMachineId('');
      }
    } catch (error) {
      console.error('Error fetching machines:', error);
      toast.error('Error loading machines');
      setMachines([]);
      setSelectedMachineId('');
    } finally {
      setLoading(false);
    }
  };

  // Handle lab selection change
  const handleLabChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const labId = e.target.value;
    setSelectedLabId(labId);
    if (labId) {
      fetchMachinesForLab(labId);
    } else {
      setMachines([]);
      setSelectedMachineId('');
    }
  };

  // Handle machine selection change
  const handleMachineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMachineId(e.target.value);
  };

  const [workOrderFormOpen, setWorkOrderFormOpen] = useState(false);
  const [chartTab, setChartTab] = useState<'spindle' | 'vibration' | 'current' | 'images'>('vibration');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [aiRecommendations, setAiRecommendations] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const queryClient = useQueryClient();
  
  const handleRefresh = () => {
    // Invalidate all queries to force refresh
    queryClient.invalidateQueries();
  };

  if (loading && !user) {
    return (
      <div className="bg-dark-bg text-dark-text p-6 min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-dark-bg text-dark-text p-6 min-h-screen">
      {/* Service Controls Icon Button (floating) */}
      <ServiceControlsButton machineId={selectedMachineId || 'machine-01'} />
      
      {/* Header */}
      <div className="mb-6">
        {/* Analytics Heading */}
        <div className="flex items-center gap-3 mb-4">
          <ChartIcon className="w-8 h-8 text-sage-400" />
          <h1 className="heading-inter heading-inter-lg">AI Insights</h1>
        </div>
        
        {/* Shopfloor/Lab and Machine Selection */}
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-4">
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
            
            <button
              onClick={() => setWorkOrderFormOpen(true)}
              className="bg-sage-500 hover:bg-sage-600 text-white px-4 py-1 rounded text-sm font-medium transition-colors"
            >
              Generate Work Order
            </button>
          </div>
          <button
            onClick={handleRefresh}
            className="bg-midnight-300 hover:bg-midnight-400 text-dark-text border border-dark-border p-2 rounded transition-colors flex items-center justify-center"
            title="Refresh Data"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Charts Row - Show time series trends */}
      {selectedMachineId ? (
        <div className="mb-6">
          <div className="bg-dark-panel rounded-lg border border-dark-border">
            {/* Tabs */}
            <div className="flex border-b border-dark-border">
              <button
                onClick={() => setChartTab('vibration')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  chartTab === 'vibration'
                    ? 'text-sage-400 border-b-2 border-sage-400 bg-dark-bg/50'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Vibration
              </button>
              <button
                onClick={() => setChartTab('current')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  chartTab === 'current'
                    ? 'text-sage-400 border-b-2 border-sage-400 bg-dark-bg/50'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Current
              </button>
            </div>
            
            {/* Chart Content */}
            <div>
              {chartTab === 'vibration' ? (
                <VibrationChart 
                  machineId={selectedMachineId}
                  timeRange={`-${selectedTimeRange}`}
                  onTimeRangeChange={setSelectedTimeRange}
                />
              ) : (
                <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
                  <h3 className="heading-inter heading-inter-sm mb-4">Current Values</h3>
                  <div className="text-yellow-400">
                    <div className="mb-2">No data available in InfluxDB</div>
                    <div className="text-sm text-gray-500">
                      Time range: -1h | Machine: {selectedMachineId}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 bg-dark-panel border border-dark-border rounded-lg p-8">
          <div className="text-center text-gray-400">
            <p className="text-lg mb-2">Please select a shopfloor/lab and equipment</p>
            <p className="text-sm">Select a lab from the dropdown above, then choose an equipment</p>
          </div>
        </div>
      )}

      {/* Downtime Statistics */}
      {selectedMachineId && (
        <div className="mb-6">
          <DowntimeStats machineId={selectedMachineId} timeRange={`-${selectedTimeRange}`} />
        </div>
      )}

      {/* Alarm History */}
      {selectedMachineId && (
        <div className="mb-6">
          <AlarmHistory machineId={selectedMachineId} timeRange="-24h" />
        </div>
      )}

      {/* Alarm Events - Real-time from MQTT */}
      {selectedMachineId && (
        <div className="mb-6">
          <AlarmEvents machineId={selectedMachineId} />
        </div>
      )}

      {/* Tags Table */}
      {selectedMachineId && (
        <TagsTable machineId={selectedMachineId} />
      )}

      {/* Work Order Form Modal */}
      <WorkOrderForm
        isOpen={workOrderFormOpen}
        onClose={() => setWorkOrderFormOpen(false)}
        machineId={selectedMachineId || ''}
      />
    </div>
  );
}

