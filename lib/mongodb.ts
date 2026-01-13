import { MongoClient, Db, Collection } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

let client: MongoClient | null = null;
let cachedDb: Db | null = null;

export interface Machine {
  _id: string;
  nodeId: string | null;
  labId: string;
  machineName: string;
  image?: string;
  description?: string;
  tags?: string[];
  status: 'active' | 'inactive';
  created_at: string;
  __v?: number;
}

/**
 * Connect to MongoDB and return the database instance
 */
export async function connectToDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  if (!client) {
    const mongoUri = process.env.MONGODB_URI || uri;
    console.log(`[MongoDB] Connecting to MongoDB...`);
    console.log(`[MongoDB] URI configured: ${mongoUri ? 'Yes' : 'No'}`);
    console.log(`[MongoDB] Using ${process.env.MONGODB_URI ? 'environment variable' : 'fallback URI'}`);
    
    try {
      client = new MongoClient(mongoUri);
      await client.connect();
      console.log('✅ Connected to MongoDB');
    } catch (error: any) {
      console.error('[MongoDB] Connection error:', error);
      console.error('[MongoDB] Error details:', {
        message: error.message,
        name: error.name,
        code: error.code,
      });
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }

  cachedDb = client.db(dbName);
  return cachedDb;
}

/**
 * Get all machines from the database
 */
export async function getMachines(): Promise<Machine[]> {
  const db = await connectToDatabase();
  const collection = db.collection<Machine>('machines');
  
  const machines = await collection.find({}).toArray();
  return machines.map(machine => ({
    ...machine,
    _id: machine._id.toString(),
  }));
}

/**
 * Get a single machine by ID
 */
export async function getMachineById(machineId: string): Promise<Machine | null> {
  const db = await connectToDatabase();
  const collection = db.collection<Machine>('machines');
  
  const machine = await collection.findOne({ _id: machineId as any });
  if (!machine) {
    return null;
  }
  
  return {
    ...machine,
    _id: machine._id.toString(),
  };
}

/**
 * Get machines by status
 */
export async function getMachinesByStatus(status: 'active' | 'inactive'): Promise<Machine[]> {
  const db = await connectToDatabase();
  const collection = db.collection<Machine>('machines');
  
  const machines = await collection.find({ status }).toArray();
  return machines.map(machine => ({
    ...machine,
    _id: machine._id.toString(),
  }));
}

/**
 * Get machines by lab ID with connections/nodes
 */
export async function getMachinesByLabId(labId: string): Promise<(Machine & { nodes: any[] })[]> {
  const db = await connectToDatabase();
  const machinesCollection = db.collection<Machine>('machines');
  const connectionsCollection = db.collection('connections');
  
  // Find machines for this lab (try both string and ObjectId formats)
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
  
  // Get all machine IDs (both string and ObjectId formats)
  const machineIds = machines.map(m => m._id.toString());
  const machineObjectIds = machines.map(m => m._id);
  
  // Get all connections for these machines
  const connections = await connectionsCollection.find({
    $or: [
      { machineId: { $in: machineIds } },
      { machineId: { $in: machineObjectIds } }
    ]
  }).toArray();
  
  // Group connections by machine ID and deduplicate by MAC address
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
    
    // Only add if MAC doesn't exist, or if it exists but this one has more complete info
    if (!macMap.has(mac)) {
      macMap.set(mac, {
        mac: mac,
        nodeType: conn.nodeType || null,
        sensorType: conn.sensorType || null,
      });
    } else {
      // If MAC already exists, prefer the one with more complete info (nodeType/sensorType)
      const existing = macMap.get(mac)!;
      if ((!existing.nodeType && conn.nodeType) || (!existing.sensorType && conn.sensorType)) {
        macMap.set(mac, {
          mac: mac,
          nodeType: conn.nodeType || existing.nodeType || null,
          sensorType: conn.sensorType || existing.sensorType || null,
        });
      }
    }
  });
  
  // Convert Map to Array for each machine
  const connectionsByMachineArray = new Map<string, any[]>();
  connectionsByMachine.forEach((macMap, machineId) => {
    connectionsByMachineArray.set(machineId, Array.from(macMap.values()));
  });
  
  // Combine machines with their connections
  return machines.map(machine => {
    const machineId = machine._id.toString();
    const nodes = connectionsByMachineArray.get(machineId) || [];
    
    return {
      ...machine,
      _id: machineId,
      nodes: nodes,
    };
  });
}

/**
 * Get all nodes for a machine (via connections collection)
 */
export async function getMachineNodes(machineId: string): Promise<any[]> {
  const db = await connectToDatabase();
  const connectionsCollection = db.collection('connections');
  const nodesCollection = db.collection('nodes');
  
  // Get all unique MAC addresses for this machine
  const connections = await connectionsCollection.find({ 
    machineId: machineId 
  }).toArray();
  
  const uniqueMacs = [...new Set(connections.map(c => c.mac))];
  
  if (uniqueMacs.length === 0) {
    return [];
  }
  
  // Find nodes by MAC addresses
  const nodes = await nodesCollection.find({ 
    mac: { $in: uniqueMacs } 
  }).toArray();
  
  return nodes.map(node => ({
    ...node,
    _id: node._id.toString(),
  }));
}

/**
 * Get machine with all its nodes
 */
