import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GET /api/services/status
 * Check if services are running
 */
export async function GET() {
  try {
    // Check if InfluxDB writer is running
    const influxdbWriterRunning = await checkProcessRunning('influxdb_writer_production.py');
    
    // Check if mock PLC agents are running for each bottle filler machine
    const machine01Running = await checkProcessRunning('mock_plc_agent.py', 'machine-01');
    const machine02Running = await checkProcessRunning('mock_plc_agent.py', 'machine-02');
    const machine03Running = await checkProcessRunning('mock_plc_agent.py', 'machine-03');
    
    // Check if lathe simulators are running for each lathe machine
    const lathe01Running = await checkLatheProcessRunning('lathe01');
    const lathe02Running = await checkLatheProcessRunning('lathe02');
    const lathe03Running = await checkLatheProcessRunning('lathe03');

    return NextResponse.json({
      influxdbWriter: {
        running: influxdbWriterRunning,
      },
      machines: {
        'machine-01': {
          running: machine01Running,
        },
        'machine-02': {
          running: machine02Running,
        },
        'machine-03': {
          running: machine03Running,
        },
        'lathe01': {
          running: lathe01Running,
        },
        'lathe02': {
          running: lathe02Running,
        },
        'lathe03': {
          running: lathe03Running,
        },
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error('Error checking service status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}

async function checkProcessRunning(scriptName: string, machineId?: string): Promise<boolean> {
  try {
    if (machineId) {
      // For mock PLC, we need to check the process environment variables
      // First get all PIDs for the script
      let command = `pgrep -f "${scriptName}"`;
      const { stdout: pids } = await execAsync(command);
      
      if (!pids.trim()) {
        return false;
      }
      
      // Check each PID's environment for MACHINE_ID
      const pidList = pids.trim().split('\n');
      for (const pid of pidList) {
        try {
          // Check if this process has the matching MACHINE_ID in its environment
          const { stdout: env } = await execAsync(`ps e -p ${pid} 2>/dev/null | tr ' ' '\\n' | grep "^MACHINE_ID=" || echo ""`);
          if (env.includes(`MACHINE_ID=${machineId}`)) {
            return true;
          }
        } catch {
          // Process might have exited, continue
        }
      }
      return false;
    } else {
      // For InfluxDB writer, just check if process exists
      const { stdout } = await execAsync(`pgrep -f "${scriptName}"`);
      return stdout.trim().length > 0;
    }
  } catch (error) {
    // pgrep returns non-zero exit code if no process found, which is OK
    return false;
  }
}

async function checkLatheProcessRunning(latheMachineId: string): Promise<boolean> {
  try {
    // For lathe sim, we need to check the process environment variables
    // First get all PIDs for lathe_sim.py
    let command = `pgrep -f "lathe_sim.py"`;
    const { stdout: pids } = await execAsync(command);
    
    if (!pids.trim()) {
      return false;
    }
    
    // Check each PID's environment for LATHE_MACHINE_ID
    const pidList = pids.trim().split('\n');
    for (const pid of pidList) {
      try {
        // Check if this process has the matching LATHE_MACHINE_ID in its environment
        const { stdout: env } = await execAsync(`ps e -p ${pid} 2>/dev/null | tr ' ' '\\n' | grep "^LATHE_MACHINE_ID=" || echo ""`);
        if (env.includes(`LATHE_MACHINE_ID=${latheMachineId}`)) {
          return true;
        }
      } catch {
        // Process might have exited, continue
      }
    }
    return false;
  } catch (error) {
    // pgrep returns non-zero exit code if no process found, which is OK
    return false;
  }
}

