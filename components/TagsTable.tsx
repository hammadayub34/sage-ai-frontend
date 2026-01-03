'use client';

import { useState, useEffect } from 'react';
import { usePLCData } from '@/hooks/usePLCData';
import { useModbusLatest } from '@/hooks/useModbusLatest';
import { PLCData } from '@/types/plc-data';
import { SettingsIcon, ChartIcon, TrendingUpIcon, LockIcon, WrenchIcon, DropletIcon, CalendarIcon, ChevronDownIcon, ChevronRightIcon, WarningIcon } from './Icons';

interface TagsTableProps {
  machineId?: string;
  machineType?: string;
  macAddress?: string;
  machineName?: string;
}

export function TagsTable({ machineId = 'machine-01', machineType, macAddress, machineName }: TagsTableProps) {
  const { data, isLoading, error } = usePLCData(machineId, machineType);
  
  // Check if this is CNC Machine A (has Modbus data)
  const isCNCMachineA = machineName === 'CNC Machine A' || machineId === '6958155ea4f09743147b22ab';
  const modbusMAC = macAddress || (isCNCMachineA ? '10:06:1C:86:F9:54' : '');
  
  // Fetch latest Modbus values if it's CNC Machine A
  const { data: modbusLatest, isLoading: modbusLoading } = useModbusLatest(
    isCNCMachineA ? machineId : '',
    modbusMAC
  );
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    status: true,
    analog: true,
    tooling: true,
    coolant: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity mb-4"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="heading-inter heading-inter-sm">Tag Values</h3>
          {isExpanded ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
        </div>
        {isExpanded && <div className="text-gray-400">Loading...</div>}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity mb-4"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="heading-inter heading-inter-sm">Tag Values</h3>
          {isExpanded ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
        </div>
        {isExpanded && <div className="text-red-400">Error loading data</div>}
      </div>
    );
  }

  // Check if we have actual data
  const hasData = data && data._time;

  if (!hasData && !isLoading) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity mb-4"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="heading-inter heading-inter-sm">Tag Values</h3>
          {isExpanded ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
        </div>
        {isExpanded && (
        <div className="text-yellow-400 p-4 text-center">
          <span className="flex items-center gap-1.5 justify-center">
            <WarningIcon className="w-4 h-4" />
            No data available for {machineId}
          </span>
          <br />
          <span className="text-gray-500 text-sm mt-2 block">
            To see data for this machine, run:
            <br />
            <code className="bg-midnight-200 px-2 py-1 rounded mt-1 inline-block border border-dark-border">
              ./start_mock_plc.sh {machineId}
            </code>
          </span>
        </div>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <h3 className="heading-inter heading-inter-sm mb-4">Tag Values</h3>
        <div className="text-red-400">Error loading data</div>
      </div>
    );
  }

  // Organize fields by category - different fields for bottle filler vs lathe
  const isLathe = machineType === 'lathe';

  const statusFields = isLathe ? [
    { label: 'System Running', value: data.SystemRunning, type: 'boolean' },
    { label: 'Machining', value: data.Machining, type: 'boolean' },
    { label: 'Ready', value: data.Ready, type: 'boolean' },
    { label: 'Fault', value: !data.Fault, type: 'boolean' }, // Invert
    { label: 'Auto Mode', value: data.AutoMode, type: 'boolean' },
  ] : [
    { label: 'System Running', value: true, type: 'boolean' },
    { label: 'Fault', value: false, type: 'boolean' },
    { label: 'Ready', value: true, type: 'boolean' },
  ];

  const counterFields = isLathe ? [
    { label: 'Parts Completed', value: data.PartsCompleted, type: 'number' },
    { label: 'Parts Rejected', value: data.PartsRejected, type: 'number' },
    { label: 'Parts Per Hour', value: data.PartsPerHour, type: 'number' },
    { label: 'Cycle Time', value: data.CycleTime, type: 'number', unit: 's' },
  ] : [
    { label: 'Bottles Filled', value: data.BottlesFilled, type: 'number' },
    { label: 'Bottles Rejected', value: data.BottlesRejected, type: 'number' },
    { label: 'Bottles Per Minute', value: data.BottlesPerMinute, type: 'number' },
  ];

  // Alarm fields removed - shown in Alarm Events and Alarm History sections instead

  // Use Modbus data for CNC Machine A, otherwise use PLC data
  const analogFields = isCNCMachineA && modbusLatest ? [
    { label: 'Pressure', value: modbusLatest['Pressure']?.value, type: 'number', unit: '', time: modbusLatest['Pressure']?.time },
    { label: 'Diff Pressure/Freq', value: modbusLatest['Diff Pressure/Freq']?.value, type: 'number', unit: '', time: modbusLatest['Diff Pressure/Freq']?.time },
    { label: 'Instantaneous Flow', value: modbusLatest['Instantaneous Flow']?.value, type: 'number', unit: '', time: modbusLatest['Instantaneous Flow']?.time },
    { label: 'Density', value: modbusLatest['Density']?.value, type: 'number', unit: '', time: modbusLatest['Density']?.time },
  ] : isLathe ? [
    { label: 'Spindle Speed', value: data.SpindleSpeed, type: 'number', unit: 'RPM' },
    { label: 'Spindle Speed Setpoint', value: data.SpindleSpeedSetpoint, type: 'number', unit: 'RPM' },
    { label: 'Spindle Load', value: data.SpindleLoad, type: 'number', unit: '%' },
    { label: 'Axis X Position', value: data.AxisXPosition, type: 'number', unit: 'mm' },
    { label: 'Axis X Feedrate', value: data.AxisXFeedrate, type: 'number', unit: 'mm/min' },
    { label: 'Axis Z Position', value: data.AxisZPosition, type: 'number', unit: 'mm' },
    { label: 'Axis Z Feedrate', value: data.AxisZFeedrate, type: 'number', unit: 'mm/min' },
  ] : [
    { label: 'Tank Temperature', value: data.TankTemperature, type: 'number', unit: '°C' },
    { label: 'Tank Pressure', value: data.TankPressure, type: 'number', unit: 'PSI' },
    { label: 'Fill Flow Rate', value: data.FillFlowRate, type: 'number', unit: 'L/min' },
    { label: 'Conveyor Speed', value: data.ConveyorSpeed, type: 'number', unit: 'RPM' },
  ];

  const inputFields = isLathe ? [
    { label: 'Door Closed', value: data.DoorClosed, type: 'boolean' },
    { label: 'E-Stop OK', value: data.EStopOK, type: 'boolean' },
    { label: 'Axis X Homed', value: data.AxisXHomed, type: 'boolean' },
    { label: 'Axis Z Homed', value: data.AxisZHomed, type: 'boolean' },
  ] : [
    { label: 'Low Level Sensor', value: data.LowLevelSensor, type: 'boolean' },
  ];

  // Lathe-specific additional sections
  const toolingFields = isLathe ? [
    { label: 'Tool Number', value: data.ToolNumber, type: 'number' },
    { label: 'Tool Life Percent', value: data.ToolLifePercent, type: 'number', unit: '%' },
    { label: 'Tool Offset X', value: data.ToolOffsetX, type: 'number', unit: 'mm' },
    { label: 'Tool Offset Z', value: data.ToolOffsetZ, type: 'number', unit: 'mm' },
  ] : [];

  const coolantFields = isLathe ? [
    { label: 'Coolant Flow Rate', value: data.CoolantFlowRate, type: 'number', unit: 'L/min' },
    { label: 'Coolant Temperature', value: data.CoolantTemperature, type: 'number', unit: '°C' },
    { label: 'Coolant Level Percent', value: data.CoolantLevelPercent, type: 'number', unit: '%' },
  ] : [];

  const formatValue = (value: any, type: string, unit?: string) => {
    if (type === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (type === 'number') {
      // Format large numbers with commas
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(num)) return 'N/A';
      
      // For whole numbers, don't show decimals
      if (num % 1 === 0) {
        return `${num.toLocaleString()}${unit ? ` ${unit}` : ''}`;
      }
      // For decimals, show 2 decimal places
      return `${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${unit ? ` ${unit}` : ''}`;
    }
    return String(value);
  };

  const getStatusColor = (value: any, type: string, isAlarm: boolean = false) => {
    if (type === 'boolean') {
      if (isAlarm) {
        // For alarms: true = active (red), false = OK (sage)
        return value ? 'text-red-400' : 'text-sage-400';
      }
      // For status fields: true = good (sage), false = bad (gray)
      return value ? 'text-sage-400' : 'text-gray-400';
    }
    return 'text-white';
  };

  // Format timestamp to EST
  const formatESTTime = (timestamp: string) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' EST';
  };

  return (
    <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
      <div 
        className="flex items-center gap-2 mb-4 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-white text-lg font-semibold">Tag Values</h3>
        {isExpanded ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
      </div>

      {isExpanded && (
      <div className="space-y-4">
        {/* Timestamp */}
        {data._time && (
          <div className="bg-midnight-200/30 border border-dark-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <CalendarIcon className="w-4 h-4" />
              <span>Last updated: {formatESTTime(data._time)}</span>
            </div>
          </div>
        )}

        {/* Status Fields */}
        <div className="border border-dark-border rounded-lg overflow-hidden">
          <div 
            className="bg-midnight-200/50 px-4 py-3 cursor-pointer hover:bg-midnight-200 transition-colors flex items-center justify-between"
            onClick={() => toggleSection('status')}
          >
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-gray-300" />
              <span className="text-gray-300 heading-inter heading-inter-sm">Status Fields</span>
            </div>
            {expandedSections.status ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
          </div>
          {expandedSections.status && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {statusFields.map((field) => (
                <div 
                  key={field.label} 
                  className={`border border-dark-border rounded-lg p-4 hover:border-midnight-300 transition-colors ${
                    field.value ? 'bg-sage-500/10' : 'bg-gray-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">{field.label}</span>
                    <div className={`w-3 h-3 rounded-full ${field.value ? 'bg-sage-500' : 'bg-gray-600'}`} />
                  </div>
                  <div className={`text-xl font-bold ${getStatusColor(field.value, field.type)}`}>
                    {field.value ? '✓' : '✗'} {formatValue(field.value, field.type)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Analog Fields */}
        <div className="border border-dark-border rounded-lg overflow-hidden">
          <div 
            className="bg-midnight-200/50 px-4 py-3 cursor-pointer hover:bg-midnight-200 transition-colors flex items-center justify-between"
            onClick={() => toggleSection('analog')}
          >
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="w-5 h-5 text-gray-300" />
              <span className="text-gray-300 heading-inter heading-inter-sm">Analog Fields</span>
            </div>
            {expandedSections.analog ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
          </div>
          {expandedSections.analog && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {isCNCMachineA && modbusLoading ? (
                <div className="col-span-full text-center text-gray-400 py-4">Loading Modbus data...</div>
              ) : analogFields.length > 0 ? (
                analogFields.map((field) => (
                  <div 
                    key={field.label} 
                    className="border border-dark-border rounded-lg p-4 hover:border-midnight-300 transition-colors bg-midnight-200/20"
                  >
                    <div className="text-gray-400 text-sm mb-2">{field.label}</div>
                    <div className="text-2xl font-bold text-white">
                      {field.value !== undefined && field.value !== null 
                        ? formatValue(field.value, field.type, field.unit)
                        : 'N/A'}
                    </div>
                    {field.time && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(field.time).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center text-gray-400 py-4">No analog data available</div>
              )}
            </div>
          )}
        </div>

        {/* Tooling Fields (Lathe only) */}
        {isLathe && toolingFields.length > 0 && (
          <div className="border border-dark-border rounded-lg overflow-hidden">
            <div 
              className="bg-midnight-200/50 px-4 py-3 cursor-pointer hover:bg-midnight-200 transition-colors flex items-center justify-between"
              onClick={() => toggleSection('tooling')}
            >
              <div className="flex items-center gap-2">
                <WrenchIcon className="w-5 h-5 text-gray-300" />
                <span className="text-gray-300 heading-inter heading-inter-sm">Tooling Fields</span>
              </div>
              {expandedSections.tooling ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
            </div>
            {expandedSections.tooling && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {toolingFields.map((field) => (
                  <div 
                    key={field.label} 
                    className="border border-dark-border rounded-lg p-4 hover:border-midnight-300 transition-colors bg-midnight-200/20"
                  >
                    <div className="text-gray-400 text-sm mb-2">{field.label}</div>
                    <div className="text-2xl font-bold text-white">
                      {formatValue(field.value, field.type, field.unit)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Coolant Fields (Lathe only) */}
        {isLathe && coolantFields.length > 0 && (
          <div className="border border-dark-border rounded-lg overflow-hidden">
            <div 
              className="bg-midnight-200/50 px-4 py-3 cursor-pointer hover:bg-midnight-200 transition-colors flex items-center justify-between"
              onClick={() => toggleSection('coolant')}
            >
              <div className="flex items-center gap-2">
                <DropletIcon className="w-5 h-5 text-gray-300" />
                <span className="text-gray-300 heading-inter heading-inter-sm">Coolant Fields</span>
              </div>
              {expandedSections.coolant ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
            </div>
            {expandedSections.coolant && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {coolantFields.map((field) => (
                  <div 
                    key={field.label} 
                    className="border border-dark-border rounded-lg p-4 hover:border-midnight-300 transition-colors bg-midnight-200/20"
                  >
                    <div className="text-gray-400 text-sm mb-2">{field.label}</div>
                    <div className="text-2xl font-bold text-white">
                      {formatValue(field.value, field.type, field.unit)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

