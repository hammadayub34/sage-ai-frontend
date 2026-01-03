'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChartIcon, CalendarIcon, ShopfloorsIcon, ChevronDownIcon, ChevronRightIcon, AlertIcon, ClockIcon, TrendingUpIcon } from '@/components/Icons';
import { toast } from 'react-toastify';

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

interface MaintenanceStats {
  totalMachines: number;
  scheduledMaintenanceCount: number;
  machinesWithMaintenance: string[];
  totalDowntime: number; // in seconds
  totalUptime: number; // in seconds
  downtimePercentage: number;
  uptimePercentage: number;
}

export default function AIInsightsPage() {
  const router = useRouter();
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [labs, setLabs] = useState<Lab[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [maintenanceStats, setMaintenanceStats] = useState<MaintenanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [wiseAnalysisExpanded, setWiseAnalysisExpanded] = useState(false);
  const [wiseAnalysis, setWiseAnalysis] = useState<string | null>(null);
  const [loadingWiseAnalysis, setLoadingWiseAnalysis] = useState(false);
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [downtimeIncidentsCount, setDowntimeIncidentsCount] = useState<number>(0);
  const [loadingDowntimeIncidents, setLoadingDowntimeIncidents] = useState(false);

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
      const response = await fetch(`/api/labs/user?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch labs');
      }
      const data = await response.json();
      console.log('[AI Insights] Labs data:', data);
      if (data.labs && data.labs.length > 0) {
        setLabs(data.labs);
        // Auto-select Dawlance lab if available, otherwise first lab
        const dawlanceLab = data.labs.find((lab: Lab) => {
          const labName = lab.name?.toLowerCase() || '';
          return labName.includes('dawlance');
        });
        console.log('[AI Insights] Dawlance lab found:', dawlanceLab);
        const labToSelect = dawlanceLab || data.labs[0];
        console.log('[AI Insights] Selected lab:', labToSelect?.name, 'ID:', labToSelect?._id);
        if (labToSelect && labToSelect._id) {
          setSelectedLabId(labToSelect._id);
        }
      } else {
        toast.error('No labs found for this user');
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
      fetchMaintenanceStats(selectedLabId);
      fetchAlertsCount(selectedLabId);
      fetchDowntimeIncidentsCount(selectedLabId);
    }
  }, [selectedLabId]);

  // Reset and auto-expand wise analysis when lab changes
  useEffect(() => {
    setWiseAnalysis(null);
    setLoadingWiseAnalysis(false);
    setWiseAnalysisExpanded(true);
  }, [selectedLabId]);

  // Auto-fetch wise analysis when lab changes and stats are loaded
  useEffect(() => {
    const selectedLab = labs.find(lab => lab._id === selectedLabId);
    // Only fetch if we have all required data and no existing analysis
    if (selectedLabId && maintenanceStats && !loadingStats && wiseAnalysisExpanded && !wiseAnalysis && selectedLab && !loadingWiseAnalysis) {
      // Small delay to ensure state is fully cleared
      const timer = setTimeout(() => {
        fetchWiseAnalysis();
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLabId, maintenanceStats, loadingStats, wiseAnalysisExpanded, labs]);

  const fetchMachinesForLab = async (labId: string) => {
    try {
      const response = await fetch(`/api/machines?labId=${labId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch machines');
      }
      const data = await response.json();
      setMachines(data.machines || []);
    } catch (error: any) {
      console.error('Error fetching machines:', error);
      toast.error('Failed to load machines');
    }
  };

  const fetchMaintenanceStats = async (labId: string) => {
    setLoadingStats(true);
    try {
      // First, get all machines for this lab
      const machinesResponse = await fetch(`/api/machines?labId=${labId}`);
      if (!machinesResponse.ok) {
        throw new Error('Failed to fetch machines');
      }
      const machinesData = await machinesResponse.json();
      const labMachines = machinesData.machines || [];
      const machineIds = labMachines.map((m: Machine) => m._id);

      if (machineIds.length === 0) {
        setMaintenanceStats({
          totalMachines: 0,
          scheduledMaintenanceCount: 0,
          machinesWithMaintenance: [],
          totalDowntime: 0,
          totalUptime: 0,
          downtimePercentage: 0,
          uptimePercentage: 100,
        });
        setLoadingStats(false);
        return;
      }

      // Fetch work orders for the past month for these machines
      const workOrdersResponse = await fetch('/api/work-orders');
      if (!workOrdersResponse.ok) {
        throw new Error('Failed to fetch work orders');
      }
      const workOrdersData = await workOrdersResponse.json();
      const allWorkOrders = workOrdersData.data || [];

      // Filter work orders from past month for machines in this lab
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const relevantWorkOrders = allWorkOrders.filter((wo: any) => {
        const workOrderDate = new Date(wo.createdAt || wo._time);
        const isInPastMonth = workOrderDate >= oneMonthAgo;
        const isForLabMachine = machineIds.includes(wo.machineId);
        return isInPastMonth && isForLabMachine;
      });

      // Count unique machines that had maintenance
      const machinesWithMaintenance = new Set(
        relevantWorkOrders.map((wo: any) => wo.machineId)
      );

      // Fetch downtime stats for all machines in the lab (last month)
      let totalDowntime = 0;
      let totalUptime = 0;
      let totalTimePeriod = 0;

      try {
        const downtimePromises = machineIds.map(async (machineId: string) => {
          try {
            const downtimeResponse = await fetch(`/api/influxdb/downtime?machineId=${machineId}&timeRange=-30d`);
            if (downtimeResponse.ok) {
              const downtimeData = await downtimeResponse.json();
              if (downtimeData.data) {
                return {
                  downtime: downtimeData.data.totalDowntime || 0,
                  uptime: downtimeData.data.totalUptime || 0,
                  totalTime: (downtimeData.data.totalDowntime || 0) + (downtimeData.data.totalUptime || 0),
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching downtime for machine ${machineId}:`, error);
          }
          return { downtime: 0, uptime: 0, totalTime: 0 };
        });

        const downtimeResults = await Promise.all(downtimePromises);
        
        // Aggregate downtime and uptime
        downtimeResults.forEach(result => {
          totalDowntime += result.downtime;
          totalUptime += result.uptime;
          totalTimePeriod += result.totalTime;
        });

        // If no data, use a default time period (30 days per machine)
        if (totalTimePeriod === 0 && machineIds.length > 0) {
          const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
          totalTimePeriod = thirtyDaysInSeconds * machineIds.length;
          totalUptime = totalTimePeriod; // Assume all uptime if no data
        }
      } catch (error) {
        console.error('Error fetching downtime stats:', error);
        // Continue with zero downtime if there's an error
      }

      const downtimePercentage = totalTimePeriod > 0 ? (totalDowntime / totalTimePeriod) * 100 : 0;
      const uptimePercentage = totalTimePeriod > 0 ? (totalUptime / totalTimePeriod) * 100 : 100;

      setMaintenanceStats({
        totalMachines: labMachines.length,
        scheduledMaintenanceCount: relevantWorkOrders.length,
        machinesWithMaintenance: Array.from(machinesWithMaintenance),
        totalDowntime,
        totalUptime,
        downtimePercentage,
        uptimePercentage,
      });
    } catch (error: any) {
      console.error('Error fetching maintenance stats:', error);
      toast.error('Failed to load maintenance statistics');
      setMaintenanceStats({
        totalMachines: machines.length,
        scheduledMaintenanceCount: 0,
        machinesWithMaintenance: [],
        totalDowntime: 0,
        totalUptime: 0,
        downtimePercentage: 0,
        uptimePercentage: 100,
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchAlertsCount = async (labId: string) => {
    setLoadingAlerts(true);
    try {
      // Get all machines for this lab
      const machinesResponse = await fetch(`/api/machines?labId=${labId}`);
      if (!machinesResponse.ok) {
        throw new Error('Failed to fetch machines');
      }
      const machinesData = await machinesResponse.json();
      const labMachines = machinesData.machines || [];
      const machineIds = labMachines.map((m: Machine) => m._id);

      if (machineIds.length === 0) {
        setAlertsCount(0);
        setLoadingAlerts(false);
        return;
      }

      // Fetch alerts for the past month for all machines in this lab
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Fetch alerts for each machine and aggregate
      let totalAlerts = 0;
      const alertPromises = machineIds.map(async (machineId: string) => {
        try {
          const params = new URLSearchParams();
          params.append('machineId', machineId);
          params.append('limit', '1000');
          params.append('startDate', oneMonthAgo.toISOString());
          params.append('endDate', now.toISOString());
          
          const response = await fetch(`/api/alarm-events?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            return data.alerts?.length || 0;
          }
        } catch (error) {
          console.error(`Error fetching alerts for machine ${machineId}:`, error);
        }
        return 0;
      });

      const results = await Promise.all(alertPromises);
      totalAlerts = results.reduce((sum, count) => sum + count, 0);
      setAlertsCount(totalAlerts);
    } catch (error: any) {
      console.error('Error fetching alerts count:', error);
      setAlertsCount(0);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const fetchDowntimeIncidentsCount = async (labId: string) => {
    setLoadingDowntimeIncidents(true);
    try {
      // Get all machines for this lab
      const machinesResponse = await fetch(`/api/machines?labId=${labId}`);
      if (!machinesResponse.ok) {
        throw new Error('Failed to fetch machines');
      }
      const machinesData = await machinesResponse.json();
      const labMachines = machinesData.machines || [];
      const machineIds = labMachines.map((m: Machine) => m._id);

      if (machineIds.length === 0) {
        setDowntimeIncidentsCount(0);
        setLoadingDowntimeIncidents(false);
        return;
      }

      // Fetch downtime incidents for all machines in the lab (last month)
      let totalIncidents = 0;
      const incidentPromises = machineIds.map(async (machineId: string) => {
        try {
          const response = await fetch(`/api/influxdb/downtime?machineId=${machineId}&timeRange=-30d`);
          if (response.ok) {
            const data = await response.json();
            return data.data?.incidentCount || 0;
          }
        } catch (error) {
          console.error(`Error fetching downtime incidents for machine ${machineId}:`, error);
        }
        return 0;
      });

      const results = await Promise.all(incidentPromises);
      totalIncidents = results.reduce((sum, count) => sum + count, 0);
      setDowntimeIncidentsCount(totalIncidents);
    } catch (error: any) {
      console.error('Error fetching downtime incidents count:', error);
      setDowntimeIncidentsCount(0);
    } finally {
      setLoadingDowntimeIncidents(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-dark-bg text-dark-text p-6 min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const selectedLab = labs.find(lab => lab._id === selectedLabId);

  // Format duration helper
  const formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${Math.round(seconds)}s`;
    }
  };

  // Fetch Wise Analysis when section is expanded
  const fetchWiseAnalysis = async () => {
    const currentSelectedLab = labs.find(lab => lab._id === selectedLabId);
    if (!maintenanceStats || !currentSelectedLab || wiseAnalysis) {
      return; // Don't fetch if already loaded or no data
    }

    setLoadingWiseAnalysis(true);
    setWiseAnalysis(null); // Clear previous analysis completely
    
    try {
      const response = await fetch('/api/ai-insights/wise-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labName: currentSelectedLab.name,
          totalMachines: maintenanceStats.totalMachines,
          scheduledMaintenanceCount: maintenanceStats.scheduledMaintenanceCount,
          machinesWithMaintenance: maintenanceStats.machinesWithMaintenance.length,
          totalDowntime: maintenanceStats.totalDowntime,
          totalUptime: maintenanceStats.totalUptime,
          downtimePercentage: maintenanceStats.downtimePercentage,
          uptimePercentage: maintenanceStats.uptimePercentage,
          timePeriod: 'Last Month',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate analysis');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            
            if (data.type === 'chunk' && data.content) {
              accumulatedText += data.content;
              setWiseAnalysis(accumulatedText);
            } else if (data.type === 'done') {
              setLoadingWiseAnalysis(false);
              return;
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Failed to generate analysis');
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }

      setLoadingWiseAnalysis(false);
    } catch (error: any) {
      console.error('Error fetching wise analysis:', error);
      toast.error('Failed to generate analysis');
      setWiseAnalysis('Unable to generate analysis at this time. Please try again later.');
      setLoadingWiseAnalysis(false);
    }
  };

  // Handle expand/collapse of Wise Analysis section
  const handleWiseAnalysisToggle = () => {
    const newExpanded = !wiseAnalysisExpanded;
    setWiseAnalysisExpanded(newExpanded);
    
    // If expanding and analysis hasn't been loaded yet, fetch it
    if (newExpanded && !wiseAnalysis && maintenanceStats) {
      fetchWiseAnalysis();
    }
  };

  return (
    <div className="bg-dark-bg text-dark-text p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <ChartIcon className="w-8 h-8 text-sage-400" />
          <h1 className="heading-inter heading-inter-lg">AI Insights</h1>
        </div>

        {/* Lab Selection */}
        <div className="flex items-center gap-4 mt-4">
          <label className="text-gray-400">Shopfloor/Lab:</label>
          <select
            value={selectedLabId}
            onChange={(e) => setSelectedLabId(e.target.value)}
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
        </div>
      </div>

      {/* Performance Section - First */}
      {selectedLabId && maintenanceStats && !loadingStats && (
        <div className="mt-6 bg-dark-panel border border-dark-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="heading-inter heading-inter-sm text-white flex items-center gap-2">
              <ClockIcon className="w-5 h-5" />
              Performance
            </h2>
            <span className="text-xs text-gray-500">Last Month</span>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Downtime Percentage */}
            <div className="bg-dark-bg border border-dark-border rounded p-4">
              <div className="text-gray-400 text-sm mb-1">Downtime</div>
              <div className="text-3xl font-bold text-red-400">
                {maintenanceStats.downtimePercentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {formatDuration(maintenanceStats.totalDowntime)}
              </div>
            </div>

            {/* Uptime Percentage */}
            <div className="bg-dark-bg border border-dark-border rounded p-4">
              <div className="text-gray-400 text-sm mb-1">Uptime</div>
              <div className="text-3xl font-bold text-sage-400">
                {maintenanceStats.uptimePercentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                <TrendingUpIcon className="w-3 h-3 inline mr-1" />
                Availability
              </div>
            </div>

            {/* Total Machines */}
            <div className="bg-dark-bg border border-dark-border rounded p-4">
              <div className="text-gray-400 text-sm mb-1">Total Machines</div>
              <div className="text-3xl font-bold text-white">
                {maintenanceStats.totalMachines}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Active machines in {selectedLab?.name || 'selected lab'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events Section */}
      {selectedLabId && maintenanceStats && !loadingStats && (
        <div className="mt-6 bg-dark-panel border border-dark-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="heading-inter heading-inter-sm text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Events
            </h2>
            <span className="text-xs text-gray-500">Last Month</span>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Scheduled Maintenance */}
            <div className="bg-dark-bg border border-dark-border rounded p-4">
              <div className="text-gray-400 text-sm mb-1">Scheduled Maintenance</div>
              <div className="text-3xl font-bold text-white">
                {maintenanceStats.scheduledMaintenanceCount}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Work orders
              </div>
            </div>

            {/* Alerts */}
            <div className="bg-dark-bg border border-dark-border rounded p-4">
              <div className="text-gray-400 text-sm mb-1">Alerts</div>
              {loadingAlerts ? (
                <div className="text-gray-400 text-sm">Loading...</div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-yellow-400">
                    {alertsCount}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Alert events
                  </div>
                </>
              )}
            </div>

            {/* Downtime Incidents */}
            <div className="bg-dark-bg border border-dark-border rounded p-4">
              <div className="text-gray-400 text-sm mb-1">Downtime Incidents</div>
              {loadingDowntimeIncidents ? (
                <div className="text-gray-400 text-sm">Loading...</div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-red-400">
                    {downtimeIncidentsCount}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {downtimeIncidentsCount === 1 ? 'incident' : 'incidents'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wise Analysis Section */}
      {selectedLabId && maintenanceStats && !loadingStats && (
        <div key={selectedLabId} className="mt-6 bg-dark-panel border border-dark-border rounded-lg overflow-hidden">
          {/* Collapsible Header */}
          <button
            onClick={handleWiseAnalysisToggle}
            className="w-full flex items-center justify-between p-6 hover:bg-dark-bg/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {wiseAnalysisExpanded ? (
                <ChevronDownIcon className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRightIcon className="w-5 h-5 text-gray-400" />
              )}
              <h3 className="text-gray-300 text-lg font-semibold">Wise Analysis</h3>
            </div>
          </button>

          {/* Expanded Content */}
          {wiseAnalysisExpanded && (
            <div className="px-6 pb-6 border-t border-dark-border">
              {loadingWiseAnalysis || (!wiseAnalysis && selectedLabId) ? (
                <div className="py-8 flex items-center justify-center">
                  <div className="text-gray-400 animate-pulse">Wise Guy gathering performance insights...</div>
                </div>
              ) : wiseAnalysis ? (
                <div className="pt-6">
                  <div className="prose prose-invert max-w-none">
                    <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {wiseAnalysis.split('\n').map((line, index, array) => {
                        // Remove markdown formatting
                        let cleanLine = line.trim();
                        
                        // Remove markdown headings (###, ##, #)
                        cleanLine = cleanLine.replace(/^#{1,6}\s+/, '');
                        
                        // Remove bold markers (**text**)
                        cleanLine = cleanLine.replace(/\*\*/g, '');
                        
                        // Check if previous line was empty or a heading
                        const prevLine = index > 0 ? array[index - 1].trim() : '';
                        const isFirstHeading = index === 0 || (prevLine === '' && index > 0);
                        
                        // Skip empty lines
                        if (!cleanLine) {
                          return <br key={index} />;
                        }
                        
                        // Format headings (lines that were markdown headings or bold text)
                        if (line.trim().match(/^#{1,6}\s+/) || (line.trim().startsWith('**') && line.trim().endsWith('**'))) {
                          // Reduce top margin for first heading or headings after empty lines
                          const topMargin = isFirstHeading ? 'mt-2' : 'mt-4';
                          return (
                            <h4 key={index} className={`text-sage-400 font-semibold ${topMargin} mb-2 text-lg`}>
                              {cleanLine}
                            </h4>
                          );
                        }
                        
                        // Format numbered lists (1., 2., etc.)
                        if (cleanLine.match(/^\d+\.\s+/)) {
                          const number = cleanLine.match(/^\d+\./)?.[0];
                          const text = cleanLine.replace(/^\d+\.\s+/, '');
                          // Reduce top margin if it's the first item after a heading
                          const topMargin = prevLine === '' || prevLine.match(/^#{1,6}\s+/) ? 'mt-1' : 'mt-0';
                          return (
                            <div key={index} className={`ml-4 mb-2 text-gray-300 ${topMargin}`}>
                              <span className="text-sage-400 mr-2">{number}</span>
                              {text}
                            </div>
                          );
                        }
                        
                        // Format bullet points
                        if (cleanLine.startsWith('-') || cleanLine.startsWith('•')) {
                          return (
                            <div key={index} className="ml-4 mb-2 text-gray-300">
                              <span className="text-sage-400 mr-2">•</span>
                              {cleanLine.replace(/^[-•]\s*/, '')}
                            </div>
                          );
                        }
                        
                        // Regular text
                        return (
                          <p key={index} className="mb-3 text-gray-300">
                            {cleanLine}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400">
                  Unable to load analysis. Please try again.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

