'use client';

import { useState, useEffect, useRef } from 'react';

interface ServiceStatus {
  influxdbWriter: { running: boolean };
  machines: {
    'machine-01': { running: boolean };
    'machine-02': { running: boolean };
    'machine-03': { running: boolean };
  };
}

interface ServiceControlsProps {
  machineId: string;
}

export function ServiceControls({ machineId }: ServiceControlsProps) {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [showLogs, setShowLogs] = useState<Record<string, boolean>>({});
  const logEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Calculate running status (must be before useEffect that uses them)
  const influxdbRunning = status?.influxdbWriter?.running ?? false;
  const machineRunning = status?.machines?.[machineId as keyof typeof status.machines]?.running ?? false;
  
  // Debug logging
  useEffect(() => {
    console.log('Service status updated:', { status, influxdbRunning, machineRunning });
  }, [status, influxdbRunning, machineRunning]);

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
        const response = await fetch('/api/services/status', {
          cache: 'no-store', // Prevent caching
        });
        if (response.ok && isMounted) {
          const data = await response.json();
          setStatus(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching status:', err);
        }
      }
    };

    // Initial fetch on mount
    fetchStatus();

    // Poll every 2 seconds to keep status updated
    pollInterval = setInterval(() => {
      if (isMounted) {
        fetchStatus();
      }
    }, 2000);

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
        // Try immediately, then after 1s, 2s, and 3s
        const refreshStatus = () => {
          fetch('/api/services/status', {
            cache: 'no-store', // Prevent caching
          })
            .then(res => res.json())
            .then(data => {
              console.log('Status refreshed:', data);
              setStatus(data);
            })
            .catch(err => console.error('Error refreshing status:', err));
        };
        
        // Immediate refresh
        refreshStatus();
        
        // Then refresh at intervals
        setTimeout(refreshStatus, 1000);
        setTimeout(refreshStatus, 2000);
        setTimeout(refreshStatus, 3000);
        setTimeout(refreshStatus, 5000); // Extra check at 5s
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
      
      // Only update logs for InfluxDB Writer
      if (service === 'influxdb_writer') {
        setLogs(prev => ({ 
          ...prev, 
          [service]: (prev[service] || '') + `\n❌ Error: ${err.message}\n` 
        }));
      }
    } finally {
      setLoading({ ...loading, [service]: false });
    }
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
        const refreshStatus = () => {
          fetch('/api/services/status')
            .then(res => res.json())
            .then(data => setStatus(data))
            .catch(err => console.error('Error refreshing status:', err));
        };
        
        // Immediate refresh
        refreshStatus();
        
        // Then refresh at intervals
        setTimeout(refreshStatus, 500);
        setTimeout(refreshStatus, 1000);
        setTimeout(refreshStatus, 2000);
      } else {
        const errorMsg = data.message || data.error || 'Failed to stop service';
        setError(errorMsg);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to stop service');
    } finally {
      setLoading({ ...loading, [service]: false });
    }
  };

  return (
    <div className="bg-dark-panel p-4 rounded-lg border border-dark-border mb-6">
      <h3 className="text-white text-lg font-semibold mb-4">Service Controls</h3>
      
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* Step 1: InfluxDB Writer */}
        <div className="p-3 bg-dark-bg/50 rounded border border-dark-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">Step 1: InfluxDB Writer</span>
              <div className={`w-3 h-3 rounded-full ${influxdbRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-xs font-medium ${influxdbRunning ? 'text-green-400' : 'text-gray-500'}`}>
                {influxdbRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!influxdbRunning ? (
                <button
                  onClick={() => startService('influxdb_writer')}
                  disabled={loading.influxdb_writer}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium transition-colors shadow-lg hover:shadow-green-500/50"
                >
                  {loading.influxdb_writer ? '⏳ Starting Writer...' : '▶ Start Writer'}
                </button>
              ) : (
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
                    {showLogs.influxdb_writer ? '📋 Hide Logs' : '📋 Show Logs'}
                  </button>
                  <button
                    onClick={() => stopService('influxdb_writer')}
                    disabled={loading.influxdb_writer}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium transition-colors shadow-lg hover:shadow-red-500/50"
                  >
                    {loading.influxdb_writer ? '⏳ Stopping Writer...' : '⏹ Stop Writer'}
                  </button>
                </>
              )}
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
          <div className="flex items-center justify-between p-3 bg-dark-bg/50 rounded border border-dark-border">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">Step 2: Mock PLC ({machineId})</span>
              <div className={`w-3 h-3 rounded-full ${machineRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-xs font-medium ${machineRunning ? 'text-green-400' : 'text-gray-500'}`}>
                {machineRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!machineRunning ? (
                <button
                  onClick={() => startService('mock_plc')}
                  disabled={loading.mock_plc}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium transition-colors shadow-lg hover:shadow-green-500/50"
                >
                  {loading.mock_plc ? '⏳ Starting Agent...' : '▶ Start Agent'}
                </button>
              ) : (
                <button
                  onClick={() => stopService('mock_plc')}
                  disabled={loading.mock_plc}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium transition-colors shadow-lg hover:shadow-red-500/50"
                >
                  {loading.mock_plc ? '⏳ Stopping Agent...' : '⏹ Stop Agent'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Message when Writer is not running */}
        {!influxdbRunning && (
          <div className="p-3 bg-dark-bg/30 rounded border border-dark-border border-dashed">
            <p className="text-gray-400 text-sm text-center">
              ⚠️ Start InfluxDB Writer first to enable Mock PLC agent controls
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-dark-border">
        <p className="text-gray-500 text-xs">
          💡 Start InfluxDB Writer first, then start Mock PLC for the selected machine.
        </p>
      </div>
    </div>
  );
}
