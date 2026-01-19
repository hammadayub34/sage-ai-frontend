# Workflow Execution Flow

## 1. Node Creation (Where nodes are made)

### Location: `frontend/app/workflows/page.tsx` (lines 289-299)

When a user clicks a node in the palette, a new node is created:

```typescript
<NodePalette onAddNode={(node) => {
  const newNode = {
    id: `node-${Date.now()}`,                    // Unique ID
    type: 'tool-node',                           // React Flow node type
    position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
    data: {
      type: node.type,                           // Tool type (e.g., 'startAgent', 'monitorTags')
      config: node.config || {},                  // Node configuration
      label: node.name,                           // Display label
    },
  };
  setNodes(prev => [...prev, newNode]);
}} />
```

### Node Types Defined: `frontend/components/NodePalette.tsx` (lines 11-42)

Available node types:
- `startAgent` → `startAgentTool`
- `monitorTags` → `monitorTagsTool`
- `queryPinecone` → `queryPineconeTool`
- `createWorkOrder` → `createWorkOrderTool`
- `saveWorkOrder` → `saveWorkOrderTool`

---

## 2. Workflow Execution (When "Run" is clicked)

### Location: `frontend/app/workflows/page.tsx` (lines 75-124)

```typescript
const handleRunWorkflow = async () => {
  // Transform nodes to API format
  const workflowNodes = nodes.map(node => ({
    id: node.id,
    type: 'tool',
    data: {
      type: node.data.type,        // 'startAgent', 'monitorTags', etc.
      config: node.data.config || {},
      label: node.data.label,
    },
  }));

  // Send to API
  const response = await fetch('/api/workflows/execute', {
    method: 'POST',
    body: JSON.stringify({ nodes: workflowNodes, edges }),
  });
}
```

---

## 3. API Route (Server-side execution)

