'use client';

import { useState, useEffect } from 'react';
import { CloseIcon, PlusIcon } from './Icons';
import { toast } from 'react-toastify';

interface MachineFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Lab {
  _id: string;
  name: string;
}

interface UnassignedNode {
  _id: string;
  mac: string;
}

interface NodeData {
  mac: string;
  nodeType: 'Beacon/c³' | 'Beacon/vᵗ' | 'Beacon/tᵒ' | '';
  sensorType: 'Current' | 'Vibration' | 'Ambient Temperature & Humidity' | '';
}

type TabType = 'equipment' | `node-${number}`;

export function MachineForm({ isOpen, onClose, onSuccess }: MachineFormProps) {
  const [loading, setLoading] = useState(false);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [unassignedNodes, setUnassignedNodes] = useState<UnassignedNode[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(false);
  const [loadingNodes, setLoadingNodes] = useState(false);
  
  const [activeTab, setActiveTab] = useState<TabType>('equipment');
  const [nodeTabs, setNodeTabs] = useState<number[]>([1]); // Start with one node tab
  
  // Equipment form data
  const [equipmentData, setEquipmentData] = useState({
    machineName: '',
    labId: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  });
  
  // Node form data - indexed by tab number
  const [nodesData, setNodesData] = useState<Record<number, NodeData>>({
    1: { mac: '', nodeType: '', sensorType: '' },
  });

  // Fetch labs and unassigned nodes when form opens
  useEffect(() => {
    if (isOpen) {
      fetchLabs();
      fetchUnassignedNodes();
    }
  }, [isOpen]);

  const fetchLabs = async () => {
    setLoadingLabs(true);
    try {
      const response = await fetch('/api/labs');
      const data = await response.json();
      if (data.success) {
        setLabs(data.labs);
      } else {
        toast.error('Failed to load shopfloors');
      }
    } catch (error) {
      console.error('Error fetching labs:', error);
      toast.error('Failed to load shopfloors');
    } finally {
      setLoadingLabs(false);
    }
  };

  const fetchUnassignedNodes = async () => {
    setLoadingNodes(true);
    try {
      const response = await fetch('/api/nodes/unassigned');
      const data = await response.json();
      if (data.success) {
        setUnassignedNodes(data.unassignedNodes || []);
      } else {
        toast.error('Failed to load unassigned nodes');
      }
    } catch (error) {
      console.error('Error fetching unassigned nodes:', error);
      toast.error('Failed to load unassigned nodes');
    } finally {
      setLoadingNodes(false);
    }
  };

  const handleNodeTypeChange = (tabNum: number, nodeType: 'Beacon/c³' | 'Beacon/vᵗ' | 'Beacon/tᵒ') => {
    const currentData = nodesData[tabNum] || { mac: '', nodeType: '', sensorType: '' };
    let sensorType: 'Current' | 'Vibration' | 'Ambient Temperature & Humidity' = 'Current';
    
    if (nodeType === 'Beacon/c³') {
      sensorType = 'Current';
    } else if (nodeType === 'Beacon/vᵗ') {
      sensorType = 'Vibration';
    } else if (nodeType === 'Beacon/tᵒ') {
      sensorType = 'Ambient Temperature & Humidity';
    }
    
    setNodesData({
      ...nodesData,
      [tabNum]: {
        ...currentData,
        nodeType,
        sensorType,
      },
    });
  };

  const handleSensorChange = (tabNum: number, sensorType: 'Current' | 'Vibration' | 'Ambient Temperature & Humidity') => {
    const currentData = nodesData[tabNum] || { mac: '', nodeType: '', sensorType: '' };
    setNodesData({
      ...nodesData,
      [tabNum]: {
        ...currentData,
        sensorType,
      },
    });
  };

  const handleMacChange = (tabNum: number, mac: string) => {
    const currentData = nodesData[tabNum] || { mac: '', nodeType: '', sensorType: '' };
    setNodesData({
      ...nodesData,
      [tabNum]: {
        ...currentData,
        mac,
      },
    });
  };

  const addNodeTab = () => {
    const newTabNum = Math.max(...nodeTabs, 0) + 1;
    setNodeTabs([...nodeTabs, newTabNum]);
    setNodesData({
      ...nodesData,
      [newTabNum]: { mac: '', nodeType: '', sensorType: '' },
    });
    setActiveTab(`node-${newTabNum}`);
  };

  const removeNodeTab = (tabNum: number) => {
    if (nodeTabs.length === 1) {
      toast.error('At least one node tab is required');
      return;
    }
    
    const newTabs = nodeTabs.filter(t => t !== tabNum);
    setNodeTabs(newTabs);
    
    // Remove data for this tab
    const newNodesData = { ...nodesData };
    delete newNodesData[tabNum];
    setNodesData(newNodesData);
    
    // Switch to equipment tab if we removed the active tab
    if (activeTab === `node-${tabNum}`) {
      setActiveTab('equipment');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate equipment
    if (!equipmentData.machineName.trim()) {
      toast.error('Machine name is required');
      return;
    }
    
    if (!equipmentData.labId) {
      toast.error('Shopfloor is required');
      return;
    }
    
    // Validate nodes
    const validNodes = nodeTabs
      .map(tabNum => nodesData[tabNum])
      .filter(node => node && node.mac && node.nodeType && node.sensorType);
    
    if (validNodes.length === 0) {
      toast.error('At least one complete node is required');
      return;
    }
    
    // Check for duplicate MACs
    const macs = validNodes.map(n => n.mac);
    const uniqueMacs = new Set(macs);
    if (macs.length !== uniqueMacs.size) {
      toast.error('Duplicate MAC addresses are not allowed');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/machines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          machineName: equipmentData.machineName.trim(),
          labId: equipmentData.labId,
          description: equipmentData.description.trim() || undefined,
          tags: undefined, // Tags are optional and can be empty
          status: equipmentData.status,
          nodes: validNodes.map(node => ({
            mac: node.mac,
            nodeType: node.nodeType,
            sensorType: node.sensorType,
          })),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Machine created successfully!');
        // Reset form
        setEquipmentData({
          machineName: '',
          labId: '',
          description: '',
          status: 'active',
        });
        setNodeTabs([1]);
        setNodesData({ 1: { mac: '', nodeType: '', sensorType: '' } });
        setActiveTab('equipment');
        
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } else {
        toast.error(data.error || 'Failed to create machine');
      }
    } catch (error: any) {
      console.error('Error creating machine:', error);
      toast.error('Failed to create machine');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getAvailableMacs = (currentTabNum: number) => {
    // Get MACs already selected in other tabs
    const selectedMacs = Object.entries(nodesData)
      .filter(([tabNum]) => Number(tabNum) !== currentTabNum)
      .map(([, data]) => data.mac)
      .filter(mac => mac);
    
    return unassignedNodes.filter(node => !selectedMacs.includes(node.mac));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-dark-panel rounded-lg border border-dark-border max-w-5xl w-full h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-dark-border flex-shrink-0">
          <div>
            <h3 className="heading-inter heading-inter-md">Add Equipment</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-border rounded transition-colors"
          >
            <CloseIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-dark-border overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'equipment'
                ? 'text-sage-400 border-b-2 border-sage-400 bg-sage-500/5'
                : 'text-gray-500 hover:text-gray-300 hover:bg-dark-border/50'
            }`}
          >
            Equipment
          </button>
          
          {nodeTabs.map((tabNum) => (
            <div key={tabNum} className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab(`node-${tabNum}`)}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === `node-${tabNum}`
                    ? 'text-sage-400 border-b-2 border-sage-400 bg-sage-500/5'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-dark-border/50'
                }`}
              >
                Node {tabNum}
              </button>
              {nodeTabs.length > 1 && (
                <button
                  onClick={() => removeNodeTab(tabNum)}
                  className="p-1 hover:bg-dark-border rounded text-gray-400 hover:text-red-400 transition-colors"
                  title="Remove node"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          
          <button
            onClick={addNodeTab}
            className="px-4 py-2 text-sm font-medium text-sage-400 hover:bg-sage-500/10 rounded transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            <PlusIcon className="w-4 h-4" />
            Add Node
          </button>
        </div>

        {/* Form Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {/* Equipment Tab */}
              {activeTab === 'equipment' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={equipmentData.machineName}
                      onChange={(e) => setEquipmentData({ ...equipmentData, machineName: e.target.value })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      placeholder="Enter machine name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Shopfloor <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={equipmentData.labId}
                      onChange={(e) => setEquipmentData({ ...equipmentData, labId: e.target.value })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      required
                      disabled={loadingLabs}
                    >
                      <option value="">Select shopfloor...</option>
                      {labs.map((lab) => (
                        <option key={lab._id} value={lab._id}>
                          {lab.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={equipmentData.description}
                      onChange={(e) => setEquipmentData({ ...equipmentData, description: e.target.value })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                      placeholder="Enter machine description"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={equipmentData.status}
                      onChange={(e) => setEquipmentData({ ...equipmentData, status: e.target.value as 'active' | 'inactive' })}
                      className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </>
              )}

              {/* Node Tabs */}
              {nodeTabs.map((tabNum) => (
                activeTab === `node-${tabNum}` && (
                  <div key={tabNum} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        MAC Address <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={nodesData[tabNum]?.mac || ''}
                        onChange={(e) => handleMacChange(tabNum, e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                        required
                        disabled={loadingNodes}
                      >
                        <option value="">Select MAC address...</option>
                        {getAvailableMacs(tabNum).map((node) => (
                          <option key={node._id} value={node.mac}>
                            {node.mac}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Node Type <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={nodesData[tabNum]?.nodeType || ''}
                        onChange={(e) => handleNodeTypeChange(tabNum, e.target.value as 'Beacon/c³' | 'Beacon/vᵗ' | 'Beacon/tᵒ')}
                        className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                        required
                      >
                        <option value="">Select node type...</option>
                        <option value="Beacon/c³">Beacon/c³</option>
                        <option value="Beacon/vᵗ">Beacon/vᵗ</option>
                        <option value="Beacon/tᵒ">Beacon/tᵒ</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Sensor <span className="text-red-400">*</span>
                      </label>
                      {nodesData[tabNum]?.nodeType === 'Beacon/c³' ? (
                        <input
                          type="text"
                          value="Current"
                          className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300 opacity-60 cursor-not-allowed"
                          disabled
                          readOnly
                        />
                      ) : nodesData[tabNum]?.nodeType === 'Beacon/tᵒ' ? (
                        <input
                          type="text"
                          value="Ambient Temperature & Humidity"
                          className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300 opacity-60 cursor-not-allowed"
                          disabled
                          readOnly
                        />
                      ) : nodesData[tabNum]?.nodeType === 'Beacon/vᵗ' ? (
                        <select
                          value={nodesData[tabNum]?.sensorType || ''}
                          onChange={(e) => handleSensorChange(tabNum, e.target.value as 'Current' | 'Vibration' | 'Ambient Temperature & Humidity')}
                          className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300"
                          required
                        >
                          <option value="">Select sensor...</option>
                          <option value="Vibration">Vibration</option>
                          <option value="Current">Current</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value=""
                          className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-midnight-300 opacity-60 cursor-not-allowed"
                          disabled
                          placeholder="Select node type first"
                        />
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Submit Button - Always Visible */}
          <div className="flex justify-end gap-3 p-6 pt-4 border-t border-dark-border flex-shrink-0 bg-dark-panel">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-dark-bg hover:bg-dark-border border border-dark-border text-white rounded text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

