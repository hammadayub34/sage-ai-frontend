'use client';

import { ServiceControlsButton } from '@/components/ServiceControlsButton';
import { TimeSeriesChart } from '@/components/TimeSeriesChart';
import { AlarmHistory } from '@/components/AlarmHistory';
import { AlarmEvents } from '@/components/AlarmEvents';
import { DowntimeStats } from '@/components/DowntimeStats';
import { WorkOrderForm } from '@/components/WorkOrderForm';
import { RefreshIcon, SignalIcon, CalendarIcon, ChevronDownIcon, ChevronRightIcon, CheckIcon, AIIcon } from '@/components/Icons';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { VibrationChart } from '@/components/VibrationChart';
import { ModbusChart } from '@/components/ModbusChart';
import { toast } from 'react-toastify';
import { formatAlarmName } from '@/lib/utils';

interface Lab {
  _id: string;
  name: string;
  description?: string;
}

interface Node {
  mac: string;
  nodeType: string | null;
  sensorType: string | null;
}

interface Machine {
  _id: string;
  machineName: string;
  labId: string;
  status: 'active' | 'inactive';
  description?: string;
  nodes?: Node[];
}

interface WorkOrder {
  workOrderNo: string;
  machineId: string;
  status: string;
  priority: string;
  weekNo: string;
  weekOf: string;
  alarmType: string;
  machineType: string;
  equipmentName: string;
  equipmentNumber: string;
  equipmentLocation: string;
  equipmentDescription: string;
  location: string;
  building: string;
  floor: string;
  room: string;
  specialInstructions: string;
  shop: string;
  vendor: string;
  vendorAddress: string;
  vendorPhone: string;
  vendorContact: string;
  taskNumber: string;
  frequency: string;
  workDescription: string;
  workPerformedBy: string;
  workPerformed: string;
  standardHours: number;
  overtimeHours: number;
  workCompleted: boolean;
  companyName: string;
  createdAt: string;
  parts: any[];
  materials: any[];
}

