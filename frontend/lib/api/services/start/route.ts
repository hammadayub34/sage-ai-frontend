import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Get project root (go up from frontend directory)
// process.cwd() in Next.js API routes is the frontend/ directory
// So we need to go up one level to get to mqtt-ot-network/
const PROJECT_ROOT = path.resolve(process.cwd(), '..');

/**
 * POST /api/services/start
 * Start a service
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

    if (service === 'influxdb_writer') {
      return await startInfluxDBWriter();
    } else if (service === 'mock_plc') {
      if (!machineId) {
        return NextResponse.json(
          { error: 'machineId is required for mock_plc service' },
          { status: 400 }
        );
      }
      // Check if this is a lathe machine (starts with "lathe")
      if (machineId.startsWith('lathe')) {
        return await startLatheSim(machineId);
      } else {
      return await startMockPLC(machineId);
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid service. Use "influxdb_writer" or "mock_plc"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error starting service:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start service' },
      { status: 500 }
    );
  }
}

async function startInfluxDBWriter() {
  try {
    // Check if already running using pgrep (simpler and more reliable)
    try {
      const { stdout } = await execAsync('pgrep -f "influxdb_writer_production.py"');
      if (stdout.trim().length > 0) {
        return NextResponse.json({
          success: true,
          message: 'InfluxDB Writer is already running',
          alreadyRunning: true,
        });
      }
    } catch {
      // pgrep returns non-zero if not found, which is fine
    }

    // Note: We don't stop agents when starting the writer anymore
    // This allows workflows to start writer first, then agents

    // Start the service in background with better error handling
    return new Promise<NextResponse>((resolve) => {
      // Add a timeout to ensure the Promise always resolves
      const timeout = setTimeout(() => {
        console.warn('[Start API] Writer start check timed out after 10 seconds, assuming it started');
        resolve(NextResponse.json({
          success: true,
          message: 'InfluxDB Writer start command executed (timeout reached, assuming success)',
        }));
      }, 10000); // 10 second timeout for the API response

      exec(`cd "${PROJECT_ROOT}" && nohup bash start_influxdb_writer.sh > /tmp/influxdb_writer.log 2>&1 &`, 
        async (error) => {
          clearTimeout(timeout); // Clear timeout if callback is called
          
          if (error) {
            console.error('Error starting InfluxDB Writer:', error);
            resolve(NextResponse.json({
              success: false,
              message: `Failed to start: ${error.message}`,
            }, { status: 500 }));
            return;
          }

          // Wait longer for process to start
          await new Promise(r => setTimeout(r, 3000));
          
          // Check if it started using pgrep
          try {
            const { stdout: checkStdout } = await execAsync('pgrep -f "influxdb_writer_production.py"');
            
            if (checkStdout.trim().length > 0) {
              resolve(NextResponse.json({
                success: true,
                message: 'InfluxDB Writer started successfully',
              }));
            } else {
              // Check log for errors
              try {
                const { stdout: logContent } = await execAsync('tail -30 /tmp/influxdb_writer.log 2>/dev/null || echo "No log file"');
                resolve(NextResponse.json({
                  success: false,
                  message: 'Failed to start. Check logs for details.',
                  logPreview: logContent.toString().substring(0, 300),
                }, { status: 500 }));
              } catch {
                resolve(NextResponse.json({
                  success: false,
                  message: 'Failed to start InfluxDB Writer. Check /tmp/influxdb_writer.log for errors.',
                }, { status: 500 }));
              }
            }
          } catch (checkError: any) {
            resolve(NextResponse.json({
              success: false,
              message: `Failed to verify start: ${checkError.message}`,
            }, { status: 500 }));
          }
        }
      );
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to start InfluxDB Writer' },
      { status: 500 }
    );
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
    
    return hasMockPLC || hasLatheSim;
  } catch (error: any) {
    return false;
  }
}

async function startAlarmMonitor() {
  try {
    // Check if alarm monitor is already running
    const { stdout: pids } = await execAsync(`pgrep -f "alarm_monitor.py"`).catch(() => {
      return { stdout: '' };
    });
    
    if (pids.trim().length > 0) {
      console.log('[Start API] Alarm monitor already running');
      return;
    }
    
    console.log('[Start API] Starting alarm monitor...');
    const { exec } = require('child_process');
    exec(`cd "${PROJECT_ROOT}" && nohup python3 alarm_monitor/alarm_monitor.py > /tmp/alarm_monitor.log 2>&1 &`, 
      (error: any) => {
        if (error) {
          console.error('[Start API] Error starting alarm monitor:', error);
        } else {
          console.log('[Start API] Alarm monitor started');
        }
      }
    );
  } catch (error: any) {
    console.error('[Start API] Error starting alarm monitor:', error);
  }
}

async function startMockPLC(machineId: string) {
  try {
    // Check if already running for this machine using pgrep
    try {
      const { stdout } = await execAsync(`pgrep -f "mock_plc_agent.py.*${machineId}"`);
      if (stdout.trim().length > 0) {
        return NextResponse.json({
          success: true,
          message: `Mock PLC for ${machineId} is already running`,
          alreadyRunning: true,
        });
      }
    } catch {
      // pgrep returns non-zero if not found, which is fine
    }
    
    // Check if this is the first agent starting - if so, start alarm monitor
    const anyAgentsRunning = await checkIfAnyAgentsRunning();
    if (!anyAgentsRunning) {
      console.log('[Start API] First agent starting, starting alarm monitor');
      await startAlarmMonitor();
      // Give alarm monitor time to start
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Start the service in background with better error handling
    return new Promise<NextResponse>((resolve) => {
      // Add a timeout to ensure the Promise always resolves
      const timeout = setTimeout(() => {
        console.warn(`[Start API] Mock PLC start check timed out after 10 seconds for ${machineId}, assuming it started`);
        resolve(NextResponse.json({
          success: true,
          message: `Mock PLC for ${machineId} start command executed (timeout reached, assuming success)`,
        }));
      }, 10000); // 10 second timeout for the API response

      exec(`cd "${PROJECT_ROOT}" && nohup bash start_mock_plc.sh ${machineId} > /tmp/mock_plc_${machineId}.log 2>&1 &`, 
        async (error) => {
          clearTimeout(timeout); // Clear timeout if callback is called
          
          if (error) {
            console.error(`Error starting Mock PLC for ${machineId}:`, error);
            resolve(NextResponse.json({
              success: false,
              message: `Failed to start: ${error.message}`,
            }, { status: 500 }));
            return;
          }

          // Wait longer for process to start
          await new Promise(r => setTimeout(r, 3000));
          
          // Check if it started using pgrep
          try {
            const { stdout: checkStdout } = await execAsync(`pgrep -f "mock_plc_agent.py.*${machineId}"`);
            
            if (checkStdout.trim().length > 0) {
              resolve(NextResponse.json({
                success: true,
                message: `Mock PLC for ${machineId} started successfully`,
              }));
            } else {
              // Check log for errors
              try {
                const { stdout: logContent } = await execAsync(`tail -30 /tmp/mock_plc_${machineId}.log 2>/dev/null || echo "No log file"`);
                resolve(NextResponse.json({
                  success: false,
                  message: `Failed to start. Check logs for details.`,
                  logPreview: logContent.toString().substring(0, 300),
                }, { status: 500 }));
              } catch {
                resolve(NextResponse.json({
                  success: false,
                  message: `Failed to start Mock PLC for ${machineId}. Check /tmp/mock_plc_${machineId}.log for errors.`,
                }, { status: 500 }));
              }
            }
          } catch (checkError: any) {
            resolve(NextResponse.json({
              success: false,
              message: `Failed to verify start: ${checkError.message}`,
            }, { status: 500 }));
          }
        }
      );
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || `Failed to start Mock PLC for ${machineId}` },
      { status: 500 }
    );
  }
}

async function startLatheSim(latheMachineId: string) {
  try {
    // Check if already running for this lathe machine using pgrep
    try {
      const { stdout: pids } = await execAsync(`pgrep -f "lathe_sim.py"`);
      if (pids.trim()) {
        // Check each PID's environment for LATHE_MACHINE_ID
        const pidList = pids.trim().split('\n');
        for (const pid of pidList) {
          try {
            const { stdout: env } = await execAsync(`ps e -p ${pid} 2>/dev/null | tr ' ' '\\n' | grep "^LATHE_MACHINE_ID=" || echo ""`);
            if (env.includes(`LATHE_MACHINE_ID=${latheMachineId}`)) {
              return NextResponse.json({
                success: true,
                message: `Lathe simulator for ${latheMachineId} is already running`,
                alreadyRunning: true,
              });
            }
          } catch {
            // Process might have exited, continue
          }
        }
      }
    } catch {
      // pgrep returns non-zero if not found, which is fine
    }
    
    // Check if this is the first agent starting - if so, start alarm monitor
    const anyAgentsRunning = await checkIfAnyAgentsRunning();
    if (!anyAgentsRunning) {
      console.log('[Start API] First agent starting, starting alarm monitor');
      await startAlarmMonitor();
      // Give alarm monitor time to start
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Start the service in background with better error handling
    return new Promise<NextResponse>((resolve) => {
      exec(`cd "${PROJECT_ROOT}" && nohup bash start_lathe_sim.sh ${latheMachineId} > /tmp/lathe_sim_${latheMachineId}.log 2>&1 &`, 
        async (error) => {
          if (error) {
            console.error(`Error starting Lathe Sim for ${latheMachineId}:`, error);
            resolve(NextResponse.json({
              success: false,
              message: `Failed to start: ${error.message}`,
            }, { status: 500 }));
            return;
          }

          // Wait longer for process to start
          await new Promise(r => setTimeout(r, 3000));
          
          // Check if it started using pgrep
          try {
            const { stdout: pids } = await execAsync(`pgrep -f "lathe_sim.py"`);
            let found = false;
            if (pids.trim()) {
              const pidList = pids.trim().split('\n');
              for (const pid of pidList) {
                try {
                  const { stdout: env } = await execAsync(`ps e -p ${pid} 2>/dev/null | tr ' ' '\\n' | grep "^LATHE_MACHINE_ID=" || echo ""`);
                  if (env.includes(`LATHE_MACHINE_ID=${latheMachineId}`)) {
                    found = true;
                    break;
                  }
                } catch {
                  // Process might have exited, continue
                }
              }
            }
            
            if (found) {
              resolve(NextResponse.json({
                success: true,
                message: `Lathe simulator for ${latheMachineId} started successfully`,
              }));
            } else {
              // Check log for errors
              try {
                const { stdout: logContent } = await execAsync(`tail -30 /tmp/lathe_sim_${latheMachineId}.log 2>/dev/null || echo "No log file"`);
                resolve(NextResponse.json({
                  success: false,
                  message: `Failed to start. Check logs for details.`,
                  logPreview: logContent.toString().substring(0, 300),
                }, { status: 500 }));
              } catch {
                resolve(NextResponse.json({
                  success: false,
                  message: `Failed to start Lathe simulator for ${latheMachineId}. Check /tmp/lathe_sim_${latheMachineId}.log for errors.`,
                }, { status: 500 }));
              }
            }
          } catch (checkError: any) {
            resolve(NextResponse.json({
              success: false,
              message: `Failed to verify start: ${checkError.message}`,
            }, { status: 500 }));
          }
        }
      );
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || `Failed to start Lathe simulator for ${latheMachineId}` },
      { status: 500 }
    );
  }
}

