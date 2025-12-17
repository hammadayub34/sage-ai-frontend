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
    
    // Show config values that will be used (especially machineId)
    const configMachineId = node.data.config?.machineId;
    if (configMachineId) {
      logBoth(`   Config machineId: ${configMachineId}`);
    }
    
    logBoth(`   Current State: machineId=${state.machineId || 'undefined'}, hasAlarmData=${!!state.alarmData}, hasPineconeData=${!!state.pineconeData}, hasWorkOrderData=${!!state.workOrderData}`);

    // Additional terminal logging for debugging
    console.log(`\n🔄 [WORKFLOW BUILDER] About to execute node: ${nodeId}`);
    console.log('   Node details:', {
      id: nodeId,
      type: toolType,
      label: node.data.config?.label || toolType,
      config: node.data.config || {},
    });
    console.log('   State before execution:', {
      machineId: state.machineId,
      hasAlarmData: !!state.alarmData,
      hasPineconeData: !!state.pineconeData,
      hasWorkOrderData: !!state.workOrderData,
      executionLogLength: state.executionLog?.length || 0,
    });

    // Execute the tool
    const startTime = Date.now();
    console.log('   ⏱️  [WORKFLOW BUILDER] Tool execution started at:', new Date().toISOString());
    
    // Pass logBoth to tool if it accepts it (tools now accept optional third parameter)
    let updatedState: WorkflowState;
    try {
      updatedState = await (tool as any)(state, node.data.config || {}, logBoth);
      const duration = Date.now() - startTime;
      console.log(`   ⏱️  [WORKFLOW BUILDER] Tool execution completed in ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`   ❌ [WORKFLOW BUILDER] Tool execution failed after ${duration}ms`);
      console.error('      Error:', error.message);
      console.error('      Stack:', error.stack);
      throw error;
    }
    
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
      logBoth(`\n➡️  [WORKFLOW] Node ${nodeId} completed. Checking for next node(s)...`);
      logBoth(`   Found ${nextNodeIds.length} next node(s): ${nextNodeIds.join(', ')}`);
      
      // Execute next nodes sequentially
      for (let i = 0; i < nextNodeIds.length; i++) {
        const nextNodeId = nextNodeIds[i];
        const nextNode = nodeMap.get(nextNodeId);
        const nodeNumber = i + 1;
        const nodeLabel = nextNode?.data.config?.label || nextNode?.data.type || nextNodeId;
        
        logBoth(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logBoth(`➡️  [WORKFLOW] Moving to next node (Node ${nodeNumber} of ${nextNodeIds.length})`);
        logBoth(`   Node ID: ${nextNodeId}`);
        logBoth(`   Node Label: ${nodeLabel}`);
        logBoth(`   Node Type: ${nextNode?.data.type || 'unknown'}`);
        logBoth(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        currentState = await executeFromNode(nextNodeId, currentState);
      }
    } else {
      logBoth(`\n🏁 [WORKFLOW] Node ${nodeId} is the end node - no more nodes to execute`);
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