export default function Dashboard() {
  const router = useRouter();
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [workOrderFormOpen, setWorkOrderFormOpen] = useState(false);
  const [chartTab, setChartTab] = useState<'vibration' | 'pressure' | 'density' | 'flow' | 'temperature' | 'current'>('vibration');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [monitoringAnalysis, setMonitoringAnalysis] = useState<string | null>(null);
  const [loadingMonitoringAnalysis, setLoadingMonitoringAnalysis] = useState(false);
  const [monitoringAnalysisExpanded, setMonitoringAnalysisExpanded] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  // Check if selected machine is CNC Machine A (has Modbus data)
  const isCNCMachineA = selectedMachine?.machineName === 'CNC Machine A' || selectedMachine?._id === '6958155ea4f09743147b22ab';
  const selectedMachineMAC = selectedMachine?.nodes && selectedMachine.nodes.length > 0 ? selectedMachine.nodes[0].mac : '';
  
  // Debug logging
  useEffect(() => {
    console.log('[Dashboard] Selected Machine:', {
      name: selectedMachine?.machineName,
      id: selectedMachine?._id,
      isCNCMachineA,
      macAddress: selectedMachineMAC,
      nodes: selectedMachine?.nodes
    });
  }, [selectedMachine, isCNCMachineA, selectedMachineMAC]);
  
  // Set default tab based on machine type
  useEffect(() => {
    if (isCNCMachineA && chartTab === 'vibration') {
      setChartTab('pressure');
    } else if (!isCNCMachineA && chartTab !== 'vibration' && chartTab !== 'current') {
      setChartTab('vibration');
    }
  }, [isCNCMachineA]);
  
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
      
      // Log response details for debugging
      console.log(`[Dashboard] Labs API response status: ${response.status}`);
      console.log(`[Dashboard] Labs API response ok: ${response.ok}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`[Dashboard] Labs API error (${response.status}):`, errorData);
        toast.error(`Failed to fetch labs: ${errorData.error || `HTTP ${response.status}`}`);
        setLabs([]);
        return;
      }
      
      const data = await response.json();
      console.log(`[Dashboard] Labs API response data:`, data);

      if (data.success) {
        setLabs(data.labs || []);
        // Auto-select Maheen Textiles lab if available, otherwise first lab
        if (data.labs && data.labs.length > 0) {
          const maheenLab = data.labs.find((lab: Lab) => 
            lab.name.toLowerCase().includes('maheen') || lab.name.toLowerCase().includes('textiles')
          );
          const labToSelect = maheenLab || data.labs[0];
          setSelectedLabId(labToSelect._id);
          fetchMachinesForLab(labToSelect._id);
        } else {
          console.warn('[Dashboard] No labs found for user');
          toast.warning('No labs found for your account');
        }
      } else {
        console.error('[Dashboard] Failed to fetch labs:', data.error);
        toast.error(`Failed to fetch labs: ${data.error || 'Unknown error'}`);
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
        // Auto-select Polyol Pump Motor if available, otherwise first machine
        if (data.machines && data.machines.length > 0) {
          const polyolMotor = data.machines.find((machine: Machine) => 
            machine.machineName?.toLowerCase().includes('polyol') && 
            machine.machineName?.toLowerCase().includes('pump')
          );
          const machineToSelect = polyolMotor || data.machines[0];
          setSelectedMachineId(machineToSelect._id);
          setSelectedMachine(machineToSelect);
        } else {
          setSelectedMachineId('');
          setSelectedMachine(null);
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
    const machineId = e.target.value;
    setSelectedMachineId(machineId);
    const machine = machines.find(m => m._id === machineId) || null;
    setSelectedMachine(machine);
    // Fetch work orders for the selected machine
    if (machineId) {
      fetchWorkOrdersForMachine(machineId);
    } else {
      setWorkOrders([]);
    }
  };

  // Fetch work orders for a specific machine
  const fetchWorkOrdersForMachine = async (machineId: string) => {
    setLoadingWorkOrders(true);
    try {
      const response = await fetch(`/api/work-orders?machineId=${machineId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch work orders');
      }
      const data = await response.json();
      setWorkOrders(data.data || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error('Failed to load work orders');
      setWorkOrders([]);
    } finally {
      setLoadingWorkOrders(false);
    }
  };

  // Fetch work orders when machine is selected initially
  useEffect(() => {
    if (selectedMachineId) {
      fetchWorkOrdersForMachine(selectedMachineId);
    }
  }, [selectedMachineId]);

  const toggleExpand = (workOrderNo: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workOrderNo)) {
        newSet.delete(workOrderNo);
      } else {
        newSet.add(workOrderNo);
      }
      return newSet;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'high':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-sage-400 bg-sage-500/10 border-sage-500/30';
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  const queryClient = useQueryClient();

  // Fetch shift utilization data for the selected machine across all shifts
  const { data: shiftUtilizationData, isLoading: isLoadingShiftUtilization } = useQuery({
    queryKey: ['shift-utilization', selectedLabId, selectedMachineId, selectedTimeRange],
    queryFn: async () => {
      if (!selectedLabId || !selectedMachineId || !selectedMachine) return null;
      
      try {
        // Get lab details to fetch all shifts
        const labsResponse = await fetch('/api/labs');
        if (!labsResponse.ok) return null;
        
        const labsData = await labsResponse.json();
        if (!labsData.success || !labsData.labs) return null;
        
        const lab = labsData.labs.find((l: Lab) => {
          const lId = l._id?.toString() || l._id;
          const selectedId = selectedLabId?.toString() || selectedLabId;
          return lId === selectedId;
        });
        
        if (!lab || !lab.shifts || lab.shifts.length === 0) return null;
        
        // Calculate date range based on selectedTimeRange
        const endDate = new Date();
        const startDate = new Date();
        
        if (selectedTimeRange === '24h') {
          startDate.setDate(startDate.getDate() - 1);
        } else if (selectedTimeRange === '7d') {
          startDate.setDate(startDate.getDate() - 7);
        } else if (selectedTimeRange === '30d') {
          startDate.setDate(startDate.getDate() - 30);
        }
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // Fetch shift utilization for each shift and aggregate
        const shiftPromises = lab.shifts.map(async (shift: any) => {
          try {
            const response = await fetch(
              `/api/shift-utilization?labId=${selectedLabId}&shiftName=${shift.name}&startDate=${startDateStr}&endDate=${endDateStr}`
            );
            if (!response.ok) return null;
            
            const result = await response.json();
            if (!result.success || !result.data) return null;
            
            // Find data for the selected machine
            const machineData = result.data.machineUtilizations?.find(
              (m: any) => m.machineName === selectedMachine.machineName
            );
            
            if (machineData) {
              return {
                totalScheduledHours: machineData.totalScheduledHours || 0,
                totalProductiveHours: machineData.totalProductiveHours || 0,
                totalIdleHours: machineData.totalIdleHours || 0,
                totalNonProductiveHours: machineData.totalNonProductiveHours || 0,
              };
            }
            return null;
          } catch (error) {
            console.error(`Error fetching shift ${shift.name}:`, error);
            return null;
          }
        });
        
        const shiftResults = await Promise.all(shiftPromises);
        
        // Aggregate across all shifts
        const aggregated = shiftResults.reduce(
          (acc, shiftData) => {
            if (shiftData) {
              acc.totalScheduledHours += shiftData.totalScheduledHours;
              acc.totalProductiveHours += shiftData.totalProductiveHours;
              acc.totalIdleHours += shiftData.totalIdleHours;
              acc.totalNonProductiveHours += shiftData.totalNonProductiveHours;
            }
            return acc;
          },
          {
            totalScheduledHours: 0,
            totalProductiveHours: 0,
            totalIdleHours: 0,
            totalNonProductiveHours: 0,
          }
        );
        
        // Only return if we have scheduled hours
        return aggregated.totalScheduledHours > 0 ? aggregated : null;
      } catch (error) {
        console.error('Error fetching shift utilization:', error);
        return null;
      }
    },
    enabled: !!selectedLabId && !!selectedMachineId && !!selectedMachine,
  });

  // Fetch downtime stats for analysis (fallback when shift utilization is not available)
  const { data: downtimeData } = useQuery({
    queryKey: ['downtime', selectedMachineId, selectedTimeRange],
    queryFn: async () => {
      if (!selectedMachineId) return null;
      const response = await fetch(`/api/influxdb/downtime?machineId=${selectedMachineId}&timeRange=-${selectedTimeRange}`);
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    },
    enabled: !!selectedMachineId && !shiftUtilizationData, // Only fetch if shift utilization is not available
  });

  // Fetch alarm history for analysis
  const { data: alarmHistoryData } = useQuery({
    queryKey: ['alarm-history', selectedMachineId, '-24h'],
    queryFn: async () => {
      if (!selectedMachineId) return {};
      try {
        const { queryAlarmHistory } = await import('@/lib/influxdb');
        return await queryAlarmHistory(selectedMachineId, '-24h');
      } catch (error) {
        console.error('Error fetching alarm history:', error);
        return {};
      }
    },
    enabled: !!selectedMachineId,
  });

  // Fetch vibration data to check availability and which axes have data
  const { data: vibrationDataOverall, isLoading: isLoadingVibration } = useQuery({
    queryKey: ['vibration', selectedMachineId, `-${selectedTimeRange}`, 'raw', 'vibration'],
    queryFn: async () => {
      if (!selectedMachineId || isCNCMachineA) return null;
      try {
        const response = await fetch(`/api/influxdb/vibration?machineId=${selectedMachineId}&timeRange=-${selectedTimeRange}&windowPeriod=raw&axis=vibration`);
        if (!response.ok) return null;
        const result = await response.json();
        return result.data || [];
      } catch (error) {
        return null;
      }
    },
    enabled: !!selectedMachineId && !isCNCMachineA && chartTab === 'vibration',
  });

  // Check if vibration data exists and get basic info
  const vibrationInfo = useMemo(() => {
    // If not on vibration tab or it's a CNC machine, no vibration data
    if (isCNCMachineA || chartTab !== 'vibration') {
      return { hasData: false, dataPoints: 0, axes: [], timeRange: null };
    }
    
    // If still loading, we don't know yet
    if (isLoadingVibration) {
      return { hasData: false, dataPoints: 0, axes: [], timeRange: selectedTimeRange };
    }
    
    // Check if we have data
    if (!vibrationDataOverall || !Array.isArray(vibrationDataOverall) || vibrationDataOverall.length === 0) {
      return { hasData: false, dataPoints: 0, axes: [], timeRange: selectedTimeRange };
    }
    
    try {
      const hasData = vibrationDataOverall.some((d: any) => d && d.value > 0);
      const dataPoints = vibrationDataOverall.length;
      
      // Common axes that are typically available when vibration data exists
      const commonAxes = ['vibration', 'x_vibration', 'y_vibration', 'x_acc', 'y_acc', 'z_acc'];
      
      return {
        hasData,
        dataPoints,
        axes: hasData ? commonAxes : [],
        timeRange: selectedTimeRange,
      };
    } catch (error) {
      return { hasData: false, dataPoints: 0, axes: [], timeRange: selectedTimeRange };
    }
  }, [vibrationDataOverall, isLoadingVibration, isCNCMachineA, chartTab, selectedTimeRange]);

  // Fetch monitoring analysis
  const fetchMonitoringAnalysis = async () => {
    // Check if we have either MongoDB data or InfluxDB data
    const hasMongoData = shiftUtilizationData && shiftUtilizationData.totalScheduledHours > 0;
    const hasInfluxData = downtimeData && (downtimeData.downtimePercentage !== undefined || downtimeData.totalDowntime !== undefined);
    
    if (!selectedMachineId || !selectedLabId || (!hasMongoData && !hasInfluxData)) {
      console.log('[Monitoring Analysis] Missing required data:', {
        selectedMachineId,
        hasMongoData,
        hasInfluxData,
        selectedLabId
      });
      return;
    }
    
    const machine = selectedMachine || machines.find(m => m._id === selectedMachineId);
    if (!machine) {
      console.log('[Monitoring Analysis] Machine not found:', selectedMachineId);
      return;
    }

    // Get lab name - ensure we have the correct lab
    const selectedLab = labs.find(lab => lab._id === selectedLabId);
    if (!selectedLab) {
      console.log('[Monitoring Analysis] Lab not found:', selectedLabId, 'Available labs:', labs.map(l => ({ id: l._id, name: l.name })));
      return;
    }

    const labName = selectedLab.name;
    const machineName = machine.machineName;
    
    // Validate that we have valid names
    if (!machineName || machineName === 'Unknown Machine') {
      console.error('[Monitoring Analysis] Invalid machine name:', machineName, 'Machine object:', machine);
      return;
    }
    
    if (!labName || labName === 'Unknown Lab') {
      console.error('[Monitoring Analysis] Invalid lab name:', labName, 'Lab object:', selectedLab);
      return;
    }
    
    // Log for debugging
    console.log('[Monitoring Analysis] Sending data:', {
      machineName,
      machineId: selectedMachineId,
      labName,
      selectedLabId,
      machineObject: machine,
      labObject: selectedLab
    });

    setLoadingMonitoringAnalysis(true);
    setMonitoringAnalysis(null);

    try {
      const alertsCount = alarmHistoryData ? Object.values(alarmHistoryData).reduce((sum: number, count) => sum + (count as number), 0) : 0;
      const workOrdersCount = workOrders.length;
      
      // Get alarm breakdown
      const alarmBreakdown = alarmHistoryData ? Object.entries(alarmHistoryData)
        .filter(([_, count]) => (count as number) > 0)
        .map(([alarmType, count]) => ({ type: alarmType, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // Top 5 alarms
        : [];

      const formatTimeRange = (range: string): string => {
        const match = range.match(/-(\d+)([hdms])/);
        if (!match) return range;
        const value = parseInt(match[1]);
        const unit = match[2];
        if (unit === 'h') {
          return value === 1 ? 'Last hour' : `Last ${value} hours`;
        } else if (unit === 'd') {
          return value === 1 ? 'Last 24 hours' : `Last ${value} days`;
        }
        return range;
      };

      // Check if vibration data is available
      const hasVibrationData = !isCNCMachineA && chartTab === 'vibration' && vibrationInfo?.hasData;
      const vibrationDataPoints = vibrationInfo?.dataPoints || 0;
      const vibrationAxesAvailable = vibrationInfo?.axes || [];
      const vibrationTimeRange = vibrationInfo?.timeRange || null;
      
      // Format time range for display (for vibration chart, it uses different ranges)
      const formatVibrationTimeRange = (range: string | null): string => {
        if (!range) return '';
        // Vibration chart uses: 5m, 30m, 1h, 24h
        // Main page uses: 24h, 7d, 30d
        // We'll use the main page range for consistency
        const rangeMap: Record<string, string> = {
          '24h': '24 hours',
          '7d': '7 days',
          '30d': '30 days',
          '5m': '5 minutes',
          '30m': '30 minutes',
          '1h': '1 hour',
        };
        return rangeMap[range] || range;
      };

      // Calculate performance values from MongoDB data if available, otherwise use InfluxDB data
      let downtimePercentage: number;
      let uptimePercentage: number;
      let totalDowntime: number;
      let totalUptime: number;
      let incidentCount: number;
      let scheduledHours: number | undefined;

      if (shiftUtilizationData && shiftUtilizationData.totalScheduledHours > 0) {
        // Use MongoDB data - EXACT SAME CALCULATION AS PERFORMANCE SECTION
        const scheduledHoursValue = shiftUtilizationData.totalScheduledHours;
        const downtimeHours = shiftUtilizationData.totalNonProductiveHours;
        const productiveHours = shiftUtilizationData.totalProductiveHours;
        const idleHours = shiftUtilizationData.totalIdleHours;
        
        // Calculate percentages (same as DowntimeStats component)
        const calculatedDowntimePercentage = (downtimeHours / scheduledHoursValue) * 100;
        const calculatedUptimePercentage = ((idleHours + productiveHours) / scheduledHoursValue) * 100;
        
        // Ensure total is exactly 100% (same normalization logic as Performance section)
        const totalPercentage = calculatedDowntimePercentage + calculatedUptimePercentage;
        downtimePercentage = calculatedDowntimePercentage;
        uptimePercentage = totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.1
          ? 100 - calculatedDowntimePercentage
          : calculatedUptimePercentage;
        
        // Convert hours to seconds for API consistency
        totalDowntime = downtimeHours * 3600;
        totalUptime = (idleHours + productiveHours) * 3600;
        
        // Incident count not available from shift utilization, use 0
        incidentCount = 0;
        scheduledHours = scheduledHoursValue;
        
        console.log('[Monitoring Analysis] Using MongoDB data (matching Performance section):', {
          scheduledHours: scheduledHoursValue,
          downtimeHours,
          productiveHours,
          idleHours,
          downtimePercentage: downtimePercentage.toFixed(2),
          uptimePercentage: uptimePercentage.toFixed(2),
          calculatedDowntimePercentage: calculatedDowntimePercentage.toFixed(2),
          calculatedUptimePercentage: calculatedUptimePercentage.toFixed(2),
          totalPercentage: totalPercentage.toFixed(2),
        });
      } else {
        // Fallback to InfluxDB data
        downtimePercentage = downtimeData?.downtimePercentage || 0;
        uptimePercentage = downtimeData?.uptimePercentage || 0;
        totalDowntime = downtimeData?.totalDowntime || 0;
        totalUptime = downtimeData?.totalUptime || 0;
        incidentCount = downtimeData?.incidentCount || 0;
        scheduledHours = undefined;
        
        console.log('[Monitoring Analysis] Using InfluxDB fallback data:', {
          downtimePercentage: downtimePercentage.toFixed(2),
          uptimePercentage: uptimePercentage.toFixed(2),
          incidentCount,
        });
      }

      const requestBody = {
        machineName: machineName,
        machineId: selectedMachineId,
        labName: labName,
        downtimePercentage,
        uptimePercentage,
        totalDowntime,
        totalUptime,
        incidentCount,
        timeRange: formatTimeRange(`-${selectedTimeRange}`),
        alertsCount,
        alarmBreakdown,
        workOrdersCount,
        workOrdersPending: workOrders.filter(wo => wo.status.toLowerCase() === 'pending').length,
        workOrdersCompleted: workOrders.filter(wo => wo.status.toLowerCase() === 'completed').length,
        hasVibrationData,
        vibrationDataPoints,
        vibrationAxesAvailable,
        vibrationTimeRange: vibrationTimeRange ? formatVibrationTimeRange(vibrationTimeRange) : null,
        chartType: isCNCMachineA ? chartTab : (chartTab === 'vibration' ? 'vibration' : 'current'),
        scheduledHours,
      };

      const response = await fetch('/api/monitoring/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analysis');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let analysisText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.type === 'chunk') {
                analysisText += data.content;
                setMonitoringAnalysis(analysisText);
              } else if (data.type === 'done') {
                break;
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching monitoring analysis:', error);
      toast.error('Failed to load analysis');
      setMonitoringAnalysis(null);
    } finally {
      setLoadingMonitoringAnalysis(false);
    }
  };

  // Clear analysis when lab, machine, or time range changes
  useEffect(() => {
    setMonitoringAnalysis(null);
  }, [selectedLabId, selectedMachineId, selectedTimeRange]);

  // Auto-fetch analysis when machine and data are available
  useEffect(() => {
    const hasMongoData = shiftUtilizationData && shiftUtilizationData.totalScheduledHours > 0;
    const hasInfluxData = downtimeData && (downtimeData.downtimePercentage !== undefined || downtimeData.totalDowntime !== undefined);
    
    if (selectedMachineId && selectedLabId && (hasMongoData || hasInfluxData) && !loadingMonitoringAnalysis) {
      fetchMonitoringAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachineId, selectedLabId, selectedTimeRange, shiftUtilizationData, downtimeData, alarmHistoryData, workOrders, vibrationDataOverall, chartTab]);
  
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
          <SignalIcon className="w-6 h-6 text-sage-400" />
          <h1 className="heading-inter heading-inter-lg">Monitoring</h1>
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
            <div className="flex border-b border-dark-border flex-wrap">
              {isCNCMachineA ? (
                // Modbus tabs for CNC Machine A
                <>
                  <button
                    onClick={() => setChartTab('pressure')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      chartTab === 'pressure'
                        ? 'text-sage-400 border-b-2 border-sage-400 bg-dark-bg/50'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Pressure
                  </button>
                  <button
                    onClick={() => setChartTab('flow')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      chartTab === 'flow'
                        ? 'text-sage-400 border-b-2 border-sage-400 bg-dark-bg/50'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Diff Pressure/Freq
                  </button>
                  <button
                    onClick={() => setChartTab('density')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      chartTab === 'density'
                        ? 'text-sage-400 border-b-2 border-sage-400 bg-dark-bg/50'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Instantaneous Flow
                  </button>
                  <button
                    onClick={() => setChartTab('temperature')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      chartTab === 'temperature'
                        ? 'text-sage-400 border-b-2 border-sage-400 bg-dark-bg/50'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Density
                  </button>
                </>
              ) : (
                // Vibration tab for other machines
                <>
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
                </>
              )}
            </div>
            
            {/* Chart Content */}
            <div>
              {isCNCMachineA ? (
                // Modbus charts for CNC Machine A
                <>
                  {chartTab === 'pressure' && (
                    <ModbusChart
                      machineId={selectedMachineId}
                      macAddress={selectedMachineMAC || '10:06:1C:86:F9:54'}
                      field="Pressure"
                      fieldLabel="Pressure"
                      timeRange={`-${selectedTimeRange}`}
                      onTimeRangeChange={setSelectedTimeRange}
                    />
                  )}
                  {chartTab === 'flow' && (
                    <ModbusChart
                      machineId={selectedMachineId}
                      macAddress={selectedMachineMAC || '10:06:1C:86:F9:54'}
                      field="Differential pressure/frequency"
                      fieldLabel="Diff Pressure/Freq"
                      timeRange={`-${selectedTimeRange}`}
                      onTimeRangeChange={setSelectedTimeRange}
                    />
                  )}
                  {chartTab === 'density' && (
                    <ModbusChart
                      machineId={selectedMachineId}
                      macAddress={selectedMachineMAC || '10:06:1C:86:F9:54'}
                      field="Instantaneous_flow"
                      fieldLabel="Instantaneous Flow"
                      timeRange={`-${selectedTimeRange}`}
                      onTimeRangeChange={setSelectedTimeRange}
                    />
                  )}
                  {chartTab === 'temperature' && (
                    <ModbusChart
                      machineId={selectedMachineId}
                      macAddress={selectedMachineMAC || '10:06:1C:86:F9:54'}
                      field="Density"
                      fieldLabel="Density"
                      timeRange={`-${selectedTimeRange}`}
                      onTimeRangeChange={setSelectedTimeRange}
                    />
                  )}
                </>
              ) : (
                // Vibration chart for other machines
                <>
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
                </>
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
          <DowntimeStats 
            machineId={selectedMachineId} 
            timeRange={`-${selectedTimeRange}`}
            shiftUtilizationData={isLoadingShiftUtilization ? undefined : (shiftUtilizationData || null)}
            machineName={selectedMachine?.machineName}
            labId={selectedLabId}
          />
        </div>
      )}

      {/* AI Analysis Section */}
      {selectedMachineId && (
        <div className="mb-6">
          <div className="bg-dark-panel p-6 rounded-lg border border-dark-border">
            <div className="flex items-center gap-2 mb-4">
              <div>
                <h3 className="heading-inter heading-inter-sm flex items-center gap-2">
                  <AIIcon className="w-5 h-5 text-sage-400" />
                  AI Analysis
                </h3>
              </div>
            </div>

            {loadingMonitoringAnalysis ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-sage-400 animate-pulse">
                  <div className="w-4 h-4 border-2 border-sage-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-medium">Gathering insights...</span>
                </div>
              </div>
            ) : monitoringAnalysis ? (
              <div className="pt-4">
                <div className="prose prose-invert max-w-none">
                  <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {monitoringAnalysis.split('\n').map((line, index, array) => {
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
                          <h3 key={index} className={`${topMargin} mb-2 text-white font-semibold text-base`}>
                            {cleanLine}
                          </h3>
                        );
                      }
                      
                      // Regular paragraph
                      return (
                        <p key={index} className="mb-3 last:mb-0">
                          {cleanLine}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-sage-500/10 border border-sage-500/30 rounded text-center">
                <span className="text-sage-400 text-sm">
                  No analysis available
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Work Orders Section */}
      {selectedMachineId && (
        <div className="mb-6">
          <div className="bg-dark-panel border border-dark-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CalendarIcon className="w-6 h-6 text-sage-400" />
              <h2 className="heading-inter heading-inter-sm text-white">Work Orders</h2>
            </div>

            {loadingWorkOrders ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span className="ml-3 text-gray-400">Loading work orders...</span>
              </div>
            ) : workOrders.length === 0 ? (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded text-center">
                <span className="text-gray-400 text-sm">
                  No work orders found for this machine
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {workOrders.map((order) => {
                  const isExpanded = expandedOrders.has(order.workOrderNo);
                  return (
                    <div
                      key={order.workOrderNo}
                      className="bg-dark-bg border border-dark-border rounded-lg hover:border-midnight-300 transition-colors"
                    >
                      {/* Header - Clickable */}
                      <div
                        className="p-6 cursor-pointer"
                        onClick={() => toggleExpand(order.workOrderNo)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {isExpanded ? (
                                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                              )}
                              <h3 className="text-white font-semibold text-lg">{order.workOrderNo}</h3>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(order.priority)}`}
                              >
                                {order.priority}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(order.status)}`}
                              >
                                {order.status ? (order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase()) : 'Unknown'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              {order.equipmentName && (
                                <span>
                                  <span className="font-semibold text-gray-300">Equipment:</span> {order.equipmentName}
                                </span>
                              )}
                              {order.alarmType && (
                                <span>
                                  <span className="font-semibold text-gray-300">Alarm:</span>{' '}
                                  {formatAlarmName(order.alarmType)}
                                </span>
                              )}
                              {order.taskNumber && (
                                <span>
                                  <span className="font-semibold text-gray-300">Task:</span> {order.taskNumber}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm text-gray-400">
                            <div>
                              {order.createdAt ? (
                                <>
                                  {new Date(order.createdAt).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })} {new Date(order.createdAt).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: true 
                                  })}
                                </>
                              ) : (
                                'Date not available'
                              )}
                            </div>
                            {order.weekOf && (
                              <div className="mt-1">Week of: {order.weekOf}</div>
                            )}
                          </div>
                        </div>

                        {!isExpanded && order.workDescription && (
                          <div className="mt-4">
                            <p className="text-gray-300 text-sm">{order.workDescription.substring(0, 200)}...</p>
                          </div>
                        )}

                        {!isExpanded && (
                          <div className="flex items-center gap-6 text-sm text-gray-400 mt-4">
                            {order.standardHours > 0 && (
                              <span>
                                <span className="font-semibold text-gray-300">Hours:</span> {order.standardHours}
                              </span>
                            )}
                            {order.workPerformedBy && (
                              <span>
                                <span className="font-semibold text-gray-300">Performed by:</span> {order.workPerformedBy}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-6 pb-6 border-t border-dark-border pt-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {order.workDescription && (
                              <div className="col-span-2">
                                <span className="font-semibold text-gray-300">Description:</span>
                                <p className="text-gray-400 mt-1">{order.workDescription}</p>
                              </div>
                            )}
                            {order.specialInstructions && (
                              <div className="col-span-2">
                                <span className="font-semibold text-gray-300">Special Instructions:</span>
                                <p className="text-gray-400 mt-1">{order.specialInstructions}</p>
                              </div>
                            )}
                            {order.equipmentLocation && (
                              <div>
                                <span className="font-semibold text-gray-300">Location:</span>
                                <p className="text-gray-400 mt-1">{order.equipmentLocation}</p>
                              </div>
                            )}
                            {order.vendor && (
                              <div>
                                <span className="font-semibold text-gray-300">Vendor:</span>
                                <p className="text-gray-400 mt-1">{order.vendor}</p>
                              </div>
                            )}
                            {order.standardHours > 0 && (
                              <div>
                                <span className="font-semibold text-gray-300">Standard Hours:</span>
                                <p className="text-gray-400 mt-1">{order.standardHours}</p>
                              </div>
                            )}
                            {order.overtimeHours > 0 && (
                              <div>
                                <span className="font-semibold text-gray-300">Overtime Hours:</span>
                                <p className="text-gray-400 mt-1">{order.overtimeHours}</p>
                              </div>
                            )}
                            {order.workPerformed && (
                              <div className="col-span-2">
                                <span className="font-semibold text-gray-300">Work Performed:</span>
                                <p className="text-gray-400 mt-1">{order.workPerformed}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

      {/* Work Order Form Modal */}
      <WorkOrderForm
        isOpen={workOrderFormOpen}
        onClose={() => setWorkOrderFormOpen(false)}
        machineId={selectedMachineId || ''}
        machine={selectedMachine}
        shopfloorName={labs.find(lab => lab._id === selectedLabId)?.name || ''}
      />
    </div>
  );
}

