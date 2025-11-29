/**
 * Example Workflows
 * Pre-built workflows for testing and demonstration
 */

export const EXAMPLE_WORKFLOW = {
  nodes: [
    {
      id: '1',
      type: 'tool',
      data: {
        type: 'startAgent',
        config: {
          machineId: 'machine-01',
          service: 'mock_plc',
        },
        label: 'Start Agent',
      },
    },
    {
      id: '2',
      type: 'tool',
      data: {
        type: 'monitorTags',
        config: {
          machineId: 'machine-01',
          timeRange: '-24h',
          threshold: 50,
        },
        label: 'Monitor Tags',
      },
    },
    {
      id: '3',
      type: 'tool',
      data: {
        type: 'queryPinecone',
        config: {
          machineId: 'machine-01',
          machineType: 'bottlefiller',
        },
        label: 'Query Pinecone',
      },
    },
    {
      id: '4',
      type: 'tool',
      data: {
        type: 'createWorkOrder',
        config: {},
        label: 'Create Work Order',
      },
    },
    {
      id: '5',
      type: 'tool',
      data: {
        type: 'saveWorkOrder',
        config: {},
        label: 'Save to InfluxDB',
      },
    },
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3' },
    { id: 'e3-4', source: '3', target: '4' },
    { id: 'e4-5', source: '4', target: '5' },
  ],
};