export async function getMachineWithNodes(machineId: string): Promise<Machine & { nodes: any[] } | null> {
  const machine = await getMachineById(machineId);
  if (!machine) {
    return null;
  }
  
  const nodes = await getMachineNodes(machineId);
  return {
    ...machine,
    nodes,
  };
}

/**
 * Get all labs (for shopfloor dropdown)
 */
export interface Lab {
  _id: string;
  name: string;
  description?: string;
}

export async function getLabs(): Promise<Lab[]> {
  const db = await connectToDatabase();
  const collection = db.collection<Lab>('labs');
  
  const labs = await collection.find({}).toArray();
  return labs.map(lab => ({
    ...lab,
    _id: lab._id.toString(),
  }));
}

/**
 * Get a single lab by ID
 */
export async function getLabById(labId: string): Promise<Lab | null> {
  const db = await connectToDatabase();
  const collection = db.collection<Lab>('labs');
  const { ObjectId } = await import('mongodb');
  
  let labObjectId: any;
  try {
    labObjectId = new ObjectId(labId);
  } catch {
    labObjectId = null;
  }
  
  const lab = await collection.findOne({
    $or: [
      { _id: labId },
      ...(labObjectId ? [{ _id: labObjectId }] : [])
    ]
  });
  
  if (!lab) {
    return null;
  }
  
  return {
    ...lab,
    _id: lab._id.toString(),
  };
}

/**
 * Get labs for a specific user (labs where user is in user_id array)
 */
export async function getLabsForUser(userId: string): Promise<Lab[]> {
  const db = await connectToDatabase();
  const collection = db.collection('labs');
  const { ObjectId } = await import('mongodb');
  
  let userObjectId: any;
  try {
    userObjectId = new ObjectId(userId);
  } catch (error) {
    // If userId is not a valid ObjectId, try searching as string
    const labs = await collection.find({
      user_id: userId
    }).toArray();
    
    return labs.map(lab => ({
      _id: lab._id.toString(),
      name: lab.name,
      description: lab.description,
    }));
  }
  
  // Find labs where user_id array contains the user's ObjectId
  const labs = await collection.find({
    user_id: userObjectId
  }).toArray();
  
  // If no labs found with ObjectId, try string format
  if (labs.length === 0) {
    const labsString = await collection.find({
      user_id: userId
    }).toArray();
    
    return labsString.map(lab => ({
      _id: lab._id.toString(),
      name: lab.name,
      description: lab.description,
    }));
  }
  
  return labs.map(lab => ({
    _id: lab._id.toString(),
    name: lab.name,
    description: lab.description,
  }));
}

/**
 * Get unassigned nodes (status: "unassigned")
 */
export interface UnassignedNode {
  _id: string;
  mac: string;
  status: string;
}

export async function getUnassignedNodes(): Promise<UnassignedNode[]> {
  const db = await connectToDatabase();
  const nodesCollection = db.collection('nodes');
  const connectionsCollection = db.collection('connections');
  
  // Get all assigned MACs from connections
  const assignedMacs = await connectionsCollection.distinct('mac');
  
  // Get nodes that are unassigned AND not in connections
  const nodes = await nodesCollection.find({ 
    status: 'unassigned',
    mac: { $nin: assignedMacs }
  }).toArray();
  
  return nodes.map(node => ({
    _id: node._id.toString(),
    mac: node.mac,
    status: node.status,
  }));
}

/**
 * Create machine with nodes
 */
export interface CreateMachineData {
  machineName: string;
  labId: string;
  description?: string;
  tags?: string[];
  status?: 'active' | 'inactive';
  nodes: Array<{
    mac: string;
    nodeType: 'Beacon/c³' | 'Beacon/vᵗ' | 'Beacon/tᵒ';
    sensorType: 'Current' | 'Vibration' | 'Ambient Temperature & Humidity';
  }>;
}

export async function createMachineWithNodes(data: CreateMachineData): Promise<{ machineId: string; connections: any[] }> {
  const db = await connectToDatabase();
  const machinesCollection = db.collection('machines');
  const connectionsCollection = db.collection('connections');
  const nodesCollection = db.collection('nodes');
  
  // Create machine document
  const machineDoc = {
    machineName: data.machineName,
    labId: data.labId,
    description: data.description || '',
    tags: data.tags || [],
    status: data.status || 'active',
    nodeId: null,
    created_at: new Date(),
    __v: 0,
  };
  
  const machineResult = await machinesCollection.insertOne(machineDoc);
  const machineId = machineResult.insertedId.toString();
  
  // Create connection documents for each node
  const connections = [];
  for (const node of data.nodes) {
    const connectionDoc = {
      machineId: machineId,
      mac: node.mac,
      nodeType: node.nodeType,
      sensorType: node.sensorType,
      created_at: new Date(),
      __v: 0,
    };
    
    const connectionResult = await connectionsCollection.insertOne(connectionDoc);
    connections.push({
      _id: connectionResult.insertedId.toString(),
      ...connectionDoc,
    });
    
    // Update node status to "assigned"
    await nodesCollection.updateOne(
      { mac: node.mac },
      { $set: { status: 'assigned' } }
    );
  }
  
  return {
    machineId,
    connections,
  };
}

/**
 * Close the MongoDB connection
 */
export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    cachedDb = null;
    console.log('🔌 MongoDB connection closed');
  }
}