### Location: `frontend/app/api/workflows/execute/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const { nodes, edges } = await request.json();
  
  // Build workflow from nodes and edges
  const workflow = buildWorkflow({ nodes, edges }, onLog);
  
  // Execute workflow
  const result = await workflow.execute();
  
  return NextResponse.json({ success: true, result });
}
```

---

## 4. Workflow Builder (Execution orchestration)

### Location: `frontend/lib/workflow-builder.ts`

### Step 1: Find Start Node (lines 47-60)
```typescript
// Find node with no incoming edges (the start node)
const startNodes = nodes.filter(n => !targetIds.has(n.id));
const startNode = startNodes[0];
```

### Step 2: Build Execution Order (lines 62-72)
```typescript
// Build adjacency list to determine execution sequence
const adjacencyList: Record<string, string[]> = {};
edges.forEach(edge => {
  adjacencyList[edge.source].push(edge.target);
});
```

### Step 3: Execute Each Node (lines 80-113)
```typescript
async function executeNode(nodeId: string, state: WorkflowState): Promise<WorkflowState> {
  // 1. Get node from map
  const node = nodeMap.get(nodeId);
  
  // 2. Get tool type from node data
  const toolType = node.data.type;  // e.g., 'startAgent'
  
  // 3. Look up tool function from registry
  const tool = TOOL_REGISTRY[toolType];  // e.g., startAgentTool
  
  // 4. Log execution start
  state.executionLog.push(`▶️ Executing: ${node.data.config?.label || toolType}`);
  
  // 5. Execute the tool function
  const updatedState = await tool(state, node.data.config || {});
  
  return updatedState;
}
```

### Step 4: Execute Sequentially (lines 118-131)
```typescript
async function executeFromNode(nodeId: string, state: WorkflowState): Promise<WorkflowState> {
  // Execute current node
  let currentState = await executeNode(nodeId, state);
  
  // Get next nodes from edges
  const nextNodeIds = adjacencyList[nodeId] || [];
  
  // Execute next nodes sequentially
  for (const nextNodeId of nextNodeIds) {
    currentState = await executeFromNode(nextNodeId, currentState);
  }
  
  return currentState;
}
```

---

## 5. Tool Functions (What each node actually does)

### Location: `frontend/lib/workflow-tools.ts`

### Tool Registry (lines 283-289)
```typescript
export const TOOL_REGISTRY: Record<string, Function> = {
  startAgent: startAgentTool,           // Starts agent/writer service
  monitorTags: monitorTagsTool,         // Queries InfluxDB for alarms
  queryPinecone: queryPineconeTool,    // Queries Pinecone for maintenance data
  createWorkOrder: createWorkOrderTool, // Formats work order data
  saveWorkOrder: saveWorkOrderTool,     // Saves to InfluxDB
};
```

### Example: `startAgentTool` (lines 31-65)
```typescript
export async function startAgentTool(
  state: WorkflowState,
  config: { machineId: string; service: 'mock_plc' | 'influxdb_writer' }
): Promise<WorkflowState> {
  // 1. Add log entry
  log.push(`🔧 Starting ${config.service} for ${config.machineId}...`);
  
  // 2. Call API endpoint
  const response = await fetch(`${baseUrl}/api/services/start`, {
    method: 'POST',
    body: JSON.stringify({
      service: config.service,
      machineId: config.machineId,
    }),
  });
  
  // 3. Update state with result
  return {
    ...state,
    machineId: config.machineId,
    executionLog: log,
  };
}
```

### Example: `monitorTagsTool` (lines 71-120)
```typescript
export async function monitorTagsTool(
  state: WorkflowState,
  config: { machineId: string; timeRange?: string; threshold?: number }
): Promise<WorkflowState> {
  // 1. Add log entry
  log.push(`📊 Monitoring tags for ${machineId} (threshold: ${threshold})...`);
  
  // 2. Call API endpoint
  const response = await fetch(`${baseUrl}/api/work-order/check-thresholds`, {
    method: 'POST',
    body: JSON.stringify({
      machineId,
      timeRange: '-24h',
      customThreshold: 50,
    }),
  });
  
  // 3. Store alarm data in state
  return {
    ...state,
    alarmData: {
      alarms: alarmsExceedingThreshold,
      firstAlarm: alarmsExceedingThreshold[0],
    },
    executionLog: log,
  };
}
```

### Example: `queryPineconeTool` (lines 126-176)
```typescript
export async function queryPineconeTool(
  state: WorkflowState,
  config: { machineId?: string; alarmType?: string; machineType?: string }
): Promise<WorkflowState> {
  // 1. Get alarm data from previous step (state.alarmData)
  const firstAlarm = state.alarmData?.firstAlarm;
  
  // 2. Call API endpoint
  const response = await fetch(`${baseUrl}/api/work-order/pinecone-fill`, {
    method: 'POST',
    body: JSON.stringify({
      machineId,
      alarmType: firstAlarm?.alarmType,
      machineType: firstAlarm?.machineType,
    }),
  });
  
  // 3. Store Pinecone data in state
  return {
    ...state,
    pineconeData: result,
    executionLog: log,
  };
}
```

### Example: `createWorkOrderTool` (lines 182-234)
```typescript
export async function createWorkOrderTool(
  state: WorkflowState,
  config: Record<string, any> = {}
): Promise<WorkflowState> {
  // 1. Get data from previous steps
  const pineconeData = state.pineconeData;
  const alarmData = state.alarmData;
  
  // 2. Build work order object
  const workOrderData = {
    workOrderNo: `WO-${...}`,
    machineId: state.machineId,
    alarmType: alarmData?.firstAlarm?.alarmType,
    workDescription: pineconeData.workDescription,
    specialInstructions: pineconeData.specialInstructions,
    parts: pineconeData.parts,
    // ... etc
  };
  
  // 3. Store in state
  return {
    ...state,
    workOrderData,
    executionLog: log,
  };
}
```

### Example: `saveWorkOrderTool` (lines 240-278)
```typescript
export async function saveWorkOrderTool(
  state: WorkflowState,
  config: Record<string, any> = {}
): Promise<WorkflowState> {
  // 1. Get work order from previous step
  const workOrderData = state.workOrderData;
  
  // 2. Call API to save
  const response = await fetch(`${baseUrl}/api/work-order`, {
    method: 'POST',
    body: JSON.stringify(workOrderData),
  });
  
  // 3. Return saved result
  return {
    ...state,
    savedWorkOrder: result,
    executionLog: log,
  };
}
```

---

## Execution Flow Summary

```
User clicks node in palette
  ↓
Node created in workflows/page.tsx (line 289)
  ↓
User clicks "Run Workflow"
  ↓
handleRunWorkflow() sends nodes/edges to API (line 102)
  ↓
API route receives request (route.ts line 12)
  ↓
buildWorkflow() creates execution plan (workflow-builder.ts line 42)
  ↓
execute() finds start node (line 143)
  ↓
executeFromNode() executes nodes sequentially (line 118)
  ↓
executeNode() for each node (line 80)
  ↓
TOOL_REGISTRY[toolType]() executes tool function (line 87)
  ↓
Tool function calls API endpoint (workflow-tools.ts)
  ↓
State passed to next node (workflow-builder.ts line 120)
  ↓
Final result returned to UI
```

---

## State Flow Between Nodes

State object is passed between nodes and accumulates data:

```typescript
// Initial state
{ executionLog: [] }

// After startAgent
{ machineId: 'machine-01', executionLog: [...] }

// After monitorTags
{ machineId: 'machine-01', alarmData: {...}, executionLog: [...] }

// After queryPinecone
{ machineId: 'machine-01', alarmData: {...}, pineconeData: {...}, executionLog: [...] }

// After createWorkOrder
{ machineId: 'machine-01', alarmData: {...}, pineconeData: {...}, workOrderData: {...}, executionLog: [...] }

// After saveWorkOrder
{ machineId: 'machine-01', alarmData: {...}, pineconeData: {...}, workOrderData: {...}, savedWorkOrder: {...}, executionLog: [...] }
```

