'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowInstance,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onNodeClick?: (node: Node) => void;
  onPaneClick?: () => void;
}

// Custom node component with connection handles
const ToolNode = ({ data }: { data: any }) => {
  // Determine what to display below the label
  const getConfigDisplay = () => {
    if (!data.config || Object.keys(data.config).length === 0) {
      return null;
    }
    
    // For Connect Machine (startAgent), show machineId if available
    // Check both data.type (from node data) and data.config.service
    const nodeType = data.type;
    if (nodeType === 'startAgent' && data.config.machineId) {
      return <div className="text-[10px] text-gray-400 mt-0.5 truncate">Machine: {data.config.machineId}</div>;
    }
    
    // For Monitor Sensor Values, show sensorType and timeRange (no machineId)
    if (data.type === 'monitorSensorValues') {
      const parts = [];
      if (data.config.sensorType) parts.push(data.config.sensorType);
      if (data.config.timeRange) parts.push(data.config.timeRange);
      if (parts.length > 0) {
        return <div className="text-[10px] text-gray-400 mt-0.5 truncate">{parts.join(' • ')}</div>;
      }
    }
    
    // For Monitor Tags, show machineId and threshold
    if (data.type === 'monitorTags') {
      const parts = [];
      if (data.config.machineId) parts.push(data.config.machineId);
      if (data.config.threshold) parts.push(`threshold: ${data.config.threshold}`);
      if (parts.length > 0) {
        return <div className="text-[10px] text-gray-400 mt-0.5 truncate">{parts.join(' • ')}</div>;
      }
    }
    
    // Default: show first config entry
    const firstEntry = Object.entries(data.config)[0];
    if (firstEntry) {
      const [key, value] = firstEntry;
      return <div className="text-[10px] text-gray-400 mt-0.5 truncate">{key}: {String(value).substring(0, 15)}</div>;
    }
    
    return null;
  };
  
  return (
    <div className="px-3 py-2 bg-dark-bg border border-sage-500 rounded shadow min-w-[120px] max-w-[180px]">
      {/* Input handle (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-2.5 h-2.5 bg-sage-400 border border-dark-bg"
      />
      
      <div className="text-white text-xs font-medium">{data.label}</div>
      {getConfigDisplay()}
      
      {/* Output handle (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-2.5 h-2.5 bg-sage-400 border border-dark-bg"
      />
    </div>
  );
};

const nodeTypes = {
  'tool-node': ToolNode,
};

export function WorkflowCanvas({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onPaneClick,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const isInternalUpdateRef = useRef(false);

  // Sync initial nodes/edges when they change from parent (e.g., Load Example, Clear, or config updates)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    
    // Check if nodes were added/removed (by ID)
    const currentIds = nodes.map(n => n.id).sort().join(',');
    const incomingIds = initialNodes.map(n => n.id).sort().join(',');
    
    if (currentIds !== incomingIds) {
      setNodes(initialNodes);
      return;
    }
    
    // Check if node data has changed (e.g., config updates)
    // Compare each node's data to detect changes
    let dataChanged = false;
    if (nodes.length === initialNodes.length) {
      for (let i = 0; i < nodes.length; i++) {
        const currentNode = nodes[i];
        const incomingNode = initialNodes.find(n => n.id === currentNode.id);
        if (incomingNode) {
          // Deep compare data objects
          const currentDataStr = JSON.stringify(currentNode.data);
          const incomingDataStr = JSON.stringify(incomingNode.data);
          if (currentDataStr !== incomingDataStr) {
            dataChanged = true;
            break;
          }
        }
      }
    }
    
    if (dataChanged) {
      setNodes(initialNodes);
    }
  }, [initialNodes, setNodes, nodes]);

  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    
    const currentIds = edges.map(e => e.id).sort().join(',');
    const incomingIds = initialEdges.map(e => e.id).sort().join(',');
    
    if (currentIds !== incomingIds) {
      setEdges(initialEdges);
    }
  }, [initialEdges, setEdges, edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: { stroke: '#437874', strokeWidth: 2 },
      };
      const updatedEdges = addEdge(newEdge, edges);
      setEdges(updatedEdges);
      onEdgesChange(updatedEdges);
    },
    [edges, setEdges, onEdgesChange]
  );

  const handleNodesChange = useCallback(
    (changes: any) => {
      isInternalUpdateRef.current = true;
      onNodesChangeInternal(changes);
      // After React Flow processes the changes, sync back to parent
      requestAnimationFrame(() => {
        setNodes((currentNodes) => {
          onNodesChange([...currentNodes]);
          return currentNodes;
        });
      });
    },
    [onNodesChangeInternal, onNodesChange, setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      isInternalUpdateRef.current = true;
      onEdgesChangeInternal(changes);
      // After React Flow processes the changes, sync back to parent
      requestAnimationFrame(() => {
        setEdges((currentEdges) => {
          onEdgesChange([...currentEdges]);
          return currentEdges;
        });
      });
    },
    [onEdgesChangeInternal, onEdgesChange, setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeData = JSON.parse(event.dataTransfer.getData('application/reactflow'));

      if (!reactFlowInstance) {
        console.warn('React Flow instance not initialized yet');
        return;
      }

      // Get position relative to React Flow viewport
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Helper function to get machineType from machineId
      const getMachineType = (machineId: string): string => {
        if (machineId.startsWith('lathe')) return 'lathe';
        if (machineId.startsWith('machine-')) return 'bottlefiller';
        return 'bottlefiller'; // default
      };

      // Find Connect Machine node and extract machineId
      const connectMachineNode = nodes.find(n => n.data.type === 'startAgent');
      const machineId = connectMachineNode?.data.config?.machineId;

      // Build config with auto-populated machineId if needed
      let config = { ...(nodeData.config || {}) };

      // Ensure service is set for startAgent nodes
      if (nodeData.type === 'startAgent') {
        if (!config.service) config.service = 'mock_plc';
        if (config.machineId === undefined) config.machineId = '';
      }

      // Auto-populate machineId for nodes that need it
      if (machineId && machineId.trim() !== '') {
        const nodeTypesNeedingMachineId = ['monitorTags', 'queryPinecone'];
        if (nodeTypesNeedingMachineId.includes(nodeData.type)) {
          config.machineId = machineId;
          
          // For queryPinecone, also set machineType
          if (nodeData.type === 'queryPinecone') {
            config.machineType = getMachineType(machineId);
          }
        }
      }

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: 'tool-node',
        position,
        data: {
          label: nodeData.name,
          type: nodeData.type,
          config,
        },
      };

      // Add node to React Flow's internal state
      setNodes((currentNodes) => {
        const updatedNodes = [...currentNodes, newNode];
        // Sync to parent
        onNodesChange(updatedNodes);
        return updatedNodes;
      });
    },
    [setNodes, onNodesChange, reactFlowInstance, nodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="w-full h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onNodeClick={onNodeClick ? (event, node) => {
          event.stopPropagation();
          onNodeClick(node);
        } : undefined}
        onPaneClick={onPaneClick ? () => {
          onPaneClick();
        } : undefined}
        nodeTypes={nodeTypes}
        fitView
        className="bg-transparent"
      >
        <Background color="#2a2a2a" gap={20} size={1} />
        <Controls className="bg-dark-panel border border-dark-border rounded" />
      </ReactFlow>
    </div>
  );
}

