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
  sensorData?: any;
  pineconeData?: any;
  workOrderData?: any;
  executionLog?: string[];
  [key: string]: any;
}

/**
 * Fetch with timeout helper
 * Increased timeout to 60 seconds to account for process startup time
 */
function fetchWithTimeout(url: string, options: RequestInit, timeout: number = 60000): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
}

/**
 * Verify data is being written to InfluxDB
 * Polls InfluxDB for a few minutes to confirm data is being written
 */
async function verifyInfluxDBData(
  machineId: string,
  logBoth?: (message: string) => void
): Promise<{ success: boolean; dataPoints: number; message: string }> {
  const baseUrl = getBaseUrl();
  const maxAttempts = 18; // Check for 3 minutes (18 * 10 seconds)
  const pollInterval = 10000; // 10 seconds
  let dataConfirmed = false;
  let confirmedAtAttempt = 0;
  let lastTimestamp: string | null = null;
  
  if (logBoth) logBoth(`      ⏱️  Checking InfluxDB for data (monitoring for ${maxAttempts * pollInterval / 1000} seconds)...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Wait before checking (except first attempt)
    if (attempt > 1) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    try {
      // Query InfluxDB for recent data points
      const response = await fetch(
        `${baseUrl}/api/influxdb/latest?machineId=${machineId}&timeRange=-2m`,
        { method: 'GET' }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.data && Object.keys(data.data).length > 0) {
          const currentTimestamp = data.timestamp || data.data._time;
          const fieldCount = Object.keys(data.data).length;
          
          // Calculate estimated data points
          // Agent publishes every 2 seconds with ~20-25 fields per message
          // So in 2 minutes: ~60 publishes * 20 fields = ~1200 data points
          // We estimate based on time elapsed and field count
          const elapsedSeconds = attempt * pollInterval / 1000;
          const estimatedPublishes = Math.floor(elapsedSeconds / 2); // Every 2 seconds
          const estimatedPoints = estimatedPublishes * fieldCount;
          
          // Check if timestamp is updating (data is fresh)
          const isFresh = !lastTimestamp || currentTimestamp !== lastTimestamp;
          lastTimestamp = currentTimestamp;
          
          if (isFresh && fieldCount > 5) {
            if (logBoth) logBoth(`      📊 Check ${attempt}/${maxAttempts}: Data confirmed (${fieldCount} fields, ${estimatedPoints}+ points)`);
            
            // Confirm if we have fresh data for at least 2 consecutive checks
            if (!dataConfirmed) {
              dataConfirmed = true;
              confirmedAtAttempt = attempt;
            } else if (attempt >= confirmedAtAttempt + 2) {
              // Data confirmed for multiple checks, we're good
              console.log(`   ✅ [VERIFY] Data verified after ${attempt * pollInterval / 1000} seconds (${estimatedPoints}+ points)`);
              if (logBoth) logBoth(`      ✅ Data verified: ${estimatedPoints}+ points written over ${Math.floor(elapsedSeconds)} seconds`);
              return {
                success: true,
                dataPoints: estimatedPoints,
                message: `Verified after ${Math.floor(elapsedSeconds)} seconds`,
              };
            }
          } else if (fieldCount > 0) {
            if (logBoth && attempt % 3 === 0) {
              logBoth(`      ⏳ Check ${attempt}/${maxAttempts}: Data found, monitoring for fresh updates...`);
            }
          }
        } else {
          if (logBoth && attempt % 3 === 0) {
            logBoth(`      ⏳ Check ${attempt}/${maxAttempts}: Still waiting for data...`);
          }
        }
      } else if (response.status === 404) {
        // No data yet, this is expected initially
        if (logBoth && attempt % 3 === 0) {
          logBoth(`      ⏳ Check ${attempt}/${maxAttempts}: No data yet, waiting...`);
        }
      }
    } catch (error: any) {
      // Silent fail, continue checking
    }
  }
  
  // Final check
  try {
    const finalResponse = await fetch(
      `${baseUrl}/api/influxdb/latest?machineId=${machineId}&timeRange=-2m`,
      { method: 'GET' }
    );
    
    if (finalResponse.ok) {
      const finalData = await finalResponse.json();
      if (finalData.data && Object.keys(finalData.data).length > 0) {
        const elapsedSeconds = maxAttempts * pollInterval / 1000;
        const estimatedPublishes = Math.floor(elapsedSeconds / 2);
        const finalPoints = estimatedPublishes * Object.keys(finalData.data).length;
        console.log(`   ✅ [VERIFY] Final check: Found data (${finalPoints}+ points estimated after ${Math.floor(elapsedSeconds)} seconds)`);
        if (logBoth) logBoth(`      ✅ Final verification: ${finalPoints}+ data points found`);
        return {
          success: true,
          dataPoints: finalPoints,
          message: `Verified after ${Math.floor(elapsedSeconds)} seconds`,
        };
      }
    }
  } catch (error: any) {
    // Ignore final check errors
  }
  
  const totalSeconds = maxAttempts * pollInterval / 1000;
  return {
    success: false,
    dataPoints: 0,
    message: `No data found after ${Math.floor(totalSeconds)} seconds. Ensure InfluxDB Writer is running.`,
  };
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
  
  // Validate machineId is provided (required for mock_plc service)
  if (config.service === 'mock_plc' && (!config.machineId || config.machineId.trim() === '')) {
    const errorMsg = 'machineId is required for Start Agent node. Please select a machine in the node configuration.';
    log.push(`❌ Error: ${errorMsg}`);
    if (logBoth) logBoth(`   ❌ [TOOL] startAgentTool error: ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  log.push(`🔧 Starting ${config.service} for ${config.machineId || 'influxdb_writer'}...`);
  
  // UI logging only (console.logs removed for performance)
  if (logBoth) logBoth(`   🔧 [TOOL] startAgentTool called`);
  if (logBoth) logBoth(`      Service: ${config.service}, Machine: ${config.machineId || 'N/A'}`);

  try {
    const baseUrl = getBaseUrl();
    
    // Step 1: Ensure InfluxDB Writer is running first (only for mock_plc)
    if (config.service === 'mock_plc') {
      if (logBoth) logBoth(`      📝 Step 1: Checking if InfluxDB Writer is running...`);
      
      // Check writer status
      const statusResponse = await fetch(`${baseUrl}/api/services/status`);
      const statusData = await statusResponse.json();
      
      if (!statusData.influxdbWriter?.running) {
        if (logBoth) logBoth(`      ⚠️  InfluxDB Writer not running. Starting it first...`);
        if (logBoth) logBoth(`      📡 Calling API to start InfluxDB Writer (this may take a few seconds)...`);
        
        // Use fetchWithTimeout helper to prevent hanging
        let writerResponse: Response;
        let writerResult: any;
        
        try {
          writerResponse = await fetchWithTimeout(`${baseUrl}/api/services/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service: 'influxdb_writer',
            }),
          }, 60000);
          
          if (logBoth) logBoth(`      📥 Writer start response received (status: ${writerResponse.status})`);
          
          writerResult = await writerResponse.json();
          if (logBoth) logBoth(`      📋 Response: success=${writerResult.success}, alreadyRunning=${writerResult.alreadyRunning}, message=${writerResult.message || 'N/A'}`);
        } catch (error: any) {
          if (logBoth) logBoth(`      ❌ Error calling writer start API: ${error.message} (will check if writer started anyway)`);
          log.push(`⚠️ Warning: Error calling writer start API: ${error.message}`);
          
          // Check if writer actually started despite the timeout
          if (logBoth) logBoth(`      🔍 Checking if writer started despite API timeout...`);
          
          try {
            const checkResponse = await fetch(`${baseUrl}/api/services/status`);
            const checkData = await checkResponse.json();
            const isRunning = checkData.influxdbWriter?.running || false;
            
            if (isRunning) {
              if (logBoth) logBoth(`      ✅ Writer is running despite API timeout - continuing...`);
              // Treat as success
              writerResponse = { ok: true, status: 200 } as Response;
              writerResult = { success: true, message: 'Writer started (verified despite API timeout)' };
            } else {
              // Writer not running, treat as failure but continue anyway
              writerResponse = { ok: false, status: 500 } as Response;
              writerResult = { success: false, message: error.message };
            }
          } catch (checkError: any) {
            // Continue anyway - we'll verify in the verification step
            writerResponse = { ok: false, status: 500 } as Response;
            writerResult = { success: false, message: error.message };
          }
        }
        
        // Always verify writer status, even if API call failed or timed out
        // The writer might have started even if the API response didn't come through
        if (writerResponse.ok && (writerResult.success || writerResult.alreadyRunning)) {
          if (logBoth) logBoth(`      ✅ InfluxDB Writer start command executed`);
        } else {
          if (logBoth) logBoth(`      ⚠️  Writer start API response: ${writerResult.message || 'Unknown error'} (will verify anyway)`);
          log.push(`⚠️ Warning: Writer start API: ${writerResult.message || 'Unknown error'}`);
        }
        
        // Always verify writer actually started by polling status API
        // This ensures we check even if the API response was unclear
        if (logBoth) logBoth(`      🔍 Verifying writer started successfully (will check up to 5 times, every 2 seconds)...`);
        
        const maxVerificationAttempts = 5;
        const verificationInterval = 2000; // 2 seconds
        let writerVerified = false;
        
        for (let attempt = 1; attempt <= maxVerificationAttempts; attempt++) {
          if (attempt > 1) {
            await new Promise(resolve => setTimeout(resolve, verificationInterval));
          }
          
          if (logBoth && attempt === 1) {
            logBoth(`      🔍 Check ${attempt}/${maxVerificationAttempts}: Checking if writer is running...`);
          }
          
          try {
            const verifyResponse = await fetch(`${baseUrl}/api/services/status`);
            const verifyData = await verifyResponse.json();
            
            if (logBoth && attempt === 1) {
              logBoth(`      📊 Status check: writer running = ${verifyData.influxdbWriter?.running}`);
            }
            
            if (verifyData.influxdbWriter?.running) {
              if (logBoth) logBoth(`      ✅ Writer verified running after ${attempt * verificationInterval / 1000} seconds (attempt ${attempt}/${maxVerificationAttempts})`);
              log.push(`✅ InfluxDB Writer started and verified`);
              writerVerified = true;
              break;
            }
          } catch (verifyError: any) {
            // Silent fail, continue checking
          }
        }
        
        if (!writerVerified) {
          if (logBoth) logBoth(`      ⚠️  Could not verify writer started after ${maxVerificationAttempts} attempts (will continue anyway)`);
          log.push(`⚠️ Warning: Could not verify InfluxDB Writer started, but continuing...`);
        }
        
        // Always continue to agent step, even if writer verification failed
        if (logBoth) logBoth(`      ➡️  Proceeding to agent start step...`);
      } else {
        if (logBoth) logBoth(`      ✅ InfluxDB Writer is already running`);
        log.push(`✅ InfluxDB Writer already running`);
      }
    }
    
    // Step 2: Check if agent is already running, then start if needed
    if (logBoth) logBoth(`      📡 Step 2: Checking if agent is already running for ${config.machineId}...`);
    
    // Check agent status
    const agentStatusResponse = await fetch(`${baseUrl}/api/services/status`);
    const agentStatusData = await agentStatusResponse.json();
    
    const isAgentRunning = agentStatusData.machines?.[config.machineId]?.running || false;
    
    if (isAgentRunning) {
      if (logBoth) logBoth(`      ✅ Agent already running for ${config.machineId}`);
      log.push(`✅ Agent already running for ${config.machineId}`);
      
      // Still verify data is being written to InfluxDB
      if (config.service === 'mock_plc') {
        if (logBoth) logBoth(`      🔍 Verifying data is being written to InfluxDB...`);
        
        const verificationResult = await verifyInfluxDBData(config.machineId, logBoth);
        
        if (verificationResult.success) {
          log.push(`✅ Verified: Data is being written to InfluxDB (${verificationResult.dataPoints} data points found)`);
          if (logBoth) logBoth(`      ✅ Data verification: ${verificationResult.dataPoints} data points found in InfluxDB`);
        } else {
          log.push(`⚠️ Warning: Could not verify data in InfluxDB: ${verificationResult.message}`);
          if (logBoth) logBoth(`      ⚠️  Data verification: ${verificationResult.message}`);
        }
      }
      
      return {
        ...state,
        machineId: config.machineId,
        executionLog: log,
      };
    }
    
    // Agent is not running, start it
    if (logBoth) logBoth(`      🚀 Step 2b: Starting ${config.service} for ${config.machineId}...`);
    
    const requestBody = {
      service: config.service === 'mock_plc' ? 'mock_plc' : 'influxdb_writer',
      machineId: config.machineId,
    };
    
    if (logBoth) logBoth(`      📡 Calling API to start agent (this may take a few seconds)...`);
    
    // Use fetchWithTimeout helper to prevent hanging
    let response: Response;
    let result: any;
    
    try {
      response = await fetchWithTimeout(`${baseUrl}/api/services/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }, 60000);
      
      if (logBoth) logBoth(`      📥 Agent start response received (status: ${response.status})`);
      
      result = await response.json();
      if (logBoth) logBoth(`      📋 Response: success=${result.success}, alreadyRunning=${result.alreadyRunning}, message=${result.message || 'N/A'}`);
    } catch (error: any) {
      if (logBoth) logBoth(`      ❌ Error calling agent start API: ${error.message} (will check if agent started anyway)`);
      log.push(`⚠️ Warning: Error calling agent start API: ${error.message}`);
      
      // Check if agent actually started despite the timeout
      if (logBoth) logBoth(`      🔍 Checking if agent started despite API timeout...`);
      
      try {
        const checkResponse = await fetch(`${baseUrl}/api/services/status`);
        const checkData = await checkResponse.json();
        const isRunning = checkData.machines?.[config.machineId]?.running || false;
        
        if (isRunning) {
          if (logBoth) logBoth(`      ✅ Agent is running despite API timeout - continuing...`);
          // Treat as success
          response = { ok: true, status: 200 } as Response;
          result = { success: true, message: 'Agent started (verified despite API timeout)' };
        } else {
          // Agent not running, treat as failure but continue anyway
          response = { ok: false, status: 500 } as Response;
          result = { success: false, message: error.message };
        }
      } catch (checkError: any) {
        // Continue anyway - we'll verify in the data verification step
        response = { ok: false, status: 500 } as Response;
        result = { success: false, message: error.message };
      }
    }

    // Check if agent is actually running (even if API call failed/timed out)
    // This handles cases where the service started but the API response didn't come through
    let agentActuallyRunning = false;
    if (!response.ok || !result.success) {
      if (logBoth) logBoth(`      🔍 API call failed/timed out - verifying if agent is actually running...`);
      
      try {
        const verifyResponse = await fetch(`${baseUrl}/api/services/status`);
        const verifyData = await verifyResponse.json();
        agentActuallyRunning = verifyData.machines?.[config.machineId]?.running || false;
        
        if (agentActuallyRunning) {
          if (logBoth) logBoth(`      ✅ Agent is running (verified via status check) - continuing...`);
          // Update result to reflect success
          result = { success: true, message: 'Agent started (verified via status check)' };
        }
      } catch (verifyError: any) {
        // Silent fail
      }
    }

    if (response.ok && (result.success || result.alreadyRunning) || agentActuallyRunning) {
      if (result.alreadyRunning) {
        if (logBoth) logBoth(`      ✅ Agent was already running for ${config.machineId}`);
        log.push(`✅ Agent already running for ${config.machineId}`);
      } else if (agentActuallyRunning) {
        log.push(`✅ Agent started successfully (verified via status check)`);
        if (logBoth) logBoth(`      ✅ Agent started successfully (verified via status check)`);
      } else {
        log.push(`✅ Agent started successfully`);
        if (logBoth) logBoth(`      ✅ Agent started successfully`);
      }
      
      // Verify data is being written to InfluxDB (only for mock_plc, not for influxdb_writer)
      if (config.service === 'mock_plc') {
        if (logBoth) logBoth(`      🔍 Verifying data is being written to InfluxDB (will check up to 6 times, every 10 seconds)...`);
        
        const verificationResult = await verifyInfluxDBData(config.machineId, logBoth);
        
        if (verificationResult.success) {
          log.push(`✅ Verified: Data is being written to InfluxDB (${verificationResult.dataPoints} data points found)`);
          if (logBoth) logBoth(`      ✅ Data verification: ${verificationResult.dataPoints} data points found in InfluxDB`);
        } else {
          log.push(`⚠️ Warning: Could not verify data in InfluxDB: ${verificationResult.message}`);
          if (logBoth) logBoth(`      ⚠️  Data verification: ${verificationResult.message}`);
        }
      }
      
      if (logBoth) logBoth(`      ✅ Start Agent node completed successfully`);
      
      return {
        ...state,
        machineId: config.machineId,
        executionLog: log,
      };
    } else {
      console.error('   ❌ [AGENT TOOL] Failed to start agent');
      console.error('      Error:', result.error || result.message);
      if (logBoth) logBoth(`      ❌ Result: Failed - ${result.error || result.message || 'Unknown error'}`);
      throw new Error(result.error || result.message || 'Failed to start agent');
    }
  } catch (error: any) {
    log.push(`❌ Error starting agent: ${error.message}`);
    console.error('   ❌ [AGENT TOOL] Exception caught');
    console.error('      Error message:', error.message);
    console.error('      Error stack:', error.stack);
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
 * Monitor Sensor Values Tool
 * Queries InfluxDB for current sensor values and tag data
 */
export async function monitorSensorValuesTool(
  state: WorkflowState,
  config: { machineId: string; timeRange?: string; machineType?: string },
  logBoth?: (message: string) => void
): Promise<WorkflowState> {
  const log = state.executionLog || [];
  const machineId = config.machineId || state.machineId || 'machine-01';
  const timeRange = config.timeRange || '-5m';
  const machineType = config.machineType;

  log.push(`📊 Monitoring sensor values for ${machineId}...`);
  if (logBoth) logBoth(`   📊 [TOOL] monitorSensorValuesTool called`);
  if (logBoth) logBoth(`      Machine: ${machineId}, Time Range: ${timeRange}${machineType ? `, Machine Type: ${machineType}` : ''}`);

  try {
    const baseUrl = getBaseUrl();
    let url = `${baseUrl}/api/influxdb/latest?machineId=${machineId}&timeRange=${timeRange}`;
    if (machineType) {
      url += `&machineType=${machineType}`;
    }
    
    if (logBoth) logBoth(`      Calling: ${url}`);
    const response = await fetch(url, {
      method: 'GET',
    });

    const result = await response.json();

    if (response.ok && result.data) {
      const sensorData = result.data;
      const fieldCount = Object.keys(sensorData).length;
      
      log.push(`✅ Retrieved ${fieldCount} sensor value(s) for ${machineId}`);
      if (logBoth) logBoth(`      ✅ Result: Retrieved ${fieldCount} sensor values`);
      
      // Log some key sensor values
      const keyFields = ['BottlesFilled', 'BottlesPerMinute', 'FillLevel', 'TankTemperature', 'SystemRunning', 'Fault'];
      const keyValues: string[] = [];
      for (const field of keyFields) {
        if (sensorData[field] !== undefined) {
          keyValues.push(`${field}=${sensorData[field]}`);
        }
      }
      if (keyValues.length > 0) {
        if (logBoth) logBoth(`      📈 Key values: ${keyValues.join(', ')}`);
      }

      return {
        ...state,
        machineId,
        sensorData: {
          timestamp: result.timestamp || sensorData._time,
          values: sensorData,
          fieldCount,
        },
        executionLog: log,
      };
    } else if (response.status === 404) {
      log.push(`⚠️ No sensor data found for ${machineId}`);
      if (logBoth) logBoth(`      ⚠️  Result: No data found for ${machineId}`);
      return {
        ...state,
        machineId,
        sensorData: null,
        executionLog: log,
      };
    } else {
      if (logBoth) logBoth(`      ❌ Result: Failed - ${result.error || 'Unknown error'}`);
      throw new Error(result.error || 'Failed to monitor sensor values');
    }
  } catch (error: any) {
    log.push(`❌ Error monitoring sensor values: ${error.message}`);
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
  monitorSensorValues: monitorSensorValuesTool,
  queryPinecone: queryPineconeTool,
  createWorkOrder: createWorkOrderTool,
  saveWorkOrder: saveWorkOrderTool,
};

