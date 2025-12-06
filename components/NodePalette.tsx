'use client';

interface NodeType {
  name: string;
  type: string;
  description: string;
  icon?: string;
  config?: Record<string, any>;
}

const NODE_TYPES: NodeType[] = [
  {
    name: 'Start Agent',
    type: 'startAgent',
    description: 'Start a mock PLC agent or InfluxDB writer',
    config: { machineId: '', service: 'mock_plc' },
  },
  {
    name: 'Monitor Tags',
    type: 'monitorTags',
    description: 'Query InfluxDB for tags/alarms exceeding threshold',
    config: { machineId: 'machine-01', timeRange: '-24h', threshold: 50 },
  },
  {
    name: 'AI Analysis',
    type: 'queryPinecone',
    description: 'Enter a prompt to query Pinecone and get AI analysis',
    config: { prompt: 'Enter your question or analysis request here...', machineId: 'machine-01', machineType: 'bottlefiller' },
  },
  {
    name: 'Create Work Order',
    type: 'createWorkOrder',
    description: 'Format work order data from previous nodes',
    config: {},
  },
  {
    name: 'Create Report',
    type: 'createReport',
    description: 'Generate a report from collected data',
    config: {},
  },
];

interface NodePaletteProps {
  onAddNode: (node: NodeType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <div className="p-4">
      <h3 className="text-white font-medium mb-4 text-sm">Available Nodes</h3>
      <div className="space-y-2">
        {NODE_TYPES.map((node) => (
          <div
            key={node.type}
            onClick={() => onAddNode(node)}
            className="bg-dark-bg border border-dark-border rounded p-3 cursor-move hover:border-sage-500 transition-colors"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow', JSON.stringify(node));
            }}
          >
            <div className="text-white text-sm font-medium mb-1">{node.name}</div>
            <div className="text-gray-400 text-xs">{node.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

