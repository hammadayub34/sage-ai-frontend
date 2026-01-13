'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChartIcon, CalendarIcon, ShopfloorsIcon, ChevronDownIcon, ChevronRightIcon, AlertIcon, ClockIcon, TrendingUpIcon } from '@/components/Icons';
import { toast } from 'react-toastify';

interface Shift {
  name: string;
  startTime: string;
  endTime: string;
  _id?: string;
}

interface Lab {
  _id: string;
  name: string;
  shifts?: Shift[];
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
  const [wiseAnalysisExpanded, setWiseAnalysisExpanded] = useState(true); // Auto-expand by default
  const [wiseAnalysis, setWiseAnalysis] = useState<string | null>(null);
  const [loadingWiseAnalysis, setLoadingWiseAnalysis] = useState(false);
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [downtimeIncidentsCount, setDowntimeIncidentsCount] = useState<number>(0);
  const [loadingDowntimeIncidents, setLoadingDowntimeIncidents] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [labShifts, setLabShifts] = useState<Shift[]>([]);
  const [shiftUtilization, setShiftUtilization] = useState<any>(null);
  const [loadingShiftUtilization, setLoadingShiftUtilization] = useState(false);
  const fetchingWiseAnalysisRef = useRef(false);

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

  const fetchLabWithShifts = useCallback(async (labId: string) => {
    try {
      const response = await fetch(`/api/labs`);
      if (!response.ok) {
        throw new Error('Failed to fetch lab details');
      }
      const data = await response.json();
      if (data.success && data.labs) {
        const lab = data.labs.find((l: any) => {
          const lId = l._id?.toString() || l._id;
          const selectedId = labId?.toString() || labId;
          return lId === selectedId;
        });
        
        if (lab && lab.shifts && Array.isArray(lab.shifts) && lab.shifts.length > 0) {
          setLabShifts(lab.shifts);
          // Auto-select first shift
          setSelectedShift(lab.shifts[0].name);
          console.log('[AI Insights] Lab shifts:', lab.shifts);
        } else {
          setLabShifts([]);
          setSelectedShift('');
          console.log('[AI Insights] No shifts found for lab:', lab?.name);
        }
      }
    } catch (error: any) {
      console.error('Error fetching lab shifts:', error);
      setLabShifts([]);
      setSelectedShift('');
    }
  }, []);

  // Fetch lab details with shifts when lab is selected
  useEffect(() => {
    if (selectedLabId) {
      fetchLabWithShifts(selectedLabId);
    } else {
      setLabShifts([]);
      setSelectedShift('');
      setShiftUtilization(null);
    }
  }, [selectedLabId, fetchLabWithShifts]);

