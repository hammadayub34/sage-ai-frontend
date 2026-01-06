import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/machines/nodes-info
 * Get all machines with their nodes and sensor information
 * Optional query params:
 * - labId: filter by lab ID
 * - machineId: get specific machine
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const labId = searchParams.get('labId');
    const machineId = searchParams.get('machineId');

    const db = await connectToDatabase();
    const machinesCollection = db.collection('machines');
    const connectionsCollection = db.collection('connections');
    const labsCollection = db.collection('labs');

    // Build query for machines
    let machineQuery: any = {};
    if (machineId) {
      try {
        machineQuery._id = new ObjectId(machineId);
      } catch {
        machineQuery._id = machineId;
      }
    } else if (labId) {
      try {
        const labObjectId = new ObjectId(labId);
        machineQuery.$or = [
          { labId: labId },
          { labId: labObjectId }
        ];
      } catch {
        machineQuery.labId = labId;
      }
    }

    // Get machines
    const machines = await machinesCollection.find(machineQuery).toArray();

    if (machines.length === 0) {
      return NextResponse.json({
        success: true,
        machines: [],
        summary: {
          totalMachines: 0,
          totalNodes: 0,
          sensorTypes: {},
          nodeTypes: {}
        }
      });
    }

    // Get machine IDs
    const machineIds = machines.map(m => m._id.toString());
    const machineObjectIds = machines.map(m => m._id);

    // Get all connections for these machines
    const connections = await connectionsCollection.find({
      $or: [
        { machineId: { $in: machineIds } },
        { machineId: { $in: machineObjectIds } }
      ]
    }).toArray();

    // Get all unique MAC addresses from connections
    const allMacs = [...new Set(connections.map(c => c.mac).filter(Boolean))];
    
    // Query nodes collection to get sensor information for each MAC
    const nodesCollection = db.collection('nodes');
    const nodes = allMacs.length > 0 ? await nodesCollection.find({
      mac: { $in: allMacs }
    }).toArray() : [];
    
    // Helper function to determine sensor type from node document
    const getSensorTypeFromNode = (node: any): string | null => {
      if (!node) return null;
      
      // Check which sensors are active
      const activeSensors: string[] = [];
      
      if (node.ct && node.ct.status === true) {
        activeSensors.push('Current');
      }
      if (node.vibration && node.vibration.status === true) {
        activeSensors.push('Vibration');
      }
      if (node.ambient && node.ambient.status === true) {
        activeSensors.push('Ambient Temperature & Humidity');
      }
      if (node.thermistor && node.thermistor.status === true) {
        activeSensors.push('Temperature');
      }
      
      // Return the first active sensor, or null if none
      return activeSensors.length > 0 ? activeSensors[0] : null;
    };
    
    // Create a map of MAC -> node info from nodes collection
    const nodesByMac = new Map<string, any>();
    nodes.forEach(node => {
      if (node.mac) {
        nodesByMac.set(node.mac, {
          sensorType: getSensorTypeFromNode(node),
          // Node type can be inferred from sensor type or stored separately
          nodeType: node.nodeType || null,
        });
      }
    });

    // Get lab information
    const labIds = [...new Set(machines.map(m => m.labId?.toString()).filter(Boolean))];
    const labObjectIds = labIds.map(id => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const labs = await labsCollection.find({
      $or: [
        { _id: { $in: labIds } },
        { _id: { $in: labObjectIds } }
      ]
    }).toArray();

    const labMap = new Map();
    labs.forEach(lab => {
      labMap.set(lab._id.toString(), lab.name);
    });

    // Group connections by machine ID and deduplicate by MAC
    const connectionsByMachine = new Map<string, Map<string, any>>();
    connections.forEach(conn => {
      const machineId = typeof conn.machineId === 'string' 
        ? conn.machineId 
        : conn.machineId.toString();
      
      if (!connectionsByMachine.has(machineId)) {
        connectionsByMachine.set(machineId, new Map());
      }
      
      const macMap = connectionsByMachine.get(machineId)!;
      const mac = conn.mac;
      
      // Get node info from nodes collection if available
      const nodeInfo = nodesByMac.get(mac) || {};
      
      if (!macMap.has(mac)) {
        macMap.set(mac, {
          mac: mac,
          // Prefer connection data, fallback to nodes collection data
          nodeType: conn.nodeType || nodeInfo.nodeType || null,
          sensorType: conn.sensorType || nodeInfo.sensorType || null,
        });
      } else {
        // Prefer the one with more complete info
        const existing = macMap.get(mac)!;
        const newNodeType = conn.nodeType || nodeInfo.nodeType || existing.nodeType;
        const newSensorType = conn.sensorType || nodeInfo.sensorType || existing.sensorType;
        
        if ((!existing.nodeType && newNodeType) || (!existing.sensorType && newSensorType)) {
          macMap.set(mac, {
            mac: mac,
            nodeType: newNodeType || existing.nodeType || null,
            sensorType: newSensorType || existing.sensorType || null,
          });
        }
      }
    });

    // Build response with machines and their nodes
    const machinesWithNodes = machines.map(machine => {
      const machineId = machine._id.toString();
      const macMap = connectionsByMachine.get(machineId) || new Map();
      
      // Also check if machine has nodes array directly (for backward compatibility)
      if (machine.nodes && Array.isArray(machine.nodes)) {
        machine.nodes.forEach((node: any) => {
          if (node.mac && !macMap.has(node.mac)) {
            macMap.set(node.mac, {
              mac: node.mac,
              nodeType: node.nodeType || null,
              sensorType: node.sensorType || null,
            });
          } else if (node.mac && macMap.has(node.mac)) {
            // Merge data if node exists but has more complete info
            const existing = macMap.get(node.mac)!;
            if ((!existing.nodeType && node.nodeType) || (!existing.sensorType && node.sensorType)) {
              macMap.set(node.mac, {
                mac: node.mac,
                nodeType: node.nodeType || existing.nodeType || null,
                sensorType: node.sensorType || existing.sensorType || null,
              });
            }
          }
        });
      }
      
      const nodes = Array.from(macMap.values());

      return {
        machineId: machineId,
        machineName: machine.machineName,
        labId: machine.labId?.toString() || machine.labId,
        labName: labMap.get(machine.labId?.toString() || machine.labId) || 'Unknown Lab',
        status: machine.status || 'active',
        description: machine.description || '',
        nodes: nodes,
        nodeCount: nodes.length,
      };
    });

    // Calculate summary statistics
    const summary = {
      totalMachines: machinesWithNodes.length,
      totalNodes: machinesWithNodes.reduce((sum, m) => sum + m.nodeCount, 0),
      sensorTypes: {} as Record<string, number>,
      nodeTypes: {} as Record<string, number>,
    };

    machinesWithNodes.forEach(machine => {
      machine.nodes.forEach(node => {
        if (node.sensorType) {
          summary.sensorTypes[node.sensorType] = (summary.sensorTypes[node.sensorType] || 0) + 1;
        }
        if (node.nodeType) {
          summary.nodeTypes[node.nodeType] = (summary.nodeTypes[node.nodeType] || 0) + 1;
        }
      });
    });

    return NextResponse.json({
      success: true,
      machines: machinesWithNodes,
      summary: summary,
    });
  } catch (error: any) {
    console.error('[Machines Nodes Info API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch machines and nodes info' },
      { status: 500 }
    );
  }
}

