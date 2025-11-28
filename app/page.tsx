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
  const [chartTab, setChartTab] = useState<'spindle' | 'vibration'>('spindle');
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
                Sensor Data (Vibration)
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
              ) : (
                <div className="p-6">
                <VibrationChart 
                  machineId={machineId}
                  timeRange="-24h"
                />
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

