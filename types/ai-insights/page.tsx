'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChartIcon, CalendarIcon, ShopfloorsIcon, ChevronDownIcon, ChevronRightIcon, AlertIcon, ClockIcon, TrendingUpIcon, ArrowUpIcon, ArrowDownIcon, SignalIcon } from '@/components/Icons';
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
  const [previousMonthStats, setPreviousMonthStats] = useState<MaintenanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [wiseAnalysisExpanded, setWiseAnalysisExpanded] = useState(true); // Auto-expand by default
  const [wiseAnalysis, setWiseAnalysis] = useState<string | null>(null);
  const [loadingWiseAnalysis, setLoadingWiseAnalysis] = useState(false);
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [previousAlertsCount, setPreviousAlertsCount] = useState<number | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [downtimeIncidentsCount, setDowntimeIncidentsCount] = useState<number>(0);
  const [previousDowntimeIncidentsCount, setPreviousDowntimeIncidentsCount] = useState<number | null>(null);
  const [loadingDowntimeIncidents, setLoadingDowntimeIncidents] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [labShifts, setLabShifts] = useState<Shift[]>([]);
  const [shiftUtilization, setShiftUtilization] = useState<any>(null);
  const [previousMonthShiftUtilization, setPreviousMonthShiftUtilization] = useState<any>(null);
  const [loadingShiftUtilization, setLoadingShiftUtilization] = useState(false);
  // Initialize dateRange to current month (first day to last day)
  const getCurrentMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { startDate, endDate };
  };
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>(getCurrentMonthRange());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const fetchingWiseAnalysisRef = useRef(false);

  // Helper function to get period label
  const getPeriodLabel = (range: { startDate: Date; endDate: Date }) => {
    const days = getDaysDifference(range.startDate, range.endDate);
    if (days === 1) return 'Prev Day';
    if (days === 7) return 'Prev 7 Days';
    if (days === 30) return 'Prev 30 Days';
    return `Prev ${days} Days`;
  };

  // Helper component to show comparison with previous period
  const ComparisonBadge = ({ current, previous, format = (val: number) => val.toFixed(1), isPercentage = false, lowerIsBetter = false }: { current: number; previous: number | null; format?: (val: number) => string; isPercentage?: boolean; lowerIsBetter?: boolean }) => {
    if (previous === null || previous === undefined) {
      return null;
    }
    
    const diff = current - previous;
    const isIncrease = diff > 0;
    const isBetter = lowerIsBetter ? !isIncrease : isIncrease;
    const periodLabel = getPeriodLabel(dateRange);
    
    return (
      <div className="flex items-center gap-1 mt-1">
        <span className="text-xs text-gray-500">
          {periodLabel}: {format(previous)}{isPercentage ? '%' : ''}
        </span>
        {Math.abs(diff) > 0.01 && (
          <span className={`text-xs ${isBetter ? 'text-green-400' : 'text-red-400'}`}>
            {isIncrease ? (
              <ArrowUpIcon className="w-3 h-3 inline" />
            ) : (
              <ArrowDownIcon className="w-3 h-3 inline" />
            )}
          </span>
        )}
      </div>
    );
  };

  // Helper function to format date range for display
  const getDateRangeLabel = (range: { startDate: Date; endDate: Date }) => {
    const start = range.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const end = range.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // If same month and year, simplify
    if (range.startDate.getMonth() === range.endDate.getMonth() && 
        range.startDate.getFullYear() === range.endDate.getFullYear()) {
      if (range.startDate.getDate() === range.endDate.getDate()) {
        // Single day
        return range.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      // Same month, different days
      return `${range.startDate.getDate()} - ${range.endDate.getDate()}, ${range.startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }
    
    return `${start} - ${end}`;
  };

  // Calculate number of days in date range
  const getDaysDifference = (startDate: Date, endDate: Date) => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    return diffDays;
  };

  // Calculate previous period of same length
  const calculatePreviousPeriod = (range: { startDate: Date; endDate: Date }) => {
    const days = getDaysDifference(range.startDate, range.endDate);
    const prevEndDate = new Date(range.startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1); // Day before start date
    prevEndDate.setHours(23, 59, 59, 999);
    
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - (days - 1)); // Go back (days - 1) to get the start
    prevStartDate.setHours(0, 0, 0, 0);
    
    return { startDate: prevStartDate, endDate: prevEndDate };
  };

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isDateInRange = (date: Date, range: { startDate: Date; endDate: Date }) => {
    const dateTime = new Date(date).setHours(0, 0, 0, 0);
    const startTime = new Date(range.startDate).setHours(0, 0, 0, 0);
    const endTime = new Date(range.endDate).setHours(0, 0, 0, 0);
    return dateTime >= startTime && dateTime <= endTime;
  };

  const isDateStart = (date: Date, range: { startDate: Date; endDate: Date }) => {
    const dateTime = new Date(date).setHours(0, 0, 0, 0);
    const startTime = new Date(range.startDate).setHours(0, 0, 0, 0);
    return dateTime === startTime;
  };

  const isDateEnd = (date: Date, range: { startDate: Date; endDate: Date }) => {
    const dateTime = new Date(date).setHours(0, 0, 0, 0);
    const endTime = new Date(range.endDate).setHours(0, 0, 0, 0);
    return dateTime === endTime;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Calendar popup component
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

    // Reset when calendar opens
    useEffect(() => {
      if (isOpen) {
        setCurrentMonth(new Date(selectedRange.startDate));
        setSelectingStart(true);
        setTempStart(null);
        setTempEnd(null);
      }
    }, [isOpen, selectedRange.startDate]);

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
        // Auto-select Maheen Textiles lab if available, otherwise first lab
        const maheenLab = data.labs.find((lab: Lab) => {
          const labName = lab.name?.toLowerCase() || '';
          return labName.includes('maheen') || labName.includes('textiles');
        });
        console.log('[AI Insights] Maheen Textiles lab found:', maheenLab);
        const labToSelect = maheenLab || data.labs[0];
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
  const fetchShiftUtilization = useCallback(async (labId: string, shiftName: string, range?: { startDate: Date; endDate: Date }) => {
    setLoadingShiftUtilization(true);
    try {
      const selectedRange = range || dateRange;
      const prevRange = calculatePreviousPeriod(selectedRange);
      
      // Fetch current period
      const response = await fetch(`/api/shift-utilization?labId=${labId}&shiftName=${shiftName}&startDate=${selectedRange.startDate.toISOString().split('T')[0]}&endDate=${selectedRange.endDate.toISOString().split('T')[0]}`);
      if (!response.ok) {
        throw new Error('Failed to fetch shift utilization');
      }
      const data = await response.json();
      if (data.success) {
        setShiftUtilization(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch shift utilization');
      }

      // Fetch previous period for comparison
      try {
        const prevResponse = await fetch(`/api/shift-utilization?labId=${labId}&shiftName=${shiftName}&startDate=${prevRange.startDate.toISOString().split('T')[0]}&endDate=${prevRange.endDate.toISOString().split('T')[0]}`);
        if (prevResponse.ok) {
          const prevData = await prevResponse.json();
          if (prevData.success) {
            setPreviousMonthShiftUtilization(prevData.data);
          }
        }
      } catch (error) {
        console.error('Error fetching previous period shift utilization:', error);
        setPreviousMonthShiftUtilization(null);
      }
    } catch (error: any) {
      console.error('Error fetching shift utilization:', error);
      toast.error('Failed to load shift utilization data');
      setShiftUtilization(null);
    } finally {
      setLoadingShiftUtilization(false);
    }
  }, [dateRange]);

  // Fetch shift utilization when shift is selected
  useEffect(() => {
    if (selectedLabId && selectedShift) {
      fetchShiftUtilization(selectedLabId, selectedShift, dateRange);
    } else {
      setShiftUtilization(null);
      setPreviousMonthShiftUtilization(null);
    }
  }, [selectedLabId, selectedShift, dateRange, fetchShiftUtilization]);

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

    // Reset wise analysis when lab, shift, or date range changes (but keep expanded)
    setWiseAnalysis(null);
    setWiseAnalysisExpanded(true); // Keep expanded when lab/shift/date range changes
    setLoadingWiseAnalysis(false);
    fetchingWiseAnalysisRef.current = false;

    // Fetch all data in parallel (will use shift-specific data if shift is selected)
    fetchAllLabData(selectedLabId, selectedShift, dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLabId, selectedShift, dateRange]);

  // Optimized: Single function to fetch all lab data in parallel
  const fetchAllLabData = async (labId: string, shiftName?: string, range?: { startDate: Date; endDate: Date }) => {
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
        setPreviousAlertsCount(null);
        setDowntimeIncidentsCount(0);
        setPreviousDowntimeIncidentsCount(null);
        setLoadingStats(false);
        setLoadingAlerts(false);
        setLoadingDowntimeIncidents(false);
        return;
      }

      // Step 2: Use provided date range or default to current dateRange
      const selectedRange = range || dateRange;
      const prevRange = calculatePreviousPeriod(selectedRange);

      // Step 3: Fetch all independent data in parallel
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
              params.append('startDate', selectedRange.startDate.toISOString());
              params.append('endDate', selectedRange.endDate.toISOString());
              
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
        return workOrderDate >= selectedRange.startDate && workOrderDate <= selectedRange.endDate && machineIds.includes(wo.machineId);
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
          const shiftUtilResponse = await fetch(`/api/shift-utilization?labId=${labId}&shiftName=${currentShift}&startDate=${selectedRange.startDate.toISOString().split('T')[0]}&endDate=${selectedRange.endDate.toISOString().split('T')[0]}`);
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
                    const res = await fetch(`/api/shift-utilization?labId=${labId}&shiftName=${shift.name}&startDate=${selectedRange.startDate.toISOString().split('T')[0]}&endDate=${selectedRange.endDate.toISOString().split('T')[0]}`);
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
          // Calculate days difference for timeRange
          const daysDiff = getDaysDifference(selectedRange.startDate, selectedRange.endDate);
          // Fetch downtime from InfluxDB for all machines and aggregate
        const downtimePromises = machineIds.map(async (machineId: string) => {
          try {
              console.log(`[AI Insights] Fetching InfluxDB downtime for machineId: ${machineId}, timeRange: -${daysDiff}d`);
              const downtimeRes = await fetch(`/api/influxdb/downtime?machineId=${machineId}&timeRange=-${daysDiff}d`);
              if (downtimeRes.ok) {
                const downtimeData = await downtimeRes.json();
                console.log(`[AI Insights] Machine ${machineId}: InfluxDB response:`, JSON.stringify(downtimeData, null, 2));
                // Check if we got actual data (not just empty response)
                if (downtimeData.data && downtimeData.data.totalDowntime !== undefined && downtimeData.data.totalUptime !== undefined) {
                  const data = downtimeData.data;
                  const timePeriod = (data.totalDowntime || 0) + (data.totalUptime || 0);
                  // Only return data if we have a valid time period (machine has data)
                  // If timePeriod is 0, it means no data was found, so don't use this result
                  if (timePeriod > 0) {
                    console.log(`[AI Insights] Machine ${machineId}: Got downtime data - downtime: ${data.totalDowntime}s (${(data.totalDowntime/3600).toFixed(2)}h), uptime: ${data.totalUptime}s (${(data.totalUptime/3600).toFixed(2)}h), downtime%: ${data.downtimePercentage}%, incidents: ${data.incidentCount}`);
                return {
                      downtime: data.totalDowntime || 0,
                      uptime: data.totalUptime || 0,
                      timePeriod: timePeriod,
                      incidents: data.incidentCount || 0,
                    };
                  } else {
                    console.log(`[AI Insights] Machine ${machineId}: timePeriod is 0, no valid data`);
                  }
                } else {
                  console.log(`[AI Insights] Machine ${machineId}: Response structure unexpected or missing data field`);
                }
              } else {
                console.log(`[AI Insights] Machine ${machineId}: InfluxDB API returned status ${downtimeRes.status}`);
            }
          } catch (error) {
              console.error(`[AI Insights] Error fetching InfluxDB downtime for machine ${machineId}:`, error);
          }
            // Return null to indicate no valid data found (don't assume 100% downtime)
            return null;
        });

        const downtimeResults = await Promise.all(downtimePromises);
        const validResults = downtimeResults.filter(result => result !== null);
        
        if (validResults.length > 0) {
          validResults.forEach(result => {
            if (result) {
          totalDowntime += result.downtime;
          totalUptime += result.uptime;
              totalTimePeriod += result.timePeriod;
              totalIncidents += result.incidents;
            }
          });
        } else {
          // No valid InfluxDB data found - don't assume 100% downtime
          // The machine might be sending data but not vibration data, or data might be in a different format
          console.log('[AI Insights] No valid InfluxDB downtime data found for any machines');
          console.log('[AI Insights] This could mean:');
          console.log('  1. Machine is sending data but not vibration data');
          console.log('  2. MachineId format doesn\'t match InfluxDB');
          console.log('  3. Data exists in a different bucket/measurement');
          console.log('  4. Machine truly has no data');
          // Don't assume 100% downtime - leave as 0 so it shows as "no data" rather than misleading 100% downtime
        }
      } catch (error) {
          console.error('Error fetching InfluxDB downtime as fallback:', error);
          // If InfluxDB also fails, don't assume 100% downtime
          // Leave totalTimePeriod as 0 so we don't show misleading 100% downtime
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

      // Fetch previous period data for comparison
      try {
        // Fetch previous period work orders
        const prevWorkOrdersData = await fetch('/api/work-orders').then(res => res.ok ? res.json() : { data: [] });
        const prevWorkOrders = prevWorkOrdersData.data || [];
        const prevRelevantWorkOrders = prevWorkOrders.filter((wo: any) => {
          const workOrderDate = new Date(wo.createdAt || wo._time);
          return workOrderDate >= prevRange.startDate && workOrderDate <= prevRange.endDate && machineIds.includes(wo.machineId);
        });

        // Fetch previous period alerts
        const prevAlertsResults = await Promise.all(
          machineIds.map(async (machineId: string) => {
        try {
          const params = new URLSearchParams();
          params.append('machineId', machineId);
          params.append('limit', '1000');
              params.append('startDate', prevRange.startDate.toISOString());
              params.append('endDate', prevRange.endDate.toISOString());
              
              const res = await fetch(`/api/alarm-events?${params.toString()}`);
              if (res.ok) {
                const data = await res.json();
            return data.alerts?.length || 0;
          }
        } catch (error) {
              console.error(`Error fetching previous period alerts for machine ${machineId}:`, error);
        }
        return 0;
          })
        );
        const prevTotalAlerts = prevAlertsResults.reduce((sum, count) => sum + count, 0);
        setPreviousAlertsCount(prevTotalAlerts);

        // Fetch previous period shift utilization or InfluxDB data
        let prevTotalDowntime = 0;
        let prevTotalUptime = 0;
        let prevTotalTimePeriod = 0;
        let prevTotalIncidents = 0;

        if (currentShift) {
          try {
            const prevUtilResponse = await fetch(`/api/shift-utilization?labId=${labId}&shiftName=${currentShift}&startDate=${prevRange.startDate.toISOString().split('T')[0]}&endDate=${prevRange.endDate.toISOString().split('T')[0]}`).catch(() => null);
            if (prevUtilResponse && prevUtilResponse.ok) {
              const prevUtilData = await prevUtilResponse.json();
              if (prevUtilData.success && prevUtilData.data) {
                prevTotalDowntime = (prevUtilData.data.totalNonProductiveHours || 0) * 3600;
                prevTotalUptime = ((prevUtilData.data.totalProductiveHours || 0) + (prevUtilData.data.totalIdleHours || 0)) * 3600;
                prevTotalTimePeriod = (prevUtilData.data.totalScheduledHours || 0) * 3600;
                prevTotalIncidents = prevUtilData.data.machineUtilizations.reduce((sum: number, m: any) => sum + (m.recordCount || 0), 0);
              }
          }
        } catch (error) {
            console.error('Error fetching previous period shift utilization:', error);
          }
        } else {
          // Aggregate previous period across all shifts
          try {
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
                  const prevShiftPromises = lab.shifts.map(async (shift: Shift) => {
                    try {
                      const res = await fetch(`/api/shift-utilization?labId=${labId}&shiftName=${shift.name}&startDate=${prevRange.startDate.toISOString().split('T')[0]}&endDate=${prevRange.endDate.toISOString().split('T')[0]}`).catch(() => null);
                      if (res && res.ok) {
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
                      console.error(`Error fetching previous period shift ${shift.name}:`, error);
                    }
                    return { downtime: 0, scheduled: 0, productive: 0, idle: 0, incidents: 0 };
                  });
                  
                  const prevShiftResults = await Promise.all(prevShiftPromises);
                  prevShiftResults.forEach(result => {
                    prevTotalDowntime += result.downtime;
                    prevTotalUptime += (result.productive + result.idle);
                    prevTotalTimePeriod += result.scheduled;
                    prevTotalIncidents += result.incidents;
                  });
                }
              }
          }
        } catch (error) {
            console.error('Error fetching previous period shifts:', error);
          }
        }

        const prevDowntimePercentage = prevTotalTimePeriod > 0 ? (prevTotalDowntime / prevTotalTimePeriod) * 100 : 0;
        const prevUptimePercentage = prevTotalTimePeriod > 0 ? (prevTotalUptime / prevTotalTimePeriod) * 100 : 0;

        setPreviousMonthStats({
          totalMachines: labMachines.length, // Same as current
          scheduledMaintenanceCount: prevRelevantWorkOrders.length,
          machinesWithMaintenance: [],
          totalDowntime: prevTotalDowntime,
          totalUptime: prevTotalUptime,
          downtimePercentage: prevDowntimePercentage,
          uptimePercentage: prevUptimePercentage,
        });
        setPreviousDowntimeIncidentsCount(prevTotalIncidents);
      } catch (error) {
        console.error('Error fetching previous month data:', error);
        setPreviousMonthStats(null);
        setPreviousAlertsCount(null);
        setPreviousDowntimeIncidentsCount(null);
      }

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
      setPreviousAlertsCount(null);
      setDowntimeIncidentsCount(0);
      setPreviousDowntimeIncidentsCount(null);
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
          timePeriod: getDateRangeLabel(dateRange),
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

        {/* Lab Selection and Month Selector */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-3 relative">
            <label className="text-gray-400 text-sm">Date Range:</label>
            <button
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="flex items-center gap-2 bg-dark-panel border border-dark-border rounded px-3 py-2 text-white text-sm hover:bg-dark-bg transition-colors"
            >
              <CalendarIcon className="w-4 h-4 text-sage-400" />
              <span className="min-w-[180px] text-left">{getDateRangeLabel(dateRange)}</span>
            </button>
            <DateRangeCalendar
              isOpen={isCalendarOpen}
              onClose={() => setIsCalendarOpen(false)}
              selectedRange={dateRange}
              onRangeSelect={(range) => {
                // Ensure dates are properly set with correct time boundaries
                const newRange = {
                  startDate: new Date(range.startDate),
                  endDate: new Date(range.endDate)
                };
                newRange.startDate.setHours(0, 0, 0, 0);
                newRange.endDate.setHours(23, 59, 59, 999);
                setDateRange(newRange);
                setIsCalendarOpen(false);
                console.log('[AI Insights] Date range updated:', {
                  start: newRange.startDate.toISOString(),
                  end: newRange.endDate.toISOString()
                });
              }}
            />
      </div>
        </div>
      </div>

      {/* Shift Tabs - Right Side, Above Performance */}
      {selectedLabId && labShifts.length > 0 && (
        <div className="mt-4 flex justify-end">
          {labShifts.map((shift) => (
            <button
              key={shift.name}
              onClick={() => setSelectedShift(shift.name)}
              className={`px-6 py-3 text-sm font-medium transition-colors flex flex-col items-center ${
                selectedShift === shift.name
                  ? 'text-sage-400 border-b-2 border-sage-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <span>{formatShiftName(shift.name)}</span>
              {shift.startTime && shift.endTime && (
                <span className="text-xs text-gray-500 mt-0.5">
                  {shift.startTime} - {shift.endTime}
                </span>
              )}
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
                  <div className="flex items-center gap-2 text-sage-400 animate-pulse">
                    <div className="w-4 h-4 border-2 border-sage-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium">Gathering insights...</span>
                  </div>
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
              <ClockIcon className="w-5 h-5 text-sage-400" />
              Performance
            </h2>
            <span className="text-xs text-gray-500">{getDateRangeLabel(dateRange)}</span>
          </div>

          {loadingStats ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-sage-400 animate-pulse">
                <div className="w-4 h-4 border-2 border-sage-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-medium">Loading performance data...</span>
              </div>
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
                <ComparisonBadge 
                  current={maintenanceStats.downtimePercentage} 
                  previous={previousMonthStats?.downtimePercentage ?? null}
                  isPercentage={true}
                  lowerIsBetter={true}
                />
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
                <ComparisonBadge 
                  current={maintenanceStats.uptimePercentage} 
                  previous={previousMonthStats?.uptimePercentage ?? null}
                  isPercentage={true}
                  lowerIsBetter={false}
                />
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
                <ComparisonBadge 
                  current={maintenanceStats.totalMachines} 
                  previous={previousMonthStats?.totalMachines ?? null}
                  format={(val) => val.toFixed(0)}
                  isPercentage={false}
                  lowerIsBetter={false}
                />
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
              <ChartIcon className="w-5 h-5 text-sage-400" />
              Shift Utilization - {formatShiftName(selectedShift)}
            </h2>
            <span className="text-xs text-gray-500">{getDateRangeLabel(dateRange)}</span>
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
                    {(shiftUtilization.averageUtilization || 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {shiftUtilization.machinesWithData || 0} of {shiftUtilization.totalMachines || 0} machines
                  </div>
                  <ComparisonBadge 
                    current={shiftUtilization.averageUtilization || 0} 
                    previous={previousMonthShiftUtilization?.averageUtilization ?? null}
                    isPercentage={true}
                    lowerIsBetter={false}
                  />
                </div>

                {/* Productive Hours */}
                <div className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="text-gray-400 text-sm mb-1">Productive Hours</div>
                  <div className="text-3xl font-bold text-green-400">
                    {(shiftUtilization.totalProductiveHours || 0).toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total hours
                  </div>
                  <ComparisonBadge 
                    current={shiftUtilization.totalProductiveHours || 0} 
                    previous={previousMonthShiftUtilization?.totalProductiveHours ?? null}
                    format={(val) => val.toFixed(1)}
                    isPercentage={false}
                    lowerIsBetter={false}
                  />
                </div>

                {/* Downtime Hours */}
                <div className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="text-gray-400 text-sm mb-1">Downtime Hours</div>
                  <div className="text-3xl font-bold text-red-400">
                    {(shiftUtilization.totalNonProductiveHours || 0).toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total hours
                  </div>
                  <ComparisonBadge 
                    current={shiftUtilization.totalNonProductiveHours || 0} 
                    previous={previousMonthShiftUtilization?.totalNonProductiveHours ?? null}
                    format={(val) => val.toFixed(1)}
                    isPercentage={false}
                    lowerIsBetter={true}
                  />
                </div>

                {/* Idle Hours */}
                <div className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="text-gray-400 text-sm mb-1">Idle Hours</div>
                  <div className="text-3xl font-bold text-yellow-400">
                    {(shiftUtilization.totalIdleHours || 0).toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total hours
                  </div>
                  <ComparisonBadge 
                    current={shiftUtilization.totalIdleHours || 0} 
                    previous={previousMonthShiftUtilization?.totalIdleHours ?? null}
                    format={(val) => val.toFixed(1)}
                    isPercentage={false}
                    lowerIsBetter={false}
                  />
                </div>

                {/* Scheduled Hours */}
                <div className="bg-dark-bg border border-dark-border rounded p-4">
                  <div className="text-gray-400 text-sm mb-1">Scheduled Hours</div>
                  <div className="text-3xl font-bold text-white">
                    {(shiftUtilization.totalScheduledHours || 0).toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total hours
                  </div>
                  <ComparisonBadge 
                    current={shiftUtilization.totalScheduledHours || 0} 
                    previous={previousMonthShiftUtilization?.totalScheduledHours ?? null}
                    format={(val) => val.toFixed(1)}
                    isPercentage={false}
                    lowerIsBetter={false}
                  />
                </div>
              </div>

              {/* Machine-wise Utilization Table */}
              {shiftUtilization.machineUtilizations && shiftUtilization.machineUtilizations.length > 0 && (
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
              <CalendarIcon className="w-5 h-5 text-sage-400" />
              Events
            </h2>
            <span className="text-xs text-gray-500">{getDateRangeLabel(dateRange)}</span>
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
                  <ComparisonBadge 
                    current={alertsCount} 
                    previous={previousAlertsCount}
                    format={(val) => val.toFixed(0)}
                    isPercentage={false}
                    lowerIsBetter={true}
                  />
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
                  <ComparisonBadge 
                    current={downtimeIncidentsCount} 
                    previous={previousDowntimeIncidentsCount}
                    format={(val) => val.toFixed(0)}
                    isPercentage={false}
                    lowerIsBetter={true}
                  />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

