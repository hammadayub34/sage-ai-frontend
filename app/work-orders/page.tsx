'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatAlarmName } from '@/lib/utils';
import { CalendarIcon, ChevronDownIcon, ChevronRightIcon, TrashIcon } from '@/components/Icons';
import { toast } from 'react-toastify';

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

type ViewMode = 'list' | 'calendar';

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    machineId: '',
  });

  useEffect(() => {
    fetchWorkOrders();
  }, [filters]);

  // Set today's date as default when switching to calendar view
  useEffect(() => {
    if (viewMode === 'calendar' && !selectedDate) {
      const today = new Date();
      setSelectedDate(today);
      setCurrentWeek(today);
    }
  }, [viewMode, selectedDate]);

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);

      const response = await fetch(`/api/work-orders?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch work orders:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to fetch work orders');
      }

      const data = await response.json();
      console.log('Work orders fetched:', data.data?.length || 0, 'orders');
      setWorkOrders(data.data || []);
      
      if (!data.data || data.data.length === 0) {
        console.warn('No work orders found in response');
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error('Failed to load work orders. Please check the console for details.');
    } finally {
      setLoading(false);
    }
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

  // Group work orders by date (use weekOf if available, otherwise createdAt)
  const workOrdersByDate = useMemo(() => {
    const grouped: Record<string, WorkOrder[]> = {};
    workOrders.forEach(order => {
      // Use weekOf date if available, otherwise use createdAt
      let date: Date;
      if (order.weekOf) {
        date = new Date(order.weekOf);
      } else {
        date = new Date(order.createdAt);
      }
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(order);
    });
    return grouped;
  }, [workOrders]);

  // Get work orders for selected date
  const selectedDateOrders = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = selectedDate.toISOString().split('T')[0];
    return workOrdersByDate[dateKey] || [];
  }, [selectedDate, workOrdersByDate]);

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const hasWorkOrders = (date: Date) => {
    const dateKey = formatDateKey(date);
    return workOrdersByDate[dateKey] && workOrdersByDate[dateKey].length > 0;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

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

  // Week view helper functions
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Sunday = 0
    return new Date(d.setDate(diff));
  };

  const getWeekDays = (weekStart: Date) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setDate(prev.getDate() - 7);
      } else {
        newDate.setDate(prev.getDate() + 7);
      }
      return newDate;
    });
  };

  // Get work orders for a specific day and time range
  const getWorkOrdersForDay = (date: Date) => {
    const dateKey = formatDateKey(date);
    const orders = workOrdersByDate[dateKey] || [];
    return orders.map((order, idx) => {
      // Use the actual createdAt timestamp if available
      let hour = 13; // Default to 1 PM
      let minute = 0;
      
      if (order.createdAt) {
        try {
          const createdAtDate = new Date(order.createdAt);
          // Only use the time if the date matches (same day)
          if (formatDateKey(createdAtDate) === dateKey) {
            hour = createdAtDate.getHours();
            minute = createdAtDate.getMinutes();
          } else {
            // If date doesn't match, use default time but add small offset for multiple orders
            minute = idx * 15;
            if (minute >= 60) {
              hour += Math.floor(minute / 60);
              minute = minute % 60;
            }
          }
        } catch (error) {
          console.error('Error parsing createdAt date:', error);
          // Fallback: use default time with offset
          minute = idx * 15;
          if (minute >= 60) {
            hour += Math.floor(minute / 60);
            minute = minute % 60;
          }
        }
      } else {
        // No createdAt, use default time with offset for multiple orders
        minute = idx * 15;
        if (minute >= 60) {
          hour += Math.floor(minute / 60);
          minute = minute % 60;
        }
      }
      
      // Ensure time is within calendar view (8 AM - 9 PM)
      if (hour < 8) {
        hour = 8;
        minute = 0;
      } else if (hour >= 21) {
        hour = 20;
        minute = 45;
      }
      
      // Create a new date with the time set
      const timeDate = new Date(date);
      timeDate.setHours(hour, minute, 0, 0);
      
      return {
        ...order,
        hour: hour,
        minute: minute,
        time: timeDate,
      };
    }).sort((a, b) => a.time.getTime() - b.time.getTime());
  };

  // Calculate position for work order block in pixels
  // Each hour slot is 64px (h-16 = 4rem = 64px)
  const HOUR_HEIGHT = 64;
  const START_HOUR = 8;
  
  const getWorkOrderPosition = (hour: number, minute: number) => {
    const startHour = START_HOUR;
    const totalMinutes = (hour - startHour) * 60 + minute;
    // Position in pixels: each hour is 64px, each minute is 64/60 px
    const position = (totalMinutes / 60) * HOUR_HEIGHT;
    return Math.max(0, position);
  };

  const getWorkOrderHeight = (standardHours: number) => {
    // Always 1 hour height (64px)
    return HOUR_HEIGHT;
  };

  // Get current time position
  const getCurrentTimePosition = () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    return getWorkOrderPosition(hour, minute);
  };

  const isCurrentWeek = () => {
    const today = new Date();
    const weekStart = getWeekStart(currentWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return today >= weekStart && today <= weekEnd;
  };

  const handleDelete = async (workOrderNo: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent expanding/collapsing when clicking delete
    
    if (!confirm(`Are you sure you want to delete work order ${workOrderNo}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/work-orders/${workOrderNo}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete work order');
      }

      // Show success toast
      toast.success(
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">
            <span className="text-sage-400 font-bold text-xl leading-none">✓</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm mb-0.5">Work Order Deleted</div>
            <div className="text-gray-400 text-xs">Work Order {workOrderNo} has been deleted successfully</div>
          </div>
        </div>,
        {
          position: 'top-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          icon: false,
        }
      );

      // Remove from expanded orders if it was expanded
      setExpandedOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(workOrderNo);
        return newSet;
      });

      // Refresh the list
      fetchWorkOrders();
    } catch (error: any) {
      console.error('Error deleting work order:', error);
      toast.error(
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">
            <span className="text-red-400 font-bold text-xl leading-none">!</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm mb-0.5">Delete Failed</div>
            <div className="text-gray-400 text-xs">{error.message || 'Failed to delete work order'}</div>
          </div>
        </div>,
        {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          icon: false,
        }
      );
    }
  };

  return (
    <div className="bg-dark-bg text-dark-text p-6 min-h-screen">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-sage-400" />
            <h1 className="heading-inter heading-inter-lg">Work Orders</h1>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-dark-panel border border-dark-border rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-sage-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => {
                setViewMode('calendar');
                // Set today's date when switching to calendar view if no date is selected
                if (!selectedDate) {
                  setSelectedDate(new Date());
                }
              }}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-sage-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>

        {/* Filters - Show in both views */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <label className="text-gray-400 text-sm mr-2">Status:</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-sm mr-2">Priority:</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
            >
              <option value="">All</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <span className="ml-3 text-gray-400">Loading work orders...</span>
            </div>
          ) : (
            <div className="flex gap-4 h-[calc(100vh-250px)]">
              {/* Left Sidebar - Mini Calendar & Filters */}
              <div className="w-64 bg-dark-panel border border-dark-border rounded-lg p-4 flex flex-col gap-4 overflow-y-auto">
                {/* Mini Calendar */}
                <div>
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
                  
                  {/* Mini Calendar Grid */}
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
                      const dateKey = formatDateKey(date);
                      const hasOrders = hasWorkOrders(date);
                      const isSelectedDay = isSelected(date);
                      const isTodayDay = isToday(date);
                      const weekStart = getWeekStart(currentWeek);
                      const weekDays = getWeekDays(weekStart);
                      const isInCurrentWeek = weekDays.some(d => d.toDateString() === date.toDateString());

                      return (
                        <button
                          key={day}
                          onClick={() => {
                            handleDateClick(date);
                            setCurrentWeek(date);
                          }}
                          className={`text-xs p-1 rounded transition-all ${
                            isSelectedDay
                              ? 'bg-sage-500 text-white'
                              : isTodayDay
                              ? 'bg-sage-500/30 text-sage-400 font-semibold'
                              : hasOrders
                              ? 'bg-sage-500/10 text-sage-400 hover:bg-sage-500/20'
                              : isInCurrentWeek
                              ? 'bg-dark-border/50 text-gray-300 hover:bg-dark-border'
                              : 'text-gray-400 hover:bg-dark-border'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* My Work Orders Section */}
                <div>
                  <h4 className="text-white font-semibold text-sm mb-3">My Work Orders</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={true}
                        readOnly
                        className="w-4 h-4 rounded border-dark-border bg-dark-bg text-sage-500 focus:ring-sage-500"
                      />
                      <span className="text-sm text-gray-300">All Work Orders</span>
                    </label>
                  </div>
                </div>

                {/* Filters Section */}
                <div>
                  <h4 className="text-white font-semibold text-sm mb-3">Filters</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Machine</label>
                      <input
                        type="text"
                        value={filters.machineId}
                        onChange={(e) => setFilters({ ...filters, machineId: e.target.value })}
                        placeholder="All machines"
                        className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Status</label>
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-sage-500"
                      >
                        <option value="">All</option>
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Priority</label>
                      <select
                        value={filters.priority}
                        onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                        className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-sage-500"
                      >
                        <option value="">All</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Calendar Grid - Weekly View */}
              <div className="flex-1 bg-dark-panel border border-dark-border rounded-lg flex flex-col overflow-hidden">
                {/* Week Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-border flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigateWeek('prev')}
                      className="p-2 hover:bg-dark-border rounded transition-colors text-gray-400 hover:text-white"
                    >
                      <ChevronRightIcon className="w-5 h-5 rotate-180" />
                    </button>
                    <button
                      onClick={() => {
                        setCurrentWeek(new Date());
                        setSelectedDate(new Date());
                      }}
                      className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-dark-border rounded transition-colors"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => navigateWeek('next')}
                      className="p-2 hover:bg-dark-border rounded transition-colors text-gray-400 hover:text-white"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                    <h2 className="text-white font-semibold text-lg ml-2">
                      {getWeekStart(currentWeek).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                      {new Date(getWeekStart(currentWeek).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </h2>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-auto relative">
                  {/* Time Column */}
                  <div className="flex">
                    <div className="w-20 flex-shrink-0 border-r border-dark-border relative">
                      {/* Empty space for day headers */}
                      <div className="h-12 border-b border-dark-border"></div>
                      
                      {/* Time slots */}
                      {Array.from({ length: 13 }, (_, i) => i + 8).map(hour => (
                        <div key={hour} className="h-16 border-b border-dark-border/30 relative flex items-start">
                          <div className="text-xs text-gray-500 px-2 pt-0.5 w-full text-right">
                            {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Days Grid */}
                    <div className="flex-1 grid grid-cols-7">
                      {getWeekDays(getWeekStart(currentWeek)).map((day, dayIdx) => {
                        const dayOrders = getWorkOrdersForDay(day);
                        const isTodayDay = isToday(day);
                        const isSelectedDay = isSelected(day);

                        return (
                          <div
                            key={dayIdx}
                            className={`border-r border-dark-border last:border-r-0 ${
                              isSelectedDay ? 'bg-sage-500/5' : ''
                            }`}
                          >
                            {/* Day Header */}
                            <div
                              className={`h-12 border-b border-dark-border p-2 cursor-pointer hover:bg-dark-border/50 transition-colors ${
                                isTodayDay ? 'bg-sage-500/20' : ''
                              }`}
                              onClick={() => handleDateClick(day)}
                            >
                              <div className="text-xs text-gray-500 mb-0.5">
                                {day.toLocaleDateString('en-US', { weekday: 'short' })}
                              </div>
                              <div className={`text-sm font-semibold ${
                                isTodayDay ? 'text-sage-400' : isSelectedDay ? 'text-white' : 'text-gray-300'
                              }`}>
                                {day.getDate()}
                              </div>
                            </div>

                              {/* Time Slots */}
                              <div className="relative">
                                {Array.from({ length: 13 }, (_, i) => i + 8).map(hour => (
                                  <div
                                    key={hour}
                                    className="h-16 border-b border-dark-border/30 relative"
                                  />
                                ))}
                                
                                {/* Current Time Indicator - Shows across all days in current week */}
                                {isTodayDay && isCurrentWeek() && (() => {
                                  const now = new Date();
                                  const currentHour = now.getHours();
                                  const currentMinute = now.getMinutes();
                                  if (currentHour >= 8 && currentHour < 21) {
                                    const hourIndex = currentHour - 8;
                                    const minutePosition = (currentMinute / 60) * 100;
                                    const topPosition = hourIndex * 64 + (minutePosition / 100) * 64; // 64px per hour (h-16 = 4rem = 64px)
                                    return (
                                      <div
                                        className="absolute left-0 right-0 z-10 pointer-events-none"
                                        style={{
                                          top: `${topPosition}px`,
                                        }}
                                      >
                                        <div className="relative">
                                          <div className="absolute -left-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-dark-bg z-10"></div>
                                          <div className="h-0.5 bg-red-500"></div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}

                              {/* Work Order Blocks */}
                              {dayOrders.map((order, orderIdx) => {
                                const topPx = getWorkOrderPosition(order.hour, order.minute);
                                const heightPx = getWorkOrderHeight(order.standardHours || 1);
                                
                                // Calculate left position and width for overlapping orders
                                const totalOrders = dayOrders.length;
                                const maxOverlap = Math.min(3, totalOrders);
                                const orderWidth = 100 / maxOverlap;
                                const leftPercent = (orderIdx % maxOverlap) * orderWidth;
                                const widthPercent = orderWidth - 1; // Small gap between overlapping orders

                                // Priority-based color scheme
                                const getPriorityColors = (priority: string) => {
                                  switch (priority?.toLowerCase()) {
                                    case 'critical':
                                      return {
                                        bg: 'bg-red-500/20',
                                        border: 'border-red-500/50',
                                        text: 'text-red-100',
                                        accent: 'bg-red-500',
                                        hover: 'hover:bg-red-500/30 hover:border-red-500/70',
                                      };
                                    case 'high':
                                      return {
                                        bg: 'bg-orange-500/20',
                                        border: 'border-orange-500/50',
                                        text: 'text-orange-100',
                                        accent: 'bg-orange-500',
                                        hover: 'hover:bg-orange-500/30 hover:border-orange-500/70',
                                      };
                                    case 'medium':
                                      return {
                                        bg: 'bg-sage-500/20',
                                        border: 'border-sage-500/50',
                                        text: 'text-sage-100',
                                        accent: 'bg-sage-500',
                                        hover: 'hover:bg-sage-500/30 hover:border-sage-500/70',
                                      };
                                    case 'low':
                                      return {
                                        bg: 'bg-gray-500/20',
                                        border: 'border-gray-500/50',
                                        text: 'text-gray-100',
                                        accent: 'bg-gray-500',
                                        hover: 'hover:bg-gray-500/30 hover:border-gray-500/70',
                                      };
                                    default:
                                      return {
                                        bg: 'bg-blue-500/20',
                                        border: 'border-blue-500/50',
                                        text: 'text-blue-100',
                                        accent: 'bg-blue-500',
                                        hover: 'hover:bg-blue-500/30 hover:border-blue-500/70',
                                      };
                                  }
                                };

                                const colors = getPriorityColors(order.priority || 'Medium');
                                const isCompleted = order.workCompleted || order.status === 'completed';

                                return (
                                  <div
                                    key={order.workOrderNo}
                                    className={`absolute rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition-all duration-200 ${colors.bg} ${colors.border} border-l-4 ${colors.hover} shadow-lg overflow-hidden flex flex-col group ${
                                      isCompleted ? 'opacity-60' : ''
                                    }`}
                                    style={{
                                      top: `${topPx}px`,
                                      height: `${heightPx}px`,
                                      left: `${leftPercent}%`,
                                      width: `${widthPercent}%`,
                                      minHeight: '52px',
                                    }}
                                    onClick={() => {
                                      setSelectedDate(day);
                                      toggleExpand(order.workOrderNo);
                                    }}
                                  >
                                    {/* Priority indicator bar */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.accent} rounded-l-md`} />
                                    
                                    {/* Content */}
                                    <div className="flex-1 flex flex-col justify-between pl-1">
                                      {/* Header row */}
                                      <div className="flex items-start justify-between gap-1 mb-0.5">
                                        <div className="flex-1 min-w-0">
                                          <div className={`font-bold truncate ${colors.text} text-[11px] leading-tight`}>
                                            {order.workOrderNo}
                                          </div>
                                        </div>
                                        {isCompleted && (
                                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-400 mt-0.5" />
                                        )}
                                      </div>
                                      
                                      {/* Equipment name */}
                                      <div className="text-[10px] text-gray-300 truncate leading-tight mb-0.5">
                                        {order.equipmentName || order.machineId || 'Unknown Equipment'}
                                      </div>
                                      
                                      {/* Footer with time and priority */}
                                      <div className="flex items-center justify-between gap-1 mt-auto">
                                        <div className="text-[9px] text-gray-400 leading-tight font-medium">
                                          {(() => {
                                            const displayHour = order.hour === 0 ? 12 : order.hour > 12 ? order.hour - 12 : order.hour;
                                            const ampm = order.hour >= 12 ? 'PM' : 'AM';
                                            const minutes = order.minute > 0 ? `:${order.minute.toString().padStart(2, '0')}` : '';
                                            return `${displayHour}${minutes} ${ampm}`;
                                          })()}
                                        </div>
                                        {order.priority && (
                                          <div className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${colors.accent} ${colors.text} leading-tight shadow-sm`}>
                                            {order.priority.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Hover effect overlay */}
                                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar - Selected Date Work Orders */}
              {selectedDate && (
                <div className="w-80 bg-dark-panel border border-dark-border rounded-lg p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold text-sm">
                      {selectedDate.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </h3>
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
                    >
                      ×
                    </button>
                  </div>

                  {selectedDateOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      <p>No work orders</p>
                    </div>
                  ) : (
                    <div className="space-y-2 flex-1 overflow-y-auto">
                      {selectedDateOrders.map((order) => {
                        const isExpanded = expandedOrders.has(order.workOrderNo);
                        const orderTime = new Date(order.createdAt);
                        return (
                          <div
                            key={order.workOrderNo}
                            className="bg-dark-bg border border-dark-border rounded-lg p-3"
                          >
                            <div
                              className="cursor-pointer"
                              onClick={() => toggleExpand(order.workOrderNo)}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                                  ) : (
                                    <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                                  )}
                                  <span className="text-white font-semibold text-sm">{order.workOrderNo}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-xs font-medium border ${getPriorityColor(order.priority)}`}
                                  >
                                    {order.priority}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-gray-400 mb-1">
                                {orderTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </div>
                              <div className="text-xs text-gray-400">
                                <span className="font-semibold text-gray-300">Machine:</span> {order.machineId}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-dark-border space-y-1.5 text-xs">
                                {order.workDescription && (
                                  <div>
                                    <span className="text-gray-400">Description:</span>
                                    <p className="text-gray-300 mt-0.5">{order.workDescription.substring(0, 100)}...</p>
                                  </div>
                                )}
                                <div className="flex items-center gap-3 text-gray-400">
                                  <span>
                                    <span className="font-semibold text-gray-300">Hours:</span> {order.standardHours}
                                  </span>
                                  {order.parts && order.parts.length > 0 && (
                                    <span>
                                      <span className="font-semibold text-gray-300">Parts:</span> {order.parts.length}
                                    </span>
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
              )}
            </div>
          )}
        </>
      )}

      {/* Work Orders List */}
      {viewMode === 'list' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <span className="ml-3 text-gray-400">Loading work orders...</span>
            </div>
          ) : workOrders.length === 0 ? (
            <div className="p-8 bg-dark-panel border border-dark-border rounded text-center">
              <p className="text-gray-400">No work orders found</p>
            </div>
          ) : (
        <div className="space-y-4">
          {workOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.workOrderNo);
            return (
              <div
                key={order.workOrderNo}
                className="bg-dark-panel border border-dark-border rounded-lg hover:border-midnight-300 transition-colors"
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
                        <span>
                          <span className="font-semibold text-gray-300">Machine:</span> {order.machineId}
                        </span>
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
                    <div className="flex items-center gap-3">
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
                      <button
                        onClick={(e) => handleDelete(order.workOrderNo, e)}
                        className="p-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded transition-colors"
                        title="Delete work order"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {!isExpanded && order.workDescription && (
                    <div className="mt-4">
                      <p className="text-gray-300 text-sm">{order.workDescription.substring(0, 200)}...</p>
                    </div>
                  )}

                  {!isExpanded && (
                    <div className="flex items-center gap-6 text-sm text-gray-400 mt-4">
                      <span>
                        <span className="font-semibold text-gray-300">Work By:</span> {order.workPerformedBy}
                      </span>
                      <span>
                        <span className="font-semibold text-gray-300">Standard Hours:</span> {order.standardHours}
                      </span>
                      {order.overtimeHours > 0 && (
                        <span>
                          <span className="font-semibold text-gray-300">Overtime:</span> {order.overtimeHours}
                        </span>
                      )}
                      {order.parts && order.parts.length > 0 && (
                        <span>
                          <span className="font-semibold text-gray-300">Parts:</span> {order.parts.length}
                        </span>
                      )}
                      {order.materials && order.materials.length > 0 && (
                        <span>
                          <span className="font-semibold text-gray-300">Materials:</span> {order.materials.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-0 border-t border-dark-border space-y-6">
                    {/* Company & Basic Info */}
                    <div>
                      <h4 className="text-white font-semibold mb-3 text-sm">Work Order Details</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {order.companyName && (
                          <div>
                            <span className="text-gray-400">Company:</span>
                            <span className="text-gray-300 ml-2">{order.companyName}</span>
                          </div>
                        )}
                        {order.weekNo && (
                          <div>
                            <span className="text-gray-400">Week No:</span>
                            <span className="text-gray-300 ml-2">{order.weekNo}</span>
                          </div>
                        )}
                        {order.weekOf && (
                          <div>
                            <span className="text-gray-400">Week Of:</span>
                            <span className="text-gray-300 ml-2">{order.weekOf}</span>
                          </div>
                        )}
                        {order.frequency && (
                          <div>
                            <span className="text-gray-400">Frequency:</span>
                            <span className="text-gray-300 ml-2">{order.frequency}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Equipment Information */}
                    {(order.equipmentName || order.equipmentNumber || order.equipmentLocation || order.equipmentDescription) && (
                      <div>
                        <h4 className="text-white font-semibold mb-3 text-sm">Equipment Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {order.equipmentName && (
                            <div>
                              <span className="text-gray-400">Equipment Name:</span>
                              <span className="text-gray-300 ml-2">{order.equipmentName}</span>
                            </div>
                          )}
                          {order.equipmentNumber && (
                            <div>
                              <span className="text-gray-400">Equipment Number:</span>
                              <span className="text-gray-300 ml-2">{order.equipmentNumber}</span>
                            </div>
                          )}
                          {order.equipmentLocation && (
                            <div>
                              <span className="text-gray-400">Equipment Location:</span>
                              <span className="text-gray-300 ml-2">{order.equipmentLocation}</span>
                            </div>
                          )}
                          {order.equipmentDescription && (
                            <div className="col-span-2">
                              <span className="text-gray-400">Equipment Description:</span>
                              <span className="text-gray-300 ml-2">{order.equipmentDescription}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Location Information */}
                    {(order.location || order.building || order.floor || order.room) && (
                      <div>
                        <h4 className="text-white font-semibold mb-3 text-sm">Location Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {order.location && (
                            <div>
                              <span className="text-gray-400">Location:</span>
                              <span className="text-gray-300 ml-2">{order.location}</span>
                            </div>
                          )}
                          {order.building && (
                            <div>
                              <span className="text-gray-400">Building:</span>
                              <span className="text-gray-300 ml-2">{order.building}</span>
                            </div>
                          )}
                          {order.floor && (
                            <div>
                              <span className="text-gray-400">Floor:</span>
                              <span className="text-gray-300 ml-2">{order.floor}</span>
                            </div>
                          )}
                          {order.room && (
                            <div>
                              <span className="text-gray-400">Room:</span>
                              <span className="text-gray-300 ml-2">{order.room}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Work Description */}
                    {order.workDescription && (
                      <div>
                        <h4 className="text-white font-semibold mb-2 text-sm">Work Description</h4>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{order.workDescription}</p>
                      </div>
                    )}

                    {/* Special Instructions */}
                    {order.specialInstructions && (
                      <div>
                        <h4 className="text-white font-semibold mb-2 text-sm">Special Instructions</h4>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{order.specialInstructions}</p>
                      </div>
                    )}

                    {/* Work Performance */}
                    <div>
                      <h4 className="text-white font-semibold mb-3 text-sm">Work Performance</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-400">Work Performed By:</span>
                          <span className="text-gray-300 ml-2">{order.workPerformedBy || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Standard Hours:</span>
                          <span className="text-gray-300 ml-2">{order.standardHours || 0}</span>
                        </div>
                        {order.overtimeHours > 0 && (
                          <div>
                            <span className="text-gray-400">Overtime Hours:</span>
                            <span className="text-gray-300 ml-2">{order.overtimeHours}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400">Work Completed:</span>
                          <span className={`ml-2 ${order.workCompleted ? 'text-sage-400' : 'text-yellow-400'}`}>
                            {order.workCompleted ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                      {order.workPerformed && (
                        <div className="mt-2">
                          <span className="text-gray-400 text-sm">Work Performed:</span>
                          <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{order.workPerformed}</p>
                        </div>
                      )}
                    </div>

                    {/* Parts */}
                    {order.parts && order.parts.length > 0 && (
                      <div>
                        <h4 className="text-white font-semibold mb-3 text-sm">Parts & Components</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-dark-border">
                                <th className="text-left py-2 text-gray-400">Part Number</th>
                                <th className="text-left py-2 text-gray-400">Description</th>
                                <th className="text-left py-2 text-gray-400">Quantity</th>
                                <th className="text-left py-2 text-gray-400">Qty in Stock</th>
                                <th className="text-left py-2 text-gray-400">Location</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.parts.map((part: any, idx: number) => (
                                <tr key={idx} className="border-b border-dark-border/50">
                                  <td className="py-2 text-gray-300">{part.partNumber || '-'}</td>
                                  <td className="py-2 text-gray-300">{part.description || '-'}</td>
                                  <td className="py-2 text-gray-300">{part.quantity || '-'}</td>
                                  <td className="py-2 text-gray-300">{part.qtyInStock || '-'}</td>
                                  <td className="py-2 text-gray-300">{part.location || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Materials */}
                    {order.materials && order.materials.length > 0 && (
                      <div>
                        <h4 className="text-white font-semibold mb-3 text-sm">Materials Used</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-dark-border">
                                <th className="text-left py-2 text-gray-400">Part Number</th>
                                <th className="text-left py-2 text-gray-400">Description</th>
                                <th className="text-left py-2 text-gray-400">Quantity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.materials.map((material: any, idx: number) => (
                                <tr key={idx} className="border-b border-dark-border/50">
                                  <td className="py-2 text-gray-300">{material.partNumber || '-'}</td>
                                  <td className="py-2 text-gray-300">{material.description || '-'}</td>
                                  <td className="py-2 text-gray-300">{material.quantity || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Vendor Information */}
                    {(order.shop || order.vendor || order.vendorAddress || order.vendorPhone || order.vendorContact) && (
                      <div>
                        <h4 className="text-white font-semibold mb-3 text-sm">Shop/Vendor Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {order.shop && (
                            <div>
                              <span className="text-gray-400">Shop:</span>
                              <span className="text-gray-300 ml-2">{order.shop}</span>
                            </div>
                          )}
                          {order.vendor && (
                            <div>
                              <span className="text-gray-400">Vendor:</span>
                              <span className="text-gray-300 ml-2">{order.vendor}</span>
                            </div>
                          )}
                          {order.vendorAddress && (
                            <div className="col-span-2">
                              <span className="text-gray-400">Vendor Address:</span>
                              <span className="text-gray-300 ml-2">{order.vendorAddress}</span>
                            </div>
                          )}
                          {order.vendorPhone && (
                            <div>
                              <span className="text-gray-400">Vendor Phone:</span>
                              <span className="text-gray-300 ml-2">{order.vendorPhone}</span>
                            </div>
                          )}
                          {order.vendorContact && (
                            <div>
                              <span className="text-gray-400">Vendor Contact:</span>
                              <span className="text-gray-300 ml-2">{order.vendorContact}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
          )}
        </>
      )}
    </div>
  );
}

