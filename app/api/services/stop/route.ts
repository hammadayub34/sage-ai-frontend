import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * POST /api/services/stop
 * Stop a service
 * Body: { service: 'influxdb_writer' | 'mock_plc', machineId?: 'machine-01' | 'machine-02' | 'machine-03' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service, machineId } = body;

    if (!service) {
      return NextResponse.json(
        { error: 'service is required' },
        { status: 400 }
      );
    }

    let stopResult;
    if (service === 'influxdb_writer') {
      stopResult = await stopInfluxDBWriter();
    } else if (service === 'mock_plc') {
      if (!machineId) {
        return NextResponse.json(
          { error: 'machineId is required for mock_plc service' },
          { status: 400 }
        );
      }
      // Check if this is a lathe machine (starts with "lathe")
      if (machineId.startsWith('lathe')) {
        stopResult = await stopLatheSim(machineId);
      } else {
        stopResult = await stopMockPLC(machineId);
      }
      
      // After stopping an agent, check if any agents are still running
      // If no agents are running, stop the alarm monitor
      const anyAgentsRunning = await checkIfAnyAgentsRunning();
      if (!anyAgentsRunning) {
        console.log('[Stop API] No agents running, stopping alarm monitor');
        await stopAlarmMonitor();
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid service. Use "influxdb_writer" or "mock_plc"' },
        { status: 400 }
      );
    }
    
    return stopResult;
  } catch (error: any) {
    console.error('Error stopping service:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to stop service' },
      { status: 500 }
    );
  }
}

async function stopInfluxDBWriter() {
  try {
    // Use pkill to stop the process
    await execAsync('pkill -f "influxdb_writer_production.py"').catch(() => {
      // pkill may return non-zero if process not found, which is OK
    });
    return NextResponse.json({
      success: true,
      message: 'InfluxDB Writer stopped',
    });
  } catch (error: any) {
    // Even if pkill fails, assume it's stopped
    return NextResponse.json({
      success: true,
      message: 'InfluxDB Writer stopped (or was not running)',
    });
  }
}

async function stopMockPLC(machineId: string) {
  try {
    console.log(`[Stop API] Attempting to stop Mock PLC for ${machineId}`);
    
    // First, find all PIDs for mock_plc_agent.py
    const { stdout: pids } = await execAsync(`pgrep -f "mock_plc_agent.py"`).catch(() => {
      return { stdout: '' };
    });
    
    if (!pids.trim()) {
      console.log(`[Stop API] No mock_plc_agent.py processes found`);
      return NextResponse.json({
        success: true,
        message: `Mock PLC for ${machineId} stopped (or was not running)`,
      });
    }
    
    // Try to find the matching process by checking environment variables
    const pidList = pids.trim().split('\n').filter(pid => pid.trim());
    console.log(`[Stop API] Found ${pidList.length} process(es): ${pidList.join(', ')}`);
    let foundAndKilled = false;
    let killedPid: string | null = null;
    
    for (const pid of pidList) {
      try {
        // Check if this process has the matching MACHINE_ID in its environment
        const { stdout: env } = await execAsync(`ps e -p ${pid} 2>/dev/null | tr ' ' '\\n' | grep "^MACHINE_ID=" || echo ""`).catch(() => {
          return { stdout: '' };
        });
        const envStr = env.trim();
        console.log(`[Stop API] PID ${pid}: MACHINE_ID=${envStr}`);
        
        if (envStr.includes(`MACHINE_ID=${machineId}`)) {
          // Found the matching process, kill it with SIGTERM first, then SIGKILL if needed
          console.log(`[Stop API] ✅ Match found! Killing PID ${pid} for MACHINE_ID=${machineId}`);
          try {
            // Try graceful kill first
            await execAsync(`kill ${pid}`);
            console.log(`[Stop API] Sent SIGTERM to PID ${pid}`);
            
            // Wait a moment and check if it's still running
            await new Promise(resolve => setTimeout(resolve, 500));
            const { stdout: stillRunning } = await execAsync(`ps -p ${pid} 2>/dev/null || echo ""`).catch(() => ({ stdout: '' }));
            
            if (stillRunning.trim()) {
              // Process still running, force kill
              console.log(`[Stop API] Process still running, sending SIGKILL to PID ${pid}`);
              await execAsync(`kill -9 ${pid}`).catch(() => {});
            }
            
            killedPid = pid;
            foundAndKilled = true;
            break;
          } catch (killError: any) {
            console.log(`[Stop API] Error killing PID ${pid}:`, killError.message);
            // Try force kill
            try {
              await execAsync(`kill -9 ${pid}`).catch(() => {});
              killedPid = pid;
              foundAndKilled = true;
              break;
            } catch {
              // Continue to next process
            }
          }
        }
      } catch (err: any) {
        console.log(`[Stop API] Error checking PID ${pid}:`, err.message);
        // Process might have exited, continue
      }
    }
    
    // If we didn't find a match by environment variable, but there's only one process,
    // kill it anyway (fallback for cases where env var isn't accessible)
    if (!foundAndKilled && pidList.length === 1) {
      const pid = pidList[0];
      console.log(`[Stop API] No env match found, but only one process. Killing PID ${pid} as fallback`);
      try {
        await execAsync(`kill ${pid}`).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 500));
        const { stdout: stillRunning } = await execAsync(`ps -p ${pid} 2>/dev/null || echo ""`).catch(() => ({ stdout: '' }));
        if (stillRunning.trim()) {
          await execAsync(`kill -9 ${pid}`).catch(() => {});
        }
        killedPid = pid;
        foundAndKilled = true;
      } catch (err: any) {
        console.log(`[Stop API] Error in fallback kill:`, err.message);
      }
    }
    
    // If still no match and multiple processes, kill all of them (safety measure)
    if (!foundAndKilled && pidList.length > 1) {
      console.log(`[Stop API] Multiple processes found, killing all as safety measure`);
      try {
        await execAsync(`pkill -f "mock_plc_agent.py"`).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 500));
        await execAsync(`pkill -9 -f "mock_plc_agent.py"`).catch(() => {});
        foundAndKilled = true;
      } catch (err: any) {
        console.log(`[Stop API] Error in pkill:`, err.message);
      }
    }
    
    console.log(`[Stop API] Stop result: foundAndKilled=${foundAndKilled}, killedPid=${killedPid}`);
    
    return NextResponse.json({
      success: true,
      message: foundAndKilled 
        ? `Mock PLC for ${machineId} stopped${killedPid ? ` (PID ${killedPid})` : ''}`
        : `Mock PLC for ${machineId} stopped (or was not running)`,
    });
  } catch (error: any) {
    console.error(`[Stop API] Error in stopMockPLC:`, error);
    // Even if kill fails, try pkill as a fallback
    try {
      console.log(`[Stop API] Attempting fallback pkill`);
      await execAsync(`pkill -f "mock_plc_agent.py"`).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 500));
      await execAsync(`pkill -9 -f "mock_plc_agent.py"`).catch(() => {});
    } catch (err: any) {
      console.log(`[Stop API] Fallback pkill error:`, err.message);
    }
    return NextResponse.json({
      success: true,
      message: `Mock PLC for ${machineId} stopped (or was not running)`,
    });
  }
}

