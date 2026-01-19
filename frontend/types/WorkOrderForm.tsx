'use client';

import { useState, useEffect } from 'react';
import { CloseIcon, AIIcon, CheckIcon, TrashIcon } from './Icons';
import { formatAlarmName } from '@/lib/utils';
import { toast } from 'react-toastify';

interface Machine {
  _id: string;
  machineName: string;
  labId: string;
  description?: string;
  status?: 'active' | 'inactive';
}

interface WorkOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  machineId?: string;
  alarmType?: string;
  machineType?: 'bottlefiller' | 'lathe';
  machine?: Machine | null; // Full machine object from dashboard
  shopfloorName?: string; // Shopfloor/lab name from dashboard
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
  machineType = 'bottlefiller',
  machine: machineFromProps = null,
  shopfloorName: shopfloorNameFromProps = ''
}: WorkOrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [pineconeInfo, setPineconeInfo] = useState<string | null>(null);
  const [loadingPinecone, setLoadingPinecone] = useState(false);
  const [formData, setFormData] = useState({
    // Header
    companyName: '', // Will be filled with shopfloor (lab) name
    priority: '',
    
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
    workPerformedBy: '',
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

  // Helper function to calculate ISO week number
  const getISOWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Reset form to completely empty state
  const resetForm = () => {
    setFormData({
      companyName: '',
      priority: '',
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
      workPerformedBy: '',
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
    setPineconeInfo(null);
    setLoadingPinecone(false);
    setAutoFilling(false);
    setLoading(false);
  };

  // Reset form when form closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Update formData when form opens or machineId/machineType props change
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const weekNo = getISOWeekNumber(now);
      const weekOf = now.toISOString().slice(0, 10);
      
      // Always generate work order number when form opens
      const generatedWorkOrderNo = `WO-${dateStr}-${random}`;
      
      // Use machine and shopfloor data from props (already selected on dashboard)
      const machine = machineFromProps;
      const shopfloorName = shopfloorNameFromProps;
      
      if (machine && shopfloorName) {
        // We have all the data we need from props - use it directly!
        const machineName = machine.machineName || machineId;
        const machineIdFromDB = machine._id || machineId;
        const machineDescription = machine.description || '';
      
      setFormData(prev => ({
        ...prev,
          // Machine context
          machineId: machineIdFromDB,
          machineType: machineType,
          alarmType: alarmType,
          // Equipment Information from props (MongoDB data)
          equipmentName: machineName,
          equipmentNumber: machineIdFromDB,
          equipmentLocation: machineName,
          equipmentDescription: machineDescription,
          // Shopfloor (lab name) from props
          companyName: shopfloorName,
          // Always generate new work order number when form opens
          workOrderNo: generatedWorkOrderNo,
          weekNo: weekNo.toString(),
          weekOf: weekOf,
          // Default vendor information
          shop: prev.shop || 'Maintenance Shop',
          vendor: prev.vendor || 'Industrial Equipment Solutions Inc.',
          vendorAddress: prev.vendorAddress || '123 Industrial Park Blvd, Manufacturing District, City, State 12345',
          vendorPhone: prev.vendorPhone || '(555) 123-4567',
          vendorContact: prev.vendorContact || 'John Smith - Service Manager',
        }));
      } else if (machineId) {
        // Fallback: fetch machine info from API if props not provided
        const fetchMachineInfo = async () => {
          try {
            const machineResponse = await fetch(`/api/machines?machineId=${machineId}`);
            if (machineResponse.ok) {
              const machineData = await machineResponse.json();
              if (machineData.success && machineData.machine) {
                const fetchedMachine = machineData.machine;
                const machineName = fetchedMachine.machineName || machineId;
                const machineIdFromDB = fetchedMachine._id || machineId;
                const machineDescription = fetchedMachine.description || '';
                
                // Get shopfloor name
                let fetchedShopfloorName = '';
                if (fetchedMachine.labId) {
                  try {
                    const labsResponse = await fetch('/api/labs');
                    if (labsResponse.ok) {
                      const labsData = await labsResponse.json();
                      if (labsData.success && labsData.labs) {
                        const lab = labsData.labs.find((l: any) => {
                          const labId = l._id?.toString() || l._id;
                          const machineLabId = fetchedMachine.labId?.toString() || fetchedMachine.labId;
                          return labId === machineLabId;
                        });
                        if (lab) {
                          fetchedShopfloorName = lab.name;
                        }
                      }
                    }
                  } catch (error) {
                    console.error('Error fetching shopfloor (lab) name:', error);
                  }
                }
                
                setFormData(prev => ({
                  ...prev,
                  machineId: machineIdFromDB,
                  machineType: machineType,
                  alarmType: alarmType,
                  equipmentName: machineName,
                  equipmentNumber: machineIdFromDB,
                  equipmentLocation: machineName,
                  equipmentDescription: machineDescription,
                  companyName: fetchedShopfloorName,
                  workOrderNo: generatedWorkOrderNo,
                  weekNo: weekNo.toString(),
                  weekOf: weekOf,
                  // Default vendor information
                  shop: prev.shop || 'Maintenance Shop',
                  vendor: prev.vendor || 'Industrial Equipment Solutions Inc.',
                  vendorAddress: prev.vendorAddress || '123 Industrial Park Blvd, Manufacturing District, City, State 12345',
                  vendorPhone: prev.vendorPhone || '(555) 123-4567',
                  vendorContact: prev.vendorContact || 'John Smith - Service Manager',
                }));
                return;
              }
            }
          } catch (error) {
            console.error('Error fetching machine info:', error);
          }
          
          // Final fallback: just update context fields
          setFormData(prev => ({
            ...prev,
        machineId: machineId,
        machineType: machineType,
        alarmType: alarmType,
            equipmentName: prev.equipmentName || '',
            equipmentNumber: prev.equipmentNumber || '',
            equipmentLocation: prev.equipmentLocation || '',
            workOrderNo: generatedWorkOrderNo,
            weekNo: weekNo.toString(),
            weekOf: weekOf,
          }));
        };
        
        fetchMachineInfo();
      } else {
        // No machine ID - just update context
        setFormData(prev => ({
          ...prev,
            machineId: machineId,
            machineType: machineType,
            alarmType: alarmType,
            workOrderNo: generatedWorkOrderNo,
            weekNo: weekNo.toString(),
            weekOf: weekOf,
      }));
    }
    }
  }, [isOpen, machineId, machineType, alarmType, machineFromProps, shopfloorNameFromProps]);

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
      toast.error('Machine ID is required for AI Auto Fill');
      return;
    }

    setLoadingPinecone(true);
    setPineconeInfo(null);
    
    // Ensure work order number and week info are set before proceeding
    setFormData(prev => {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const weekNo = getISOWeekNumber(now);
      const weekOf = now.toISOString().slice(0, 10);
      
      // Only set if they're empty
      if (!prev.workOrderNo || !prev.weekNo || !prev.weekOf) {
        return {
          ...prev,
          workOrderNo: prev.workOrderNo || `WO-${dateStr}-${random}`,
          weekNo: prev.weekNo || weekNo.toString(),
          weekOf: prev.weekOf || weekOf,
        };
      }
      return prev;
    });
    
    try {
      // Step 0: Use machine and shopfloor info from props (already selected on dashboard)
      let shopfloorName = shopfloorNameFromProps;
      let machineInfo: any = machineFromProps;
      
      // If props not provided, fetch from API
      if (!machineInfo && machineId) {
        const machineResponse = await fetch(`/api/machines?machineId=${machineId}`);
        if (machineResponse.ok) {
          const machineData = await machineResponse.json();
          if (machineData.success && machineData.machine) {
            machineInfo = machineData.machine;
          }
        }
      }
      
      // If shopfloor name not provided, fetch it
      if (!shopfloorName && machineInfo?.labId) {
        try {
          const labsResponse = await fetch('/api/labs');
          if (labsResponse.ok) {
            const labsData = await labsResponse.json();
            if (labsData.success && labsData.labs) {
              const lab = labsData.labs.find((l: any) => {
                const labId = l._id?.toString() || l._id;
                const machineLabId = machineInfo.labId?.toString() || machineInfo.labId;
                return labId === machineLabId;
              });
              if (lab) {
                shopfloorName = lab.name;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching shopfloor (lab) name:', error);
        }
      }

      // Determine which alarm/issue to use
      let alarmToUse = alarmType;
      let documentType = 'maintenance_work_order';
      let issueType = 'alarm';
      const CRITICAL_DOWNTIME_THRESHOLD = 10; // 10% downtime is considered critical
      
      // Step 1: Check alarm thresholds (only if no alarmType is provided)
      if (!alarmType) {
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
          const errorData = await thresholdResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to check alarm thresholds');
      }

      const thresholdData = await thresholdResponse.json();

        // If threshold breached, use the first exceeded alarm
      if (thresholdData.shouldGenerateWorkOrder && thresholdData.exceededAlarms.length > 0) {
          alarmToUse = thresholdData.exceededAlarms[0];
        } else {
          // No alarms exceeded - check downtime incidents
          console.log('[AI Auto Fill] No alarms exceeded, checking downtime incidents...');
          const downtimeResponse = await fetch(`/api/influxdb/downtime?machineId=${machineId}&timeRange=-7d`);
          
          if (downtimeResponse.ok) {
            const downtimeData = await downtimeResponse.json();
            if (downtimeData.data) {
              const downtimePercentage = downtimeData.data.downtimePercentage || 0;
              const incidentCount = downtimeData.data.incidentCount || 0;
              const periods = downtimeData.data.periods || [];
              
              console.log(`[AI Auto Fill] Downtime: ${downtimePercentage.toFixed(2)}%, Incidents: ${incidentCount}`);
              
              // If there are ANY downtime incidents, assume motor vibration issue
              if (incidentCount > 0) {
                console.log(`[AI Auto Fill] Downtime incidents detected (${incidentCount} incidents, ${downtimePercentage.toFixed(2)}% downtime), assuming motor vibration issue`);
                documentType = 'vibration';
                issueType = 'vibration';
                alarmToUse = `Motor Vibration Issue - ${incidentCount} downtime incident${incidentCount > 1 ? 's' : ''} (${downtimePercentage.toFixed(1)}% downtime)`;
                toast.info(`Detected ${incidentCount} downtime incident${incidentCount > 1 ? 's' : ''}. Assuming motor vibration issue and filling form accordingly.`);
              } else {
                // No downtime incidents
                setPineconeInfo(`No alarms exceeded threshold and no downtime incidents detected (${downtimePercentage.toFixed(1)}% downtime). Please specify an alarm type or wait for issues to occur.`);
                toast.info('No alarms exceeded threshold and no downtime incidents. You can still use AI Auto Fill if you specify an alarm type.');
                return;
              }
            } else {
              // No downtime data available
              setPineconeInfo('No alarms exceeded the threshold (50 occurrences). Please specify an alarm type or wait for threshold to be exceeded.');
              toast.info('No alarms exceeded threshold. You can still use AI Auto Fill if you specify an alarm type.');
              return;
            }
          } else {
            // Downtime check failed, but continue with no alarm
            setPineconeInfo('No alarms exceeded the threshold (50 occurrences). Please specify an alarm type or wait for threshold to be exceeded.');
            toast.info('No alarms exceeded threshold. You can still use AI Auto Fill if you specify an alarm type.');
            return;
          }
        }
      }

        // Update alarmType in form data
      if (alarmToUse) {
        setFormData(prev => ({
          ...prev,
          alarmType: alarmToUse,
          companyName: shopfloorName, // Use shopfloor (lab) name
        }));
      }

      // Step 2: Query Pinecone and auto-fill
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
          documentType,
          issueType,
          }),
        });

      if (!fillResponse.ok) {
        const errorData = await fillResponse.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to get information from Pinecone';
        console.error('Fill response error:', errorData);
        setPineconeInfo(`Error: ${errorMessage}`);
        toast.error(`AI Auto Fill failed: ${errorMessage}`);
        return;
      }

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
          const workOrder = fillData.workOrder;
          // Get machine info from MongoDB (already fetched above)
          const machineName = machineInfo?.machineName || machineId;
          const machineIdFromDB = machineInfo?._id || machineId;
          const machineDescription = machineInfo?.description || '';
          
              const updated = {
                ...prev,
            // Shopfloor Name - always use lab name from MongoDB
            companyName: shopfloorName || prev.companyName,
            
            // Priority
            priority: workOrder.priority || prev.priority,
            
            // Equipment Information - prioritize MongoDB data, then AI-filled data, then keep existing
            equipmentName: machineName || workOrder.equipmentName || prev.equipmentName,
            equipmentNumber: machineIdFromDB || workOrder.equipmentNumber || prev.equipmentNumber,
            equipmentLocation: machineName || workOrder.equipmentLocation || prev.equipmentLocation,
            equipmentDescription: machineDescription || workOrder.equipmentDescription || prev.equipmentDescription,
            
            // Location Information
            location: workOrder.location || prev.location,
            building: workOrder.building || prev.building,
            floor: workOrder.floor || prev.floor,
            room: workOrder.room || prev.room,
            
            // Special Instructions
            specialInstructions: workOrder.specialInstructions || prev.specialInstructions,
            
            // Shop/Vendor Information
            shop: workOrder.shop || prev.shop,
            vendor: workOrder.vendor || prev.vendor,
            vendorAddress: workOrder.vendorAddress || prev.vendorAddress,
            vendorPhone: workOrder.vendorPhone || prev.vendorPhone,
            vendorContact: workOrder.vendorContact || prev.vendorContact,
            
            // Task Information
            taskNumber: workOrder.taskNumber || prev.taskNumber,
            frequency: workOrder.frequency || prev.frequency,
            workPerformedBy: workOrder.workPerformedBy || prev.workPerformedBy,
            standardHours: workOrder.standardHours || prev.standardHours,
            overtimeHours: workOrder.overtimeHours || prev.overtimeHours,
            
            // Work Description
            workDescription: workOrder.workDescription || prev.workDescription,
            workPerformed: workOrder.workPerformed || prev.workPerformed,
            
            // Preserve these fields - DO NOT overwrite with AI data
            workOrderNo: prev.workOrderNo, // Keep generated work order number
            weekNo: prev.weekNo, // Keep calculated week number
            weekOf: prev.weekOf, // Keep week of date
            machineId: prev.machineId, // Keep machine ID
            machineType: prev.machineType, // Keep machine type
            alarmType: alarmToUse || prev.alarmType, // Update alarm type if found
            workCompleted: prev.workCompleted, // Keep work completed status
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

        const formattedAlarmName = formatAlarmName(alarmToUse || '');
            setPineconeInfo(`Form filled for ${formattedAlarmName}`);
        toast.success(`Work order form auto-filled for ${formattedAlarmName}`);
          } else {
            console.error('No work order data in response:', fillData);
            setPineconeInfo(fillData.error || 'No maintenance information found in Pinecone for this alarm type.');
        toast.error(fillData.error || 'No maintenance information found in Pinecone for this alarm type.');
      }
    } catch (error: any) {
      console.error('Error:', error);
      const errorMessage = error.message || 'Failed to check thresholds or query Pinecone. Make sure the maintenance manual is embedded.';
      setPineconeInfo(`Error: ${errorMessage}`);
      toast.error(`AI Auto Fill error: ${errorMessage}`);
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
      
      // Form will be reset by useEffect when isOpen becomes false
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
            {loadingPinecone ? (
              <div className="flex items-center gap-2 text-sage-400 animate-pulse">
                <div className="w-4 h-4 border-2 border-sage-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-medium">Gathering Info...</span>
              </div>
            ) : (
            <button
              onClick={handleGetPineconeInfo}
                disabled={!machineId}
                className="px-4 py-2 rounded text-sm font-medium transition-all duration-300 flex items-center gap-2 bg-sage-500/20 hover:bg-sage-500/30 border border-sage-500/40 text-sage-400 hover:text-sage-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:blur-[0.5px]"
              title="AI Auto Fill - Automatically fill form fields from maintenance manual"
            >
                  <AIIcon className="w-4 h-4" />
                  AI Auto Fill
            </button>
            )}
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

