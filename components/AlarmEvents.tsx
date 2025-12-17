'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, WarningIcon, FileIcon } from './Icons';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AlarmInstructions } from './AlarmInstructions';
import { formatAlarmName } from '@/lib/utils';

interface AlarmEvent {
  timestamp: string;
  machine_id: string;
  alarm_type: string;
  alarm_label: string;
  state: 'RAISED' | 'CLEARED';
  value: boolean;
}

interface AlarmEventsProps {
  machineId?: string;
  machineType?: 'bottlefiller' | 'lathe';
}

interface WebSocketAlarm {
  machine_id: string;
  alarm_name: string;
  alarm_type: string;
  state: 'RAISED' | 'CLEARED';
  timestamp: string;
}

export function AlarmEvents({ machineId = 'machine-01', machineType }: AlarmEventsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [events, setEvents] = useState<AlarmEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [selectedAlarm, setSelectedAlarm] = useState<{ alarmType: string; machineType: 'bottlefiller' | 'lathe'; state: 'RAISED' | 'CLEARED' } | null>(null);

  // WebSocket connection for real-time notifications
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8765';
    console.log(`🔌 Attempting to connect to WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ Connected to alarm WebSocket');
      setWsConnected(true);
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const alarm: WebSocketAlarm = JSON.parse(event.data);
        console.log('📨 Received alarm via WebSocket:', alarm);
        console.log('   Machine:', alarm.machine_id);
        console.log('   Alarm Name:', alarm.alarm_name);
        console.log('   Alarm Type:', alarm.alarm_type);
        console.log('   State:', alarm.state);
        console.log('   Timestamp:', alarm.timestamp);
        
        // Only process alarms for the selected machine (or all if machineId is not specified)
        if (!machineId || alarm.machine_id === machineId) {
          console.log('   ✅ Processing alarm (matches machine filter)');
          const alarmLabel = alarm.alarm_name || alarm.alarm_type;
          const formattedAlarmName = formatAlarmName(alarmLabel);
          const message = `${formattedAlarmName} on ${alarm.machine_id}`;
          
          // Only show toast notification when alarm is RAISED (goes true)
          if (alarm.state === 'RAISED') {
            toast.error(
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">
                  <span className="text-red-400 font-bold text-xl leading-none">!</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm mb-0.5">Alarm Raised</div>
                  <div className="text-gray-400 text-xs truncate">{message}</div>
                  <div className="text-gray-500 text-xs mt-1">{alarm.machine_id}</div>
                </div>
              </div>,
              {
                position: 'top-right',
                autoClose: 6000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                icon: false,
                className: 'custom-toast',
                bodyClassName: 'custom-toast-body',
              }
            );
          }
          // No toast for CLEARED alarms - silent update only
          
          // Update local state directly from WebSocket message (no API call)
          // Update table for both RAISED and CLEARED to maintain complete history
          const newEvent: AlarmEvent = {
            timestamp: alarm.timestamp,
            machine_id: alarm.machine_id,
            alarm_type: alarm.alarm_type,
            alarm_label: alarm.alarm_name,
            state: alarm.state,
            value: alarm.state === 'RAISED',
          };
          
          // Add new event to the beginning of the list
          // Keep events for all machines in state, but filter when displaying
          setEvents((prevEvents) => {
            const updated = [newEvent, ...prevEvents];
            // Keep only last 50 events (to maintain history across machine switches)
            return updated.slice(0, 50);
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
      setConnectionStatus('error');
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed', event.code, event.reason);
      setWsConnected(false);
      setConnectionStatus('disconnected');
      
      // Attempt to reconnect after 3 seconds if not a normal closure
      if (event.code !== 1000) {
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            console.log('🔄 Attempting to reconnect...');
            setConnectionStatus('connecting');
            // Reconnect will be handled by useEffect cleanup and re-run
          }
        }, 3000);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [machineId]);

  const formatTime = (timestamp: string) => {
    try {
      // Handle ISO format with or without Z, with or without timezone offset
      let dateStr = timestamp;
      // Remove any trailing Z if there's already a timezone offset
      if (dateStr.includes('+') && dateStr.endsWith('Z')) {
        dateStr = dateStr.slice(0, -1);
      }
      // Ensure we have a valid date string
      const date = new Date(dateStr);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid timestamp:', timestamp);
        return 'Invalid Date';
      }
      
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
    } catch (error) {
      console.error('Error formatting timestamp:', timestamp, error);
      return 'Invalid Date';
    }
  };

  // Filter events to only show those for the selected machine
  const filteredEvents = events.filter(e => e.machine_id === machineId);
  const activeAlarms = filteredEvents.filter(e => e.state === 'RAISED').length;

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-sage-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'disconnected':
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return '● Connected';
      case 'connecting':
        return '● Connecting...';
      case 'disconnected':
        return '● Disconnected';
      case 'error':
        return '● Connection Error';
      default:
        return '● Unknown';
    }
  };

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={6000}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        limit={5}
        toastClassName="custom-toast"
        bodyClassName="custom-toast-body"
      />
      
      <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span className="heading-inter heading-inter-sm">Events (Real-time)</span>
            {isExpanded ? <ChevronDownIcon className="w-3 h-3 text-gray-500" /> : <ChevronRightIcon className="w-3 h-3 text-gray-500" />}
            <span className={`text-xs ml-2 ${getConnectionStatusColor()}`}>
              {getConnectionStatusText()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {activeAlarms > 0 && (
              <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded text-sm font-medium border border-red-500/50">
                {activeAlarms} Active
              </span>
            )}
          </div>
        </div>
        
        {isExpanded && (
          <>
            {connectionStatus === 'error' && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-center mb-4">
                <span className="text-red-400 text-sm">
                  <span className="flex items-center gap-1.5 justify-center">
                    <WarningIcon className="w-4 h-4" />
                    WebSocket connection error. Make sure the Alarm Monitor is running.
                  </span>
                </span>
                <p className="text-gray-500 text-xs mt-2">
                  Run: <code className="bg-midnight-200 px-2 py-1 rounded">./start_alarm_monitor.sh</code>
                </p>
              </div>
            )}
            
            {connectionStatus === 'connecting' && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded text-center mb-4">
                <span className="text-yellow-400 text-sm flex items-center gap-1.5">
                  <ClockIcon className="w-4 h-4" />
                  Connecting to WebSocket server...
                </span>
              </div>
            )}
            
            {connectionStatus === 'disconnected' && (
              <div className="p-4 bg-gray-500/10 border border-gray-500/30 rounded text-center mb-4">
                <span className="text-gray-400 text-sm">🔌 WebSocket disconnected. Will attempt to reconnect...</span>
              </div>
            )}

            {filteredEvents.length === 0 ? (
              <div className="p-4 bg-gray-800/30 border border-dark-border rounded text-center">
                <span className="text-gray-400 text-sm">
                  {connectionStatus === 'connected' 
                    ? (
                      <span className="flex items-center gap-1.5 justify-center">
                        <CheckIcon className="w-4 h-4" />
                        No events for {machineId} -
                      </span>
                    )
                    : 'No events yet'}
                </span>
                <p className="text-gray-500 text-xs mt-2">
                  {connectionStatus === 'connected'
                    ? `Alarm notifications for ${machineId} will appear here when alarms are raised`
                    : 'Connect to WebSocket to receive real-time alarm notifications'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredEvents.map((event, index) => {
                  // Use provided machineType or determine from machine_id
                  const eventMachineType: 'bottlefiller' | 'lathe' = 
                    machineType || (event.machine_id.startsWith('lathe') ? 'lathe' : 'bottlefiller');
                  
                  return (
                    <div
                      key={`${event.timestamp}-${index}`}
                      className={`p-3 rounded border ${
                        event.state === 'RAISED'
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-sage-500/10 border-sage-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {event.state === 'RAISED' ? (
                            <AlertIcon className="w-4 h-4 text-red-400" />
                          ) : (
                            <CheckIcon className="w-4 h-4 text-sage-400" />
                          )}
                          <div className="flex-1">
                            <div className="text-dark-text font-medium">{formatAlarmName(event.alarm_type)}</div>
                            <div className="text-gray-500 text-xs">{formatTime(event.timestamp)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedAlarm({
                              alarmType: event.alarm_type,
                              machineType: eventMachineType,
                              state: event.state,
                            })}
                            className="flex items-center gap-1.5 text-xs bg-midnight-300 hover:bg-midnight-400 text-dark-text px-2 py-1 rounded transition-colors"
                          >
                            <FileIcon className="w-3 h-3" />
                            AI Analysis
                          </button>
                          <div className="text-xs text-gray-400">
                            {event.machine_id}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* AI Analysis Modal */}
      {selectedAlarm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <AlarmInstructions
              alarmType={selectedAlarm.alarmType}
              machineType={selectedAlarm.machineType}
              state={selectedAlarm.state}
              machineId={machineId}
              onClose={() => setSelectedAlarm(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
