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
}

interface ScheduledHoursResponse {
  success: boolean;
  scheduledHours?: number;
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
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showJsonData, setShowJsonData] = useState(false);
  const [jsonDataForDisplay, setJsonDataForDisplay] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const isAnalysisInProgress = useRef(false);
  const lastAnalysisDataKey = useRef<string | null>(null);

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
    setAnalysis(null); // Clear previous analysis
    setJsonDataForDisplay(null); // Clear previous JSON
    
    // Reset the analysis data key to force new analysis when new lab data loads
    lastAnalysisDataKey.current = null;
    
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

  // Get all page data as JSON structure (memoized to prevent unnecessary recreations)
  const getAllPageData = useCallback(() => {
    // Always use the latest state values - find current selections
    const selectedLab = labs.find(l => l._id === selectedLabId);
    
    // Only find machine if machineId is set AND it exists in current machines array
    // This prevents using stale machine data from previous lab
    let selectedMachine = null;
    if (selectedMachineId && machines.length > 0) {
      const foundMachine = machines.find(m => m._id === selectedMachineId);
      // Validate: machine must exist in current machines array (which is filtered by current lab)
      if (foundMachine) {
        selectedMachine = foundMachine;
      } else {
        // Machine ID exists but not in current machines array - likely from previous lab
        console.warn('[getAllPageData] Selected machine ID not found in current machines array, clearing machine selection');
      }
    }
    
    const selectedShiftObj = labShifts.find(s => s.name === selectedShift);
    
    // Log current state to verify it's fresh
    console.log('[getAllPageData] ✅ Generating fresh JSON with current state:', {
      selectedLabId,
      selectedLabName: selectedLab?.name || 'none',
      selectedMachineId: selectedMachineId || 'none',
      selectedMachineName: selectedMachine?.machineName || 'none',
      machinesCount: machines.length,
      machineIdsInArray: machines.map(m => m._id),
      selectedShift: selectedShift || 'none',
      dateRange: `${formatDateForAPI(dateRange.startDate)} to ${formatDateForAPI(dateRange.endDate)}`
    });

    return {
      timestamp: new Date().toISOString(),
      page: 'Insights',
      user: {
        id: user?._id || null,
        name: user?.name || null,
        email: user?.email || null,
      },
      selections: {
        lab: {
          id: selectedLabId,
          name: selectedLab?.name || null,
        },
        machine: {
          id: selectedMachine && selectedMachineId ? selectedMachineId : null,
          name: selectedMachine?.machineName || null,
          description: selectedMachine?.description || null,
        },
        shift: {
          name: selectedShift,
          startTime: selectedShiftObj?.startTime || null,
          endTime: selectedShiftObj?.endTime || null,
        },
        dateRange: {
          startDate: formatDateForAPI(dateRange.startDate),
          endDate: formatDateForAPI(dateRange.endDate),
          startDateISO: dateRange.startDate.toISOString(),
          endDateISO: dateRange.endDate.toISOString(),
        },
      },
      scheduledHours: {
        loading: loadingScheduledHours,
        data: scheduledHoursData ? {
          success: scheduledHoursData.success,
          scheduledHours: scheduledHoursData.scheduledHours,
          shiftInfo: scheduledHoursData.shiftInfo ? {
            shiftName: scheduledHoursData.shiftInfo.shiftName,
            startTime: scheduledHoursData.shiftInfo.startTime,
            endTime: scheduledHoursData.shiftInfo.endTime,
            shiftDuration: scheduledHoursData.shiftInfo.shiftDuration,
            numberOfDays: scheduledHoursData.shiftInfo.numberOfDays,
          } : null,
          error: scheduledHoursData.error || null,
        } : null,
        apiCall: {
          endpoint: '/api/scheduled-hours',
          parameters: {
            labId: selectedLabId,
            shiftName: selectedShift,
            startDate: formatDateForAPI(dateRange.startDate),
            endDate: formatDateForAPI(dateRange.endDate),
          },
        },
      },
      utilization: {
        loading: loadingUtilization,
        data: utilizationData ? {
          success: utilizationData.success,
          shiftName: utilizationData.data?.shiftName || null,
          totalMachines: utilizationData.data?.totalMachines || null,
          machinesWithData: utilizationData.data?.machinesWithData || null,
          averageUtilization: utilizationData.data?.averageUtilization || null,
          totalProductiveHours: utilizationData.data?.totalProductiveHours || null,
          totalIdleHours: utilizationData.data?.totalIdleHours || null,
          totalScheduledHours: utilizationData.data?.totalScheduledHours || null,
          totalNonProductiveHours: utilizationData.data?.totalNonProductiveHours || null,
          totalNodeOffHours: utilizationData.data?.totalNodeOffHours || null,
          machineUtilizations: utilizationData.data?.machineUtilizations || [],
          error: utilizationData.error || null,
        } : null,
        apiCall: {
          endpoint: '/api/shift-utilization',
          parameters: {
            labId: selectedLabId,
            shiftName: selectedShift,
            startDate: formatDateForAPI(dateRange.startDate),
            endDate: formatDateForAPI(dateRange.endDate),
            machineName: selectedMachine && selectedMachineId ? selectedMachine.machineName : null,
          },
        },
      },
      queryInfo: {
        loading: loadingQueryInfo,
        data: queryInfo ? {
          success: queryInfo.success,
          collection: queryInfo.collection,
          database: queryInfo.database,
          recordCount: queryInfo.recordCount,
          lastSeenDate: queryInfo.lastSeenDate,
          lastSeenRecord: queryInfo.lastSeenRecord,
          query: queryInfo.query,
          parameters: queryInfo.parameters,
          error: queryInfo.error || null,
        } : null,
        apiCall: {
          endpoint: '/api/shift-utilization/query-info',
          parameters: {
            labId: selectedLabId,
            shiftName: selectedShift,
            startDate: formatDateForAPI(dateRange.startDate),
            endDate: formatDateForAPI(dateRange.endDate),
            machineName: selectedMachine && selectedMachineId ? selectedMachine.machineName : null,
          },
        },
      },
      calculationSteps: calculationSteps,
      availableData: {
        labs: labs.map(l => ({ id: l._id, name: l.name })),
        machines: machines.map(m => ({ 
          id: m._id, 
          name: m.machineName, 
          description: m.description || null 
        })),
        shifts: labShifts.map(s => ({ 
          name: s.name, 
          startTime: s.startTime, 
          endTime: s.endTime 
        })),
      },
    };
  }, [selectedLabId, selectedMachineId, selectedShift, dateRange, labs, machines, labShifts, user, scheduledHoursData, utilizationData, loadingScheduledHours, loadingUtilization, queryInfo, loadingQueryInfo, calculationSteps]);

  // Fetch query info and last seen date
  const fetchQueryInfo = useCallback(async () => {
    if (!selectedLabId || !selectedShift) {
      setQueryInfo(null);
      setCalculationSteps([]);
      return;
    }

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
      
      setUtilizationData(data);
      setCalculationSteps(prev => [...prev, ...steps]);
      
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

  // Extract AI Analysis function
  const fetchAIAnalysis = useCallback(async (isManual = false) => {
    // Prevent duplicate calls
    if (isAnalysisInProgress.current) {
      return;
    }

    // Don't analyze if required selections are missing
    if (!selectedLabId || !selectedShift) {
      return;
    }

    isAnalysisInProgress.current = true;
    setLoadingAnalysis(true);
    setShowAnalysis(true); // Auto-expand the section

    try {
      // Get all page data (JSON) - generates FRESH JSON with current selections
      // This is called every time fetchAIAnalysis runs, so it always has the latest data
      const jsonData = getAllPageData();

      // Log the JSON being sent to OpenAI
      console.log('[AI Analysis] ✅ Generating NEW JSON with current selections');
      console.log('[AI Analysis] Current selections in JSON:', {
        lab: jsonData.selections?.lab?.name || jsonData.selections?.lab?.id,
        machine: jsonData.selections?.machine?.name || jsonData.selections?.machine?.id || 'All machines',
        shift: jsonData.selections?.shift?.name,
        dateRange: `${jsonData.selections?.dateRange?.startDate} to ${jsonData.selections?.dateRange?.endDate}`
      });
      console.log('[AI Analysis] Full JSON being sent to OpenAI:', JSON.stringify(jsonData, null, 2));
      console.log('[AI Analysis] JSON size:', JSON.stringify(jsonData).length, 'characters');

      // Send to OpenAI for analysis
      const response = await fetch('/api/insights/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      });

      const data = await response.json();
      if (data.success) {
        setAnalysis(data.analysis);
        // Only show success toast on manual refresh
        if (isManual) {
          toast.success('AI Insights generated successfully!');
        }
      } else {
        throw new Error(data.error || 'Failed to generate analysis');
      }
    } catch (error: any) {
      console.error('[AI Insights] Error:', error);
      // Only show error toast on manual refresh, not auto-load
      if (isManual) {
        toast.error(error.message || 'Failed to generate AI insights');
      }
      setAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
      isAnalysisInProgress.current = false;
    }
  }, [selectedLabId, selectedShift, selectedMachineId, dateRange, getAllPageData]);

  // Update JSON display whenever ANY selection OR data changes
  useEffect(() => {
    // Generate fresh JSON immediately when selections or data changes
    if (selectedLabId && selectedShift) {
      const freshJson = getAllPageData();
      setJsonDataForDisplay(freshJson);
      console.log('[JSON Update] ✅ Updated JSON display - Selection or data changed:', {
        labId: selectedLabId,
        machineId: selectedMachineId || 'all machines',
        shift: selectedShift,
        dateRange: `${formatDateForAPI(dateRange.startDate)} to ${formatDateForAPI(dateRange.endDate)}`,
        hasScheduledHours: !!scheduledHoursData,
        hasUtilization: !!utilizationData
      });
    } else {
      // Clear JSON if required selections are missing
      setJsonDataForDisplay(null);
    }
  }, [
    selectedLabId, 
    selectedMachineId, 
    selectedShift, 
    dateRange, 
    scheduledHoursData, 
    utilizationData,
    queryInfo,
    getAllPageData
  ]);

  // Auto-trigger AI analysis when all required data is ready
  useEffect(() => {
    // Only trigger if all required data is ready
    if (
      selectedLabId &&
      selectedShift &&
      !loadingScheduledHours &&
      !loadingUtilization &&
      scheduledHoursData &&
      utilizationData &&
      !isAnalysisInProgress.current
    ) {
      // Create a unique key for the current data state to prevent duplicate calls
      // Include all relevant selections: lab, machine, shift, and date range
      const dataKey = `${selectedLabId}-${selectedMachineId || 'all'}-${selectedShift}-${formatDateForAPI(dateRange.startDate)}-${formatDateForAPI(dateRange.endDate)}-${scheduledHoursData?.scheduledHours}-${utilizationData?.data?.totalScheduledHours}`;
      
      // Only trigger if this is a new data state (prevents duplicate calls for the same data)
      if (lastAnalysisDataKey.current !== dataKey) {
        console.log('[AI Analysis Auto-Trigger] Selection changed, generating new JSON and triggering analysis');
        console.log('[AI Analysis Auto-Trigger] Previous dataKey:', lastAnalysisDataKey.current);
        console.log('[AI Analysis Auto-Trigger] New dataKey:', dataKey);
        console.log('[AI Analysis Auto-Trigger] Selections:', {
          labId: selectedLabId,
          machineId: selectedMachineId || 'all machines',
          shift: selectedShift,
          dateRange: `${formatDateForAPI(dateRange.startDate)} to ${formatDateForAPI(dateRange.endDate)}`
        });
        lastAnalysisDataKey.current = dataKey;
        fetchAIAnalysis(false); // false = auto-trigger, not manual - this will generate fresh JSON
      } else {
        console.log('[AI Analysis Auto-Trigger] Data unchanged, skipping analysis (dataKey matches previous)');
      }
    }
  }, [
    selectedLabId,
    selectedShift,
    selectedMachineId,
    dateRange,
    scheduledHoursData,
    utilizationData,
    loadingScheduledHours,
    loadingUtilization,
    fetchAIAnalysis,
  ]);

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

        {/* JSON Data Display - Always visible when selections are made */}
        {jsonDataForDisplay && selectedLabId && selectedShift && (
          <div className="bg-dark-panel border border-dark-border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-end mb-4">
              <button
                onClick={() => setShowJsonData(!showJsonData)}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white px-2 py-1 border border-dark-border rounded"
              >
                {showJsonData ? (
                  <>
                    <ChevronDownIcon className="w-3 h-3" />
                    Hide JSON
                  </>
                ) : (
                  <>
                    <ChevronRightIcon className="w-3 h-3" />
                    Show JSON
                  </>
                )}
              </button>
            </div>
            
            {/* JSON Data Display */}
            {showJsonData && (
              <div className="bg-black border border-dark-border rounded-lg p-4">
                <div className="mb-2 text-xs text-gray-500">
                  This JSON is automatically updated when you change lab, machine, shift, or date range.
                  It will be sent to OpenAI when analysis is triggered.
                </div>
                <pre className="text-xs text-green-400 font-mono overflow-x-auto max-h-96 overflow-y-auto">
                  {JSON.stringify(jsonDataForDisplay, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* AI Analysis Display */}
        {(analysis || loadingAnalysis) && (
          <div className="bg-dark-panel border border-dark-border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">AI Analysis</h2>
              <button
                onClick={() => setShowAnalysis(!showAnalysis)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
              >
                {showAnalysis ? (
                  <>
                    <ChevronDownIcon className="w-4 h-4" />
                    Hide
                  </>
                ) : (
                  <>
                    <ChevronRightIcon className="w-4 h-4" />
                    Show
                  </>
                )}
              </button>
            </div>
            
            {showAnalysis && (
              <>
                {loadingAnalysis ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-400"></div>
                    <span className="ml-3 text-gray-400">Generating analysis...</span>
                  </div>
                ) : analysis ? (
                  <div className="bg-dark-bg border border-dark-border rounded-lg p-6">
                    <div className="prose prose-invert max-w-none">
                      <div className="text-gray-300 leading-relaxed">
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
                            <p key={index} className="mb-3 last:mb-0 text-gray-300">
                              {cleanLine}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(analysis);
                        toast.success('Analysis copied to clipboard!');
                      }}
                      className="mt-4 px-3 py-1 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors"
                    >
                      Copy Analysis
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-400 py-4">
                    Click "AI Insights" to generate insights from the page data.
                  </div>
                )}
              </>
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
                              {(machine.utilization ?? 0).toFixed(2)}%
                            </td>
                            <td className="py-2 px-4 text-right text-green-400">
                              {(machine.productiveHours ?? 0).toFixed(2)}h
                            </td>
                            <td className="py-2 px-4 text-right text-yellow-400">
                              {(machine.idleHours ?? 0).toFixed(2)}h
                            </td>
                            <td className="py-2 px-4 text-right text-gray-300">
                              {(machine.scheduledHours ?? 0).toFixed(2)}h
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

