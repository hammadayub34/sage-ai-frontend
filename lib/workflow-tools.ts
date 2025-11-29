/**
 * Workflow Tool Functions
 * These functions wrap existing API calls to be used in workflow execution
 * Note: These are called from the server-side API route, so fetch URLs need to be absolute
 */

// Get base URL for API calls (works in both client and server)
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Server-side: use environment variable or default to localhost
  return process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3005';
}

interface WorkflowState {
  machineId?: string;
  alarmData?: any;
  pineconeData?: any;
  workOrderData?: any;
  executionLog?: string[];
  [key: string]: any;
}

/**
 * Start Agent Tool
 * Calls /api/services/start to start a mock PLC agent or InfluxDB writer
 */
export async function startAgentTool(
  state: WorkflowState,
  config: { machineId: string; service: 'mock_plc' | 'influxdb_writer' },
  logBoth?: (message: string) => void
): Promise<WorkflowState> {
  const log = state.executionLog || [];
  log.push(`🔧 Starting ${config.service} for ${config.machineId}...`);
  if (logBoth) logBoth(`   🔧 [TOOL] startAgentTool called`);
  if (logBoth) logBoth(`      Service: ${config.service}, Machine: ${config.machineId}`);

  try {
    const baseUrl = getBaseUrl();
    if (logBoth) logBoth(`      Calling: ${baseUrl}/api/services/start`);
    const response = await fetch(`${baseUrl}/api/services/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: config.service === 'mock_plc' ? 'mock_plc' : 'influxdb_writer',
        machineId: config.machineId,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      log.push(`✅ Agent started successfully`);
      if (logBoth) logBoth(`      ✅ Result: Agent started successfully`);
      return {
        ...state,
        machineId: config.machineId,
        executionLog: log,
      };
    } else {
      if (logBoth) logBoth(`      ❌ Result: Failed - ${result.error}`);
      throw new Error(result.error || 'Failed to start agent');
    }
  } catch (error: any) {
    log.push(`❌ Error starting agent: ${error.message}`);
    if (logBoth) logBoth(`      ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Monitor Tags Tool
 * Queries InfluxDB for alarms that exceed a threshold
 */
export async function monitorTagsTool(
  state: WorkflowState,
  config: { machineId: string; timeRange?: string; threshold?: number },
  logBoth?: (message: string) => void
): Promise<WorkflowState> {
  const log = state.executionLog || [];
  const machineId = config.machineId || state.machineId || 'machine-01';
  const timeRange = config.timeRange || '-24h';
  const threshold = config.threshold || 50;

  log.push(`📊 Monitoring tags for ${machineId} (threshold: ${threshold})...`);
  if (logBoth) logBoth(`   📊 [TOOL] monitorTagsTool called`);
  if (logBoth) logBoth(`      Machine: ${machineId}, Time Range: ${timeRange}, Threshold: ${threshold}`);

  try {
    const baseUrl = getBaseUrl();
    if (logBoth) logBoth(`      Calling: ${baseUrl}/api/work-order/check-thresholds`);
    const response = await fetch(`${baseUrl}/api/work-order/check-thresholds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineId,
        timeRange,
        customThreshold: threshold,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      const alarmsExceedingThreshold = result.alarmsExceedingThreshold || [];
      log.push(`✅ Found ${alarmsExceedingThreshold.length} alarm(s) exceeding threshold`);
      
      if (alarmsExceedingThreshold.length > 0) {
        log.push(`   Alarms: ${alarmsExceedingThreshold.map((a: any) => a.alarmType).join(', ')}`);
        if (logBoth) logBoth(`      ✅ Result: Found ${alarmsExceedingThreshold.length} alarm(s): ${alarmsExceedingThreshold.map((a: any) => a.alarmType).join(', ')}`);
      } else {
        if (logBoth) logBoth(`      ✅ Result: No alarms exceeding threshold`);
      }

      return {
        ...state,
        machineId,
        alarmData: {
          alarms: alarmsExceedingThreshold,
          firstAlarm: alarmsExceedingThreshold[0] || null,
        },
        executionLog: log,
      };
    } else {
      if (logBoth) logBoth(`      ❌ Result: Failed - ${result.error}`);
      throw new Error(result.error || 'Failed to monitor tags');
    }
  } catch (error: any) {
    log.push(`❌ Error monitoring tags: ${error.message}`);
    if (logBoth) logBoth(`      ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Query Pinecone Tool
 * Queries Pinecone for work order maintenance data based on alarm
 */
export async function queryPineconeTool(
  state: WorkflowState,
  config: { machineId?: string; alarmType?: string; machineType?: string },
  logBoth?: (message: string) => void
): Promise<WorkflowState> {
  const log = state.executionLog || [];
  
  // Get alarm data from previous step
  const alarmData = state.alarmData;
  const firstAlarm = alarmData?.firstAlarm;
  
  const machineId = config.machineId || state.machineId || 'machine-01';
  const alarmType = config.alarmType || firstAlarm?.alarmType || '';
  const machineType = config.machineType || firstAlarm?.machineType || 'bottlefiller';

  if (logBoth) logBoth(`   🔍 [TOOL] queryPineconeTool called`);
  if (logBoth) logBoth(`      Machine: ${machineId}, Alarm Type: ${alarmType}, Machine Type: ${machineType}`);

  if (!alarmType) {
    log.push(`⚠️ No alarm type available, skipping Pinecone query`);
    if (logBoth) logBoth(`      ⚠️  Skipping: No alarm type available`);
    return { ...state, executionLog: log };
  }

  log.push(`🔍 Querying Pinecone for ${alarmType} on ${machineId}...`);

  try {
    const baseUrl = getBaseUrl();
    if (logBoth) logBoth(`      Calling: ${baseUrl}/api/work-order/pinecone-fill`);
    const response = await fetch(`${baseUrl}/api/work-order/pinecone-fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineId,
        alarmType,
        machineType,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      log.push(`✅ Retrieved work order data from Pinecone`);
      if (logBoth) logBoth(`      ✅ Result: Retrieved work order data - Task: ${result.taskNumber || 'N/A'}, Priority: ${result.priority || 'N/A'}`);
      return {
        ...state,
        machineId,
        pineconeData: result,
        executionLog: log,
      };
    } else {
      if (logBoth) logBoth(`      ❌ Result: Failed - ${result.error}`);
      throw new Error(result.error || 'Failed to query Pinecone');
    }
  } catch (error: any) {
    log.push(`❌ Error querying Pinecone: ${error.message}`);
    if (logBoth) logBoth(`      ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Create Work Order Tool
 * Formats work order data from previous nodes
 */
export async function createWorkOrderTool(
  state: WorkflowState,
  config: Record<string, any> = {},
  logBoth?: (message: string) => void
): Promise<WorkflowState> {
  const log = state.executionLog || [];
  log.push(`📝 Creating work order from collected data...`);
  if (logBoth) logBoth(`   📝 [TOOL] createWorkOrderTool called`);

  const pineconeData = state.pineconeData;
  const alarmData = state.alarmData;
  const machineId = state.machineId || 'machine-01';

  if (!pineconeData) {
    log.push(`⚠️ No Pinecone data available, cannot create work order`);
    if (logBoth) logBoth(`      ⚠️  Skipping: No Pinecone data available`);
    return { ...state, executionLog: log };
  }

  // Generate work order number
  const now = new Date();
  const weekNo = Math.ceil(now.getDate() / 7);
  const workOrderNo = `WO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

  // Build work order from Pinecone data
  const workOrderData = {
    workOrderNo,
    weekNo: weekNo.toString(),
    weekOf: now.toISOString().split('T')[0],
    machineId,
    machineType: pineconeData.machineType || alarmData?.firstAlarm?.machineType || 'bottlefiller',
    alarmType: alarmData?.firstAlarm?.alarmType || '',
    status: 'pending',
    priority: pineconeData.priority || 'Medium',
    taskNumber: pineconeData.taskNumber || '',
    frequency: pineconeData.frequency || '',
    workPerformedBy: pineconeData.workPerformedBy || 'Maintenance Department',
    standardHours: pineconeData.standardHours || 0,
    overtimeHours: pineconeData.overtimeHours || 0,
    workDescription: pineconeData.workDescription || '',
    specialInstructions: pineconeData.specialInstructions || '',
    parts: pineconeData.parts || [],
    materials: pineconeData.materials || [],
    equipmentName: machineId,
    equipmentNumber: machineId,
    equipmentLocation: machineId,
  };

  log.push(`✅ Work order created: ${workOrderNo}`);
  if (logBoth) logBoth(`      ✅ Result: Work order created - No: ${workOrderNo}, Machine: ${machineId}, Alarm: ${workOrderData.alarmType}`);

  return {
    ...state,
    workOrderData,
    executionLog: log,
  };
}

/**
 * Save Work Order Tool
 * Saves work order to InfluxDB
 */
export async function saveWorkOrderTool(
  state: WorkflowState,
  config: Record<string, any> = {},
  logBoth?: (message: string) => void
): Promise<WorkflowState> {
  const log = state.executionLog || [];
  log.push(`💾 Saving work order to InfluxDB...`);
  if (logBoth) logBoth(`   💾 [TOOL] saveWorkOrderTool called`);

  const workOrderData = state.workOrderData;

  if (!workOrderData) {
    log.push(`⚠️ No work order data available, cannot save`);
    if (logBoth) logBoth(`      ⚠️  Skipping: No work order data available`);
    return { ...state, executionLog: log };
  }

  if (logBoth) logBoth(`      Work Order No: ${workOrderData.workOrderNo}`);

  try {
    const baseUrl = getBaseUrl();
    if (logBoth) logBoth(`      Calling: ${baseUrl}/api/work-order`);
    const response = await fetch(`${baseUrl}/api/work-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workOrderData),
    });

    const result = await response.json();

    if (response.ok) {
      log.push(`✅ Work order saved successfully: ${workOrderData.workOrderNo}`);
      if (logBoth) logBoth(`      ✅ Result: Work order saved successfully - No: ${workOrderData.workOrderNo}`);
      return {
        ...state,
        savedWorkOrder: result,
        executionLog: log,
      };
    } else {
      if (logBoth) logBoth(`      ❌ Result: Failed - ${result.error}`);
      throw new Error(result.error || 'Failed to save work order');
    }
  } catch (error: any) {
    log.push(`❌ Error saving work order: ${error.message}`);
    if (logBoth) logBoth(`      ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Tool registry - maps node types to tool functions
 */
export const TOOL_REGISTRY: Record<string, (state: WorkflowState, config: any) => Promise<WorkflowState>> = {
  startAgent: startAgentTool,
  monitorTags: monitorTagsTool,
  queryPinecone: queryPineconeTool,
  createWorkOrder: createWorkOrderTool,
  saveWorkOrder: saveWorkOrderTool,
};

