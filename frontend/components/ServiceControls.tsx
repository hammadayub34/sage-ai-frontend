'use client';

import { useState, useEffect, useRef } from 'react';
import { PlayIcon, StopIcon, ClockIcon, FileIcon, WarningIcon } from './Icons';

interface ServiceStatus {
  influxdbWriter: { running: boolean };
  machines: {
    'machine-01': { running: boolean };
    'machine-02': { running: boolean };
    'machine-03': { running: boolean };
    'lathe01': { running: boolean };
    'lathe02': { running: boolean };
    'lathe03': { running: boolean };
  };
}

interface ServiceControlsProps {
  machineId: string;
}

export function ServiceControls({ machineId }: ServiceControlsProps) {
  // Initialize with all services stopped to prevent flash of wrong state
  const [status, setStatus] = useState<ServiceStatus | null>({
    influxdbWriter: { running: false },
    machines: {
      'machine-01': { running: false },
      'machine-02': { running: false },
      'machine-03': { running: false },
      'lathe01': { running: false },
      'lathe02': { running: false },
      'lathe03': { running: false },
    },
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [showLogs, setShowLogs] = useState<Record<string, boolean>>({});
  const logEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Calculate running status (must be before useEffect that uses them)
  // Use a more reliable check that also considers loading state
  const influxdbRunning = status?.influxdbWriter?.running ?? false;
  const machineRunning = status?.machines?.[machineId as keyof typeof status.machines]?.running ?? false;
  
  // Debug logging
  useEffect(() => {
    console.log('Service status updated:', { 
      status, 
      influxdbRunning, 
      machineRunning,
      loading,
      'influxdbWriter.running': status?.influxdbWriter?.running 
    });
  }, [status, influxdbRunning, machineRunning, loading]);

  // Reset logs visibility when service stops
  useEffect(() => {
    if (!influxdbRunning) {
      setShowLogs(prev => {
        if (prev.influxdb_writer) {
          return { ...prev, influxdb_writer: false };
        }
        return prev;
      });
    }
  }, [influxdbRunning]);

  // Fetch logs only when "Show Logs" button is clicked (one-time fetch)
  const fetchLogs = async () => {
    if (!influxdbRunning) {
      return;
    }

    try {
      const url = `/api/services/logs?service=influxdb_writer`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.logs) {
          setLogs(prev => ({ ...prev, influxdb_writer: data.logs }));
          // Auto-scroll to bottom (only within the log container, not the page)
          setTimeout(() => {
            const ref = logEndRefs.current['influxdb_writer'];
            if (ref) {
              ref.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 100);
        }
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Fetch status with polling
  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchStatus = async () => {
      try {
        // Add timestamp to prevent caching
        const response = await fetch(`/api/services/status?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        if (response.ok && isMounted) {
          const data = await response.json();
          console.log('Status fetched:', data);
          // Always update status to ensure UI reflects current state
          setStatus({
            influxdbWriter: { running: data.influxdbWriter?.running ?? false },
            machines: {
              'machine-01': { running: data.machines?.['machine-01']?.running ?? false },
              'machine-02': { running: data.machines?.['machine-02']?.running ?? false },
              'machine-03': { running: data.machines?.['machine-03']?.running ?? false },
              'lathe01': { running: data.machines?.['lathe01']?.running ?? false },
              'lathe02': { running: data.machines?.['lathe02']?.running ?? false },
              'lathe03': { running: data.machines?.['lathe03']?.running ?? false },
            },
          });
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching status:', err);
        }
      }
    };

    // Initial fetch on mount with a small delay to ensure fresh data
    setTimeout(() => {
      if (isMounted) {
        fetchStatus();
      }
    }, 100);

    // Poll every 1 second to keep status updated more responsively
    pollInterval = setInterval(() => {
      if (isMounted) {
        fetchStatus();
      }
    }, 1000);

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []); // Empty dependency array - only run on mount

  const getCommand = (service: 'influxdb_writer' | 'mock_plc'): string => {
    if (service === 'influxdb_writer') {
      return 'bash start_influxdb_writer.sh';
    } else {
      return `bash start_mock_plc.sh ${machineId}`;
    }
  };

  const startService = async (service: 'influxdb_writer' | 'mock_plc') => {
    // Reset status to ensure we don't show wrong button state
    if (service === 'influxdb_writer') {
      setStatus(prev => prev ? { ...prev, influxdbWriter: { running: false } } : null);
    }
    setLoading({ ...loading, [service]: true });
    setError(null);
    
    // Only show logs for InfluxDB Writer
    if (service === 'influxdb_writer') {
      setShowLogs(prev => ({ ...prev, [service]: true })); // Show logs when starting
      // Clear old logs
      setLogs(prev => ({ ...prev, [service]: '🚀 Starting service...\n' }));
    }

    try {
      const body: any = { service };
      if (service === 'mock_plc') {
        body.machineId = machineId;
      }

      const response = await fetch('/api/services/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setError(null);
        
        // Only update logs for InfluxDB Writer
        if (service === 'influxdb_writer') {
          setLogs(prev => ({ 
            ...prev, 
            [service]: (prev[service] || '') + `\n✅ Service started successfully!\n📋 Command: ${getCommand(service)}\n\n` 
          }));
        }
        
        // Refresh status multiple times to catch the service starting
        // Try immediately, then every 500ms for up to 5 seconds
        const refreshStatus = (attempt: number = 0) => {
          // Use timestamp to prevent caching
          fetch(`/api/services/status?t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          })
            .then(res => res.json())
            .then(data => {
              console.log(`Status refreshed (attempt ${attempt}):`, data);
              
              // Always update status immediately to trigger re-render
              const newStatus = {
                influxdbWriter: { running: data.influxdbWriter?.running ?? false },
                machines: {
                  'machine-01': { running: data.machines?.['machine-01']?.running ?? false },
                  'machine-02': { running: data.machines?.['machine-02']?.running ?? false },
                  'machine-03': { running: data.machines?.['machine-03']?.running ?? false },
                  'lathe01': { running: data.machines?.['lathe01']?.running ?? false },
                  'lathe02': { running: data.machines?.['lathe02']?.running ?? false },
                  'lathe03': { running: data.machines?.['lathe03']?.running ?? false },
                },
              };
              setStatus(newStatus);
              
              // Check if service is now running
              const isRunning = service === 'influxdb_writer' 
                ? data.influxdbWriter?.running 
                : data.machines?.[machineId]?.running;
              
              console.log(`Service ${service} running status: ${isRunning} (attempt ${attempt})`);
              
              if (isRunning) {
                // Service is running, clear loading state immediately
                console.log(`✅ Service ${service} is now running! Clearing loading state.`);
                setLoading(prev => ({ ...prev, [service]: false }));
                // Don't continue polling - we're done
                return;
              } else if (attempt < 10) {
                // Service not running yet, try again more frequently (every 500ms)
                console.log(`Service ${service} not running yet, retrying in 500ms (attempt ${attempt + 1}/10)`);
                setTimeout(() => refreshStatus(attempt + 1), 500);
              } else {
                // Max attempts reached, clear loading anyway
                console.log(`Max attempts reached for ${service}, clearing loading state`);
                setLoading(prev => ({ ...prev, [service]: false }));
              }
            })
            .catch(err => {
              console.error('Error refreshing status:', err);
              // Clear loading on error after a delay
              if (attempt >= 3) {
                setLoading(prev => ({ ...prev, [service]: false }));
              } else {
                // Retry on error
                setTimeout(() => refreshStatus(attempt + 1), 500);
              }
            });
        };
        
        // Start refreshing status immediately (first check after 200ms to give process time to start)
        console.log(`Starting status refresh for ${service}...`);
        setTimeout(() => refreshStatus(0), 200);
      } else {
        const errorMsg = data.message || data.error || 'Failed to start service';
        const logPreview = data.logPreview ? `\n\nLog preview:\n${data.logPreview}` : '';
        setError(errorMsg + logPreview);
        
        // Only update logs for InfluxDB Writer
        if (service === 'influxdb_writer') {
          setLogs(prev => ({ 
            ...prev, 
            [service]: (prev[service] || '') + `\n❌ Error: ${errorMsg}${logPreview}\n` 
          }));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start service');
      setLoading(prev => ({ ...prev, [service]: false }));
      
      // Only update logs for InfluxDB Writer
      if (service === 'influxdb_writer') {
        setLogs(prev => ({ 
          ...prev, 
          [service]: (prev[service] || '') + `\n❌ Error: ${err.message}\n` 
        }));
      }
    }
    // Note: Don't clear loading in finally - let refreshStatus handle it
  };

  const stopService = async (service: 'influxdb_writer' | 'mock_plc') => {
    setLoading({ ...loading, [service]: true });
    setError(null);

    try {
      const body: any = { service };
      if (service === 'mock_plc') {
        body.machineId = machineId;
      }

      const response = await fetch('/api/services/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setError(null);
        // Refresh status multiple times to catch the service stopping
        const refreshStatus = (attempt: number = 0) => {
          fetch(`/api/services/status?t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          })
            .then(res => res.json())
            .then(data => {
              console.log(`Status refreshed after stop (attempt ${attempt}):`, data);
              
              // Always update status immediately to trigger re-render
              const newStatus = {
                influxdbWriter: { running: data.influxdbWriter?.running ?? false },
                machines: {
                  'machine-01': { running: data.machines?.['machine-01']?.running ?? false },
                  'machine-02': { running: data.machines?.['machine-02']?.running ?? false },
                  'machine-03': { running: data.machines?.['machine-03']?.running ?? false },
                  'lathe01': { running: data.machines?.['lathe01']?.running ?? false },
                  'lathe02': { running: data.machines?.['lathe02']?.running ?? false },
                  'lathe03': { running: data.machines?.['lathe03']?.running ?? false },
                },
              };
              setStatus(newStatus);
              
              // Check if service is now stopped
              const isRunning = service === 'influxdb_writer' 
                ? data.influxdbWriter?.running 
                : data.machines?.[machineId]?.running;
              
              if (!isRunning) {
                // Service is stopped, clear loading state
                console.log(`✅ Service ${service} is now stopped! Clearing loading state.`);
                setLoading(prev => ({ ...prev, [service]: false }));
              } else if (attempt < 10) {
                // Service still running, try again (every 500ms)
                setTimeout(() => refreshStatus(attempt + 1), 500);
              } else {
                // Max attempts reached, clear loading anyway
                console.log(`Max attempts reached for ${service} stop, clearing loading state`);
                setLoading(prev => ({ ...prev, [service]: false }));
              }
            })
            .catch(err => {
              console.error('Error refreshing status:', err);
              // Clear loading on error after a delay
              if (attempt >= 3) {
                setLoading(prev => ({ ...prev, [service]: false }));
              } else {
                // Retry on error
                setTimeout(() => refreshStatus(attempt + 1), 500);
              }
            });
        };
        
        // Start refreshing status immediately (first check after 200ms)
        setTimeout(() => refreshStatus(0), 200);
      } else {
        const errorMsg = data.message || data.error || 'Failed to stop service';
        setError(errorMsg);
        setLoading(prev => ({ ...prev, [service]: false }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to stop service');
      setLoading(prev => ({ ...prev, [service]: false }));
    }
    // Note: Don't clear loading in finally - let refreshStatus handle it
  };

  return (
    <div className="bg-dark-panel p-3 rounded-lg border border-dark-border mb-6">
      <h3 className="heading-inter heading-inter-sm mb-3">Service Controls</h3>
      
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {/* Step 1: InfluxDB Writer */}
        <div className="p-2 bg-dark-bg/50 rounded border border-dark-border">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">Step 1: InfluxDB Writer</span>
              <div className={`w-3 h-3 rounded-full ${influxdbRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-xs font-medium ${influxdbRunning ? 'text-green-400' : 'text-gray-500'}`}>
                {influxdbRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!influxdbRunning && !loading.influxdb_writer ? (
                <button
                  onClick={() => startService('influxdb_writer')}
                  disabled={loading.influxdb_writer}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium transition-colors shadow-lg hover:shadow-green-500/50"
                >
                  <span className="flex items-center gap-1.5">
                    <PlayIcon className="w-4 h-4" />
                    Start Writer
                  </span>
                </button>
              ) : loading.influxdb_writer && !influxdbRunning ? (
                <button
                  disabled
                  className="bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium"
                >
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="w-4 h-4" />
                    Starting Writer...
                  </span>
                </button>
              ) : influxdbRunning ? (
                <>
                  <button
                    onClick={() => {
                      const newShowLogs = !showLogs.influxdb_writer;
                      setShowLogs(prev => ({ ...prev, influxdb_writer: newShowLogs }));
                      // Fetch logs when showing
                      if (newShowLogs) {
                        fetchLogs();
                      }
                    }}
                    className="bg-midnight-300 hover:bg-midnight-400 text-dark-text border border-dark-border px-4 py-2 rounded text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileIcon className="w-4 h-4" />
                      {showLogs.influxdb_writer ? 'Hide Logs' : 'Show Logs'}
                    </span>
                  </button>
                  <button
                    onClick={() => stopService('influxdb_writer')}
                    disabled={loading.influxdb_writer}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium transition-colors shadow-lg hover:shadow-red-500/50"
                  >
                    <span className="flex items-center gap-1.5">
                      <StopIcon className="w-4 h-4" />
                      Stop Writer
                    </span>
                  </button>
                </>
              ) : null}
            </div>
          </div>
          
          {/* Command Preview */}
          {!influxdbRunning && (
            <div className="mt-2 p-2 bg-black/50 rounded text-xs font-mono text-gray-400 border border-dark-border">
              <span className="text-gray-500">$ </span>
              <span className="text-green-400">{getCommand('influxdb_writer')}</span>
            </div>
          )}

          {/* Log Viewer */}
          {showLogs.influxdb_writer && (influxdbRunning || logs.influxdb_writer) && (
            <div className="mt-3 p-3 bg-black rounded border border-dark-border max-h-64 overflow-y-auto font-mono text-xs scroll-smooth">
              <div className="text-gray-400 whitespace-pre-wrap">
                {logs.influxdb_writer || 'No logs available yet...'}
              </div>
              <div ref={el => {
                if (el) {
                  logEndRefs.current['influxdb_writer'] = el;
                }
              }} />
            </div>
          )}
        </div>

        {/* Step 2: Mock PLC for current machine - Only show when Writer is running */}
        {influxdbRunning && (
          <div className="flex items-center justify-between p-2 bg-dark-bg/50 rounded border border-dark-border">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">Step 2: Mock PLC ({machineId})</span>
              <div className={`w-3 h-3 rounded-full ${machineRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-xs font-medium ${machineRunning ? 'text-green-400' : 'text-gray-500'}`}>
                {machineRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!machineRunning && !loading.mock_plc ? (
                <button
                  onClick={() => startService('mock_plc')}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded text-sm font-medium transition-colors shadow-lg hover:shadow-green-500/50"
                >
                  <span className="flex items-center gap-1.5">
                    <PlayIcon className="w-4 h-4" />
                    Start Agent
                  </span>
                </button>
              ) : machineRunning ? (
                <button
                  onClick={() => stopService('mock_plc')}
                  disabled={loading.mock_plc}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium transition-colors shadow-lg hover:shadow-red-500/50"
                >
                  <span className="flex items-center gap-1.5">
                    {loading.mock_plc ? (
                      <>
                        <ClockIcon className="w-4 h-4" />
                        Stopping Agent...
                      </>
                    ) : (
                      <>
                        <StopIcon className="w-4 h-4" />
                        Stop Agent
                      </>
                    )}
                  </span>
                </button>
              ) : loading.mock_plc ? (
                <button
                  disabled
                  className="bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium"
                >
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="w-4 h-4" />
                    Starting Agent...
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        )}

        {/* Message when Writer is not running */}
        {!influxdbRunning && (
          <div className="p-2 bg-dark-bg/30 rounded border border-dark-border border-dashed">
            <p className="text-gray-400 text-sm text-center">
              <span className="flex items-center gap-1.5 justify-center">
                <WarningIcon className="w-4 h-4" />
                Start InfluxDB Writer first to enable Mock PLC agent controls
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-dark-border">
        <p className="text-gray-500 text-xs">
          💡 Start InfluxDB Writer first, then start Mock PLC for the selected machine.
        </p>
      </div>
    </div>
  );
}
