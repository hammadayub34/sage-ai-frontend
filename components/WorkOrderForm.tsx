'use client';

import { useState, useEffect } from 'react';
import { CloseIcon, AIIcon, CheckIcon, TrashIcon } from './Icons';
import { formatAlarmName } from '@/lib/utils';
import { toast } from 'react-toastify';

interface WorkOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  machineId?: string;
  alarmType?: string;
  machineType?: 'bottlefiller' | 'lathe';
}

interface Part {
  partNumber: string;
  description: string;
  quantity: string;
  qtyInStock: string;
  location: string;
}

interface Material {
  description: string;
  quantity: string;
  partNumber: string;
}

export function WorkOrderForm({ 
  isOpen, 
  onClose, 
  machineId = '', 
  alarmType = '',
  machineType = 'bottlefiller'
}: WorkOrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [pineconeInfo, setPineconeInfo] = useState<string | null>(null);
  const [loadingPinecone, setLoadingPinecone] = useState(false);
  const [formData, setFormData] = useState({
    // Header
    companyName: 'MQTT-OT Network Production System',
    priority: 'Medium',
    
    // Work Order Details
    workOrderNo: '',
    weekNo: '',
    weekOf: '',
    
    // Equipment Information
    equipmentName: '',
    equipmentNumber: '',
    equipmentLocation: '',
    equipmentDescription: '',
    
    // Location Information
    location: '',
    building: '',
    floor: '',
    room: '',
    
    // Special Instructions
    specialInstructions: '',
    
    // Shop/Vendor Information
    shop: '',
    vendor: '',
    vendorAddress: '',
    vendorPhone: '',
    vendorContact: '',
    
    // Task Information
    taskNumber: '',
    frequency: '',
    workPerformedBy: 'Maintenance Department',
    standardHours: '',
    overtimeHours: '',
    
    // Work Performance
    workDescription: '',
    workPerformed: '',
    workCompleted: false,
    
    // Machine Context
    machineId: machineId,
    alarmType: alarmType,
    machineType: machineType,
  });

  const [parts, setParts] = useState<Part[]>([
    { partNumber: '', description: '', quantity: '', qtyInStock: '', location: '' }
  ]);

  const [materials, setMaterials] = useState<Material[]>([
    { description: '', quantity: '', partNumber: '' }
  ]);

  // Update formData when form opens or machineId/machineType props change
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      
      setFormData(prev => ({
        ...prev,
        // Always update machine context when form opens or props change
        machineId: machineId,
        machineType: machineType,
        alarmType: alarmType,
        // Update equipment fields with current machineId
        equipmentName: machineId,
        equipmentNumber: machineId,
        equipmentLocation: machineId,
        // Generate new work order number if form just opened
        workOrderNo: prev.workOrderNo || `WO-${dateStr}-${random}`,
        weekOf: prev.weekOf || now.toISOString().slice(0, 10),
      }));
    }
  }, [isOpen, machineId, machineType, alarmType]);

  // Don't auto-check on form open - user will click the button

  const checkThresholdsAndAutoFill = async () => {
    if (!machineId) return;

    try {
      // Check which alarms exceeded thresholds (use custom threshold of 50 if user wants)
      const response = await fetch('/api/work-order/check-thresholds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          machineId,
          machineType,
          timeRange: '-24h',
          customThreshold: 50, // User requested threshold of 50
        }),
      });

      if (!response.ok) {
        console.error('Failed to check thresholds');
        return;
      }

      const data = await response.json();

      if (data.shouldGenerateWorkOrder && data.exceededAlarms.length > 0) {
        // Get the first exceeded alarm (or use provided alarmType if available)
        const alarmToUse = alarmType || data.exceededAlarms[0];
        
        // Show notification
        const alarmInfo = data.alarmCounts.find((a: any) => a.alarmType === alarmToUse);
        if (alarmInfo) {
          const confirmMessage = 
            `⚠️ Alarm Threshold Exceeded!\n\n` +
            `${alarmToUse}: ${alarmInfo.count} occurrences (threshold: ${alarmInfo.threshold})\n\n` +
            `Would you like to auto-fill the work order form with relevant information?`;
          
          if (window.confirm(confirmMessage)) {
            // Auto-fill the form with information from Pinecone
            if (alarmToUse) {
              // Update alarmType in form data
              setFormData(prev => ({
                ...prev,
                alarmType: alarmToUse,
              }));

              // Get info from Pinecone and auto-fill
              setTimeout(() => {
                handleAutoFillWithAlarm(alarmToUse);
              }, 500);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking thresholds:', error);
    }
  };

  const handleAutoFillWithAlarm = async (alarmTypeToUse: string) => {
    setAutoFilling(true);
    try {
      const response = await fetch('/api/work-order/autofill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          machineId,
          alarmType: alarmTypeToUse,
          machineType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to auto-fill work order');
      }

      const data = await response.json();
      
      // Update form data with auto-filled information
      if (data.workOrder) {
        setFormData(prev => ({
          ...prev,
          ...data.workOrder,
          workOrderNo: prev.workOrderNo, // Keep generated number
          machineId: prev.machineId,
          alarmType: alarmTypeToUse,
          machineType: prev.machineType,
        }));

        if (data.workOrder.parts) {
          setParts(data.workOrder.parts);
        }

        if (data.workOrder.materials) {
          setMaterials(data.workOrder.materials);
        }
      }
    } catch (error) {
      console.error('Auto-fill error:', error);
    } finally {
      setAutoFilling(false);
    }
  };

  const handleGetPineconeInfo = async () => {
    if (!machineId) {
      return;
    }

    setLoadingPinecone(true);
    setPineconeInfo(null);
    
    try {
      // Step 1: Check alarm thresholds
      const thresholdResponse = await fetch('/api/work-order/check-thresholds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          machineId,
          machineType,
          timeRange: '-24h',
          customThreshold: 50,
        }),
      });

      if (!thresholdResponse.ok) {
        throw new Error('Failed to check alarm thresholds');
      }

      const thresholdData = await thresholdResponse.json();

      // Step 2: If threshold breached, get info from Pinecone and auto-fill
      if (thresholdData.shouldGenerateWorkOrder && thresholdData.exceededAlarms.length > 0) {
        // Use the first exceeded alarm (or provided alarmType if available)
        const alarmToUse = alarmType || thresholdData.exceededAlarms[0];

        // Update alarmType in form data
        setFormData(prev => ({
          ...prev,
          alarmType: alarmToUse,
        }));

        // Query Pinecone directly and get structured data
        const fillStartTime = Date.now();
        const fillResponse = await fetch('/api/work-order/pinecone-fill', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            machineId,
            alarmType: alarmToUse,
            machineType,
          }),
        });

        if (fillResponse.ok) {
          const fillData = await fillResponse.json();
          const fillTime = Date.now() - fillStartTime;
          console.log(`[Form] Pinecone fill completed in ${fillTime}ms`);
          if (fillData.timings) {
            console.log('[Form] API timings:', fillData.timings);
          }
          console.log('Pinecone fill response:', fillData);
          
          if (fillData.success && fillData.workOrder) {
            console.log('Filling form with work order data:', fillData.workOrder);
            
            // Fill in the form fields directly
            setFormData(prev => {
              const updated = {
                ...prev,
                ...fillData.workOrder,
                workOrderNo: prev.workOrderNo, // Keep generated number
                machineId: prev.machineId,
                alarmType: alarmToUse,
                machineType: prev.machineType,
              };
              console.log('Updated form data:', updated);
              return updated;
            });

            // Fill parts if available
            if (fillData.workOrder.parts && fillData.workOrder.parts.length > 0) {
              console.log('Setting parts:', fillData.workOrder.parts);
              setParts(fillData.workOrder.parts);
            }

            // Fill materials if available
            if (fillData.workOrder.materials && fillData.workOrder.materials.length > 0) {
              console.log('Setting materials:', fillData.workOrder.materials);
              setMaterials(fillData.workOrder.materials);
            }

            const formattedAlarmName = formatAlarmName(alarmToUse);
            setPineconeInfo(`Form filled for ${formattedAlarmName}`);
          } else {
            console.error('No work order data in response:', fillData);
            setPineconeInfo(fillData.error || 'No maintenance information found in Pinecone for this alarm type.');
          }
        } else {
          const errorData = await fillResponse.json().catch(() => ({}));
          console.error('Fill response error:', errorData);
          setPineconeInfo(`Error: ${errorData.error || 'Failed to get information from Pinecone.'}`);
        }
      } else {
        // No threshold breached
        setPineconeInfo('No alarms exceeded the threshold (50 occurrences). No work order needed at this time.');
      }
    } catch (error) {
      console.error('Error:', error);
      setPineconeInfo('Error: Failed to check thresholds or query Pinecone. Make sure the maintenance manual is embedded.');
    } finally {
      setLoadingPinecone(false);
    }
  };

  const handleAutoFill = async () => {
    if (!alarmType || !machineId) {
      alert('Please ensure alarm type and machine ID are available for auto-fill');
      return;
    }

    setAutoFilling(true);
    try {
      const response = await fetch('/api/work-order/autofill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          machineId,
          alarmType,
          machineType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to auto-fill work order');
      }

      const data = await response.json();
      
      // Update form data with auto-filled information
      if (data.workOrder) {
        setFormData(prev => ({
          ...prev,
          ...data.workOrder,
          workOrderNo: prev.workOrderNo, // Keep generated number
          machineId: prev.machineId,
          alarmType: prev.alarmType,
          machineType: prev.machineType,
        }));

        if (data.workOrder.parts) {
          setParts(data.workOrder.parts);
        }

        if (data.workOrder.materials) {
          setMaterials(data.workOrder.materials);
        }
      }
    } catch (error) {
      console.error('Auto-fill error:', error);
      alert('Failed to auto-fill work order. Please fill manually.');
    } finally {
      setAutoFilling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[WorkOrderForm] handleSubmit called');
    console.log('[WorkOrderForm] Form data:', formData);
    console.log('[WorkOrderForm] Work order number:', formData.workOrderNo);
    
    if (!formData.workOrderNo) {
      console.error('[WorkOrderForm] Missing work order number!');
      toast.error('Work order number is required. Please wait for it to be generated.');
      return;
    }
    
    setLoading(true);

    try {
      // Ensure we're using the current machineId from props, not stale formData
      const workOrderPayload = {
        ...formData,
        machineId: machineId, // Use prop value, not formData value
        machineType: machineType, // Use prop value, not formData value
        parts,
        materials,
      };

      console.log('[WorkOrderForm] Submitting work order:', {
        workOrderNo: formData.workOrderNo,
        machineId: workOrderPayload.machineId,
        machineType: workOrderPayload.machineType,
        alarmType: formData.alarmType,
        'props.machineId': machineId,
        'props.machineType': machineType,
      });

      const response = await fetch('/api/work-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workOrderPayload),
      });

      const responseData = await response.json();
      console.log('[WorkOrderForm] API Response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save work order');
      }

      // Show success toast notification
      toast.success(
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">
            <span className="text-sage-400 font-bold text-xl leading-none">✓</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm mb-0.5">Work Order Generated</div>
            <div className="text-gray-400 text-xs">Work Order #{formData.workOrderNo} has been created successfully</div>
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
      
      onClose();
      
      // Reset form
      setFormData({
        companyName: 'MQTT-OT Network Production System',
        priority: 'Medium',
        workOrderNo: '',
        weekNo: '',
        weekOf: '',
        equipmentName: '',
        equipmentNumber: '',
        equipmentLocation: '',
        equipmentDescription: '',
        location: '',
        building: '',
        floor: '',
        room: '',
        specialInstructions: '',
        shop: '',
        vendor: '',
        vendorAddress: '',
        vendorPhone: '',
        vendorContact: '',
        taskNumber: '',
        frequency: '',
        workPerformedBy: 'Maintenance Department',
        standardHours: '',
        overtimeHours: '',
        workDescription: '',
        workPerformed: '',
        workCompleted: false,
        machineId: '',
        alarmType: '',
        machineType: 'bottlefiller',
      });
      setParts([{ partNumber: '', description: '', quantity: '', qtyInStock: '', location: '' }]);
      setMaterials([{ description: '', quantity: '', partNumber: '' }]);
    } catch (error: any) {
      console.error('[WorkOrderForm] Submit error:', error);
      const errorMessage = error.message || 'Failed to save work order. Please try again.';
      
      // Show error toast notification
      toast.error(
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">
            <span className="text-red-400 font-bold text-xl leading-none">!</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm mb-0.5">Save Failed</div>
            <div className="text-gray-400 text-xs">{errorMessage}</div>
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
    } finally {
      setLoading(false);
    }
  };

  const addPart = () => {
    setParts([...parts, { partNumber: '', description: '', quantity: '', qtyInStock: '', location: '' }]);
  };

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const updatePart = (index: number, field: keyof Part, value: string) => {
    const updated = [...parts];
    updated[index] = { ...updated[index], [field]: value };
    setParts(updated);
  };

  const addMaterial = () => {
    setMaterials([...materials, { description: '', quantity: '', partNumber: '' }]);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: keyof Material, value: string) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-dark-panel rounded-lg border border-dark-border max-w-5xl w-full max-h-[90vh] flex flex-col my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-dark-border flex-shrink-0">
          <div>
            <h3 className="heading-inter heading-inter-md">Work Order Form</h3>
            {alarmType && (
              <p className="text-gray-400 text-sm mt-1">
                For: {formatAlarmName(alarmType)} on {machineId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGetPineconeInfo}
              disabled={loadingPinecone || !machineId}
              className="px-4 py-2 bg-sage-500/20 hover:bg-sage-500/30 border border-sage-500/40 text-sage-400 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="AI Auto Fill - Automatically fill form fields from maintenance manual"
            >
              {loadingPinecone ? (
                'Gathering Info...'
              ) : (
                <>
                  <AIIcon className="w-4 h-4" />
                  AI Auto Fill
                </>
              )}
            </button>
            {alarmType && (
              <button
                onClick={handleAutoFill}
                disabled={autoFilling}
                className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {autoFilling ? 'Auto-filling...' : '🤖 AI Auto-fill'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-border rounded transition-colors"
            >
              <CloseIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {/* Pinecone Info Display - Moved lower */}
          {pineconeInfo && (
            <div className="mb-6 p-3 bg-sage-500/10 border border-sage-500/30 rounded-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <CheckIcon className="w-4 h-4 text-sage-400 flex-shrink-0" />
                  <span className="text-sage-300 text-sm font-medium">
                    {pineconeInfo}
                  </span>
                </div>
                <button
                  onClick={() => setPineconeInfo(null)}
                  className="text-gray-400 hover:text-white flex-shrink-0 transition-colors p-1 rounded hover:bg-dark-border"
                  title="Close"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          
          <div className="space-y-6">
            {/* Header Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Work Order Details */}
            <div className="border-t border-dark-border pt-4">
              <h4 className="text-white font-semibold mb-4">Work Order Details</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Work Order No</label>
                  <input
                    type="text"
                    value={formData.workOrderNo}
                    readOnly
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-gray-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Week No</label>
                  <input
                    type="text"
                    value={formData.weekNo}
                    onChange={(e) => setFormData({ ...formData, weekNo: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Week Of</label>
                  <input
                    type="date"
                    value={formData.weekOf}
                    onChange={(e) => setFormData({ ...formData, weekOf: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
              </div>
            </div>

            {/* Equipment Information */}
            <div className="border-t border-dark-border pt-4">
              <h4 className="text-white font-semibold mb-4">Equipment Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Equipment Name</label>
                  <input
                    type="text"
                    value={formData.equipmentName}
                    onChange={(e) => setFormData({ ...formData, equipmentName: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Equipment Number</label>
                  <input
                    type="text"
                    value={formData.equipmentNumber}
                    onChange={(e) => setFormData({ ...formData, equipmentNumber: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Equipment Location</label>
                  <input
                    type="text"
                    value={formData.equipmentLocation}
                    onChange={(e) => setFormData({ ...formData, equipmentLocation: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Equipment Description</label>
                  <input
                    type="text"
                    value={formData.equipmentDescription}
                    onChange={(e) => setFormData({ ...formData, equipmentDescription: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="border-t border-dark-border pt-4">
              <h4 className="text-white font-semibold mb-4">Location Information</h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Building</label>
                  <input
                    type="text"
                    value={formData.building}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Floor</label>
                  <input
                    type="text"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Room</label>
                  <input
                    type="text"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
              </div>
            </div>

            {/* Special Instructions */}
            <div className="border-t border-dark-border pt-4">
              <h4 className="text-white font-semibold mb-4">Special Instructions</h4>
              <textarea
                value={formData.specialInstructions}
                onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
                rows={3}
                className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                placeholder="Enter special instructions..."
              />
            </div>

            {/* Shop/Vendor Information */}
            <div className="border-t border-dark-border pt-4">
              <h4 className="text-white font-semibold mb-4">Shop/Vendor Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Shop</label>
                  <input
                    type="text"
                    value={formData.shop}
                    onChange={(e) => setFormData({ ...formData, shop: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Vendor</label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Vendor Address</label>
                  <input
                    type="text"
                    value={formData.vendorAddress}
                    onChange={(e) => setFormData({ ...formData, vendorAddress: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Vendor Phone</label>
                  <input
                    type="text"
                    value={formData.vendorPhone}
                    onChange={(e) => setFormData({ ...formData, vendorPhone: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Vendor Contact</label>
                  <input
                    type="text"
                    value={formData.vendorContact}
                    onChange={(e) => setFormData({ ...formData, vendorContact: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
              </div>
            </div>

            {/* Task Information */}
            <div className="border-t border-dark-border pt-4">
              <h4 className="text-white font-semibold mb-4">Task Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Task Number</label>
                  <input
                    type="text"
                    value={formData.taskNumber}
                    onChange={(e) => setFormData({ ...formData, taskNumber: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Frequency</label>
                  <input
                    type="text"
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Work Performed By</label>
                  <input
                    type="text"
                    value={formData.workPerformedBy}
                    onChange={(e) => setFormData({ ...formData, workPerformedBy: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Standard Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.standardHours}
                    onChange={(e) => setFormData({ ...formData, standardHours: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Overtime Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.overtimeHours}
                    onChange={(e) => setFormData({ ...formData, overtimeHours: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                  />
                </div>
              </div>
            </div>

            {/* Work Description */}
            <div className="border-t border-dark-border pt-4">
              <h4 className="text-white font-semibold mb-4">Work Description</h4>
              <textarea
                value={formData.workDescription}
                onChange={(e) => setFormData({ ...formData, workDescription: e.target.value })}
                rows={4}
                className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                placeholder="Enter detailed work description..."
              />
            </div>

            {/* Parts & Components */}
            <div className="border-t border-dark-border pt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold">Parts & Components</h4>
                <button
                  type="button"
                  onClick={addPart}
                  className="px-3 py-1 h-[34px] bg-sage-500 hover:bg-sage-600 text-white rounded text-sm font-medium transition-colors flex items-center justify-center"
                >
                  + Add Part
                </button>
              </div>
              <div className="space-y-3">
                {parts.map((part, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="grid grid-cols-5 gap-2 flex-1">
                      <input
                        type="text"
                        placeholder="Part #"
                        value={part.partNumber}
                        onChange={(e) => updatePart(index, 'partNumber', e.target.value)}
                        className="bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={part.description}
                        onChange={(e) => updatePart(index, 'description', e.target.value)}
                        className="bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      />
                      <input
                        type="text"
                        placeholder="Quantity"
                        value={part.quantity}
                        onChange={(e) => updatePart(index, 'quantity', e.target.value)}
                        className="bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      />
                      <input
                        type="text"
                        placeholder="Qty in Stock"
                        value={part.qtyInStock}
                        onChange={(e) => updatePart(index, 'qtyInStock', e.target.value)}
                        className="bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      />
                      <input
                        type="text"
                        placeholder="Location"
                        value={part.location}
                        onChange={(e) => updatePart(index, 'location', e.target.value)}
                        className="bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePart(index)}
                      className="p-1.5 text-gray-400 hover:text-red-400 transition-colors flex items-center justify-center"
                      title="Remove part"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Materials Used */}
            <div className="border-t border-dark-border pt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold">Materials Used</h4>
                <button
                  type="button"
                  onClick={addMaterial}
                  className="px-3 py-1 h-[34px] bg-sage-500 hover:bg-sage-600 text-white rounded text-sm font-medium transition-colors flex items-center justify-center"
                >
                  + Add Material
                </button>
              </div>
              <div className="space-y-3">
                {materials.map((material, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      <input
                        type="text"
                        placeholder="Description"
                        value={material.description}
                        onChange={(e) => updateMaterial(index, 'description', e.target.value)}
                        className="bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      />
                      <input
                        type="text"
                        placeholder="Quantity"
                        value={material.quantity}
                        onChange={(e) => updateMaterial(index, 'quantity', e.target.value)}
                        className="bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      />
                      <input
                        type="text"
                        placeholder="Part #"
                        value={material.partNumber}
                        onChange={(e) => updateMaterial(index, 'partNumber', e.target.value)}
                        className="bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMaterial(index)}
                      className="p-1.5 text-gray-400 hover:text-red-400 transition-colors flex items-center justify-center"
                      title="Remove material"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Work Performed */}
            <div className="border-t border-dark-border pt-4">
              <h4 className="text-white font-semibold mb-4">Work Performed</h4>
              <textarea
                value={formData.workPerformed}
                onChange={(e) => setFormData({ ...formData, workPerformed: e.target.value })}
                rows={3}
                className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                placeholder="Enter work performed details..."
              />
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="workCompleted"
                  checked={formData.workCompleted}
                  onChange={(e) => setFormData({ ...formData, workCompleted: e.target.checked })}
                  className="w-4 h-4 text-sage-500 bg-dark-bg border-dark-border rounded focus:ring-sage-500"
                />
                <label htmlFor="workCompleted" className="text-sm text-gray-400">
                  Work Completed
                </label>
              </div>
            </div>
          </div>

          {/* Footer Buttons - Inside Form */}
          <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-dark-border hover:bg-midnight-300 text-white rounded text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

