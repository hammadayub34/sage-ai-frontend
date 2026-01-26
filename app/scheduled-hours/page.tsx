'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarIcon, ShopfloorsIcon, ChevronDownIcon, ChevronRightIcon } from '@/components/Icons';
import { toast } from 'react-toastify';

interface Lab {
  _id: string;
  name: string;
  description?: string;
  shifts?: Shift[];
}

interface Shift {
  name: string;
  startTime: string;
  endTime: string;
  _id?: string;
}

interface Machine {
  _id: string;
  machineName: string;
  labId: string;
  status: 'active' | 'inactive';
  description: string;
}

interface ScheduledHoursResponse {
  success: boolean;
  data?: {
    scheduledHours?: number;
    shiftInfo?: {
      shiftName: string;
      startTime: string;
      endTime: string;
      shiftDuration: number;
      numberOfDays: number;
    };
  };
  scheduledHours?: number; // Keep for backward compatibility
  shiftInfo?: {
    shiftName: string;
    startTime: string;
    endTime: string;
    shiftDuration: number;
    numberOfDays: number;
  };
  error?: string;
}

interface UtilizationData {
  success: boolean;
  data?: {
    shiftName: string;
    totalMachines: number;
    machinesWithData: number;
    averageUtilization: number;
    totalProductiveHours: number;
    totalIdleHours: number;
    totalScheduledHours: number;
    totalNonProductiveHours: number;
    totalNodeOffHours: number;
    machineUtilizations: Array<{
      machineName: string;
      averageUtilization: number;
      totalProductiveHours: number;
      totalIdleHours: number;
      totalScheduledHours: number;
      totalNonProductiveHours: number;
      totalNodeOffHours: number;
      recordCount: number;
    }>;
  };
  error?: string;
}

interface QueryInfo {
  success: boolean;
  query?: any;
  queryString?: string;
  collection?: string;
  database?: string;
  recordCount?: number;
  lastSeenDate?: string | null;
  lastSeenRecord?: {
    date: string;
    shift_name: string;
    machine_name: string;
    scheduled_hours: number;
    utilization: number;
  } | null;
  parameters?: {
    labId: string;
    shiftName: string;
    machineName: string;
    startDate: string;
    endDate: string;
    machineCount: number;
  };
  error?: string;
}

interface CalculationStep {
  step: number;
  description: string;
  value?: string | number;
  timestamp: string;
}

