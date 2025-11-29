/**
 * Workflow Builder
 * Converts visual workflow (nodes + edges) to executable workflow
 * For now, we use simple sequential execution. LangGraph can be added later for conditional routing.
 */

import { TOOL_REGISTRY } from './workflow-tools';

interface WorkflowNode {
  id: string;
  type: string;
  data: {
    type: string;
    config: Record<string, any>;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowState {
  machineId?: string;
  alarmData?: any;
  pineconeData?: any;
  workOrderData?: any;
  executionLog?: string[];
  currentNode?: string;
  [key: string]: any;
}

/**
 * Build a LangGraph workflow from visual nodes and edges
 */
export function buildWorkflow(definition: WorkflowDefinition, onLog?: (message: string) => void): {
  execute: (initialState?: WorkflowState) => Promise<WorkflowState>;
} {
  // Helper to log to both terminal and UI
  const logBoth = (message: string) => {
    console.log(message);
    if (onLog) onLog(message);
  };
  const { nodes, edges } = definition;

  // Find start node (node with no incoming edges)
  const nodeIds = new Set(nodes.map(n => n.id));
  const targetIds = new Set(edges.map(e => e.target));
  const startNodes = nodes.filter(n => !targetIds.has(n.id));

  if (startNodes.length === 0) {
    throw new Error('No start node found. Workflow must have at least one node with no incoming edges.');
  }

  if (startNodes.length > 1) {
    throw new Error('Multiple start nodes found. Workflow must have exactly one start node.');
  }

  const startNode = startNodes[0];

  // Build adjacency list for execution order
  const adjacencyList: Record<string, string[]> = {};
  nodes.forEach(node => {
    adjacencyList[node.id] = [];
  });
  edges.forEach(edge => {
    if (!adjacencyList[edge.source]) {
      adjacencyList[edge.source] = [];
    }
    adjacencyList[edge.source].push(edge.target);
  });

  // Create node map for quick lookup
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  /**
   * Execute a single node
   */
  async function executeNode(nodeId: string, state: WorkflowState): Promise<WorkflowState> {
    const node = nodeMap.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const toolType = node.data.type;
    const tool = TOOL_REGISTRY[toolType];

    if (!tool) {
      throw new Error(`Unknown tool type: ${toolType}`);
    }

    // Update state with current node
    state.currentNode = nodeId;
    const initialLogLength = (state.executionLog || []).length;
    state.executionLog = state.executionLog || [];
    const logMessage = `▶️ Executing: ${node.data.config?.label || toolType}`;
    state.executionLog.push(logMessage);
    logBoth(logMessage);

    // Log node execution details
    logBoth(`\n🔄 [NODE] Executing node: ${nodeId}`);
    logBoth(`   Type: ${toolType}`);
    logBoth(`   Label: ${node.data.config?.label || toolType}`);
    logBoth(`   Config: ${JSON.stringify(node.data.config || {})}`);
    logBoth(`   Current State: machineId=${state.machineId}, hasAlarmData=${!!state.alarmData}, hasPineconeData=${!!state.pineconeData}, hasWorkOrderData=${!!state.workOrderData}`);

    // Execute the tool
    const startTime = Date.now();
    // Pass logBoth to tool if it accepts it (tools now accept optional third parameter)
    const updatedState = await (tool as any)(state, node.data.config || {}, logBoth);
    const duration = Date.now() - startTime;
    
    // Log node completion
    logBoth(`✅ [NODE] Node ${nodeId} completed in ${duration}ms`);
    logBoth(`   Updated State: machineId=${updatedState.machineId}, hasAlarmData=${!!updatedState.alarmData}, hasPineconeData=${!!updatedState.pineconeData}, hasWorkOrderData=${!!updatedState.workOrderData}, hasSavedWorkOrder=${!!updatedState.savedWorkOrder}`);
    if (updatedState.alarmData?.firstAlarm) {
      logBoth(`   Alarm Data: type=${updatedState.alarmData.firstAlarm.alarmType}, count=${updatedState.alarmData.alarms?.length || 0}`);
    }
    if (updatedState.workOrderData?.workOrderNo) {
      logBoth(`   Work Order: ${updatedState.workOrderData.workOrderNo}`);
    }
    
    // Stream any new log entries from the tool
    if (updatedState.executionLog && updatedState.executionLog.length > initialLogLength + 1) {
      const newLogs = updatedState.executionLog.slice(initialLogLength + 1);
      newLogs.forEach((log: string) => {
        if (onLog) onLog(log);
      });
    }

    return updatedState;
  }

  /**
   * Execute workflow starting from a node
   */
  async function executeFromNode(nodeId: string, state: WorkflowState): Promise<WorkflowState> {
    // Execute current node
    let currentState = await executeNode(nodeId, state);

    // Get next nodes
    const nextNodeIds = adjacencyList[nodeId] || [];
    
    if (nextNodeIds.length > 0) {
      logBoth(`➡️  [WORKFLOW] Node ${nodeId} has ${nextNodeIds.length} next node(s): ${nextNodeIds.join(', ')}`);
    } else {
      logBoth(`🏁 [WORKFLOW] Node ${nodeId} is the end node`);
    }

    // Execute next nodes sequentially
    for (const nextNodeId of nextNodeIds) {
      currentState = await executeFromNode(nextNodeId, currentState);
    }

    return currentState;
  }

  /**
   * Main execution function
   */
  async function execute(initialState: WorkflowState = {}): Promise<WorkflowState> {
    const state: WorkflowState = {
      executionLog: [],
      ...initialState,
    };

    try {
      logBoth(`🎯 [WORKFLOW] Starting from node: ${startNode.id} (${startNode.data.config?.label || startNode.data.type})`);
      const finalState = await executeFromNode(startNode.id, state);
      finalState.executionLog = finalState.executionLog || [];
      const completionMessage = '✅ Workflow execution completed';
      finalState.executionLog.push(completionMessage);
      logBoth(completionMessage);
      logBoth(`\n🎉 [WORKFLOW] Workflow execution completed successfully`);
      return finalState;
    } catch (error: any) {
      const errorMessage = `❌ Workflow execution failed: ${error.message}`;
      logBoth(`\n❌ [WORKFLOW] Execution failed: ${error.message}`);
      if (error.stack) {
        logBoth(`   Stack: ${error.stack.split('\n')[0]}`);
      }
      const errorState: WorkflowState = {
        ...state,
        executionLog: [
          ...(state.executionLog || []),
          errorMessage,
        ],
        error: error.message,
      };
      return errorState;
    }
  }

  return { execute };
}

