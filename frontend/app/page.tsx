'use client';

import { TagsTable } from '@/components/TagsTable';
import { ServiceControls } from '@/components/ServiceControls';
import { TimeSeriesChart } from '@/components/TimeSeriesChart';
import { AlarmHistory } from '@/components/AlarmHistory';
import { AlarmEvents } from '@/components/AlarmEvents';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function Dashboard() {
  const [machineId, setMachineId] = useState('machine-01');
  const queryClient = useQueryClient();
  
  const handleRefresh = () => {
    // Invalidate all queries to force refresh
    queryClient.invalidateQueries();
  };
  
  const handleMachineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMachineId(e.target.value);
    // Manual refresh required - no auto-refresh
  };

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">PLC Tags</h1>
        
        {/* Service Controls */}
        <ServiceControls machineId={machineId} />
        
        {/* Machine Selection */}
        <div className="flex items-center gap-4 mt-4">
          <label className="text-gray-400">Machine ID:</label>
          <select
            value={machineId}
            onChange={handleMachineChange}
            className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white"
          >
            <option value="machine-01">Machine 01</option>
            <option value="machine-02">Machine 02</option>
            <option value="machine-03">Machine 03</option>
          </select>
          <button
            onClick={handleRefresh}
            className="bg-midnight-300 hover:bg-midnight-400 text-dark-text border border-dark-border px-4 py-1 rounded text-sm font-medium transition-colors"
          >
            🔄 Refresh Data
          </button>
          <span className="text-gray-500 text-sm">
            Click refresh to update data
          </span>
        </div>
      </div>

      {/* Charts Row - Show time series trends */}
      <div className="mb-6">
        <TimeSeriesChart 
          field="BottlesPerMinute" 
          label="Production Rate (Bottles/Minute)"
          machineId={machineId}
          timeRange="-24h"
        />
      </div>

      {/* Alarm History */}
      <div className="mb-6">
        <AlarmHistory machineId={machineId} timeRange="-24h" />
      </div>

      {/* Alarm Events - Real-time from MQTT */}
      <div className="mb-6">
        <AlarmEvents machineId={machineId} />
      </div>

      {/* Tags Table */}
      <TagsTable machineId={machineId} />
    </div>
  );
}

