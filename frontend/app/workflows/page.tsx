'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WorkflowCanvas } from '@/components/WorkflowCanvas';
import { NodePalette } from '@/components/NodePalette';
import { PlayIcon, WorkflowIcon } from '@/components/Icons';
import { EXAMPLE_WORKFLOW } from '@/lib/workflow-examples';
import { ChatDock } from '@/components/ChatDock';
import { toast } from 'react-toastify';

const MIN_CANVAS_HEIGHT = 400;
const MAX_CANVAS_HEIGHT = 1200;
const DEFAULT_CANVAS_HEIGHT = 580;

export default function WorkflowsPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [dropdownStates, setDropdownStates] = useState<Record<string, { safety: boolean; alarm: boolean }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [sidebarView, setSidebarView] = useState<'nodes' | 'workflows'>('nodes');
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [canvasHeight, setCanvasHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('workflow-canvas-height');
      return saved ? parseInt(saved, 10) : DEFAULT_CANVAS_HEIGHT;
    }
    return DEFAULT_CANVAS_HEIGHT;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside any dropdown
      if (!target.closest('.dropdown-container')) {
        setDropdownStates({});
      }
    };
    
    if (Object.keys(dropdownStates).length > 0) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [dropdownStates]);

  // Save height to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('workflow-canvas-height', canvasHeight.toString());
    }
  }, [canvasHeight]);

  const loadSavedWorkflows = useCallback(async () => {
    setIsLoadingWorkflows(true);
    try {
      const response = await fetch('/api/workflows/list');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        setSavedWorkflows(result.workflows || []);
      } else {
        console.error('Failed to load workflows:', result.error);
        setSavedWorkflows([]);
      }
    } catch (error: any) {
      console.error('Error loading workflows:', error);
      setSavedWorkflows([]);
    } finally {
      setIsLoadingWorkflows(false);
    }
  }, []);

  // Load saved workflows on mount and initialize scheduler
  useEffect(() => {
    loadSavedWorkflows();
    // Initialize scheduler on app load
    fetch('/api/workflows/scheduler/init').catch(err => {
      console.error('Failed to initialize scheduler:', err);
    });
  }, [loadSavedWorkflows]);

  const handleLoadWorkflow = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflows/load?id=${workflowId}`);
      const result = await response.json();
      
      if (result.success && result.workflow) {
        const workflow = result.workflow;
        
        // Transform nodes to match ReactFlow format
        const nodePositions = [
          { x: 100, y: 200 },
          { x: 300, y: 200 },
          { x: 500, y: 200 },
          { x: 700, y: 200 },
          { x: 900, y: 200 },
        ];
        
        const loadedNodes = workflow.nodes.map((n: any, idx: number) => ({
          ...n,
          type: 'tool-node',
          position: nodePositions[idx] || { x: 100 + idx * 200, y: 200 },
        }));
        
        console.log('📋 [WORKFLOW] Loading saved workflow:', workflow.name);
        console.log('   Nodes:', loadedNodes.length);
        console.log('   Edges:', workflow.edges.length);
        
        setNodes(loadedNodes);
        setEdges(workflow.edges || []);
        setSelectedNode(null);
        setExecutionLog([]);
        
        // Refresh the list to update any metadata
        loadSavedWorkflows();
      } else {
        alert(`Failed to load workflow: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error loading workflow:', error);
      alert(`Error loading workflow: ${error.message}`);
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeRef.current) return;

    const containerRect = resizeRef.current.getBoundingClientRect();
    const newHeight = e.clientY - containerRect.top;
    const clampedHeight = Math.max(MIN_CANVAS_HEIGHT, Math.min(MAX_CANVAS_HEIGHT, newHeight));
    setCanvasHeight(clampedHeight);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Generate workflow name from connected nodes (1-2 words max)
  const generateWorkflowName = (nodes: any[], edges: any[]): string => {
    if (nodes.length === 0) return 'Empty Workflow';
    
    // Get node types in execution order
    const nodeTypes = nodes.map(n => n.data.type);
    
    // Map node types to short names
    const nodeNameMap: Record<string, string> = {
      'startAgent': 'Connect',
      'monitorTags': 'Monitor',
      'monitorSensorValues': 'Sensors',
      'queryPinecone': 'Analysis',
      'createWorkOrder': 'WorkOrder',
      'createReport': 'Report',
    };
    
    // Get unique node types (in order of appearance)
    const uniqueTypes: string[] = [];
    nodeTypes.forEach(type => {
      if (!uniqueTypes.includes(type)) {
        uniqueTypes.push(type);
      }
    });
    
    // Generate name from first 2 unique node types
    if (uniqueTypes.length === 1) {
      return nodeNameMap[uniqueTypes[0]] || 'Workflow';
    } else if (uniqueTypes.length >= 2) {
      const first = nodeNameMap[uniqueTypes[0]] || 'Workflow';
      const second = nodeNameMap[uniqueTypes[1]] || '';
      return second ? `${first} ${second}` : first;
    }
    
    return 'Workflow';
  };

  const handleSaveWorkflow = async () => {
    if (nodes.length === 0) {
      toast.error('Please add at least one node to the workflow');
      return;
    }

    // Auto-generate name from nodes
    const workflowName = generateWorkflowName(nodes, edges);
    const workflowDescription = `Workflow with ${nodes.length} node${nodes.length !== 1 ? 's' : ''}`;

    setIsSaving(true);
    try {
      // Transform nodes to match API expected format
      const workflowNodes = nodes.map(node => ({
        id: node.id,
        type: 'tool',
        data: {
          type: node.data.type,
          config: node.data.config || {},
          label: node.data.label,
        },
      }));

      const workflowEdges = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      }));

      const response = await fetch('/api/workflows/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflowName,
          description: workflowDescription,
          nodes: workflowNodes,
          edges: workflowEdges,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(`Workflow "${workflowName}" saved successfully!`);
        console.log('Workflow saved:', result.workflowId, workflowName);
        // Refresh the saved workflows list
        loadSavedWorkflows();
      } else {
        toast.error(`Failed to save workflow: ${result.error || 'Unknown error'}`);
        console.error('Save error:', result);
      }
    } catch (error: any) {
      console.error('Error saving workflow:', error);
      toast.error(`Error saving workflow: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunWorkflow = async () => {
    if (nodes.length === 0) {
      alert('Please add at least one node to the workflow');
      return;
    }

    console.log('\n🚀 [WORKFLOW] Starting workflow execution from UI');
    console.log('   Workflow summary:', {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes: nodes.map(n => ({ id: n.id, type: n.data.type, label: n.data.label })),
      edges: edges.map(e => ({ from: e.source, to: e.target })),
    });

    setIsRunning(true);
    setExecutionLog(['Starting workflow execution...']);
    console.log('Starting workflow execution...');

    try {
      // Transform nodes to match API expected format
      const workflowNodes = nodes.map(node => ({
        id: node.id,
        type: 'tool',
        data: {
          type: node.data.type,
          config: node.data.config || {},
          label: node.data.label,
        },
      }));

      const workflowEdges = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      }));

      // Use streaming for real-time log updates
      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ nodes: workflowNodes, edges: workflowEdges }),
      });

      // Check if response is streaming
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let finalResult: any = null;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonData = JSON.parse(line.slice(6));
                  
                  if (jsonData.type === 'start') {
                    setExecutionLog([jsonData.message]);
                    console.log(jsonData.message);
                  } else if (jsonData.type === 'log') {
                    setExecutionLog(prev => {
                      const newLogs = [...prev, jsonData.message];
                      // Auto-scroll only the log container, not the page
                      setTimeout(() => {
                        if (logContainerRef.current) {
                          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                        }
                      }, 50);
                      return newLogs;
                    });
                    console.log(jsonData.message);
                  } else if (jsonData.type === 'result') {
                    finalResult = jsonData.data;
                    if (jsonData.error) {
                      setExecutionLog(prev => [...prev, `❌ Error: ${jsonData.error}`]);
                      console.error('❌ Error:', jsonData.error);
                    }
                  } else if (jsonData.type === 'done') {
                    if (finalResult) {
                      setExecutionLog(prev => [
                        ...prev,
                        '✅ Workflow completed successfully',
                        JSON.stringify(finalResult, null, 2),
                      ]);
                      console.log('✅ Workflow completed successfully');
                      console.log('Result:', JSON.stringify(finalResult, null, 2));
                    }
                  } else if (jsonData.type === 'error') {
                    setExecutionLog(prev => [...prev, `❌ Error: ${jsonData.message}`]);
                    console.error('❌ Error:', jsonData.message);
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }
        }
      } else {
        // Non-streaming response (backward compatibility)
        const result = await response.json();

        if (response.ok) {
          setExecutionLog(prev => [
            ...prev,
            '✅ Workflow completed successfully',
            ...(result.result?.executionLog || []),
            JSON.stringify(result.result, null, 2),
          ]);
          console.log('✅ Workflow completed successfully');
          if (result.result?.executionLog) {
            result.result.executionLog.forEach((log: string) => console.log(log));
          }
          console.log('Result:', JSON.stringify(result.result, null, 2));
        } else {
          setExecutionLog(prev => [...prev, `❌ Error: ${result.error}`]);
          console.error('❌ Error:', result.error);
        }
      }
    } catch (error: any) {
      setExecutionLog(prev => [...prev, `❌ Execution failed: ${error.message}`]);
      console.error('❌ Execution failed:', error.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <ChatDock>
      <div className="bg-dark-bg text-dark-text p-6 min-h-screen">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <WorkflowIcon className="w-8 h-8 text-sage-400" />
              <h1 className="heading-inter heading-inter-lg">Workflows</h1>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 bg-dark-panel border border-dark-border rounded-lg p-1">
              <button
                onClick={() => {
                  // Layout nodes in a horizontal flow
                  const nodePositions = [
                    { x: 100, y: 200 },
                    { x: 300, y: 200 },
                    { x: 500, y: 200 },
                    { x: 700, y: 200 },
                    { x: 900, y: 200 },
                  ];
                  const newNodes = EXAMPLE_WORKFLOW.nodes.map((n, idx) => ({
                    ...n,
                    type: 'tool-node',
                    position: nodePositions[idx] || { x: 100 + idx * 200, y: 200 },
                  }));
                  const newEdges = EXAMPLE_WORKFLOW.edges;
                  
                  console.log('📋 [WORKFLOW] Loading example workflow');
                  console.log('   Nodes:', newNodes.map(n => ({ id: n.id, type: n.data.type, label: n.data.label })));
                  console.log('   Edges:', newEdges.map(e => ({ from: e.source, to: e.target })));
                  console.log('   Total nodes:', newNodes.length);
                  console.log('   Total edges:', newEdges.length);
                  
                  setNodes(newNodes);
                  setEdges(newEdges);
                  setExecutionLog([]);
                }}
                className="px-4 py-2 rounded text-sm font-medium bg-midnight-400 hover:bg-midnight-500 text-white transition-colors"
              >
                Load Example
              </button>
              <button
                onClick={() => {
                  console.log('🗑️  [WORKFLOW] Clearing workflow');
                  console.log('   Removed', nodes.length, 'node(s)');
                  console.log('   Removed', edges.length, 'edge(s)');
                  setNodes([]);
                  setEdges([]);
                  setExecutionLog([]);
                }}
                className="px-4 py-2 rounded text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleSaveWorkflow}
                disabled={isSaving || nodes.length === 0}
                className="px-4 py-2 rounded text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white flex items-center gap-1.5 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleRunWorkflow}
                disabled={isRunning || nodes.length === 0}
                className="px-4 py-2 rounded text-sm font-medium bg-sage-500 hover:bg-sage-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white flex items-center gap-1.5 transition-colors"
              >
                <PlayIcon className="w-4 h-4" />
                {isRunning ? 'Running...' : 'Run'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="rounded-lg border border-dark-border overflow-hidden">
          {/* Top row: canvas + node palette */}
          <div className="flex relative" style={{ height: `${canvasHeight}px` }} ref={resizeRef}>
            {/* Canvas Area - using Canvas component style */}
            <div className="flex-1 bg-dark-bg relative overflow-hidden">
              <div className="w-full h-full bg-dark-panel relative">
                {/* Grid Background */}
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, #2a2a2a 1px, transparent 1px),
                      linear-gradient(to bottom, #2a2a2a 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px',
                  }}
                />
                
                {/* Placeholder when no nodes */}
                {nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="text-center">
                      <p className="text-gray-500 text-lg mb-2">Canvas Area</p>
                      <p className="text-gray-600 text-sm">Nodes and connections will appear here</p>
                    </div>
                  </div>
                )}

                {/* Workflow Canvas */}
                <div className="absolute inset-0">
                  <WorkflowCanvas
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={(updatedNodes) => {
                      setNodes(updatedNodes);
                      // Update selected node if it was modified
                      if (selectedNode) {
                        const updated = updatedNodes.find(n => n.id === selectedNode.id);
                        if (updated) setSelectedNode(updated);
                      }
                    }}
                    onEdgesChange={setEdges}
                    onNodeClick={(node) => setSelectedNode(node)}
                  />
                </div>
              </div>
            </div>

            {/* Node Configuration Panel, Saved Workflows, or Node Palette */}
            <div className="w-64 bg-dark-panel border-l border-dark-border overflow-y-auto">
              {selectedNode ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-medium text-sm">{selectedNode.data.label}</h3>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-3">
                    {selectedNode.data.type === 'startAgent' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Machine</label>
                          <select
                            value={selectedNode.data.config?.machineId || ''}
                            onChange={(e) => {
                              const updatedNodes = nodes.map(n =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        config: {
                                          ...(n.data.config || {}),
                                          service: n.data.config?.service || 'mock_plc', // Preserve service
                                          machineId: e.target.value,
                                        },
                                      },
                                    }
                                  : n
                              );
                              setNodes(updatedNodes);
                              setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                            }}
                            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                          >
                            <option value="">Select a machine...</option>
                            <option value="machine-01">machine-01 (Bottle Filler)</option>
                            <option value="machine-02">machine-02 (Bottle Filler)</option>
                            <option value="machine-03">machine-03 (Bottle Filler)</option>
                            <option value="lathe01">lathe01 (Lathe)</option>
                            <option value="lathe02">lathe02 (Lathe)</option>
                            <option value="lathe03">lathe03 (Lathe)</option>
                          </select>
                        </div>
                        {selectedNode.data.config?.machineId && (
                          <div className="text-xs text-gray-500">
                            Selected: <span className="text-sage-400">{selectedNode.data.config.machineId}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {selectedNode.data.type === 'monitorSensorValues' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Sensor Type</label>
                          <select
                            value={selectedNode.data.config?.sensorType || 'current'}
                            onChange={(e) => {
                              const updatedNodes = nodes.map(n =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        config: {
                                          ...(n.data.config || {}),
                                          sensorType: e.target.value,
                                        },
                                      },
                                    }
                                  : n
                              );
                              setNodes(updatedNodes);
                              setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                            }}
                            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                          >
                            <option value="current">Current</option>
                            <option value="vibration">Vibration</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Time Range</label>
                          <select
                            value={selectedNode.data.config?.timeRange || '+5m'}
                            onChange={(e) => {
                              const updatedNodes = nodes.map(n =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        config: {
                                          ...(n.data.config || {}),
                                          timeRange: e.target.value,
                                        },
                                      },
                                    }
                                  : n
                              );
                              setNodes(updatedNodes);
                              setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                            }}
                            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                          >
                            <option value="+5m">Next 5 minutes</option>
                            <option value="+30m">Next 30 minutes</option>
                            <option value="+1h">Next 1 hour</option>
                            <option value="+6h">Next 6 hours</option>
                            <option value="+24h">Next 24 hours</option>
                          </select>
                        </div>
                      </div>
                    )}
                    {selectedNode.data.type === 'monitorTags' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Machine</label>
                          <select
                            value={selectedNode.data.config?.machineId || 'machine-01'}
                            onChange={(e) => {
                              const updatedNodes = nodes.map(n =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        config: {
                                          ...(n.data.config || {}),
                                          machineId: e.target.value,
                                        },
                                      },
                                    }
                                  : n
                              );
                              setNodes(updatedNodes);
                              setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                            }}
                            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                          >
                            <option value="machine-01">machine-01 (Bottle Filler)</option>
                            <option value="machine-02">machine-02 (Bottle Filler)</option>
                            <option value="machine-03">machine-03 (Bottle Filler)</option>
                            <option value="lathe01">lathe01 (Lathe)</option>
                            <option value="lathe02">lathe02 (Lathe)</option>
                            <option value="lathe03">lathe03 (Lathe)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Time Range</label>
                          <select
                            value={selectedNode.data.config?.timeRange || '+24h'}
                            onChange={(e) => {
                              const updatedNodes = nodes.map(n =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        config: {
                                          ...(n.data.config || {}),
                                          timeRange: e.target.value,
                                        },
                                      },
                                    }
                                  : n
                              );
                              setNodes(updatedNodes);
                              setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                            }}
                            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                          >
                            <option value="+5m">Next 5 minutes</option>
                            <option value="+30m">Next 30 minutes</option>
                            <option value="+1h">Next 1 hour</option>
                            <option value="+6h">Next 6 hours</option>
                            <option value="+24h">Next 24 hours</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Threshold</label>
                          <input
                            type="number"
                            value={selectedNode.data.config?.threshold || 50}
                            onChange={(e) => {
                              const updatedNodes = nodes.map(n =>
                                n.id === selectedNode.id
                                  ? {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        config: {
                                          ...(n.data.config || {}),
                                          threshold: parseInt(e.target.value) || 50,
                                        },
                                      },
                                    }
                                  : n
                              );
                              setNodes(updatedNodes);
                              setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                            }}
                            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                            placeholder="50"
                            min="1"
                          />
                        </div>
                        {(() => {
                          const machineId = selectedNode.data.config?.machineId || 'machine-01';
                          const isLathe = machineId.startsWith('lathe');
                          const safetyTags = isLathe ? ['DoorClosed', 'EStopOK'] : [];
                          
                          if (safetyTags.length > 0) {
                            const dropdownKey = `safety-${selectedNode.id}`;
                            const safetyDropdownOpen = dropdownStates[dropdownKey]?.safety || false;
                            const setSafetyDropdownOpen = (open: boolean) => {
                              setDropdownStates(prev => ({
                                ...prev,
                                [dropdownKey]: { ...prev[dropdownKey], safety: open }
                              }));
                            };
                            const selectedSafety = selectedNode.data.config?.selectedSafetyTags;
                            const selectedSafetyArray = selectedSafety === 'All' || !selectedSafety 
                              ? safetyTags 
                              : Array.isArray(selectedSafety) 
                                ? selectedSafety 
                                : [selectedSafety];
                            const isAllSelected = selectedSafetyArray.length === safetyTags.length;
                            const displayText = isAllSelected 
                              ? 'All' 
                              : selectedSafetyArray.length > 0 
                                ? selectedSafetyArray.join(', ') 
                                : 'Select tags...';
                            
                            return (
                              <div>
                                <label className="text-gray-400 text-xs mb-1 block">Safety Tags</label>
                                <div className="relative dropdown-container">
                                  <button
                                    type="button"
                                    onClick={() => setSafetyDropdownOpen(!safetyDropdownOpen)}
                                    className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs text-left focus:outline-none focus:ring-1 focus:ring-sage-500 flex items-center justify-between"
                                  >
                                    <span>{displayText}</span>
                                    <span className="text-gray-400">{safetyDropdownOpen ? '▲' : '▼'}</span>
                                  </button>
                                  {safetyDropdownOpen && (
                                    <div className="absolute z-10 w-full mt-1 bg-dark-bg border border-dark-border rounded shadow-lg max-h-48 overflow-y-auto">
                                      <div
                                        className="px-2 py-1 hover:bg-dark-panel cursor-pointer flex items-center"
                                        onClick={() => {
                                          const finalValue = isAllSelected ? [] : 'All';
                                          const updatedNodes = nodes.map(n =>
                                            n.id === selectedNode.id
                                              ? {
                                                  ...n,
                                                  data: {
                                                    ...n.data,
                                                    config: {
                                                      ...(n.data.config || {}),
                                                      selectedSafetyTags: finalValue,
                                                    },
                                                  },
                                                }
                                              : n
                                          );
                                          setNodes(updatedNodes);
                                          setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                                          setSafetyDropdownOpen(false);
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isAllSelected}
                                          onChange={() => {}}
                                          className="mr-2"
                                        />
                                        <span className="text-white text-xs">All</span>
                                      </div>
                                      {safetyTags.map(tag => {
                                        const isSelected = selectedSafetyArray.includes(tag);
                                        return (
                                          <div
                                            key={tag}
                                            className="px-2 py-1 hover:bg-dark-panel cursor-pointer flex items-center"
                                            onClick={() => {
                                              const currentArray = Array.isArray(selectedSafety) ? selectedSafety : (selectedSafety === 'All' ? safetyTags : [selectedSafety]);
                                              const newArray = isSelected 
                                                ? currentArray.filter(t => t !== tag)
                                                : [...currentArray, tag];
                                              const finalValue = newArray.length === 0 
                                                ? 'All' 
                                                : (newArray.length === safetyTags.length ? 'All' : newArray);
                                              
                                              const updatedNodes = nodes.map(n =>
                                                n.id === selectedNode.id
                                                  ? {
                                                      ...n,
                                                      data: {
                                                        ...n.data,
                                                        config: {
                                                          ...(n.data.config || {}),
                                                          selectedSafetyTags: finalValue,
                                                        },
                                                      },
                                                    }
                                                  : n
                                              );
                                              setNodes(updatedNodes);
                                              setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => {}}
                                              className="mr-2"
                                            />
                                            <span className="text-white text-xs">{tag}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {(() => {
                          const machineId = selectedNode.data.config?.machineId || 'machine-01';
                          const isLathe = machineId.startsWith('lathe');
                          const alarmTags = isLathe ? [
                            'AlarmSpindleOverload',
                            'AlarmChuckNotClamped',
                            'AlarmDoorOpen',
                            'AlarmToolWear',
                            'AlarmCoolantLow'
                          ] : [
                            'AlarmFault',
                            'AlarmOverfill',
                            'AlarmUnderfill',
                            'AlarmLowProductLevel',
                            'AlarmCapMissing'
                          ];
                          
                          const dropdownKey = `alarm-${selectedNode.id}`;
                          const alarmDropdownOpen = dropdownStates[dropdownKey]?.alarm || false;
                          const setAlarmDropdownOpen = (open: boolean) => {
                            setDropdownStates(prev => ({
                              ...prev,
                              [dropdownKey]: { ...prev[dropdownKey], alarm: open }
                            }));
                          };
                          const selectedAlarms = selectedNode.data.config?.selectedAlarmTags;
                          const selectedAlarmsArray = selectedAlarms === 'All' || !selectedAlarms 
                            ? alarmTags 
                            : Array.isArray(selectedAlarms) 
                              ? selectedAlarms 
                              : [selectedAlarms];
                          const isAllSelected = selectedAlarmsArray.length === alarmTags.length;
                          const displayText = isAllSelected 
                            ? 'All' 
                            : selectedAlarmsArray.length > 0 
                              ? selectedAlarmsArray.join(', ') 
                              : 'Select tags...';
                          
                          return (
                            <div>
                              <label className="text-gray-400 text-xs mb-1 block">Alarm Tags</label>
                              <div className="relative dropdown-container">
                                <button
                                  type="button"
                                  onClick={() => setAlarmDropdownOpen(!alarmDropdownOpen)}
                                  className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs text-left focus:outline-none focus:ring-1 focus:ring-sage-500 flex items-center justify-between"
                                >
                                  <span>{displayText}</span>
                                  <span className="text-gray-400">{alarmDropdownOpen ? '▲' : '▼'}</span>
                                </button>
                                {alarmDropdownOpen && (
                                  <div className="absolute z-10 w-full mt-1 bg-dark-bg border border-dark-border rounded shadow-lg max-h-48 overflow-y-auto">
                                    <div
                                      className="px-2 py-1 hover:bg-dark-panel cursor-pointer flex items-center"
                                      onClick={() => {
                                        const finalValue = isAllSelected ? [] : 'All';
                                        const updatedNodes = nodes.map(n =>
                                          n.id === selectedNode.id
                                            ? {
                                                ...n,
                                                data: {
                                                  ...n.data,
                                                  config: {
                                                    ...(n.data.config || {}),
                                                    selectedAlarmTags: finalValue,
                                                  },
                                                },
                                              }
                                            : n
                                        );
                                        setNodes(updatedNodes);
                                        setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                                        setAlarmDropdownOpen(false);
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={() => {}}
                                        className="mr-2"
                                      />
                                      <span className="text-white text-xs">All</span>
                                    </div>
                                    {alarmTags.map(tag => {
                                      const isSelected = selectedAlarmsArray.includes(tag);
                                      return (
                                        <div
                                          key={tag}
                                          className="px-2 py-1 hover:bg-dark-panel cursor-pointer flex items-center"
                                          onClick={() => {
                                            const currentArray = Array.isArray(selectedAlarms) ? selectedAlarms : (selectedAlarms === 'All' ? alarmTags : [selectedAlarms]);
                                            const newArray = isSelected 
                                              ? currentArray.filter(t => t !== tag)
                                              : [...currentArray, tag];
                                            const finalValue = newArray.length === 0 
                                              ? 'All' 
                                              : (newArray.length === alarmTags.length ? 'All' : newArray);
                                            
                                            const updatedNodes = nodes.map(n =>
                                              n.id === selectedNode.id
                                                ? {
                                                    ...n,
                                                    data: {
                                                      ...n.data,
                                                      config: {
                                                        ...(n.data.config || {}),
                                                        selectedAlarmTags: finalValue,
                                                      },
                                                    },
                                                  }
                                                : n
                                            );
                                            setNodes(updatedNodes);
                                            setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {}}
                                            className="mr-2"
                                          />
                                          <span className="text-white text-xs">{tag}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {selectedNode.data.type === 'queryPinecone' && (
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Prompt</label>
                        <textarea
                          value={selectedNode.data.config?.prompt || ''}
                          onChange={(e) => {
                            const updatedNodes = nodes.map(n =>
                              n.id === selectedNode.id
                                ? {
                                    ...n,
                                    data: {
                                      ...n.data,
                                      config: {
                                        ...n.data.config,
                                        prompt: e.target.value,
                                      },
                                    },
                                  }
                                : n
                            );
                            setNodes(updatedNodes);
                            setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                          }}
                          className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sage-500 resize-none"
                          rows={4}
                          placeholder="Request analysis from Wise Guy here..."
                        />
                      </div>
                    )}
                    {selectedNode.data.type !== 'startAgent' && selectedNode.data.type !== 'monitorTags' && selectedNode.data.type !== 'monitorSensorValues' && selectedNode.data.config?.machineId && (
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Machine ID</label>
                        <input
                          type="text"
                          value={selectedNode.data.config.machineId}
                          onChange={(e) => {
                            const updatedNodes = nodes.map(n =>
                              n.id === selectedNode.id
                                ? {
                                    ...n,
                                    data: {
                                      ...n.data,
                                      config: {
                                        ...n.data.config,
                                        machineId: e.target.value,
                                      },
                                    },
                                  }
                                : n
                            );
                            setNodes(updatedNodes);
                            setSelectedNode(updatedNodes.find(n => n.id === selectedNode.id));
                          }}
                          className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {/* Toggle Buttons */}
                  <div className="flex border-b border-dark-border">
                    <button
                      onClick={() => setSidebarView('nodes')}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                        sidebarView === 'nodes'
                          ? 'bg-dark-bg text-white border-b-2 border-sage-500'
                          : 'text-gray-400 hover:text-white hover:bg-dark-bg'
                      }`}
                    >
                      Available Nodes
                    </button>
                    <button
                      onClick={() => setSidebarView('workflows')}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                        sidebarView === 'workflows'
                          ? 'bg-dark-bg text-white border-b-2 border-sage-500'
                          : 'text-gray-400 hover:text-white hover:bg-dark-bg'
                      }`}
                    >
                      Saved Workflows
                    </button>
                  </div>

                  {/* Content based on selected view */}
                  {sidebarView === 'nodes' ? (
                    <NodePalette 
                  hasConnectMachineNode={nodes.some(n => n.data.type === 'startAgent')}
                  hasMonitorNode={nodes.some(n => 
                    n.data.type === 'monitorTags' || n.data.type === 'monitorSensorValues'
                  )}
                  hasAIAnalysisNode={nodes.some(n => n.data.type === 'queryPinecone')}
                    existingNodeTypes={nodes.map(n => n.data.type)}
                    onAddNode={(node) => {
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
                    let config = { ...(node.config || {}) };

                    // Ensure service is set for startAgent nodes
                    if (node.type === 'startAgent') {
                      if (!config.service) config.service = 'mock_plc';
                      if (config.machineId === undefined) config.machineId = '';
                    }

                    // Auto-populate machineId for nodes that need it
                    if (machineId && machineId.trim() !== '') {
                      const nodeTypesNeedingMachineId = ['monitorTags', 'queryPinecone'];
                      if (nodeTypesNeedingMachineId.includes(node.type)) {
                        config.machineId = machineId;
                        
                        // For queryPinecone, also set machineType
                        if (node.type === 'queryPinecone') {
                          config.machineType = getMachineType(machineId);
                        }
                      }
                    }

                    const newNode = {
                      id: `node-${Date.now()}`,
                      type: 'tool-node',
                      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
                      data: {
                        type: node.type,
                        config,
                        label: node.name,
                      },
                    };
                    console.log('📦 [WORKFLOW] Node created:', {
                      id: newNode.id,
                      type: node.type,
                      label: node.name,
                      config: newNode.data.config,
                      machineIdAutoPopulated: machineId && machineId.trim() !== '' && ['monitorTags', 'queryPinecone'].includes(node.type),
                    });
                    setNodes(prev => {
                      const updated = [...prev, newNode];
                      console.log('   Total nodes in workflow:', updated.length);
                      return updated;
                    });
                  }} 
                />
                  ) : (
                    /* Saved Workflows Section */
                    <div className="p-4">
                      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                        {isLoadingWorkflows ? (
                          <div className="text-gray-500 text-xs text-center py-2">Loading...</div>
                        ) : savedWorkflows.length === 0 ? (
                          <div className="text-gray-500 text-xs text-center py-2">No saved workflows</div>
                        ) : (
                          savedWorkflows.map((workflow) => (
                            <div
                              key={workflow.id}
                              onClick={() => handleLoadWorkflow(workflow.id)}
                              className="bg-dark-bg border border-dark-border rounded p-2 cursor-pointer hover:border-sage-500 transition-colors"
                            >
                              <div className="text-sm font-medium text-white mb-1">{workflow.name}</div>
                              {workflow.description && (
                                <div className="text-xs text-gray-400 mb-1 line-clamp-2">{workflow.description}</div>
                              )}
                              <div className="text-xs text-gray-500">
                                {workflow.nodeCount} node{workflow.nodeCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={handleMouseDown}
              className={`absolute bottom-0 left-0 right-0 cursor-row-resize z-20 transition-all ${
                isResizing ? 'bg-sage-500 h-1' : 'bg-dark-border hover:bg-sage-400 h-0.5 hover:h-1'
              }`}
            />
            </div>

          {/* Execution Log - below canvas */}
          {(executionLog.length > 0 || isRunning) && (
            <div className="bg-dark-panel border-t border-dark-border">
              <div className="flex items-center justify-between p-4 border-b border-dark-border">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-medium text-sm">Execution Log</h3>
                  {isRunning && (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-sage-400"></div>
                      <span className="text-xs text-sage-400">Running...</span>
                    </div>
                  )}
                </div>
                {executionLog.length > 0 && (
                  <button
                    onClick={() => setExecutionLog([])}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div 
                ref={logContainerRef}
                className="p-4 h-64 overflow-y-auto font-mono text-xs scroll-smooth bg-black/50"
                style={{ maxHeight: '256px' }}
              >
                {executionLog.length === 0 && isRunning ? (
                  <div className="text-gray-500">Waiting for execution to start...</div>
                ) : (
                  <div className="space-y-1">
                    {executionLog.map((log, idx) => (
                      <div 
                        key={idx} 
                        className={`text-xs font-mono whitespace-pre-wrap ${
                          log.includes('✅') ? 'text-sage-400' :
                          log.includes('❌') ? 'text-red-400' :
                          log.includes('▶️') ? 'text-blue-400' :
                          log.includes('🔧') || log.includes('📊') || log.includes('🔍') || log.includes('📝') ? 'text-yellow-400' :
                          'text-gray-400'
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ChatDock>
  );
}

