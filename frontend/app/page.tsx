'use client';

import { TagsTable } from '@/components/TagsTable';
import { ServiceControls } from '@/components/ServiceControls';
import { TimeSeriesChart } from '@/components/TimeSeriesChart';
import { AlarmHistory } from '@/components/AlarmHistory';
import { AlarmEvents } from '@/components/AlarmEvents';
import { DowntimeStats } from '@/components/DowntimeStats';
import { WorkOrderForm } from '@/components/WorkOrderForm';
import { RefreshIcon } from '@/components/Icons';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { VibrationChart } from '@/components/VibrationChart';

export default function Dashboard() {
  const [machineId, setMachineId] = useState('machine-01');
  const [machineType, setMachineType] = useState<'bottlefiller' | 'lathe'>('bottlefiller');
  const [workOrderFormOpen, setWorkOrderFormOpen] = useState(false);
  const [chartTab, setChartTab] = useState<'spindle' | 'vibration' | 'current' | 'images'>('spindle');
  const [aiRecommendations, setAiRecommendations] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const queryClient = useQueryClient();
  
  const handleRefresh = () => {
    // Invalidate all queries to force refresh
    queryClient.invalidateQueries();
  };
  
  const handleMachineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMachineId(e.target.value);
    // Manual refresh required - no auto-refresh
  };

  const handleMachineTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'bottlefiller' | 'lathe';
    setMachineType(newType);
    // Reset to first machine of selected type
    setMachineId(newType === 'bottlefiller' ? 'machine-01' : 'lathe01');
  };

  // Determine available machines based on type
  const machineOptions = machineType === 'bottlefiller' 
    ? ['machine-01', 'machine-02', 'machine-03']
    : ['lathe01', 'lathe02', 'lathe03'];

  return (
    <div className="bg-dark-bg text-dark-text p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        {/* Service Controls */}
        <ServiceControls machineId={machineId} />
        
        {/* Machine Type and Selection */}
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-4">
            <label className="text-gray-400">Machine Type:</label>
            <select
              value={machineType}
              onChange={handleMachineTypeChange}
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
            >
              <option value="bottlefiller">Bottle Filler</option>
              <option value="lathe">CNC Lathe</option>
            </select>
            
            <label className="text-gray-400">Machine ID:</label>
            <select
              value={machineId}
              onChange={handleMachineChange}
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
            >
              {machineOptions.map(id => (
                <option key={id} value={id}>{id}</option>
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
      <div className="mb-6">
        {machineType === 'lathe' ? (
          <div className="bg-dark-panel rounded-lg border border-dark-border">
            {/* Tabs */}
            <div className="flex border-b border-dark-border">
              <button
                onClick={() => setChartTab('spindle')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  chartTab === 'spindle'
                    ? 'text-sage-400 border-b-2 border-sage-400 bg-dark-bg/50'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Spindle Speed (RPM)
              </button>
              <button
                onClick={() => setChartTab('vibration')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  chartTab === 'vibration'
                    ? 'text-sage-400 border-b-2 border-sage-400 bg-dark-bg/50'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Vibration (mm/s)
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
              <button
                onClick={() => setChartTab('images')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  chartTab === 'images'
                    ? 'text-sage-400 border-b-2 border-sage-400 bg-dark-bg/50'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Images/Video
              </button>
            </div>
            
            {/* Chart Content */}
            <div>
              {chartTab === 'spindle' ? (
                <TimeSeriesChart 
                  field="SpindleSpeed"
                  label="Spindle Speed (RPM)"
                  machineId={machineId}
                  timeRange="-24h"
                  machineType={machineType}
                />
              ) : chartTab === 'vibration' ? (
                <div className="p-6">
                  <VibrationChart 
                    machineId={machineId}
                    timeRange="-24h"
                  />
                </div>
              ) : chartTab === 'current' ? (
                <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
                  <h3 className="heading-inter heading-inter-sm mb-4">Current Values</h3>
                  <div className="text-yellow-400">
                    <div className="mb-2">No data available in InfluxDB</div>
                    <div className="text-sm text-gray-500">
                      Time range: -1h | Machine: {machineId}
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      Make sure:
                      <ul className="list-disc list-inside mt-1 ml-2">
                        <li>InfluxDB is running</li>
                        <li>Data is being written to InfluxDB</li>
                        <li>The mock PLC agent is publishing data</li>
                        <li>Click <span className="inline-flex items-center gap-1"><RefreshIcon className="w-3 h-3" /> Refresh Data</span> after starting services</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4 text-white">Images & Video</h3>
                  <div className="space-y-4">
                    <div className="bg-dark-bg rounded-lg border border-dark-border p-4">
                      <h4 className="text-md font-medium mb-2 text-gray-300">Live Video Feed</h4>
                      <div className="aspect-video bg-dark-panel rounded border border-dark-border flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          <p className="text-sm">Video feed will appear here</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
        <TimeSeriesChart 
            field="BottlesPerMinute"
            label="Production Rate (Bottles/Minute)"
          machineId={machineId}
          timeRange="-24h"
          machineType={machineType}
        />
        )}
      </div>

      {/* Downtime Statistics */}
      <div className="mb-6">
        <DowntimeStats machineId={machineId} timeRange="-24h" machineType={machineType} />
      </div>

      {/* Alarm History */}
      <div className="mb-6">
        <AlarmHistory machineId={machineId} timeRange="-24h" machineType={machineType} />
      </div>

      {/* Alarm Events - Real-time from MQTT */}
      <div className="mb-6">
              <AlarmEvents machineId={machineId} machineType={machineType} />
      </div>

      {/* Tags Table */}
      <TagsTable machineId={machineId} machineType={machineType} />

      {/* Work Order Form Modal */}
      <WorkOrderForm
        isOpen={workOrderFormOpen}
        onClose={() => setWorkOrderFormOpen(false)}
        machineId={machineId}
        machineType={machineType}
      />
    </div>
  );
}

