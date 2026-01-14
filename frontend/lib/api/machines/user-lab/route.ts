import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * Get machines for the logged-in user's lab(s)
 * Expects userId in query params
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const labsCollection = db.collection('labs');
    const machinesCollection = db.collection('machines');
    const connectionsCollection = db.collection('connections');

    // Convert userId to ObjectId
    let userObjectId: ObjectId;
    try {
      userObjectId = new ObjectId(userId);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Find all labs where this user is in the user_id array
    console.log(`[User-Lab API] Searching for labs with user_id: ${userObjectId.toString()}`);
    
    let labs = await labsCollection
      .find({
        user_id: userObjectId
      })
      .toArray();

    console.log(`[User-Lab API] Found ${labs.length} labs with ObjectId format`);
    
    if (labs.length === 0) {
      return NextResponse.json({
        success: true,
        machines: [],
        labs: [],
        message: 'User is not associated with any lab'
      });
    }

    // Get lab IDs (try both string and ObjectId formats for compatibility)
    const labIds = labs.map(lab => lab._id.toString());
    const labObjectIds = labs.map(lab => lab._id);

    // Find all machines for these labs
    const machines = await machinesCollection
      .find({
        $or: [
          { labId: { $in: labIds } },
          { labId: { $in: labObjectIds } }
        ]
      })
      .toArray();

    // Get machine IDs (both string and ObjectId formats)
    const machineIds = machines.map(m => m._id.toString());
    const machineObjectIds = machines.map(m => m._id);

    // Get all connections for these machines
    const connections = await connectionsCollection
      .find({
        $or: [
          { machineId: { $in: machineIds } },
          { machineId: { $in: machineObjectIds } }
        ]
      })
      .toArray();

    // Group connections by machineId and deduplicate by MAC
    const connectionsByMachine: Record<string, Map<string, any>> = {};
    connections.forEach(conn => {
      let machineId: string | null = null;
      for (const m of machines) {
        const mIdStr = m._id.toString();
        const mIdObj = m._id;
        const connMachineId = conn.machineId?.toString();
        if (connMachineId === mIdStr || 
            (typeof conn.machineId === 'object' && conn.machineId.equals && conn.machineId.equals(mIdObj)) ||
            conn.machineId === mIdStr ||
            (typeof conn.machineId === 'object' && mIdObj.equals && mIdObj.equals(conn.machineId))) {
          machineId = mIdStr;
          break;
        }
      }
      
      if (!machineId || !conn.mac) return;
      
      if (!connectionsByMachine[machineId]) {
        connectionsByMachine[machineId] = new Map();
      }
      
      const mac = conn.mac;
      if (!connectionsByMachine[machineId].has(mac)) {
        connectionsByMachine[machineId].set(mac, {
          mac: mac,
          nodeType: conn.nodeType || conn.node_type || null,
          sensorType: conn.sensorType || conn.sensor_type || null,
        });
      }
    });

    // Convert Maps to arrays
    const connectionsByMachineArray: Record<string, any[]> = {};
    Object.keys(connectionsByMachine).forEach(machineId => {
      connectionsByMachineArray[machineId] = Array.from(connectionsByMachine[machineId].values());
    });

    // Format machines with their connections (MAC addresses)
    const formattedMachines = machines.map(machine => ({
      ...machine,
      _id: machine._id.toString(),
      labId: machine.labId.toString(),
      macAddresses: connectionsByMachineArray[machine._id.toString()] || [],
    }));

    return NextResponse.json({
      success: true,
      machines: formattedMachines,
      labs: labs.map(lab => ({
        _id: lab._id.toString(),
        name: lab.name,
      }))
    });
  } catch (error: any) {
    console.error('Error fetching user lab machines:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch machines' },
      { status: 500 }
    );
  }
}

