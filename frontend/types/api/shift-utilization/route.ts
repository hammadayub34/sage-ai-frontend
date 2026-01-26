import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface ShiftUtilizationData {
  machine_name: string;
  shift_name: string;
  date: string;
  utilization: number;
  productive_hours: number;
  idle_hours: number;
  non_productive_hours: number;
  node_off_hours: number;
  scheduled_hours: number;
  status: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const labId = searchParams.get('labId');
    const shiftName = searchParams.get('shiftName');
    const days = parseInt(searchParams.get('days') || '30'); // Default to last month (30 days)

    if (!labId) {
      return NextResponse.json(
        { success: false, error: 'labId is required' },
        { status: 400 }
      );
    }

    if (!shiftName) {
      return NextResponse.json(
        { success: false, error: 'shiftName is required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const machinesCollection = db.collection('machines');
    const shiftUtilizationCollection = db.collection('labShiftUtilization');

    // Get all machines for this lab
    const { ObjectId } = await import('mongodb');
    let labObjectId: any;
    try {
      labObjectId = new ObjectId(labId);
    } catch {
      labObjectId = null;
    }

    const machines = await machinesCollection.find({
      $or: [
        { labId: labId },
        ...(labObjectId ? [{ labId: labObjectId }] : [])
      ]
    }).toArray();

    if (machines.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          shiftName,
          totalMachines: 0,
          machinesWithData: 0,
          averageUtilization: 0,
          totalProductiveHours: 0,
          totalIdleHours: 0,
          totalScheduledHours: 0,
          totalNonProductiveHours: 0,
          totalNodeOffHours: 0,
          machineUtilizations: [],
        }
      });
    }

    // Get machine names
    const machineNames = machines.map(m => m.machineName);

    // Calculate date range - support custom startDate and endDate, or use days
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    let startDate: Date;
    let endDate: Date;
    
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    if (startDateParam && endDateParam) {
      // Use provided date range
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      // Use days parameter (default behavior)
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    // Fetch shift utilization data for this shift and machines
    const utilizationData = await shiftUtilizationCollection
      .find({
        shift_name: shiftName,
        machine_name: { $in: machineNames },
        date: {
          $gte: startDateStr,
          $lte: endDateStr
        }
      })
      .toArray();

    // Aggregate data by machine
    const machineStats = new Map<string, {
      machineName: string;
      totalUtilization: number;
      totalProductiveHours: number;
      totalIdleHours: number;
      totalScheduledHours: number;
      totalNonProductiveHours: number;
      totalNodeOffHours: number;
      recordCount: number;
    }>();

    utilizationData.forEach((doc: any) => {
      const machineName = doc.machine_name;
      if (!machineStats.has(machineName)) {
        machineStats.set(machineName, {
          machineName,
          totalUtilization: 0,
          totalProductiveHours: 0,
          totalIdleHours: 0,
          totalScheduledHours: 0,
          totalNonProductiveHours: 0,
          totalNodeOffHours: 0,
          recordCount: 0,
        });
      }

      const stats = machineStats.get(machineName)!;
      stats.totalUtilization += doc.utilization || 0;
      stats.totalProductiveHours += doc.productive_hours || 0;
      stats.totalIdleHours += doc.idle_hours || 0;
      stats.totalScheduledHours += doc.scheduled_hours || 0;
      stats.totalNonProductiveHours += doc.non_productive_hours || 0;
      stats.totalNodeOffHours += doc.node_off_hours || 0;
      stats.recordCount += 1;
    });

    // Calculate averages and totals
    const machineUtilizations = Array.from(machineStats.values()).map(stats => ({
      machineName: stats.machineName,
      averageUtilization: stats.recordCount > 0 ? stats.totalUtilization / stats.recordCount : 0,
      totalProductiveHours: stats.totalProductiveHours,
      totalIdleHours: stats.totalIdleHours,
      totalScheduledHours: stats.totalScheduledHours,
      totalNonProductiveHours: stats.totalNonProductiveHours,
      totalNodeOffHours: stats.totalNodeOffHours,
      recordCount: stats.recordCount,
    }));

    // Calculate overall totals
    const totalProductiveHours = machineUtilizations.reduce((sum, m) => sum + m.totalProductiveHours, 0);
    const totalIdleHours = machineUtilizations.reduce((sum, m) => sum + m.totalIdleHours, 0);
    const totalScheduledHours = machineUtilizations.reduce((sum, m) => sum + m.totalScheduledHours, 0);
    const totalNonProductiveHours = machineUtilizations.reduce((sum, m) => sum + m.totalNonProductiveHours, 0);
    const totalNodeOffHours = machineUtilizations.reduce((sum, m) => sum + m.totalNodeOffHours, 0);
    
    // Calculate average utilization (weighted by scheduled hours)
    const totalUtilizationWeighted = machineUtilizations.reduce(
      (sum, m) => sum + (m.averageUtilization * m.totalScheduledHours),
      0
    );
    const averageUtilization = totalScheduledHours > 0 
      ? totalUtilizationWeighted / totalScheduledHours 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        shiftName,
        totalMachines: machines.length,
        machinesWithData: machineUtilizations.length,
        averageUtilization: Math.round(averageUtilization * 100) / 100,
        totalProductiveHours: Math.round(totalProductiveHours * 100) / 100,
        totalIdleHours: Math.round(totalIdleHours * 100) / 100,
        totalScheduledHours: Math.round(totalScheduledHours * 100) / 100,
        totalNonProductiveHours: Math.round(totalNonProductiveHours * 100) / 100,
        totalNodeOffHours: Math.round(totalNodeOffHours * 100) / 100,
        machineUtilizations: machineUtilizations.sort((a, b) => b.averageUtilization - a.averageUtilization),
        dateRange: {
          start: startDateStr,
          end: endDateStr,
          days,
        },
      }
    });
  } catch (error: any) {
    console.error('[Shift Utilization API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch shift utilization data' },
      { status: 500 }
    );
  }
}

