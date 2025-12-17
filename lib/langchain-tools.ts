/**
 * LangChain Tools for AI Analysis Node
 * Defines tools that can be called by the LangChain agent based on user prompts
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// Get base URL for API calls
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3005';
}

/**
 * Query Pinecone for maintenance data based on alarm
 */
export const queryPineconeTool = new DynamicStructuredTool({
  name: 'queryPinecone',
  description: 'Query Pinecone vector database for maintenance procedures and work order templates based on alarm type. Use this when you need to find maintenance procedures, troubleshooting steps, or work order information for a specific alarm.',
  schema: z.object({
    machineId: z.string().describe('Machine ID (e.g., machine-01, lathe01)'),
    alarmType: z.string().describe('Alarm type (e.g., AlarmLowProductLevel, AlarmOverfill)'),
    machineType: z.string().describe('Machine type: bottlefiller or lathe'),
  }),
  func: async ({ machineId, alarmType, machineType }) => {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/work-order/pinecone-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId, alarmType, machineType }),
      });

      const result = await response.json();
      if (response.ok) {
        return JSON.stringify({
          success: true,
          data: result,
          message: `Retrieved work order data: Task ${result.taskNumber || 'N/A'}, Priority: ${result.priority || 'N/A'}`,
        });
      } else {
        return JSON.stringify({
          success: false,
          error: result.error || 'Failed to query Pinecone',
        });
      }
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Error querying Pinecone',
      });
    }
  },
});

/**
 * Create/format work order data from alarm and Pinecone data
 */
export const createWorkOrderTool = new DynamicStructuredTool({
  name: 'createWorkOrder',
  description: 'Create and format a work order from alarm data and Pinecone maintenance information. Use this after querying Pinecone to format the work order data. Requires alarmData and optionally pineconeData.',
  schema: z.object({
    alarmData: z.any().describe('Alarm data object from previous nodes'),
    pineconeData: z.any().optional().describe('Pinecone query results with maintenance procedures'),
    machineId: z.string().describe('Machine ID'),
  }),
  func: async ({ alarmData, pineconeData, machineId }) => {
    try {
      // Format work order data
      const workOrderData = {
        machineId,
        alarmType: alarmData?.firstAlarm?.alarmType || alarmData?.alarmType || '',
        priority: pineconeData?.priority || 'Medium',
        taskNumber: pineconeData?.taskNumber || '',
        workDescription: pineconeData?.workDescription || '',
        specialInstructions: pineconeData?.specialInstructions || '',
        parts: pineconeData?.parts || [],
        materials: pineconeData?.materials || [],
      };

      return JSON.stringify({
        success: true,
        data: workOrderData,
        message: `Work order formatted: ${workOrderData.alarmType} on ${machineId}`,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Error creating work order',
      });
    }
  },
});

/**
 * Save work order to InfluxDB
 */
export const saveWorkOrderTool = new DynamicStructuredTool({
  name: 'saveWorkOrder',
  description: 'Save a work order to InfluxDB for persistence. Use this when the user wants to save or persist a work order. Requires workOrderData from createWorkOrder.',
  schema: z.object({
    workOrderData: z.any().describe('Work order data object from createWorkOrder'),
  }),
  func: async ({ workOrderData }) => {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/work-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workOrderData),
      });

      const result = await response.json();
      if (response.ok) {
        return JSON.stringify({
          success: true,
          data: result,
          message: `Work order saved: ${result.workOrderNo || 'N/A'}`,
        });
      } else {
        return JSON.stringify({
          success: false,
          error: result.error || 'Failed to save work order',
        });
      }
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Error saving work order',
      });
    }
  },
});

/**
 * Query InfluxDB for latest sensor/tag values
 */
export const queryInfluxDBLatestTool = new DynamicStructuredTool({
  name: 'queryInfluxDBLatest',
  description: 'Query InfluxDB for the latest sensor values and tag states for a machine. Use this to get current machine status, sensor readings, or tag values.',
  schema: z.object({
    machineId: z.string().describe('Machine ID (e.g., machine-01, lathe01)'),
    timeRange: z.string().optional().describe('Time range (e.g., -5m, -1h, -24h). Default: -24h'),
  }),
  func: async ({ machineId, timeRange = '-24h' }) => {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(
        `${baseUrl}/api/influxdb/latest?machineId=${machineId}&timeRange=${timeRange}`
      );

      const result = await response.json();
      if (response.ok && result.data) {
        return JSON.stringify({
          success: true,
          data: result.data,
          message: `Retrieved ${Object.keys(result.data).length} sensor/tag values for ${machineId}`,
        });
      } else {
        return JSON.stringify({
          success: false,
          error: result.error || 'No data found',
        });
      }
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Error querying InfluxDB',
      });
    }
  },
});

