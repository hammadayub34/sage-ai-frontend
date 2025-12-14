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
    name: 'Connect Machine',
    type: 'startAgent',
    description: 'Establish TCP/IP connection with machine',
    config: { machineId: '', service: 'mock_plc' },
  },
  {
    name: 'Monitor Tags',
    type: 'monitorTags',
    description: 'Monitor alarm or safety tags for the machine selected',
    config: { machineId: 'machine-01', timeRange: '-24h', threshold: 50 },
  },
  {
    name: 'Monitor Sensor Values',
    type: 'monitorSensorValues',
    description: 'Query InfluxDB for current sensor values and tag data',
    config: { machineId: 'machine-01', timeRange: '-5m' },
  },
  {
    name: 'AI Analysis',
    type: 'queryPinecone',
    description: 'Enter a prompt to query Pinecone and get AI analysis',
    config: { prompt: 'Request analysis from Wise Guy here...', machineId: 'machine-01', machineType: 'bottlefiller' },
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
  hasConnectMachineNode?: boolean;
  hasMonitorNode?: boolean;
  hasAIAnalysisNode?: boolean;
  existingNodeTypes?: string[]; // Array of node types already in the canvas
}

export function NodePalette({ 
  onAddNode, 
  hasConnectMachineNode = false,
  hasMonitorNode = false,
  hasAIAnalysisNode = false,
  existingNodeTypes = [],
}: NodePaletteProps) {
  // Helper function to check if a node type already exists in the canvas
  const isNodeAlreadyInCanvas = (nodeType: string): boolean => {
    return existingNodeTypes.includes(nodeType);
  };

  // Helper function to determine if a node should be enabled based on sequential dependencies
  const isNodeEnabled = (nodeType: string) => {
    // First check if node is already in canvas
    if (isNodeAlreadyInCanvas(nodeType)) {
      return false;
    }

    // Then check sequential dependencies
    switch (nodeType) {
      case 'startAgent':
        return true; // Always enabled (if not already in canvas)
      case 'monitorTags':
      case 'monitorSensorValues':
        return hasConnectMachineNode; // Enabled after Connect Machine
      case 'queryPinecone':
        return hasMonitorNode; // Enabled after Monitor node
      case 'createWorkOrder':
      case 'createReport':
        return hasAIAnalysisNode; // Enabled after AI Analysis
      default:
        return false;
    }
  };

  // Helper function to get the disabled message for a node
  const getDisabledMessage = (nodeType: string): string => {
    // Check if node is already in canvas first
    if (isNodeAlreadyInCanvas(nodeType)) {
      return 'Already in canvas';
    }

    // Then check sequential dependencies
    switch (nodeType) {
      case 'monitorTags':
      case 'monitorSensorValues':
        return 'Requires Connect Machine node';
      case 'queryPinecone':
        return 'Requires Monitor Tags or Monitor Sensor Values node';
      case 'createWorkOrder':
      case 'createReport':
        return 'Requires AI Analysis node';
      default:
        return '';
    }
  };

  // Helper function to get machineType from machineId
  const getMachineType = (machineId: string): string => {
    if (machineId.startsWith('lathe')) return 'lathe';
    if (machineId.startsWith('machine-')) return 'bottlefiller';
    return 'bottlefiller'; // default
  };

  return (
    <div className="p-4">
      <div className="space-y-2">
        {NODE_TYPES.map((node) => {
          const isEnabled = isNodeEnabled(node.type);
          return (
            <div
              key={node.type}
              onClick={() => {
                if (isEnabled) {
                  onAddNode(node);
                }
              }}
              className={`bg-dark-bg border rounded p-3 transition-colors ${
                isEnabled
                  ? 'border-dark-border cursor-move hover:border-sage-500'
                  : 'border-dark-border opacity-50 cursor-not-allowed pointer-events-none'
              }`}
              draggable={isEnabled}
              onDragStart={(e) => {
                if (isEnabled) {
                  e.dataTransfer.setData('application/reactflow', JSON.stringify(node));
                } else {
                  e.preventDefault();
                }
              }}
            >
              <div className={`text-sm font-medium mb-1 ${isEnabled ? 'text-white' : 'text-gray-500'}`}>
                {node.name}
              </div>
              <div className={`text-xs ${isEnabled ? 'text-gray-400' : 'text-gray-600'}`}>
                {node.description}
              </div>
              {!isEnabled && node.type !== 'startAgent' && (
                <div className="text-xs text-gray-600 mt-1 italic">
                  {getDisabledMessage(node.type)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