export default function ScheduledHoursPage() {
  const router = useRouter();
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [labs, setLabs] = useState<Lab[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [labShifts, setLabShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingScheduledHours, setLoadingScheduledHours] = useState(false);
  const [loadingUtilization, setLoadingUtilization] = useState(false);
  const [loadingQueryInfo, setLoadingQueryInfo] = useState(false);
  const [scheduledHoursData, setScheduledHoursData] = useState<ScheduledHoursResponse | null>(null);
  const [utilizationData, setUtilizationData] = useState<UtilizationData | null>(null);
  const [queryInfo, setQueryInfo] = useState<QueryInfo | null>(null);
  const [calculationSteps, setCalculationSteps] = useState<CalculationStep[]>([]);
  const [showQueryDetails, setShowQueryDetails] = useState(false);
  const [showCalculationLog, setShowCalculationLog] = useState(false);
  const [showQueryCalculationDetails, setShowQueryCalculationDetails] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [rawQueryData, setRawQueryData] = useState<{
    parameters: any;
    mongoQuery: any;
    rawResults: any[];
    calculationSteps: any[];
  } | null>(null);

  // AI Analysis state
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true); // Auto-expand
  const isAnalysisInProgress = useRef(false);
  const lastAnalysisFingerprint = useRef<string>('');
  const dataGeneration = useRef(0); // Tracks which "generation" of data we're on

  // Initialize dateRange to Last 7 Days (default)
  const getLast7DaysRange = () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    // Last 7 days: start = 6 days ago, end = today → 7 days inclusively
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { startDate: start, endDate: end };
  };
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>(getLast7DaysRange());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Increment generation whenever selections change (Layer 1: Race Condition Prevention)
  useEffect(() => {
    dataGeneration.current += 1;
    console.log(`[Data Generation] Incremented to ${dataGeneration.current} due to selection change`);
  }, [selectedLabId, selectedShift, selectedMachineId, dateRange]);

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
      if (!response.ok) {
        throw new Error('Failed to fetch labs');
      }
      const data = await response.json();
      if (data.labs && data.labs.length > 0) {
        setLabs(data.labs);
        // Auto-select first lab
        const labToSelect = data.labs[0];
        setSelectedLabId(labToSelect._id);
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
  const fetchMachinesForLab = async (labId: string) => {
    try {
      setLoading(true);
      console.log('[Machines] Fetching machines for labId:', labId);
      const response = await fetch(`/api/machines?labId=${labId}`);
      const data = await response.json();
      console.log('[Machines] API response:', {
        success: data.success,
        machineCount: data.machines?.length || 0,
        error: data.error
      });

      if (data.success) {
        const machinesList = data.machines || [];
        console.log('[Machines] Setting machines:', machinesList.length);
        setMachines(machinesList);
        if (machinesList.length > 0) {
          setSelectedMachineId(machinesList[0]._id);
          console.log('[Machines] Auto-selected first machine:', machinesList[0].machineName);
        } else {
          setSelectedMachineId('');
          console.warn('[Machines] No machines found for lab:', labId);
        }
      } else {
        console.error('[Machines] API returned error:', data.error);
        toast.error(data.error || 'Failed to fetch machines');
        setMachines([]);
        setSelectedMachineId('');
      }
    } catch (error: any) {
      console.error('[Machines] Error fetching machines:', error);
      toast.error(error.message || 'Error loading machines');
      setMachines([]);
      setSelectedMachineId('');
    } finally {
      setLoading(false);
    }
  };

  // Fetch lab with shifts
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
        } else {
          setLabShifts([]);
          setSelectedShift('');
        }
      }
    } catch (error: any) {
      console.error('Error fetching lab shifts:', error);
      setLabShifts([]);
      setSelectedShift('');
    }
  }, []);

  // Helper function to format date as YYYY-MM-DD in local timezone (not UTC)
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch scheduled hours
  const fetchScheduledHours = useCallback(async () => {
    if (!selectedLabId || !selectedShift) {
      setScheduledHoursData(null);
      return;
    }

    // Capture generation at start (Layer 1: Race Condition Prevention)
    const currentGeneration = dataGeneration.current;
    
    setLoadingScheduledHours(true);
    const steps: CalculationStep[] = [];
    
    try {
      // Use local timezone, not UTC, to avoid date shifting
      const startDateStr = formatDateForAPI(dateRange.startDate);
      const endDateStr = formatDateForAPI(dateRange.endDate);
      
      steps.push({
        step: 1,
        description: 'Preparing scheduled hours calculation',
        value: `Lab: ${selectedLabId}, Shift: ${selectedShift}, Date Range: ${startDateStr} to ${endDateStr}`,
        timestamp: new Date().toISOString(),
      });
      
      // Build URL with properly encoded parameters
      const params = new URLSearchParams({
        labId: selectedLabId,
        shiftName: selectedShift,
        startDate: startDateStr,
        endDate: endDateStr,
      });
      
      const url = `/api/scheduled-hours?${params.toString()}`;
      console.log('[Scheduled Hours] Fetching:', url);
      
      steps.push({
        step: 2,
        description: 'Calling scheduled hours API',
        value: url,
        timestamp: new Date().toISOString(),
      });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to fetch scheduled hours');
      }
      
      const data: ScheduledHoursResponse = await response.json();
      console.log('[Scheduled Hours] Response:', data);
      
      // Only update state if this is still the current generation (Layer 1: Race Condition Prevention)
      if (currentGeneration !== dataGeneration.current) {
        console.warn(`[Data Generation] Discarding stale scheduled hours data (generation ${currentGeneration} vs current ${dataGeneration.current})`);
        return;
      }
      
      if (data.success && data.shiftInfo) {
        steps.push({
          step: 3,
          description: 'Shift configuration retrieved',
          value: `Shift: ${data.shiftInfo.shiftName}, Duration: ${data.shiftInfo.shiftDuration.toFixed(2)}h/day, Days: ${data.shiftInfo.numberOfDays}`,
          timestamp: new Date().toISOString(),
        });
        
        steps.push({
          step: 4,
          description: 'Calculating total scheduled hours',
          value: `${data.shiftInfo.shiftDuration.toFixed(2)}h × ${data.shiftInfo.numberOfDays} days = ${data.scheduledHours?.toFixed(2)}h`,
          timestamp: new Date().toISOString(),
        });
      }
      
      setScheduledHoursData(data);
      setCalculationSteps(prev => [...prev, ...steps]);
      
      if (!data.success) {
        toast.error(data.error || 'Failed to fetch scheduled hours');
      }
    } catch (error: any) {
      console.error('[Scheduled Hours] Error:', error);
      toast.error(error.message || 'Error loading scheduled hours');
      setScheduledHoursData(null);
      setCalculationSteps(prev => [...prev, {
        step: 0,
        description: 'Error calculating scheduled hours',
        value: error.message,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoadingScheduledHours(false);
    }
  }, [selectedLabId, selectedShift, dateRange]);

  // Handle lab selection change
  const handleLabChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const labId = e.target.value;
    
    // Clear all dependent selections and data immediately when lab changes
    setSelectedMachineId(''); // Clear machine selection immediately
    setSelectedShift(''); // Clear shift selection
    setMachines([]); // Clear machines array
    setLabShifts([]); // Clear shifts
    setScheduledHoursData(null); // Clear scheduled hours data
    setUtilizationData(null); // Clear utilization data
    setQueryInfo(null); // Clear query info
    
    // Set new lab ID
    setSelectedLabId(labId);
    
    if (labId) {
      fetchMachinesForLab(labId);
      fetchLabWithShifts(labId);
    }
  };

  // Handle machine selection change
  const handleMachineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMachineId(e.target.value);
  };

  // Handle shift selection change
  const handleShiftChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedShift(e.target.value);
  };

  // Handle preset date range buttons
  const handlePresetRange = (days: number) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    // For "Today" (days=1): start = today, end = today → 1 day
    // For "Last 7 days" (days=7): start = 6 days ago, end = today → 7 days (Jan 9-15 if today is Jan 15)
    // For "Last 30 days" (days=30): start = 29 days ago, end = today → 30 days
    // We subtract (days - 1) to get the correct number of days inclusively
    // Example: "Last 7 days" means 7 days including today, so we go back 6 days from today
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    
    // Ensure end date is set to end of day to include the full last day
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    
    setDateRange({ startDate: start, endDate: endDate });
    setIsCalendarOpen(false);
    
    console.log('[Preset Range] Selected:', {
      days,
      startDate: start.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      expectedDays: days
    });
  };

  // Helper functions for calendar
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Calendar component
  const DateRangeCalendar = ({ isOpen, onClose, selectedRange, onRangeSelect }: { 
    isOpen: boolean; 
    onClose: () => void; 
    selectedRange: { startDate: Date; endDate: Date };
    onRangeSelect: (range: { startDate: Date; endDate: Date }) => void;
  }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedRange.startDate));
    const [selectingStart, setSelectingStart] = useState(true);
    const [tempStart, setTempStart] = useState<Date | null>(null);
    const [tempEnd, setTempEnd] = useState<Date | null>(null);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);

    // Reset when calendar opens
    useEffect(() => {
      if (isOpen) {
        setCurrentMonth(new Date(selectedRange.startDate));
        setSelectingStart(true);
        setTempStart(null);
        setTempEnd(null);
        setHoverDate(null);
      }
    }, [isOpen, selectedRange.startDate]);

    const navigateMonth = (direction: 'prev' | 'next') => {
      setCurrentMonth(prev => {
        const newDate = new Date(prev);
        if (direction === 'prev') {
          newDate.setMonth(prev.getMonth() - 1);
        } else {
          newDate.setMonth(prev.getMonth() + 1);
        }
        return newDate;
      });
    };

    const handleDateClick = (date: Date, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Create a new date object to avoid mutating
      const clickedDate = new Date(date);
      clickedDate.setHours(0, 0, 0, 0);
      
      if (selectingStart || !tempStart) {
        // First click - set start date
        setTempStart(clickedDate);
        setTempEnd(null);
        setSelectingStart(false);
        setHoverDate(null);
      } else {
        // Second click - set end date
        let start: Date;
        let end: Date;
        
        if (clickedDate < tempStart!) {
          // If clicked date is before start, swap them
          start = new Date(clickedDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(tempStart!);
          end.setHours(23, 59, 59, 999);
        } else {
          // Normal case: start < end
          start = new Date(tempStart!);
          start.setHours(0, 0, 0, 0);
          end = new Date(clickedDate);
          end.setHours(23, 59, 59, 999);
        }
        
        onRangeSelect({ startDate: start, endDate: end });
        setSelectingStart(true);
        setTempStart(null);
        setTempEnd(null);
        setHoverDate(null);
        onClose();
      }
    };

    const handleDateHover = (date: Date) => {
      if (!selectingStart && tempStart) {
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);
        setHoverDate(normalizedDate);
      }
    };

    const handleDateLeave = () => {
      setHoverDate(null);
    };

    const getDateClass = (date: Date) => {
      // Normalize dates for comparison
      const dateTime = new Date(date).setHours(0, 0, 0, 0);
      
      // Determine the range to highlight (either temp selection with hover preview or current selection)
      let rangeStart: Date | null = null;
      let rangeEnd: Date | null = null;
      let isStart = false;
      let isEnd = false;
      
      if (tempStart) {
        // We're in selection mode - show preview with hover
        if (hoverDate && !selectingStart) {
          // Normalize dates for comparison
          const hoverTime = new Date(hoverDate).setHours(0, 0, 0, 0);
          const tempStartTime = new Date(tempStart).setHours(0, 0, 0, 0);
          
          // Show preview of range from tempStart to hoverDate
          if (hoverTime < tempStartTime) {
            rangeStart = hoverDate;
            rangeEnd = tempStart;
          } else {
            rangeStart = tempStart;
            rangeEnd = hoverDate;
          }
        } else {
          // Just start is selected
          rangeStart = tempStart;
          rangeEnd = tempStart;
        }
      } else {
        // Show currently selected range
        rangeStart = selectedRange.startDate;
        rangeEnd = selectedRange.endDate;
      }
      
      // Calculate if this date is start or end
      if (rangeStart && rangeEnd) {
        const startTime = new Date(rangeStart).setHours(0, 0, 0, 0);
        const endTime = new Date(rangeEnd).setHours(0, 0, 0, 0);
        isStart = dateTime === startTime;
        isEnd = dateTime === endTime;
        
        // Apply styling
        if (dateTime >= startTime && dateTime <= endTime) {
          if (isStart || isEnd) {
            return 'text-xs p-1 rounded transition-all duration-200 bg-sage-500 text-white font-semibold cursor-pointer';
          } else {
            return 'text-xs p-1 rounded transition-all duration-200 bg-sage-500/30 text-sage-300 cursor-pointer';
          }
        }
      }
      
      // Default styling
      let classes = 'text-xs p-1 rounded transition-all duration-200 text-gray-400 hover:bg-sage-500/20 cursor-pointer';
      
      // Check if this is today (only if not in range)
      if (isToday(date) && (!rangeStart || dateTime < new Date(rangeStart).setHours(0, 0, 0, 0) || dateTime > new Date(rangeEnd!).setHours(0, 0, 0, 0))) {
        classes = 'text-xs p-1 rounded transition-all duration-200 bg-sage-500/20 text-sage-400 font-semibold cursor-pointer border border-sage-500/50';
      }
      
      return classes;
    };

    if (!isOpen) return null;

    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-40" 
          onClick={onClose}
        />
        {/* Calendar Popup */}
        <div 
          className="absolute right-0 top-full mt-2 z-50 bg-dark-panel border border-dark-border rounded-lg p-4 shadow-lg min-w-[280px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1 hover:bg-dark-border rounded transition-colors text-gray-400 hover:text-white"
            >
              <ChevronRightIcon className="w-4 h-4 rotate-180" />
            </button>
            <h3 className="text-white font-semibold text-sm">
              {currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </h3>
            <button
              onClick={() => navigateMonth('next')}
              className="p-1 hover:bg-dark-border rounded transition-colors text-gray-400 hover:text-white"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
              <div key={day} className="text-center text-gray-500 text-xs font-medium py-1">
                {day}
              </div>
            ))}
            {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, idx) => (
              <div key={`empty-${idx}`} />
            ))}
            {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, idx) => {
              const day = idx + 1;
              const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={(e) => handleDateClick(date, e)}
                  onMouseEnter={() => handleDateHover(date)}
                  onMouseLeave={handleDateLeave}
                  className={getDateClass(date)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          
          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t border-dark-border flex gap-2">
            <button
              onClick={() => {
                const today = new Date();
                const start = new Date(today);
                start.setHours(0, 0, 0, 0);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                onRangeSelect({ startDate: start, endDate: end });
                onClose();
              }}
              className="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-xs text-gray-300 hover:bg-dark-border transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const start = new Date(now);
                start.setDate(now.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                const end = new Date(now);
                end.setHours(23, 59, 59, 999);
                onRangeSelect({ startDate: start, endDate: end });
                onClose();
              }}
              className="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-xs text-gray-300 hover:bg-dark-border transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const start = new Date(now);
                start.setDate(now.getDate() - 29);
                start.setHours(0, 0, 0, 0);
                const end = new Date(now);
                end.setHours(23, 59, 59, 999);
                onRangeSelect({ startDate: start, endDate: end });
                onClose();
              }}
              className="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-xs text-gray-300 hover:bg-dark-border transition-colors"
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </>
    );
  };

  // Handle calendar date selection
  const handleDateRangeChange = (range: { startDate: Date; endDate: Date }) => {
    // Ensure dates are properly set with correct time boundaries
    const newRange = {
      startDate: new Date(range.startDate),
      endDate: new Date(range.endDate)
    };
    newRange.startDate.setHours(0, 0, 0, 0);
    newRange.endDate.setHours(23, 59, 59, 999);
    setDateRange(newRange);
    setIsCalendarOpen(false);
    console.log('[Scheduled Hours] Date range updated from calendar:', {
      start: newRange.startDate.toISOString(),
      end: newRange.endDate.toISOString()
    });
  };

  // Fetch query info and last seen date
  const fetchQueryInfo = useCallback(async () => {
    if (!selectedLabId || !selectedShift) {
      setQueryInfo(null);
      setCalculationSteps([]);
      return;
    }

    // Capture generation at start (Layer 1: Race Condition Prevention)
    const currentGeneration = dataGeneration.current;

    setLoadingQueryInfo(true);
    const steps: CalculationStep[] = [];
    
    try {
      // Use local timezone, not UTC, to avoid date shifting
      const startDateStr = formatDateForAPI(dateRange.startDate);
      const endDateStr = formatDateForAPI(dateRange.endDate);
      
      // Get selected machine name if a machine is selected
      // Only use machine if it exists in current machines array (validates it belongs to current lab)
      const selectedMachine = selectedMachineId && machines.length > 0 
        ? machines.find(m => m._id === selectedMachineId) 
        : null;
      const machineName = selectedMachine?.machineName || null;
      
      steps.push({
        step: 1,
        description: 'Building query parameters',
        value: `Lab: ${selectedLabId}, Shift: ${selectedShift}, Machine: ${machineName || 'All'}, Dates: ${startDateStr} to ${endDateStr}`,
        timestamp: new Date().toISOString(),
      });
      
      // Build URL with properly encoded parameters
      const params = new URLSearchParams({
        labId: selectedLabId,
        shiftName: selectedShift,
        startDate: startDateStr,
        endDate: endDateStr,
      });
      
      // Add machineName if a specific machine is selected
      if (machineName) {
        params.append('machineName', machineName);
      }
      
      const url = `/api/shift-utilization/query-info?${params.toString()}`;
      steps.push({
        step: 2,
        description: 'Fetching query information from API',
        value: url,
        timestamp: new Date().toISOString(),
      });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch query information');
      }
      
      const data: QueryInfo = await response.json();
      
      // Only update state if this is still the current generation (Layer 1: Race Condition Prevention)
      if (currentGeneration !== dataGeneration.current) {
        console.warn(`[Data Generation] Discarding stale query info data (generation ${currentGeneration} vs current ${dataGeneration.current})`);
        return;
      }
      
      setQueryInfo(data);
      
      if (data.success) {
        steps.push({
          step: 3,
          description: 'Query executed successfully',
          value: `Found ${data.recordCount || 0} records`,
          timestamp: new Date().toISOString(),
        });
        
        if (data.lastSeenDate) {
          steps.push({
            step: 4,
            description: 'Last seen date retrieved',
            value: data.lastSeenDate,
            timestamp: new Date().toISOString(),
          });
        }
      }
      
      setCalculationSteps(steps);
    } catch (error: any) {
      console.error('[Query Info] Error:', error);
      steps.push({
        step: 0,
        description: 'Error fetching query info',
        value: error.message,
        timestamp: new Date().toISOString(),
      });
      setCalculationSteps(steps);
      setQueryInfo(null);
    } finally {
      setLoadingQueryInfo(false);
    }
  }, [selectedLabId, selectedShift, selectedMachineId, machines, dateRange]);

  // Fetch utilization data from MongoDB
  const fetchUtilizationData = useCallback(async () => {
    if (!selectedLabId || !selectedShift) {
      setUtilizationData(null);
      return;
    }

    // Capture generation at start (Layer 1: Race Condition Prevention)
    const currentGeneration = dataGeneration.current;

    setLoadingUtilization(true);
    const steps: CalculationStep[] = [];
    
    try {
      // Use local timezone, not UTC, to avoid date shifting
      const startDateStr = formatDateForAPI(dateRange.startDate);
      const endDateStr = formatDateForAPI(dateRange.endDate);
      
      // Get selected machine name if a machine is selected
      // Only use machine if it exists in current machines array (validates it belongs to current lab)
      const selectedMachine = selectedMachineId && machines.length > 0 
        ? machines.find(m => m._id === selectedMachineId) 
        : null;
      const machineName = selectedMachine?.machineName || null;
      
      steps.push({
        step: 1,
        description: 'Preparing API request',
        value: `Parameters: labId=${selectedLabId}, shiftName=${selectedShift}, dates=${startDateStr} to ${endDateStr}${machineName ? `, machineName=${machineName}` : ''}`,
        timestamp: new Date().toISOString(),
      });
      
      // Build URL with properly encoded parameters
      const params = new URLSearchParams({
        labId: selectedLabId,
        shiftName: selectedShift,
        startDate: startDateStr,
        endDate: endDateStr,
      });
      
      // Add machineName if a specific machine is selected
      if (machineName) {
        params.append('machineName', machineName);
      }
      
      const url = `/api/shift-utilization?${params.toString()}`;
      steps.push({
        step: 2,
        description: 'Calling API endpoint',
        value: url,
        timestamp: new Date().toISOString(),
      });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to fetch utilization data');
      }
      
      const data: UtilizationData = await response.json();
      
      steps.push({
        step: 3,
        description: 'API response received',
        value: `Success: ${data.success}, Records: ${data.data?.machinesWithData || 0} machines with data`,
        timestamp: new Date().toISOString(),
      });
      
      if (data.success && data.data) {
        steps.push({
          step: 4,
          description: 'Calculating totals',
          value: `Total Scheduled Hours: ${data.data.totalScheduledHours.toFixed(2)}h, Average Utilization: ${data.data.averageUtilization.toFixed(2)}%`,
          timestamp: new Date().toISOString(),
        });
        
        steps.push({
          step: 5,
          description: 'Aggregating by machine',
          value: `${data.data.machineUtilizations.length} machines processed`,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Only update state if this is still the current generation (Layer 1: Race Condition Prevention)
      if (currentGeneration !== dataGeneration.current) {
        console.warn(`[Data Generation] Discarding stale utilization data (generation ${currentGeneration} vs current ${dataGeneration.current})`);
        return;
      }
      
      setUtilizationData(data);
      setCalculationSteps(prev => [...prev, ...steps]);
      
      // Store raw query data for display
      if (data.success && data.data && (data.data as any)._debug) {
        setRawQueryData({
          parameters: (data.data as any)._debug.queryParameters,
          mongoQuery: (data.data as any)._debug.mongoQuery,
          rawResults: (data.data as any)._debug.rawResults || [],
          calculationSteps: (data.data as any)._debug.calculationSteps || [],
        });
      } else {
        setRawQueryData(null);
      }
      
      if (!data.success) {
        toast.error(data.error || 'Failed to fetch utilization data');
      }
    } catch (error: any) {
      console.error('[Utilization Data] Error:', error);
      toast.error(error.message || 'Error loading utilization data');
      setUtilizationData(null);
      setCalculationSteps(prev => [...prev, {
        step: 0,
        description: 'Error occurred',
        value: error.message,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoadingUtilization(false);
    }
  }, [selectedLabId, selectedShift, selectedMachineId, machines, dateRange]);

  // Layer 2: Data Freshness Validation
  const validateDataFreshness = useCallback(() => {
    // Check scheduled hours matches current shift
    const scheduledShift = scheduledHoursData?.data?.shiftInfo?.shiftName;
    if (scheduledShift && scheduledShift !== selectedShift) {
      console.warn('[Data Validation] Scheduled hours shift mismatch:', scheduledShift, 'vs', selectedShift);
      return false;
    }
    
    // Check utilization matches current shift
    const utilizationShift = utilizationData?.data?.shiftName;
    if (utilizationShift && utilizationShift !== selectedShift) {
      console.warn('[Data Validation] Utilization shift mismatch:', utilizationShift, 'vs', selectedShift);
      return false;
    }
    
    // Check query info matches current selections
    const queryShift = queryInfo?.parameters?.shiftName;
    const queryLabId = queryInfo?.parameters?.labId;
    if (queryShift && queryShift !== selectedShift) {
      console.warn('[Data Validation] Query info shift mismatch:', queryShift, 'vs', selectedShift);
      return false;
    }
    if (queryLabId && queryLabId !== selectedLabId) {
      console.warn('[Data Validation] Query info lab mismatch:', queryLabId, 'vs', selectedLabId);
      return false;
    }
    
    // Check date ranges match
    const queryStartDate = queryInfo?.parameters?.startDate;
    const queryEndDate = queryInfo?.parameters?.endDate;
    const currentStartDate = formatDateForAPI(dateRange.startDate);
    const currentEndDate = formatDateForAPI(dateRange.endDate);
    if (queryStartDate && queryStartDate !== currentStartDate) {
      console.warn('[Data Validation] Query start date mismatch:', queryStartDate, 'vs', currentStartDate);
      return false;
    }
    if (queryEndDate && queryEndDate !== currentEndDate) {
      console.warn('[Data Validation] Query end date mismatch:', queryEndDate, 'vs', currentEndDate);
      return false;
    }
    
    return true;
  }, [selectedLabId, selectedShift, dateRange, scheduledHoursData, utilizationData, queryInfo]);

  // Layer 3: Data Fingerprint Generation
  const generateDataFingerprint = useCallback(() => {
    // Include selections
    const selectionsKey = `${selectedLabId}-${selectedMachineId || 'all'}-${selectedShift}-${formatDateForAPI(dateRange.startDate)}-${formatDateForAPI(dateRange.endDate)}`;
    
    // Include actual API response data (ensures same selections with different data triggers new analysis)
    const scheduledHours = scheduledHoursData?.scheduledHours || 0;
    const utilization = utilizationData?.data?.averageUtilization || 0;
    const machineCount = utilizationData?.data?.machinesWithData || 0;
    
    return `${selectionsKey}-${scheduledHours}-${utilization}-${machineCount}`;
  }, [selectedLabId, selectedMachineId, selectedShift, dateRange, scheduledHoursData, utilizationData]);

  // Collect all API data for AI analysis
  const collectAllAPIData = useCallback(() => {
    // Get lab name from labs API response (API Call #1 or #2)
    const selectedLabFromAPI = labs.find(l => l._id === selectedLabId);
    const labName = selectedLabFromAPI?.name || null;
    const labId = selectedLabId || null;
    
    // Get shift info from scheduled-hours API response (API Call #4)
    const shiftName = scheduledHoursData?.data?.shiftInfo?.shiftName || selectedShift || null;
    const shiftStartTime = scheduledHoursData?.data?.shiftInfo?.startTime || null;
    const shiftEndTime = scheduledHoursData?.data?.shiftInfo?.endTime || null;
    
    // CRITICAL: Get selected machine name from CURRENT dropdown selection, not from API response
    // This ensures we always use the latest selection, not stale API data
    const selectedMachine = selectedMachineId && machines.length > 0 
      ? machines.find(m => m._id === selectedMachineId) 
      : null;
    const selectedMachineNameFromDropdown = selectedMachine?.machineName || null;
    const isSpecificMachine = !!selectedMachineNameFromDropdown;
    
    // Get all machine names from utilization API response (API Call #6)
    const machineUtilizations = utilizationData?.data?.machineUtilizations || [];
    const allMachineNames = machineUtilizations.map(m => m.machineName);
    
    // Find the selected machine's data from utilization API response using CURRENT selection
    const selectedMachineData = isSpecificMachine && machineUtilizations.length > 0 && selectedMachineNameFromDropdown
      ? machineUtilizations.find(m => m.machineName === selectedMachineNameFromDropdown) || null
      : null;

    // Get selected lab and shift objects
    const selectedLab = selectedLabFromAPI || null;
    const selectedShiftObj = labShifts.find(s => s.name === selectedShift) || null;

    return {
      timestamp: new Date().toISOString(),
      selections: {
        lab: {
          id: labId,
          name: labName, // From labs API response (API Call #1 or #2)
        },
        machine: {
          name: selectedMachineNameFromDropdown || null, // From CURRENT dropdown selection
          isSelected: isSpecificMachine,
          selectionType: isSpecificMachine ? 'Specific Machine' : 'All Machines',
        },
        shift: {
          name: shiftName, // From scheduled-hours API response
          startTime: shiftStartTime, // From scheduled-hours API response
          endTime: shiftEndTime, // From scheduled-hours API response
        },
        dateRange: {
          startDate: formatDateForAPI(dateRange.startDate),
          endDate: formatDateForAPI(dateRange.endDate),
          displayText: `${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`,
        },
      },
      apiResults: {
        // API Call #1: User Labs (already in state)
        userLabs: {
          success: labs.length > 0,
          labCount: labs.length,
          selectedLab: selectedLab || null,
        },
        // API Call #2: Lab Shifts
        labShifts: {
          success: labShifts.length > 0,
          shifts: labShifts,
          selectedShift: selectedShiftObj || null,
        },
        // API Call #3: Machines
        machines: {
          success: machines.length > 0,
          machineCount: machines.length,
          selectedMachine: selectedMachine || null,
          allMachines: machines.map(m => ({
            id: m._id,
            name: m.machineName,
            description: m.description,
            status: m.status,
          })),
        },
        // API Call #4: Scheduled Hours - Shift info comes from here
        scheduledHours: {
          loading: loadingScheduledHours,
          data: scheduledHoursData,
          shiftInfo: scheduledHoursData?.data?.shiftInfo || null, // Shift name, times from API
        },
        // API Call #5: Query Info - Note: We use dropdown selection, not API response for machine name
        queryInfo: {
          loading: loadingQueryInfo,
          data: queryInfo,
          selectedMachineName: selectedMachineNameFromDropdown || null, // From CURRENT dropdown selection
        },
        // API Call #6: Utilization Data - CRITICAL: Contains machine-specific data
        utilization: {
          loading: loadingUtilization,
          data: utilizationData,
          // Extract machine-specific data for clarity (from API response)
          machineSpecificData: machineUtilizations, // Already extracted above
          // Highlight the selected machine's data if a specific machine is selected (from API response)
          selectedMachineData: selectedMachineData, // Already extracted above
          // Overall totals across all machines (from API response)
          overallTotals: utilizationData?.data ? {
            totalMachines: utilizationData.data.totalMachines,
            machinesWithData: utilizationData.data.machinesWithData,
            averageUtilization: utilizationData.data.averageUtilization,
            totalProductiveHours: utilizationData.data.totalProductiveHours,
            totalIdleHours: utilizationData.data.totalIdleHours,
            totalScheduledHours: utilizationData.data.totalScheduledHours,
            totalNonProductiveHours: utilizationData.data.totalNonProductiveHours,
            totalNodeOffHours: utilizationData.data.totalNodeOffHours,
          } : null,
          // Machine names from API response (source of truth)
          allMachineNames: allMachineNames,
        },
      },
    };
  }, [selectedLabId, selectedShift, dateRange, labs, machines, labShifts, scheduledHoursData, queryInfo, utilizationData, loadingScheduledHours, loadingQueryInfo, loadingUtilization, selectedMachineId]);

  // Fetch AI Analysis
  const fetchAIAnalysis = useCallback(async () => {
    // Prevent duplicate calls
    if (isAnalysisInProgress.current) {
      console.log('[AI Analysis] Already in progress, skipping');
      return;
    }

    // Check if all required data is loaded
    if (
      !selectedLabId ||
      !selectedShift ||
      loadingScheduledHours ||
      loadingQueryInfo ||
      loadingUtilization ||
      !scheduledHoursData?.success ||
      !queryInfo?.success ||
      !utilizationData?.success
    ) {
      console.warn('[AI Analysis] Data not ready yet');
      toast.error('Please wait for all data to load before generating analysis');
      return; // Not ready yet
    }

    // Validate data freshness
    if (!validateDataFreshness()) {
      console.warn('[AI Analysis] Data freshness validation failed');
      toast.error('Data may be stale. Please refresh the page and try again');
      return;
    }

    isAnalysisInProgress.current = true;
    setLoadingAnalysis(true);
    setShowAnalysis(true);

    try {
      // Collect all API results
      const allData = collectAllAPIData();
      
      // CRITICAL: Log the exact data being sent to verify correctness
      console.log('[AI Analysis] ===== SENDING DATA TO OPENAI =====');
      console.log('[AI Analysis] Selected Machine (from dropdown):', {
        machineId: selectedMachineId,
        machineName: allData.selections.machine.name,
        isSelected: allData.selections.machine.isSelected,
        selectionType: allData.selections.machine.selectionType,
      });
      console.log('[AI Analysis] Lab:', {
        id: allData.selections.lab.id,
        name: allData.selections.lab.name,
      });
      console.log('[AI Analysis] Shift:', {
        name: allData.selections.shift.name,
        startTime: allData.selections.shift.startTime,
        endTime: allData.selections.shift.endTime,
      });
      console.log('[AI Analysis] Date Range:', allData.selections.dateRange.displayText);
      console.log('[AI Analysis] Machine-Specific Data:', {
        totalMachines: allData.apiResults.utilization.machineSpecificData.length,
        selectedMachineData: allData.apiResults.utilization.selectedMachineData ? {
          machineName: allData.apiResults.utilization.selectedMachineData.machineName,
          averageUtilization: allData.apiResults.utilization.selectedMachineData.averageUtilization,
          totalProductiveHours: allData.apiResults.utilization.selectedMachineData.totalProductiveHours,
        } : null,
        allMachineNames: allData.apiResults.utilization.allMachineNames,
      });
      console.log('[AI Analysis] Full JSON being sent:', JSON.stringify(allData, null, 2));
      console.log('[AI Analysis] ====================================');
    
      // Send to AI analysis endpoint
      const response = await fetch('/api/insights/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allData),
      });
    
      if (!response.ok) {
        throw new Error('Failed to generate analysis');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setAnalysis(result.analysis);
        // Update fingerprint to match the analysis
        lastAnalysisFingerprint.current = generateDataFingerprint();
      } else {
        throw new Error(result.error || 'Failed to generate analysis');
      }
    } catch (error: any) {
      console.error('[AI Analysis] Error:', error);
      toast.error(error.message || 'Failed to generate AI analysis');
      setAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
      isAnalysisInProgress.current = false;
    }
  }, [selectedLabId, selectedShift, loadingScheduledHours, loadingQueryInfo, loadingUtilization, scheduledHoursData, queryInfo, utilizationData, collectAllAPIData, selectedMachineId, validateDataFreshness, generateDataFingerprint]);

  // Fetch scheduled hours when dependencies change
  useEffect(() => {
    fetchScheduledHours();
  }, [fetchScheduledHours]);

  // Fetch query info when dependencies change
  useEffect(() => {
    fetchQueryInfo();
  }, [fetchQueryInfo]);

  // Fetch utilization data when dependencies change
  useEffect(() => {
    fetchUtilizationData();
  }, [fetchUtilizationData]);

  // Clear analysis when selections change (so user knows to regenerate)
  useEffect(() => {
    const currentFingerprint = generateDataFingerprint();
    if (currentFingerprint !== lastAnalysisFingerprint.current) {
      console.log('[AI Analysis] Selections changed, clearing previous analysis');
      setAnalysis(null);
      lastAnalysisFingerprint.current = currentFingerprint;
    }
  }, [selectedLabId, selectedShift, selectedMachineId, dateRange, generateDataFingerprint]);

  // Fetch machines when lab changes (including initial load)
  useEffect(() => {
    if (selectedLabId) {
      console.log('[Effect] Lab selected, fetching machines for:', selectedLabId);
      fetchMachinesForLab(selectedLabId);
    } else {
      setMachines([]);
      setSelectedMachineId('');
    }
  }, [selectedLabId]);

  // Fetch machines when lab changes (including initial load)
  useEffect(() => {
    if (selectedLabId) {
      console.log('[Effect] Lab selected, fetching machines for:', selectedLabId);
      fetchMachinesForLab(selectedLabId);
    } else {
      setMachines([]);
      setSelectedMachineId('');
    }
  }, [selectedLabId]);

  // Fetch lab shifts when lab changes
  useEffect(() => {
    if (selectedLabId) {
      fetchLabWithShifts(selectedLabId);
    } else {
      setLabShifts([]);
      setSelectedShift('');
    }
  }, [selectedLabId, fetchLabWithShifts]);


  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-dark-bg text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShopfloorsIcon className="w-6 h-6 text-sage-400" />
            <h1 className="text-2xl font-bold text-white">Insights</h1>
          </div>
        </div>

        {/* Lab, Machine, and Shift Selection */}
        <div className="bg-dark-panel border border-dark-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
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

            <label className="text-gray-400">Shift:</label>
            <select
              value={selectedShift}
              onChange={handleShiftChange}
              className="bg-dark-panel border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500 min-w-[200px]"
              disabled={loading || !selectedLabId || labShifts.length === 0}
            >
              <option value="">
                {!selectedLabId ? 'Select a lab first...' : labShifts.length === 0 ? 'No shifts configured' : 'Select a shift...'}
              </option>
              {labShifts.map((shift) => (
                <option key={shift.name} value={shift.name}>
                  {shift.name} ({shift.startTime} - {shift.endTime})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range Selection */}
        <div className="bg-dark-panel border border-dark-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-gray-400">Date Range:</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePresetRange(1)}
                className={`px-4 py-2 rounded text-sm ${
                  dateRange.startDate.toDateString() === new Date().toDateString() &&
                  dateRange.endDate.toDateString() === new Date().toDateString()
                    ? 'bg-sage-500 text-white'
                    : 'bg-dark-bg border border-dark-border text-gray-300 hover:bg-dark-hover'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => handlePresetRange(7)}
                className={`px-4 py-2 rounded text-sm ${
                  Math.floor((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)) === 6 &&
                  dateRange.endDate.toDateString() === new Date().toDateString()
                    ? 'bg-sage-500 text-white'
                    : 'bg-dark-bg border border-dark-border text-gray-300 hover:bg-dark-hover'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => handlePresetRange(30)}
                className={`px-4 py-2 rounded text-sm ${
                  Math.floor((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)) === 29
                    ? 'bg-sage-500 text-white'
                    : 'bg-dark-bg border border-dark-border text-gray-300 hover:bg-dark-hover'
                }`}
              >
                Last 30 Days
              </button>
            </div>
            <div className="flex items-center gap-3 relative">
              <button
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="flex items-center gap-2 bg-dark-panel border border-dark-border rounded px-3 py-2 text-white text-sm hover:bg-dark-bg transition-colors"
              >
                <CalendarIcon className="w-4 h-4 text-sage-400" />
                <span className="min-w-[180px] text-left">
                  {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
                </span>
              </button>
              <DateRangeCalendar
                isOpen={isCalendarOpen}
                onClose={() => setIsCalendarOpen(false)}
                selectedRange={dateRange}
                onRangeSelect={handleDateRangeChange}
              />
            </div>
          </div>
        </div>

        {/* AI Analysis Section */}
        {selectedLabId && selectedShift && (
          <div className="bg-dark-panel border border-dark-border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Analysis
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    fetchAIAnalysis();
                    // Auto-expand when generating
                    if (!showAnalysis) {
                      setShowAnalysis(true);
                    }
                  }}
                  disabled={loadingAnalysis || loadingScheduledHours || loadingQueryInfo || loadingUtilization}
                  className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingAnalysis ? 'Generating...' : 'Generate Analysis'}
                </button>
                <button
                  onClick={() => setShowAnalysis(!showAnalysis)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {showAnalysis ? '▼' : '▶'}
                </button>
              </div>
            </div>

            {showAnalysis && (
              <div>
                {loadingAnalysis ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2 text-sage-400 animate-pulse">
                      <div className="w-4 h-4 border-2 border-sage-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-medium">Analyzing data...</span>
                    </div>
                  </div>
                ) : analysis ? (
                  <div className="pt-4">
                    <div className="prose prose-invert max-w-none">
                      <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {analysis.split('\n').map((line, index, array) => {
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
                      {!selectedLabId || !selectedShift
                        ? 'Please select a lab and shift to generate analysis'
                        : loadingScheduledHours || loadingQueryInfo || loadingUtilization
                        ? 'Loading data... Please wait for all data to load, then click "Generate Analysis" button.'
                        : 'Click the "Generate Analysis" button above to generate AI analysis with the current selections.'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Scheduled Hours Display */}
        <div className="bg-dark-panel border border-dark-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Scheduled Hours</h2>
          
          {loadingScheduledHours ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-400"></div>
              <span className="ml-3 text-gray-400">Loading scheduled hours...</span>
            </div>
          ) : scheduledHoursData?.success ? (
            <div className="space-y-4">
              <div className="bg-dark-bg border border-dark-border rounded-lg p-6">
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-bold text-sage-400">
                    {scheduledHoursData.scheduledHours?.toFixed(2)}
                  </span>
                  <span className="text-xl text-gray-400">hours</span>
                </div>
                
                {scheduledHoursData.shiftInfo && (
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-gray-500">Shift:</span>
                      <span className="ml-2 text-gray-300">{scheduledHoursData.shiftInfo.shiftName}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Time:</span>
                      <span className="ml-2 text-gray-300">
                        {scheduledHoursData.shiftInfo.startTime} - {scheduledHoursData.shiftInfo.endTime}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Shift Duration:</span>
                      <span className="ml-2 text-gray-300">
                        {scheduledHoursData.shiftInfo.shiftDuration.toFixed(2)} hours/day
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Number of Days:</span>
                      <span className="ml-2 text-gray-300">{scheduledHoursData.shiftInfo.numberOfDays} days</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Detailed Calculation Breakdown */}
              {scheduledHoursData.shiftInfo && (
                <div className="bg-dark-bg border border-dark-border rounded-lg p-6 mt-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Calculation Details</h3>
                  
                  {/* Parameters Passed */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Parameters Passed to API:</h4>
                    <div className="bg-black/30 border border-dark-border rounded p-3 font-mono text-xs space-y-1">
                      <div className="text-gray-400">
                        <span className="text-sage-400">labId:</span> <span className="text-gray-300">{selectedLabId}</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-sage-400">shiftName:</span> <span className="text-gray-300">{selectedShift}</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-sage-400">startDate:</span> <span className="text-gray-300">{formatDateForAPI(dateRange.startDate)}</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-sage-400">endDate:</span> <span className="text-gray-300">{formatDateForAPI(dateRange.endDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 1: Shift Duration Calculation */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Step 1: Calculate Shift Duration</h4>
                    <div className="bg-black/30 border border-dark-border rounded p-3 space-y-2">
                      <div className="text-xs text-gray-400">
                        <span className="text-sage-400">Shift:</span> <span className="text-gray-300">{scheduledHoursData.shiftInfo.shiftName}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        <span className="text-sage-400">Start Time:</span> <span className="text-gray-300">{scheduledHoursData.shiftInfo.startTime}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        <span className="text-sage-400">End Time:</span> <span className="text-gray-300">{scheduledHoursData.shiftInfo.endTime}</span>
                      </div>
                      <div className="pt-2 border-t border-dark-border">
                        {(() => {
                          const startTime = scheduledHoursData.shiftInfo.startTime.split(':');
                          const endTime = scheduledHoursData.shiftInfo.endTime.split(':');
                          const startHours = parseFloat(startTime[0]) + parseFloat(startTime[1]) / 60;
                          const endHours = parseFloat(endTime[0]) + parseFloat(endTime[1]) / 60;
                          const spansMidnight = endHours < startHours;
                          const duration = spansMidnight 
                            ? (24 - startHours) + endHours 
                            : endHours - startHours;
                          
                          return (
                            <div className="text-xs text-gray-300">
                              <div className="mb-1">
                                {spansMidnight ? (
                                  <>
                                    <span className="text-sage-400">Calculation:</span> Shift spans midnight
                                    <br />
                                    <span className="text-gray-400 ml-4">Duration = (24 - {startHours.toFixed(2)}) + {endHours.toFixed(2)}</span>
                                    <br />
                                    <span className="text-gray-400 ml-4">Duration = {(24 - startHours).toFixed(2)} + {endHours.toFixed(2)} = {duration.toFixed(2)} hours</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-sage-400">Calculation:</span> Normal shift
                                    <br />
                                    <span className="text-gray-400 ml-4">Duration = {endHours.toFixed(2)} - {startHours.toFixed(2)} = {duration.toFixed(2)} hours</span>
                                  </>
                                )}
                              </div>
                              <div className="mt-2 text-sage-400 font-semibold">
                                Shift Duration: {scheduledHoursData.shiftInfo.shiftDuration.toFixed(2)} hours/day
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Number of Days Calculation */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Step 2: Calculate Number of Days</h4>
                    <div className="bg-black/30 border border-dark-border rounded p-3 space-y-2">
                      <div className="text-xs text-gray-400">
                        <span className="text-sage-400">Start Date:</span> <span className="text-gray-300">{formatDateForAPI(dateRange.startDate)}</span>
                        <span className="text-gray-500 ml-2">(normalized to 00:00:00)</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        <span className="text-sage-400">End Date:</span> <span className="text-gray-300">{formatDateForAPI(dateRange.endDate)}</span>
                        <span className="text-gray-500 ml-2">(normalized to 00:00:00)</span>
                      </div>
                      <div className="pt-2 border-t border-dark-border">
                        <div className="text-xs text-gray-300">
                          <span className="text-sage-400">Calculation:</span>
                          <br />
                          <span className="text-gray-400 ml-4">Difference = End Date - Start Date</span>
                          <br />
                          <span className="text-gray-400 ml-4">Difference = {formatDateForAPI(dateRange.endDate)} - {formatDateForAPI(dateRange.startDate)}</span>
                          <br />
                          <span className="text-gray-400 ml-4">
                            Difference = {(() => {
                              const start = new Date(formatDateForAPI(dateRange.startDate));
                              const end = new Date(formatDateForAPI(dateRange.endDate));
                              const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                              return Math.round(diff);
                            })()} days
                          </span>
                          <br />
                          <span className="text-gray-400 ml-4">Number of Days = Difference + 1 (inclusive)</span>
                          <br />
                          <span className="text-gray-400 ml-4">
                            Number of Days = {(() => {
                              const start = new Date(formatDateForAPI(dateRange.startDate));
                              const end = new Date(formatDateForAPI(dateRange.endDate));
                              const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                              return Math.round(diff);
                            })()} + 1 = {scheduledHoursData.shiftInfo.numberOfDays} days
                          </span>
                        </div>
                        <div className="mt-2 text-sage-400 font-semibold">
                          Number of Days: {scheduledHoursData.shiftInfo.numberOfDays} days
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Final Calculation */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Step 3: Calculate Total Scheduled Hours</h4>
                    <div className="bg-black/30 border border-dark-border rounded p-3">
                      <div className="text-xs text-gray-300">
                        <span className="text-sage-400">Formula:</span> Scheduled Hours = Shift Duration × Number of Days
                        <br />
                        <br />
                        <span className="text-gray-400 ml-4">
                          Scheduled Hours = {scheduledHoursData.shiftInfo.shiftDuration.toFixed(2)} hours/day × {scheduledHoursData.shiftInfo.numberOfDays} days
                        </span>
                        <br />
                        <span className="text-gray-400 ml-4">
                          Scheduled Hours = {(scheduledHoursData.shiftInfo.shiftDuration * scheduledHoursData.shiftInfo.numberOfDays).toFixed(2)} hours
                        </span>
                        <br />
                        <br />
                        <div className="mt-2 text-lg font-bold text-sage-400">
                          Total Scheduled Hours: {scheduledHoursData.scheduledHours?.toFixed(2)} hours
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : scheduledHoursData?.error ? (
            <div className="text-red-400 py-4">
              Error: {scheduledHoursData.error}
            </div>
          ) : !selectedLabId || !selectedShift ? (
            <div className="text-gray-500 py-4">
              Please select a lab and shift to view scheduled hours.
            </div>
          ) : null}
        </div>

        {/* Utilization Data Display */}
        <div className="bg-dark-panel border border-dark-border rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-4">Utilization Data (from MongoDB)</h2>
          
          {loadingUtilization ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-400"></div>
              <span className="ml-3 text-gray-400">Loading utilization data...</span>
            </div>
          ) : utilizationData?.success && utilizationData.data ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Average Utilization</div>
                  <div className="text-2xl font-bold text-sage-400">
                    {(utilizationData.data.averageUtilization ?? 0).toFixed(2)}%
                  </div>
                </div>
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Total Scheduled Hours</div>
                  <div className="text-2xl font-bold text-gray-300">
                    {(utilizationData.data.totalScheduledHours ?? 0).toFixed(2)}h
                  </div>
                </div>
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Total Productive Hours</div>
                  <div className="text-2xl font-bold text-green-400">
                    {(utilizationData.data.totalProductiveHours ?? 0).toFixed(2)}h
                  </div>
                </div>
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Total Idle Hours</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {(utilizationData.data.totalIdleHours ?? 0).toFixed(2)}h
                  </div>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Total Non-Productive Hours</div>
                  <div className="text-2xl font-bold text-red-400">
                    {(utilizationData.data.totalNonProductiveHours ?? 0).toFixed(2)}h
                  </div>
                </div>
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Total Node Off Hours</div>
                  <div className="text-2xl font-bold text-gray-400">
                    {(utilizationData.data.totalNodeOffHours ?? 0).toFixed(2)}h
                  </div>
                </div>
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Machines with Data</div>
                  <div className="text-2xl font-bold text-gray-300">
                    {utilizationData.data.machinesWithData ?? 0} / {utilizationData.data.totalMachines ?? 0}
                  </div>
                </div>
              </div>

              {/* Machine-wise Breakdown */}
              {utilizationData.data.machineUtilizations && utilizationData.data.machineUtilizations.length > 0 && (
                <div className="bg-dark-bg border border-dark-border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Machine-wise Utilization</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-dark-border">
                          <th className="text-left py-2 px-4 text-gray-400">Machine</th>
                          <th className="text-right py-2 px-4 text-gray-400">Utilization</th>
                          <th className="text-right py-2 px-4 text-gray-400">Productive</th>
                          <th className="text-right py-2 px-4 text-gray-400">Idle</th>
                          <th className="text-right py-2 px-4 text-gray-400">Scheduled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {utilizationData.data.machineUtilizations.map((machine: any, idx: number) => (
                          <tr key={idx} className="border-b border-dark-border/50">
                            <td className="py-2 px-4 text-gray-300">{machine.machineName || 'N/A'}</td>
                            <td className="py-2 px-4 text-right text-sage-400">
                              {(machine.averageUtilization ?? 0).toFixed(2)}%
                            </td>
                            <td className="py-2 px-4 text-right text-green-400">
                              {(machine.totalProductiveHours ?? 0).toFixed(2)}h
                            </td>
                            <td className="py-2 px-4 text-right text-yellow-400">
                              {(machine.totalIdleHours ?? 0).toFixed(2)}h
                            </td>
                            <td className="py-2 px-4 text-right text-gray-300">
                              {(machine.totalScheduledHours ?? 0).toFixed(2)}h
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : utilizationData?.error ? (
            <div className="text-red-400 py-4">
              Error: {utilizationData.error}
            </div>
          ) : !selectedLabId || !selectedShift ? (
            <div className="text-gray-500 py-4">
              Please select a lab and shift to view utilization data.
            </div>
          ) : null}
        </div>

        {/* Query Parameters, Raw Results, and Calculation Details */}
        {rawQueryData && utilizationData?.success && (
          <div className="bg-dark-panel border border-dark-border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Query Details & Calculations</h2>
              <button
                onClick={() => setShowQueryCalculationDetails(!showQueryCalculationDetails)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
              >
                {showQueryCalculationDetails ? (
                  <>
                    <ChevronDownIcon className="w-4 h-4" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronRightIcon className="w-4 h-4" />
                    Show Details
                  </>
                )}
              </button>
            </div>

            {showQueryCalculationDetails && (
              <div className="space-y-6">
                {/* Query Parameters */}
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">Query Parameters Passed to API</h3>
                  <div className="bg-black/30 border border-dark-border rounded p-3 font-mono text-xs space-y-2">
                    <div className="text-gray-400">
                      <span className="text-sage-400">labId:</span> <span className="text-gray-300">{rawQueryData.parameters.labId}</span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-sage-400">shiftName:</span> <span className="text-gray-300">{rawQueryData.parameters.shiftName}</span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-sage-400">machineName:</span> <span className="text-gray-300">{rawQueryData.parameters.machineName}</span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-sage-400">startDate:</span> <span className="text-gray-300">{rawQueryData.parameters.startDate}</span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-sage-400">endDate:</span> <span className="text-gray-300">{rawQueryData.parameters.endDate}</span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-sage-400">machineNames (array):</span> 
                      <div className="ml-4 mt-1 text-gray-300">
                        {Array.isArray(rawQueryData.parameters.machineNames) 
                          ? JSON.stringify(rawQueryData.parameters.machineNames, null, 2)
                          : rawQueryData.parameters.machineNames}
                      </div>
                    </div>
                  </div>
                </div>

                {/* MongoDB Query */}
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">MongoDB Query Executed</h3>
                  <div className="bg-black/30 border border-dark-border rounded p-3">
                    <pre className="text-xs text-green-400 font-mono overflow-x-auto">
                      {JSON.stringify(rawQueryData.mongoQuery, null, 2)}
                    </pre>
                    <div className="mt-2 text-xs text-gray-500">
                      Collection: <span className="text-gray-300">labShiftUtilization</span>
                    </div>
                  </div>
                </div>

                {/* Raw Results from MongoDB */}
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Raw MongoDB Results 
                    <span className="text-sm text-gray-400 ml-2">
                      ({rawQueryData.rawResults.length} of {utilizationData.data?.machinesWithData || 0} records shown)
                    </span>
                  </h3>
                  <div className="bg-black/30 border border-dark-border rounded p-3 max-h-96 overflow-y-auto">
                    <pre className="text-xs text-yellow-400 font-mono">
                      {JSON.stringify(rawQueryData.rawResults, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Calculation Steps */}
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">Step-by-Step Utilization Calculation</h3>
                  <div className="space-y-4">
                    {rawQueryData.calculationSteps.map((step: any, idx: number) => (
                      <div key={idx} className="bg-black/30 border border-dark-border rounded p-3">
                        <div className="text-sm font-semibold text-white mb-2">
                          Machine: <span className="text-sage-400">{step.machineName}</span>
                        </div>
                        <div className="text-xs text-gray-400 space-y-1">
                          <div>
                            <span className="text-sage-400">Records found:</span> <span className="text-gray-300">{step.recordCount}</span>
                          </div>
                          <div>
                            <span className="text-sage-400">Sum of utilization values:</span> <span className="text-gray-300">{step.rawUtilizationSum.toFixed(2)}</span>
                          </div>
                          <div className="pt-2 border-t border-dark-border">
                            <span className="text-sage-400">Calculation:</span>
                            <div className="ml-4 mt-1 text-gray-300 font-mono">
                              {step.calculation}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-dark-border">
                            <span className="text-sage-400">Totals:</span>
                            <div className="ml-4 mt-1 text-gray-300 space-y-1">
                              <div>Productive: {step.totals.productiveHours.toFixed(2)}h</div>
                              <div>Idle: {step.totals.idleHours.toFixed(2)}h</div>
                              <div>Scheduled: {step.totals.scheduledHours.toFixed(2)}h</div>
                              <div>Non-Productive: {step.totals.nonProductiveHours.toFixed(2)}h</div>
                              <div>Node Off: {step.totals.nodeOffHours.toFixed(2)}h</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Overall Calculation */}
                    {utilizationData.data && (utilizationData.data as any)._debug?.overallCalculation && (
                      <div className="bg-black/30 border border-dark-border rounded p-3 mt-4">
                        <div className="text-sm font-semibold text-white mb-2">Overall Weighted Average Utilization</div>
                        <div className="text-xs text-gray-400 space-y-1">
                          <div>
                            <span className="text-sage-400">Formula:</span>
                            <div className="ml-4 mt-1 text-gray-300 font-mono">
                              {(utilizationData.data as any)._debug.overallCalculation.formula}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-dark-border">
                            <span className="text-sage-400">Calculation:</span>
                            <div className="ml-4 mt-1 text-gray-300 font-mono">
                              {(utilizationData.data as any)._debug.overallCalculation.result}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-dark-border">
                            <span className="text-sage-400">Final Result:</span>
                            <span className="ml-2 text-2xl font-bold text-sage-400">
                              {utilizationData.data.averageUtilization.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Query Info and Last Seen */}
        {(queryInfo || loadingQueryInfo) && (
          <div className="bg-dark-panel border border-dark-border rounded-lg p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Query Information & Last Seen</h2>
              <button
                onClick={() => setShowQueryDetails(!showQueryDetails)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
              >
                {showQueryDetails ? (
                  <>
                    <ChevronDownIcon className="w-4 h-4" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronRightIcon className="w-4 h-4" />
                    Show Details
                  </>
                )}
              </button>
            </div>

            {loadingQueryInfo ? (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sage-400"></div>
                <span>Loading query information...</span>
              </div>
            ) : queryInfo?.success ? (
              <div className="space-y-4">
                {/* Last Seen Date */}
                {queryInfo.lastSeenDate && (
                  <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Last Seen Utilization Data</div>
                        <div className="text-lg font-semibold text-sage-400">
                          {queryInfo.lastSeenDate}
                        </div>
                        {queryInfo.lastSeenRecord && (
                          <div className="text-xs text-gray-500 mt-2">
                            Shift: {queryInfo.lastSeenRecord.shift_name} | 
                            Utilization: {queryInfo.lastSeenRecord.utilization.toFixed(2)}% | 
                            Scheduled: {queryInfo.lastSeenRecord.scheduled_hours.toFixed(2)}h
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Query Details (Collapsible) */}
                {showQueryDetails && (
                  <div className="space-y-4">
                    {/* MongoDB Query */}
                    <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                      <div className="text-sm font-semibold text-gray-300 mb-2">MongoDB Query</div>
                      <div className="text-xs text-gray-500 mb-2">
                        Collection: <span className="text-sage-400">{queryInfo.collection}</span> | 
                        Database: <span className="text-sage-400">{queryInfo.database}</span> | 
                        Records Found: <span className="text-sage-400">{queryInfo.recordCount || 0}</span>
                      </div>
                      <pre className="bg-black/50 border border-dark-border rounded p-3 text-xs text-green-400 font-mono overflow-x-auto">
                        {queryInfo.queryString || JSON.stringify(queryInfo.query, null, 2)}
                      </pre>
                    </div>

                    {/* Query Parameters */}
                    {queryInfo.parameters && (
                      <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                        <div className="text-sm font-semibold text-gray-300 mb-2">Query Parameters</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Lab ID:</span>
                            <span className="ml-2 text-gray-300">{queryInfo.parameters.labId}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Shift:</span>
                            <span className="ml-2 text-gray-300">{queryInfo.parameters.shiftName}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Machine:</span>
                            <span className="ml-2 text-gray-300">{queryInfo.parameters.machineName}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Machine Count:</span>
                            <span className="ml-2 text-gray-300">{queryInfo.parameters.machineCount}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Start Date:</span>
                            <span className="ml-2 text-gray-300">{queryInfo.parameters.startDate}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">End Date:</span>
                            <span className="ml-2 text-gray-300">{queryInfo.parameters.endDate}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : queryInfo?.error ? (
              <div className="text-red-400 text-sm">Error: {queryInfo.error}</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

