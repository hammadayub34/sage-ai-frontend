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
}

// Custom node component with connection handles
const ToolNode = ({ data }: { data: any }) => {
  return (
    <div className="px-3 py-2 bg-dark-bg border border-sage-500 rounded shadow min-w-[120px] max-w-[180px]">
      {/* Input handle (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-2.5 h-2.5 bg-sage-400 border border-dark-bg"
      />
      
      <div className="text-white text-xs font-medium">{data.label}</div>
      {data.config && Object.keys(data.config).length > 0 && (
        <div className="text-[10px] text-gray-400 mt-0.5">
          {Object.entries(data.config).slice(0, 1).map(([key, value]) => (
            <div key={key} className="truncate">{key}: {String(value).substring(0, 15)}</div>
          ))}
        </div>
      )}
      
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
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const isInternalUpdateRef = useRef(false);

  // Sync initial nodes/edges when they change from parent (e.g., Load Example, Clear)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    
    const currentIds = nodes.map(n => n.id).sort().join(',');
    const incomingIds = initialNodes.map(n => n.id).sort().join(',');
    
    if (currentIds !== incomingIds) {
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

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: 'tool-node',
        position,
        data: {
          label: nodeData.name,
          type: nodeData.type,
          config: nodeData.config || {},
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
    [setNodes, onNodesChange, reactFlowInstance]
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

