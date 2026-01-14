import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * GET /api/services/logs
 * Get logs for a service
 * Query params: service (influxdb_writer | mock_plc), machineId (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const service = searchParams.get('service');
    const machineId = searchParams.get('machineId');

    if (!service) {
      return NextResponse.json(
        { error: 'service parameter is required' },
        { status: 400 }
      );
    }

    let logPath: string;
    if (service === 'influxdb_writer') {
      logPath = '/tmp/influxdb_writer.log';
    } else if (service === 'mock_plc') {
      if (!machineId) {
        return NextResponse.json(
          { error: 'machineId is required for mock_plc service' },
          { status: 400 }
        );
      }
      logPath = `/tmp/mock_plc_${machineId}.log`;
    } else {
      return NextResponse.json(
        { error: 'Invalid service. Use "influxdb_writer" or "mock_plc"' },
        { status: 400 }
      );
    }

    try {
      // Read last 50 lines of the log file
      const logContent = await readFile(logPath, 'utf-8');
      const lines = logContent.split('\n').filter(line => line.trim().length > 0);
      const lastLines = lines.slice(-50).join('\n'); // Last 50 lines
      
      return NextResponse.json({
        success: true,
        logs: lastLines,
        lineCount: lines.length,
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return NextResponse.json({
          success: true,
          logs: 'No log file found yet. Service may not have started.',
          lineCount: 0,
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error reading logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to read logs' },
      { status: 500 }
    );
  }
}