/**
 * Query InfluxDB for vibration data
 */
export const queryInfluxDBVibrationTool = new DynamicStructuredTool({
  name: 'queryInfluxDBVibration',
  description: 'Query InfluxDB for vibration sensor data. Use this when the user asks about vibration, vibration analysis, or vibration-related issues.',
  schema: z.object({
    machineId: z.string().describe('Machine ID (e.g., machine-01, lathe01)'),
    timeRange: z.string().optional().describe('Time range (e.g., -5m, -1h, -24h). Default: -24h'),
  }),
  func: async ({ machineId, timeRange = '-24h' }) => {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(
        `${baseUrl}/api/influxdb/vibration?machineId=${machineId}&timeRange=${timeRange}`
      );

      const result = await response.json();
      if (response.ok && result.data) {
        return JSON.stringify({
          success: true,
          data: result.data,
          message: `Retrieved ${result.data.length || 0} vibration data points for ${machineId}`,
        });
      } else {
        return JSON.stringify({
          success: false,
          error: result.error || 'No vibration data found',
        });
      }
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Error querying vibration data',
      });
    }
  },
});

/**
 * Query InfluxDB for downtime statistics
 */
export const queryInfluxDBDowntimeTool = new DynamicStructuredTool({
  name: 'queryInfluxDBDowntime',
  description: 'Query InfluxDB for machine downtime statistics. Use this when the user asks about downtime, uptime, availability, or machine status over time.',
  schema: z.object({
    machineId: z.string().describe('Machine ID (e.g., machine-01, lathe01)'),
    timeRange: z.string().optional().describe('Time range (e.g., -5m, -1h, -24h). Default: -24h'),
  }),
  func: async ({ machineId, timeRange = '-24h' }) => {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(
        `${baseUrl}/api/influxdb/downtime?machineId=${machineId}&timeRange=${timeRange}`
      );

      const result = await response.json();
      if (response.ok && result) {
        return JSON.stringify({
          success: true,
          data: result,
          message: `Retrieved downtime statistics for ${machineId}`,
        });
      } else {
        return JSON.stringify({
          success: false,
          error: result.error || 'No downtime data found',
        });
      }
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Error querying downtime data',
      });
    }
  },
});

/**
 * Export all tools as an array for the agent
 */
export const langchainTools = [
  queryPineconeTool,
  createWorkOrderTool,
  saveWorkOrderTool,
  queryInfluxDBLatestTool,
  queryInfluxDBVibrationTool,
  queryInfluxDBDowntimeTool,
];

/**
 * Create tools with access to workflow state
 * This allows tools to use data from previous nodes
 */