async function checkIfAnyAgentsRunning(): Promise<boolean> {
  try {
    // Check for any mock_plc_agent.py processes
    const { stdout: mockPids } = await execAsync(`pgrep -f "mock_plc_agent.py"`).catch(() => {
      return { stdout: '' };
    });
    
    // Check for any lathe_sim.py processes
    const { stdout: lathePids } = await execAsync(`pgrep -f "lathe_sim.py"`).catch(() => {
      return { stdout: '' };
    });
    
    const hasMockPLC = mockPids.trim().length > 0;
    const hasLatheSim = lathePids.trim().length > 0;
    
    console.log(`[Stop API] Agent check: mock_plc=${hasMockPLC}, lathe_sim=${hasLatheSim}`);
    return hasMockPLC || hasLatheSim;
  } catch (error: any) {
    console.error('[Stop API] Error checking agents:', error);
    return true; // Assume agents are running if we can't check
  }
}

async function stopAlarmMonitor() {
  try {
    console.log('[Stop API] Stopping alarm monitor...');
    await execAsync(`pkill -f "alarm_monitor.py"`).catch(() => {
      // pkill may return non-zero if process not found, which is OK
    });
    // Wait a moment and force kill if still running
    await new Promise(resolve => setTimeout(resolve, 500));
    await execAsync(`pkill -9 -f "alarm_monitor.py"`).catch(() => {
      // Ignore errors
    });
    console.log('[Stop API] Alarm monitor stopped');
  } catch (error: any) {
    console.error('[Stop API] Error stopping alarm monitor:', error);
  }
}

async function stopLatheSim(latheMachineId: string) {
  try {
    // First, find the PID by checking environment variables (same method as status endpoint)
    const { stdout: pids } = await execAsync(`pgrep -f "lathe_sim.py"`).catch(() => {
      return { stdout: '' };
    });
    
    if (!pids.trim()) {
      return NextResponse.json({
        success: true,
        message: `Lathe simulator for ${latheMachineId} stopped (or was not running)`,
      });
    }
    
    // Check each PID's environment for LATHE_MACHINE_ID
    const pidList = pids.trim().split('\n');
    for (const pid of pidList) {
      try {
        // Check if this process has the matching LATHE_MACHINE_ID in its environment
        const { stdout: env } = await execAsync(`ps e -p ${pid} 2>/dev/null | tr ' ' '\\n' | grep "^LATHE_MACHINE_ID=" || echo ""`).catch(() => {
          return { stdout: '' };
        });
        if (env.includes(`LATHE_MACHINE_ID=${latheMachineId}`)) {
          // Found the matching process, kill it
          await execAsync(`kill ${pid}`).catch(() => {
            // Process might have exited, continue
          });
          return NextResponse.json({
            success: true,
            message: `Lathe simulator for ${latheMachineId} stopped`,
          });
        }
      } catch {
        // Process might have exited, continue
      }
    }
    
    // No matching process found
    return NextResponse.json({
      success: true,
      message: `Lathe simulator for ${latheMachineId} stopped (or was not running)`,
    });
  } catch (error: any) {
    // Even if kill fails, assume it's stopped
    return NextResponse.json({
      success: true,
      message: `Lathe simulator for ${latheMachineId} stopped (or was not running)`,
    });
  }
}

