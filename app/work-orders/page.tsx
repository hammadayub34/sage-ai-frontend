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
  const [filters, setFilters] = useState({
    machineId: '',
    status: '',
    priority: '',
  });

  useEffect(() => {
    fetchWorkOrders();
  }, [filters]);

  // Set today's date as default when switching to calendar view
  useEffect(() => {
    if (viewMode === 'calendar' && !selectedDate) {
      setSelectedDate(new Date());
    }
  }, [viewMode, selectedDate]);

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.machineId) params.append('machineId', filters.machineId);
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

  // Group work orders by date
  const workOrdersByDate = useMemo(() => {
    const grouped: Record<string, WorkOrder[]> = {};
    workOrders.forEach(order => {
      const date = new Date(order.createdAt);
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
            <label className="text-gray-400 text-sm mr-2">Machine ID:</label>
            <input
              type="text"
              value={filters.machineId}
              onChange={(e) => setFilters({ ...filters, machineId: e.target.value })}
              placeholder="Filter by machine..."
              className="bg-dark-panel border border-dark-border rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
            />
          </div>
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
            <div className="flex gap-6 h-[calc(100vh-250px)]">
          {/* Calendar */}
          <div className="flex-1 bg-dark-panel border border-dark-border rounded-lg p-6 flex flex-col">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-dark-border rounded transition-colors text-gray-400 hover:text-white"
              >
                <ChevronRightIcon className="w-5 h-5 rotate-180" />
              </button>
              <h2 className="text-white font-semibold text-lg">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-dark-border rounded transition-colors text-gray-400 hover:text-white"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar Grid - Compact to fit on screen */}
            <div className="grid grid-cols-7 gap-1.5 flex-1 auto-rows-fr">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-gray-500 text-xs font-medium py-1">
                  {day}
                </div>
              ))}

              {/* Empty cells for days before month starts */}
              {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, idx) => (
                <div key={`empty-${idx}`} />
              ))}

              {/* Calendar Days */}
              {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, idx) => {
                const day = idx + 1;
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const dateKey = formatDateKey(date);
                const hasOrders = hasWorkOrders(date);
                const orderCount = workOrdersByDate[dateKey]?.length || 0;
                const isSelectedDay = isSelected(date);
                const isTodayDay = isToday(date);

                return (
                  <button
                    key={day}
                    onClick={() => handleDateClick(date)}
                    className={`rounded-lg border-2 transition-all relative flex flex-col items-center justify-center p-1 min-h-[60px] ${
                      isSelectedDay
                        ? 'border-sage-400 bg-sage-500/20'
                        : hasOrders
                        ? 'border-sage-500/50 bg-sage-500/10 hover:bg-sage-500/20'
                        : 'border-dark-border hover:border-midnight-300'
                    } ${isTodayDay && !isSelectedDay ? 'ring-2 ring-sage-400/50' : ''}`}
                  >
                    <div className={`text-sm font-medium ${
                      isSelectedDay ? 'text-white' : hasOrders ? 'text-sage-400' : 'text-gray-400'
                    }`}>
                      {day}
                    </div>
                    {hasOrders && (
                      <div className="mt-auto">
                        <div className="w-1.5 h-1.5 rounded-full bg-sage-400"></div>
                      </div>
                    )}
                    {orderCount > 1 && (
                      <div className="absolute top-1 right-1">
                        <span className="text-xs text-sage-400 font-semibold">{orderCount}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Work Orders Sidebar - Right */}
          {selectedDate && (
            <div className="w-96 bg-dark-panel border border-dark-border rounded-lg p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ×
                </button>
              </div>

              {selectedDateOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No work orders for this date</p>
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {selectedDateOrders.map((order) => {
                    const isExpanded = expandedOrders.has(order.workOrderNo);
                    return (
                      <div
                        key={order.workOrderNo}
                        className="bg-dark-bg border border-dark-border rounded-lg p-4"
                      >
                        <div
                          className="cursor-pointer"
                          onClick={() => toggleExpand(order.workOrderNo)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="text-white font-semibold">{order.workOrderNo}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(order.priority)}`}
                              >
                                {order.priority}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(order.status)}`}
                              >
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase()}
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-400">
                            <span className="font-semibold text-gray-300">Machine:</span> {order.machineId}
                            {order.alarmType && (
                              <>
                                {' • '}
                                <span className="font-semibold text-gray-300">Alarm:</span> {formatAlarmName(order.alarmType)}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Expanded details in sidebar - simplified */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-dark-border space-y-2 text-sm">
                            {order.workDescription && (
                              <div>
                                <span className="text-gray-400">Description:</span>
                                <p className="text-gray-300 mt-1">{order.workDescription.substring(0, 150)}...</p>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-gray-400">
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
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase()}
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
                          {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}
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