export function createLangchainToolsWithState(workflowState: any) {
  // Create a tool that can access alarm data from state
  const queryPineconeWithState = new DynamicStructuredTool({
    name: 'queryPinecone',
    description: 'Query Pinecone vector database for maintenance procedures and work order templates based on alarm type. Use this when you need to find maintenance procedures, troubleshooting steps, or work order information for a specific alarm.',
    schema: z.object({
      machineId: z.string().optional().describe('Machine ID (e.g., machine-01, lathe01). If not provided, will use machineId from workflow context.'),
      alarmType: z.string().optional().describe('Alarm type (e.g., AlarmLowProductLevel, AlarmOverfill). If not provided, will use alarmType from workflow context.'),
      machineType: z.string().optional().describe('Machine type: bottlefiller or lathe. If not provided, will use machineType from workflow context.'),
    }),
    func: async ({ machineId, alarmType, machineType }) => {
      try {
        // Use provided values or fall back to workflow state
        const finalMachineId = machineId || workflowState.machineId || 'machine-01';
        const finalAlarmType = alarmType || workflowState.alarmData?.firstAlarm?.alarmType || '';
        const finalMachineType = machineType || workflowState.alarmData?.machineType || 'bottlefiller';
        
        if (!finalAlarmType) {
          return JSON.stringify({
            success: false,
            error: 'No alarm type available. Please provide alarmType or ensure previous nodes have alarm data.',
          });
        }
        
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/api/work-order/pinecone-fill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            machineId: finalMachineId,
            alarmType: finalAlarmType,
            machineType: finalMachineType,
          }),
        });

        const result = await response.json();
        if (response.ok) {
          return JSON.stringify({
            success: true,
            data: result,
            message: `Retrieved work order data: Task ${result.taskNumber || 'N/A'}, Priority: ${result.priority || 'N/A'}`,
          });
        } else {
          return JSON.stringify({
            success: false,
            error: result.error || 'Failed to query Pinecone',
          });
        }
      } catch (error: any) {
        return JSON.stringify({
          success: false,
          error: error.message || 'Error querying Pinecone',
        });
      }
    },
  });

  // Create a tool that can access alarm and Pinecone data from state
  const createWorkOrderWithState = new DynamicStructuredTool({
    name: 'createWorkOrder',
    description: 'Create and format a work order from alarm data and Pinecone maintenance information. Use this after querying Pinecone to format the work order data. Will use alarmData and pineconeData from workflow context if available.',
    schema: z.object({
      alarmData: z.any().optional().describe('Alarm data object. If not provided, will use alarmData from workflow context.'),
      pineconeData: z.any().optional().describe('Pinecone query results. If not provided, will use pineconeData from workflow context.'),
      machineId: z.string().optional().describe('Machine ID. If not provided, will use machineId from workflow context.'),
    }),
    func: async ({ alarmData, pineconeData, machineId }) => {
      try {
        // Use provided values or fall back to workflow state
        const finalAlarmData = alarmData || workflowState.alarmData;
        const finalPineconeData = pineconeData || workflowState.pineconeData;
        const finalMachineId = machineId || workflowState.machineId || 'machine-01';
        
        if (!finalAlarmData) {
          return JSON.stringify({
            success: false,
            error: 'No alarm data available. Please ensure previous nodes have alarm data.',
          });
        }
        
        // Generate work order number
        const now = new Date();
        const weekNo = Math.ceil(now.getDate() / 7);
        const workOrderNo = `WO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
        
        // Format work order data (matching createWorkOrderTool format)
        const workOrderData = {
          workOrderNo,
          weekNo: weekNo.toString(),
          weekOf: now.toISOString().split('T')[0],
          machineId: finalMachineId,
          machineType: finalPineconeData?.machineType || finalAlarmData?.machineType || 'bottlefiller',
          alarmType: finalAlarmData?.firstAlarm?.alarmType || finalAlarmData?.alarmType || '',
          status: 'pending',
          priority: finalPineconeData?.priority || 'Medium',
          taskNumber: finalPineconeData?.taskNumber || '',
          frequency: finalPineconeData?.frequency || '',
          workPerformedBy: finalPineconeData?.workPerformedBy || 'Maintenance Department',
          standardHours: finalPineconeData?.standardHours || 0,
          overtimeHours: finalPineconeData?.overtimeHours || 0,
          workDescription: finalPineconeData?.workDescription || '',
          specialInstructions: finalPineconeData?.specialInstructions || '',
          parts: finalPineconeData?.parts || [],
          materials: finalPineconeData?.materials || [],
          equipmentName: finalMachineId,
          equipmentNumber: finalMachineId,
          equipmentLocation: finalMachineId,
        };

        return JSON.stringify({
          success: true,
          data: workOrderData,
          message: `Work order formatted: ${workOrderData.workOrderNo} for ${workOrderData.alarmType} on ${finalMachineId}`,
        });
      } catch (error: any) {
        return JSON.stringify({
          success: false,
          error: error.message || 'Error creating work order',
        });
      }
    },
  });

  // Create a tool that can access work order data from state
  const saveWorkOrderWithState = new DynamicStructuredTool({
    name: 'saveWorkOrder',
    description: 'Save a work order to InfluxDB for persistence. Use this when the user wants to save or persist a work order. Will use workOrderData from workflow context if available.',
    schema: z.object({
      workOrderData: z.any().optional().describe('Work order data object. If not provided, will use workOrderData from workflow context.'),
    }),
    func: async ({ workOrderData }) => {
      try {
        const finalWorkOrderData = workOrderData || workflowState.workOrderData;
        
        if (!finalWorkOrderData) {
          return JSON.stringify({
            success: false,
            error: 'No work order data available. Please create a work order first using createWorkOrder tool.',
          });
        }
        
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/api/work-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalWorkOrderData),
        });

        const result = await response.json();
        if (response.ok) {
          return JSON.stringify({
            success: true,
            data: result,
            message: `Work order saved: ${finalWorkOrderData.workOrderNo || result.workOrderNo || 'N/A'}`,
          });
        } else {
          return JSON.stringify({
            success: false,
            error: result.error || 'Failed to save work order',
          });
        }
      } catch (error: any) {
        return JSON.stringify({
          success: false,
          error: error.message || 'Error saving work order',
        });
      }
    },
  });

  // Create InfluxDB tools with state access
  const queryInfluxDBLatestWithState = new DynamicStructuredTool({
    name: 'queryInfluxDBLatest',
    description: 'Query InfluxDB for the latest sensor values and tag states for a machine. Use this to get current machine status, sensor readings, or tag values. Will use machineId from workflow context if not provided.',
    schema: z.object({
      machineId: z.string().optional().describe('Machine ID. If not provided, will use machineId from workflow context.'),
      timeRange: z.string().optional().describe('Time range (e.g., -5m, -1h, -24h). Default: -24h'),
    }),
    func: async ({ machineId, timeRange = '-24h' }) => {
      try {
        const finalMachineId = machineId || workflowState.machineId || 'machine-01';
        const baseUrl = getBaseUrl();
        const response = await fetch(
          `${baseUrl}/api/influxdb/latest?machineId=${finalMachineId}&timeRange=${timeRange}`
        );

        const result = await response.json();
        if (response.ok && result.data) {
          return JSON.stringify({
            success: true,
            data: result.data,
            message: `Retrieved ${Object.keys(result.data).length} sensor/tag values for ${finalMachineId}`,
          });
        } else {
          return JSON.stringify({
            success: false,
            error: result.error || 'No data found',
          });
        }
      } catch (error: any) {
        return JSON.stringify({
          success: false,
          error: error.message || 'Error querying InfluxDB',
        });
      }
    },
  });

  const queryInfluxDBVibrationWithState = new DynamicStructuredTool({
    name: 'queryInfluxDBVibration',
    description: 'Query InfluxDB for vibration sensor data. Use this when the user asks about vibration, vibration analysis, or vibration-related issues. Will use machineId from workflow context if not provided.',
    schema: z.object({
      machineId: z.string().optional().describe('Machine ID. If not provided, will use machineId from workflow context.'),
      timeRange: z.string().optional().describe('Time range (e.g., -5m, -1h, -24h). Default: -24h'),
    }),
    func: async ({ machineId, timeRange = '-24h' }) => {
      try {
        const finalMachineId = machineId || workflowState.machineId || 'machine-01';
        const baseUrl = getBaseUrl();
        const response = await fetch(
          `${baseUrl}/api/influxdb/vibration?machineId=${finalMachineId}&timeRange=${timeRange}`
        );

        const result = await response.json();
        if (response.ok && result.data) {
          return JSON.stringify({
            success: true,
            data: result.data,
            message: `Retrieved ${result.data.length || 0} vibration data points for ${finalMachineId}`,
          });
        } else {
          return JSON.stringify({
            success: false,
            error: result.error || 'No vibration data found',
          });
        }
      } catch (error: any) {
        return JSON.stringify({
          success: false,
          error: error.message || 'Error querying vibration data',
        });
      }
    },
  });

  const queryInfluxDBDowntimeWithState = new DynamicStructuredTool({
    name: 'queryInfluxDBDowntime',
    description: 'Query InfluxDB for machine downtime statistics. Use this when the user asks about downtime, uptime, availability, or machine status over time. Will use machineId from workflow context if not provided.',
    schema: z.object({
      machineId: z.string().optional().describe('Machine ID. If not provided, will use machineId from workflow context.'),
      timeRange: z.string().optional().describe('Time range (e.g., -5m, -1h, -24h). Default: -24h'),
    }),
    func: async ({ machineId, timeRange = '-24h' }) => {
      try {
        const finalMachineId = machineId || workflowState.machineId || 'machine-01';
        const baseUrl = getBaseUrl();
        const response = await fetch(
          `${baseUrl}/api/influxdb/downtime?machineId=${finalMachineId}&timeRange=${timeRange}`
        );

        const result = await response.json();
        if (response.ok && result) {
          return JSON.stringify({
            success: true,
            data: result,
            message: `Retrieved downtime statistics for ${finalMachineId}`,
          });
        } else {
          return JSON.stringify({
            success: false,
            error: result.error || 'No downtime data found',
          });
        }
      } catch (error: any) {
        return JSON.stringify({
          success: false,
          error: error.message || 'Error querying downtime data',
        });
      }
    },
  });

  // Return tools with state access
  return [
    queryPineconeWithState,
    createWorkOrderWithState,
    saveWorkOrderWithState,
    queryInfluxDBLatestWithState,
    queryInfluxDBVibrationWithState,
    queryInfluxDBDowntimeWithState,
  ];
}
