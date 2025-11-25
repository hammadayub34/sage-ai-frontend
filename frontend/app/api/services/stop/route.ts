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

    if (service === 'influxdb_writer') {
      return await stopInfluxDBWriter();
    } else if (service === 'mock_plc') {
      if (!machineId) {
        return NextResponse.json(
          { error: 'machineId is required for mock_plc service' },
          { status: 400 }
        );
      }
      return await stopMockPLC(machineId);
    } else {
      return NextResponse.json(
        { error: 'Invalid service. Use "influxdb_writer" or "mock_plc"' },
        { status: 400 }
      );
    }
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
    // First, find the PID by checking environment variables (same method as status endpoint)
    const { stdout: pids } = await execAsync(`pgrep -f "mock_plc_agent.py"`).catch(() => {
      return { stdout: '' };
    });
    
    if (!pids.trim()) {
      return NextResponse.json({
        success: true,
        message: `Mock PLC for ${machineId} stopped (or was not running)`,
      });
    }
    
    // Check each PID's environment for MACHINE_ID
    const pidList = pids.trim().split('\n');
    for (const pid of pidList) {
      try {
        // Check if this process has the matching MACHINE_ID in its environment
        const { stdout: env } = await execAsync(`ps e -p ${pid} 2>/dev/null | tr ' ' '\\n' | grep "^MACHINE_ID=" || echo ""`).catch(() => {
          return { stdout: '' };
        });
        if (env.includes(`MACHINE_ID=${machineId}`)) {
          // Found the matching process, kill it
          await execAsync(`kill ${pid}`).catch(() => {
            // Process might have exited, continue
          });
          return NextResponse.json({
            success: true,
            message: `Mock PLC for ${machineId} stopped`,
          });
        }
      } catch {
        // Process might have exited, continue
      }
    }
    
    // No matching process found
    return NextResponse.json({
      success: true,
      message: `Mock PLC for ${machineId} stopped (or was not running)`,
    });
  } catch (error: any) {
    // Even if kill fails, assume it's stopped
    return NextResponse.json({
      success: true,
      message: `Mock PLC for ${machineId} stopped (or was not running)`,
    });
  }
}