  // Fetch shift utilization data
  const fetchShiftUtilization = useCallback(async (labId: string, shiftName: string) => {
    setLoadingShiftUtilization(true);
    try {
      const response = await fetch(`/api/shift-utilization?labId=${labId}&shiftName=${shiftName}&days=30`);
      if (!response.ok) {
        throw new Error('Failed to fetch shift utilization');
      }
      const data = await response.json();
      if (data.success) {
        setShiftUtilization(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch shift utilization');
      }
    } catch (error: any) {
      console.error('Error fetching shift utilization:', error);
      toast.error('Failed to load shift utilization data');
      setShiftUtilization(null);
    } finally {
      setLoadingShiftUtilization(false);
    }
  }, []);

  // Fetch shift utilization when shift is selected
  useEffect(() => {
    if (selectedLabId && selectedShift) {
      fetchShiftUtilization(selectedLabId, selectedShift);
    } else {
      setShiftUtilization(null);
    }
  }, [selectedLabId, selectedShift, fetchShiftUtilization]);

  // Optimized: Fetch all data for selected lab in parallel
  useEffect(() => {
    if (!selectedLabId) {
      setMachines([]);
      setMaintenanceStats(null);
      setAlertsCount(0);
      setDowntimeIncidentsCount(0);
      setWiseAnalysis(null);
      setWiseAnalysisExpanded(false);
      return;
    }

    // Reset wise analysis when lab or shift changes (but keep expanded)
    setWiseAnalysis(null);
    setWiseAnalysisExpanded(true); // Keep expanded when lab/shift changes
    setLoadingWiseAnalysis(false);
    fetchingWiseAnalysisRef.current = false;

    // Fetch all data in parallel (will use shift-specific data if shift is selected)
    fetchAllLabData(selectedLabId, selectedShift);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLabId, selectedShift]);

  // Optimized: Single function to fetch all lab data in parallel
  const fetchAllLabData = async (labId: string, shiftName?: string) => {
    setLoadingStats(true);
    setLoadingAlerts(true);
    setLoadingDowntimeIncidents(true);

    try {
      // Step 1: Fetch machines once (used by all other functions)
      const machinesResponse = await fetch(`/api/machines?labId=${labId}`);
      if (!machinesResponse.ok) {
        throw new Error('Failed to fetch machines');
      }
      const machinesData = await machinesResponse.json();
      const labMachines = machinesData.machines || [];
      const machineIds = labMachines.map((m: Machine) => m._id);
      
      setMachines(labMachines);

      if (machineIds.length === 0) {
        // No machines - set all stats to zero (uptime is 0% since no machines to monitor)
        setMaintenanceStats({
          totalMachines: 0,
          scheduledMaintenanceCount: 0,
          machinesWithMaintenance: [],
          totalDowntime: 0,
          totalUptime: 0,
          downtimePercentage: 0,
          uptimePercentage: 0, // 0% when no machines (not applicable)
        });
        setAlertsCount(0);
        setDowntimeIncidentsCount(0);
        setLoadingStats(false);
        setLoadingAlerts(false);
        setLoadingDowntimeIncidents(false);
        return;
      }

      // Step 2: Fetch all independent data in parallel
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [workOrdersData, alertsResults] = await Promise.all([
        // Work orders
        fetch('/api/work-orders').then(res => res.ok ? res.json() : { data: [] }),
        
        // Alerts (parallel for all machines)
        Promise.all(
          machineIds.map(async (machineId: string) => {
            try {
              const params = new URLSearchParams();
              params.append('machineId', machineId);
              params.append('limit', '1000');
              params.append('startDate', oneMonthAgo.toISOString());
              params.append('endDate', now.toISOString());
              
              const res = await fetch(`/api/alarm-events?${params.toString()}`);
              if (res.ok) {
                const data = await res.json();
                return data.alerts?.length || 0;
              }
            } catch (error) {
              console.error(`Error fetching alerts for machine ${machineId}:`, error);
            }
            return 0;
          })
        ),
      ]);

      // Process work orders
      const allWorkOrders = workOrdersData.data || [];
      const relevantWorkOrders = allWorkOrders.filter((wo: any) => {
        const workOrderDate = new Date(wo.createdAt || wo._time);
        return workOrderDate >= oneMonthAgo && machineIds.includes(wo.machineId);
      });
      const machinesWithMaintenance = new Set<string>(
        relevantWorkOrders.map((wo: any) => wo.machineId)
      );

      // Step 3: Get downtime from shift utilization if shift is selected, otherwise aggregate all shifts
      let totalDowntime = 0;
      let totalUptime = 0;
      let totalTimePeriod = 0;
      let totalIncidents = 0;

      const currentShift = shiftName; // Use parameter, not closure
      if (currentShift) {
        // Use shift-specific downtime from shift utilization
        try {
          const shiftUtilResponse = await fetch(`/api/shift-utilization?labId=${labId}&shiftName=${currentShift}&days=30`);
          if (shiftUtilResponse.ok) {
            const shiftUtilData = await shiftUtilResponse.json();
            if (shiftUtilData.success && shiftUtilData.data) {
              // Convert hours to seconds
              const downtimeHours = shiftUtilData.data.totalNonProductiveHours || 0;
              const scheduledHours = shiftUtilData.data.totalScheduledHours || 0;
              const productiveHours = shiftUtilData.data.totalProductiveHours || 0;
              const idleHours = shiftUtilData.data.totalIdleHours || 0;
              
              totalDowntime = downtimeHours * 3600; // Convert to seconds
              totalUptime = (productiveHours + idleHours) * 3600; // Productive + idle = uptime
              totalTimePeriod = scheduledHours * 3600;
              
              // Count incidents from shift utilization (sum of all machines' records)
              totalIncidents = shiftUtilData.data.machineUtilizations.reduce((sum: number, m: any) => sum + (m.recordCount || 0), 0);
            }
          }
        } catch (error) {
          console.error('Error fetching shift utilization for downtime:', error);
        }
      } else {
        // No shift selected - aggregate all shifts for the lab
        try {
          // Get all shifts for this lab
          const labsResponse = await fetch('/api/labs');
          if (labsResponse.ok) {
            const labsData = await labsResponse.json();
            if (labsData.success && labsData.labs) {
              const lab = labsData.labs.find((l: any) => {
                const lId = l._id?.toString() || l._id;
                const selectedId = labId?.toString() || labId;
                return lId === selectedId;
              });
              
              if (lab && lab.shifts && lab.shifts.length > 0) {
                // Aggregate downtime across all shifts
                const shiftPromises = lab.shifts.map(async (shift: Shift) => {
                  try {
                    const res = await fetch(`/api/shift-utilization?labId=${labId}&shiftName=${shift.name}&days=30`);
                    if (res.ok) {
                      const data = await res.json();
                      if (data.success && data.data) {
                        return {
                          downtime: (data.data.totalNonProductiveHours || 0) * 3600,
                          scheduled: (data.data.totalScheduledHours || 0) * 3600,
                          productive: (data.data.totalProductiveHours || 0) * 3600,
                          idle: (data.data.totalIdleHours || 0) * 3600,
                          incidents: data.data.machineUtilizations.reduce((sum: number, m: any) => sum + (m.recordCount || 0), 0),
                        };
                      }
                    }
                  } catch (error) {
                    console.error(`Error fetching shift ${shift.name}:`, error);
                  }
                  return { downtime: 0, scheduled: 0, productive: 0, idle: 0, incidents: 0 };
                });
                
                const shiftResults = await Promise.all(shiftPromises);
                shiftResults.forEach(result => {
                  totalDowntime += result.downtime;
                  totalUptime += (result.productive + result.idle);
                  totalTimePeriod += result.scheduled;
                  totalIncidents += result.incidents;
                });
              }
            }
          }
        } catch (error) {
          console.error('Error aggregating shifts for downtime:', error);
        }
      }

      // If no shift utilization data exists, fall back to InfluxDB downtime calculation
      if (totalTimePeriod === 0 && machineIds.length > 0) {
        console.log('[AI Insights] No shift utilization data found, falling back to InfluxDB downtime calculation');
        try {
          // Fetch downtime from InfluxDB for all machines and aggregate
          const downtimePromises = machineIds.map(async (machineId: string) => {
            try {
              const downtimeRes = await fetch(`/api/influxdb/downtime?machineId=${machineId}&timeRange=-30d`);
              if (downtimeRes.ok) {
                const downtimeData = await downtimeRes.json();
                if (downtimeData.totalDowntime !== undefined && downtimeData.totalUptime !== undefined) {
                  return {
                    downtime: downtimeData.totalDowntime || 0,
                    uptime: downtimeData.totalUptime || 0,
                    timePeriod: (downtimeData.totalDowntime || 0) + (downtimeData.totalUptime || 0),
                    incidents: downtimeData.incidentCount || 0,
                  };
                }
              }
            } catch (error) {
              console.error(`Error fetching InfluxDB downtime for machine ${machineId}:`, error);
            }
            return { downtime: 0, uptime: 0, timePeriod: 0, incidents: 0 };
          });
          
          const downtimeResults = await Promise.all(downtimePromises);
          downtimeResults.forEach(result => {
            totalDowntime += result.downtime;
            totalUptime += result.uptime;
            totalTimePeriod += result.timePeriod;
            totalIncidents += result.incidents;
          });
          
          // If still no data from InfluxDB, assume machine is not running
          if (totalTimePeriod === 0) {
            const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
            totalTimePeriod = thirtyDaysInSeconds * machineIds.length;
            totalDowntime = totalTimePeriod; // Assume 100% downtime (machine not running) if no data at all
            totalUptime = 0;
          }
        } catch (error) {
          console.error('Error fetching InfluxDB downtime as fallback:', error);
          // If InfluxDB also fails, assume machine is not running
          const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
          totalTimePeriod = thirtyDaysInSeconds * machineIds.length;
          totalDowntime = totalTimePeriod; // Assume 100% downtime (machine not running) if no data at all
          totalUptime = 0;
        }
      }

      // Calculate percentages
      const downtimePercentage = totalTimePeriod > 0 ? (totalDowntime / totalTimePeriod) * 100 : 0;
      const uptimePercentage = machineIds.length > 0 
        ? (totalTimePeriod > 0 ? (totalUptime / totalTimePeriod) * 100 : 100)
        : 0; // 0% if no machines (not applicable)

      // Aggregate alerts
      const totalAlerts = alertsResults.reduce((sum, count) => sum + count, 0);

      // Update all state
      setMaintenanceStats({
        totalMachines: labMachines.length,
        scheduledMaintenanceCount: relevantWorkOrders.length,
        machinesWithMaintenance: Array.from(machinesWithMaintenance),
        totalDowntime,
        totalUptime,
        downtimePercentage,
        uptimePercentage,
      });
      setAlertsCount(totalAlerts);
      setDowntimeIncidentsCount(totalIncidents);

    } catch (error: any) {
      console.error('Error fetching lab data:', error);
      toast.error('Failed to load lab data');
      
      // Set fallback values
      setMaintenanceStats({
        totalMachines: machines.length,
        scheduledMaintenanceCount: 0,
        machinesWithMaintenance: [],
        totalDowntime: 0,
        totalUptime: 0,
        downtimePercentage: 0,
        uptimePercentage: 100,
      });
      setAlertsCount(0);
      setDowntimeIncidentsCount(0);
    } finally {
      setLoadingStats(false);
      setLoadingAlerts(false);
      setLoadingDowntimeIncidents(false);
    }
  };

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

  // Format shift name: convert underscores to spaces and capitalize properly
  // Examples: "SHIFT_A" -> "Shift A", "shift_b" -> "Shift B"
  const formatShiftName = (shiftName: string): string => {
    if (!shiftName) return '';
    return shiftName
      .replace(/_/g, ' ')  // Replace underscores with spaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Lazy load Wise Analysis only when user expands the section
  const fetchWiseAnalysis = useCallback(async () => {
    // Prevent duplicate calls
    if (fetchingWiseAnalysisRef.current) {
      return;
    }

    const currentSelectedLab = labs.find(lab => lab._id === selectedLabId);
    if (!maintenanceStats || !currentSelectedLab) {
      return; // Don't fetch if no data
    }

    fetchingWiseAnalysisRef.current = true;
    setLoadingWiseAnalysis(true);
    setWiseAnalysis(null); // Clear previous analysis completely
    
    try {
      // Prepare request body with shift information and utilization data
      const requestBody: any = {
        labName: currentSelectedLab.name,
        totalMachines: maintenanceStats.totalMachines,
        scheduledMaintenanceCount: maintenanceStats.scheduledMaintenanceCount,
        machinesWithMaintenance: maintenanceStats.machinesWithMaintenance.length,
        totalDowntime: maintenanceStats.totalDowntime,
        totalUptime: maintenanceStats.totalUptime,
        downtimePercentage: maintenanceStats.downtimePercentage,
        uptimePercentage: maintenanceStats.uptimePercentage,
        timePeriod: 'Last Month',
        alertsCount: alertsCount,
        downtimeIncidentsCount: downtimeIncidentsCount,
      };

      // Add shift-specific data if a shift is selected
      if (selectedShift && shiftUtilization) {
        requestBody.shiftName = selectedShift;
        requestBody.shiftUtilization = {
          averageUtilization: shiftUtilization.averageUtilization,
          totalProductiveHours: shiftUtilization.totalProductiveHours,
          totalDowntimeHours: shiftUtilization.totalNonProductiveHours,
          totalIdleHours: shiftUtilization.totalIdleHours,
          totalScheduledHours: shiftUtilization.totalScheduledHours,
          machinesWithData: shiftUtilization.machinesWithData,
        };
      }

      const response = await fetch('/api/ai-insights/wise-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
      fetchingWiseAnalysisRef.current = false;
    } catch (error: any) {
      console.error('Error fetching wise analysis:', error);
      toast.error('Failed to generate analysis');
      setWiseAnalysis('Unable to generate analysis at this time. Please try again later.');
      setLoadingWiseAnalysis(false);
      fetchingWiseAnalysisRef.current = false;
    }
  }, [selectedLabId, labs, maintenanceStats, selectedShift, shiftUtilization, alertsCount, downtimeIncidentsCount]);

  // Handle expand/collapse of Wise Analysis section - lazy load on expand
  const handleWiseAnalysisToggle = () => {
    setWiseAnalysisExpanded(prev => !prev);
  };

  // Auto-fetch wise analysis when data is available (auto-load on page load)
  useEffect(() => {
    // Only fetch when we have maintenance stats and not already loading/fetched
    if (loadingWiseAnalysis || wiseAnalysis || !maintenanceStats) {
      return;
    }

    // If shift is selected, wait for shift utilization data
    if (selectedShift) {
      if (shiftUtilization) {
        fetchWiseAnalysis();
      }
    } else {
      // No shift selected, fetch immediately
      fetchWiseAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShift, shiftUtilization, maintenanceStats, loadingWiseAnalysis, fetchWiseAnalysis]);

  // Early return AFTER all hooks are declared
  if (loading) {
    return (
      <div className="bg-dark-bg text-dark-text p-6 min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-dark-bg text-dark-text p-6 min-h-screen">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <ChartIcon className="w-8 h-8 text-sage-400" />
          <h1 className="heading-inter heading-inter-lg">AI Insights</h1>
        </div>

        {/* Lab Selection */}
        <div className="flex items-center gap-4 mt-3">
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

      {/* Shift Tabs - Right Side, Above Performance */}
      {selectedLabId && labShifts.length > 0 && (
        <div className="mt-4 flex justify-end">
          {labShifts.map((shift) => (
            <button
              key={shift.name}
              onClick={() => setSelectedShift(shift.name)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                selectedShift === shift.name
                  ? 'text-sage-400 border-b-2 border-sage-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {formatShiftName(shift.name)}
            </button>
          ))}
        </div>
      )}

      {/* Wise Analysis Section - First */}
      {selectedLabId && maintenanceStats && (
        <div key={selectedLabId} className="mt-4 bg-dark-panel border border-dark-border rounded-lg overflow-hidden">
          {/* Collapsible Header */}
          <button
            onClick={handleWiseAnalysisToggle}
            className="w-full flex items-center justify-between p-4 hover:bg-dark-bg/50 transition-colors"
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
            <div className="px-6 pb-4 border-t border-dark-border">
              {loadingWiseAnalysis || (!wiseAnalysis && selectedLabId) ? (
                <div className="py-6 flex items-center justify-center">
                  <div className="text-gray-400 animate-pulse">Wise Guy gathering performance insights...</div>
                </div>
              ) : wiseAnalysis ? (
                <div className="pt-4">
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
                          const topMargin = prevLine === '' || prevLine.match(/^#{1,6}\s+/) ? 'mt-2' : 'mt-1';
                          return (
                            <div key={index} className={`flex items-start ${topMargin} mb-2 text-gray-300`}>
                              <span className="text-sage-400 mr-3 mt-0.5 flex-shrink-0">{number}</span>
                              <span className="flex-1 leading-relaxed">{text}</span>
                            </div>
                          );
                        }
                        
                        // Format bullet points
                        if (cleanLine.match(/^[-•*]\s/)) {
                          const bulletText = cleanLine.replace(/^[-•*]\s+/, '');
                          const topMargin = prevLine === '' || prevLine.match(/^#{1,6}\s+/) ? 'mt-2' : 'mt-1';
                          return (
                            <div key={index} className={`flex items-start ${topMargin} mb-2 text-gray-300`}>
                              <span className="text-sage-400 mr-3 mt-0.5 flex-shrink-0">•</span>
                              <span className="flex-1 leading-relaxed">{bulletText}</span>
                            </div>
                          );
                        }
                        
                        // Regular text
                        return (
                          <p key={index} className="mb-3 text-gray-300 leading-relaxed">
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

      {/* Performance Section */}
      {selectedLabId && (
        <div className="mt-4 bg-dark-panel border border-dark-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="heading-inter heading-inter-sm text-white flex items-center gap-2">
              <ClockIcon className="w-5 h-5" />
              Performance
            </h2>
            <span className="text-xs text-gray-500">Last Month</span>
          </div>

          {loadingStats ? (
            // Loading skeleton
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="h-4 bg-dark-border rounded w-20 mb-3 animate-pulse"></div>
                  <div className="h-10 bg-dark-border rounded w-24 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-dark-border rounded w-32 animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : maintenanceStats ? (
            // Key Metrics Grid
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
          ) : null}
        </div>
      )}

      {/* Shift Utilization Section - Show when shift is selected */}
      {selectedLabId && selectedShift && (
        <div className="mt-4 bg-dark-panel border border-dark-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="heading-inter heading-inter-sm text-white flex items-center gap-2">
              <ClockIcon className="w-5 h-5" />
              Shift Utilization - {formatShiftName(selectedShift)}
            </h2>
            <span className="text-xs text-gray-500">Last Month</span>
          </div>

          {loadingShiftUtilization ? (
            // Loading skeleton
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="h-4 bg-dark-border rounded w-24 mb-3 animate-pulse"></div>
                  <div className="h-10 bg-dark-border rounded w-20 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-dark-border rounded w-28 animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : shiftUtilization ? (
            <>
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {/* Average Utilization */}
                <div className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="text-gray-400 text-sm mb-1">Avg Utilization</div>
                  <div className="text-3xl font-bold text-sage-400">
                    {shiftUtilization.averageUtilization.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {shiftUtilization.machinesWithData} of {shiftUtilization.totalMachines} machines
                  </div>
                </div>

                {/* Productive Hours */}
                <div className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="text-gray-400 text-sm mb-1">Productive Hours</div>
                  <div className="text-3xl font-bold text-green-400">
                    {shiftUtilization.totalProductiveHours.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total hours
                  </div>
                </div>

                {/* Downtime Hours */}
                <div className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="text-gray-400 text-sm mb-1">Downtime Hours</div>
                  <div className="text-3xl font-bold text-red-400">
                    {shiftUtilization.totalNonProductiveHours.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total hours
                  </div>
                </div>

                {/* Idle Hours */}
                <div className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="text-gray-400 text-sm mb-1">Idle Hours</div>
                  <div className="text-3xl font-bold text-yellow-400">
                    {shiftUtilization.totalIdleHours.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total hours
                  </div>
                </div>

                {/* Scheduled Hours */}
                <div className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="text-gray-400 text-sm mb-1">Scheduled Hours</div>
                  <div className="text-3xl font-bold text-white">
                    {shiftUtilization.totalScheduledHours.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total hours
                  </div>
                </div>
              </div>

              {/* Machine-wise Utilization Table */}
              {shiftUtilization.machineUtilizations.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-gray-300 text-sm font-semibold mb-3">Machine-wise Utilization</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-dark-border">
                          <th className="text-left py-2 px-4 text-gray-400 text-sm font-medium">Machine</th>
                          <th className="text-right py-2 px-4 text-gray-400 text-sm font-medium">Utilization</th>
                          <th className="text-right py-2 px-4 text-gray-400 text-sm font-medium">Productive</th>
                          <th className="text-right py-2 px-4 text-gray-400 text-sm font-medium">Downtime</th>
                          <th className="text-right py-2 px-4 text-gray-400 text-sm font-medium">Idle</th>
                          <th className="text-right py-2 px-4 text-gray-400 text-sm font-medium">Scheduled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shiftUtilization.machineUtilizations.map((machine: any, index: number) => (
                          <tr key={index} className="border-b border-dark-border/50 hover:bg-dark-bg/50">
                            <td className="py-2 px-4 text-gray-300 text-sm">{machine.machineName}</td>
                            <td className="py-2 px-4 text-right text-sm">
                              <span className={`font-semibold ${
                                machine.averageUtilization >= 70 ? 'text-green-400' :
                                machine.averageUtilization >= 50 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {machine.averageUtilization.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right text-gray-300 text-sm">
                              {machine.totalProductiveHours.toFixed(1)}h
                            </td>
                            <td className="py-2 px-4 text-right text-red-400 text-sm font-medium">
                              {machine.totalNonProductiveHours.toFixed(1)}h
                            </td>
                            <td className="py-2 px-4 text-right text-gray-300 text-sm">
                              {machine.totalIdleHours.toFixed(1)}h
                            </td>
                            <td className="py-2 px-4 text-right text-gray-300 text-sm">
                              {machine.totalScheduledHours.toFixed(1)}h
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No utilization data available for this shift
            </div>
          )}
        </div>
      )}

      {/* Events Section */}
      {selectedLabId && (
        <div className="mt-4 bg-dark-panel border border-dark-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="heading-inter heading-inter-sm text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Events
            </h2>
            <span className="text-xs text-gray-500">Last Month</span>
          </div>

          {loadingStats || loadingAlerts || loadingDowntimeIncidents ? (
            // Loading skeleton
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="h-4 bg-dark-border rounded w-24 mb-3 animate-pulse"></div>
                  <div className="h-10 bg-dark-border rounded w-20 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-dark-border rounded w-28 animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : maintenanceStats ? (
            // Key Metrics Grid
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
                <div className="text-3xl font-bold text-yellow-400">
                  {alertsCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Alert events
                </div>
              </div>

              {/* Downtime Incidents */}
              <div className="bg-dark-bg border border-dark-border rounded p-4">
                <div className="text-gray-400 text-sm mb-1">Downtime Incidents</div>
                <div className="text-3xl font-bold text-red-400">
                  {downtimeIncidentsCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {downtimeIncidentsCount === 1 ? 'incident' : 'incidents'}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

