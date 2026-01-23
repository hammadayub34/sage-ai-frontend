import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

/**
 * Get MongoDB query information and last seen date for utilization data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const labId = searchParams.get('labId');
    const shiftName = searchParams.get('shiftName');
    const machineName = searchParams.get('machineName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!labId || !shiftName || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'labId, shiftName, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const machinesCollection = db.collection('machines');
    const shiftUtilizationCollection = db.collection('labShiftUtilization');
    const { ObjectId } = await import('mongodb');

    // Get machines for the lab
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

    // Determine machine names to query
    let machineNames: string[];
    if (machineName) {
      const selectedMachine = machines.find(m => m.machineName === machineName);
      machineNames = selectedMachine ? [selectedMachine.machineName] : [];
    } else {
      machineNames = machines.map(m => m.machineName);
    }

    // Build the MongoDB query
    const mongoQuery: any = {
      shift_name: shiftName,
      machine_name: { $in: machineNames },
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Get last seen date for the selected machine (or all machines if none selected)
    let lastSeenDate: string | null = null;
    let lastSeenRecord: any = null;

    if (machineName && machineNames.length > 0) {
      // Get last seen for specific machine
      lastSeenRecord = await shiftUtilizationCollection
        .findOne(
          { machine_name: machineName },
          { sort: { date: -1 } }
        );
    } else if (machineNames.length > 0) {
      // Get last seen across all machines
      lastSeenRecord = await shiftUtilizationCollection
        .findOne(
          { machine_name: { $in: machineNames } },
          { sort: { date: -1 } }
        );
    }

    if (lastSeenRecord) {
      lastSeenDate = lastSeenRecord.date;
    }

    // Get query statistics
    const recordCount = await shiftUtilizationCollection.countDocuments(mongoQuery);

    // Format query for display
    const queryString = JSON.stringify(mongoQuery, null, 2);

    return NextResponse.json({
      success: true,
      query: mongoQuery,
      queryString,
      collection: 'labShiftUtilization',
      database: 'admin',
      recordCount,
      lastSeenDate,
      lastSeenRecord: lastSeenRecord ? {
        date: lastSeenRecord.date,
        shift_name: lastSeenRecord.shift_name,
        machine_name: lastSeenRecord.machine_name,
        scheduled_hours: lastSeenRecord.scheduled_hours,
        utilization: lastSeenRecord.utilization,
      } : null,
      parameters: {
        labId,
        shiftName,
        machineName: machineName || 'All machines',
        startDate,
        endDate,
        machineCount: machineNames.length,
      },
    });
  } catch (error: any) {
    console.error('[Query Info API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get query information' },
      { status: 500 }
    );
  }
}

