'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShopfloorsIcon } from '@/components/Icons';
import { toast } from 'react-toastify';

interface Node {
  mac: string;
  nodeType: string | null;
  sensorType: string | null;
}

interface MachineInfo {
  machineId: string;
  machineName: string;
  labId: string;
  labName: string;
  status: string;
  description: string;
  nodes: Node[];
  nodeCount: number;
}

interface Summary {
  totalMachines: number;
  totalNodes: number;
  sensorTypes: Record<string, number>;
  nodeTypes: Record<string, number>;
}

export default function MachinesNodesPage() {
  const router = useRouter();
  const [machines, setMachines] = useState<MachineInfo[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [labs, setLabs] = useState<Array<{ _id: string; name: string }>>([]);
  const [user, setUser] = useState<any>(null);

  // Check if user is logged in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const userStr = localStorage.getItem('user');
      
      if (!isLoggedIn || !userStr) {
        router.push('/login');
        return;
      }
      
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        fetchUserLabs(userData._id);
      } catch (error) {
        console.error('Error parsing user data:', error);
        router.push('/login');
      }
    }
  }, [router]);

  // Fetch labs for the logged-in user
  const fetchUserLabs = async (userId: string) => {
    try {
      const response = await fetch(`/api/labs/user?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch labs');
      }
      const data = await response.json();
      if (data.labs && data.labs.length > 0) {
        setLabs(data.labs);
        // Auto-select first lab
        setSelectedLabId(data.labs[0]._id);
      }
    } catch (error: any) {
      console.error('Error fetching labs:', error);
      toast.error('Failed to load labs');
    }
  };

  // Fetch machines and nodes info
  const fetchMachinesNodesInfo = async (labId?: string) => {
    setLoading(true);
    try {
      const url = labId 
        ? `/api/machines/nodes-info?labId=${labId}`
        : '/api/machines/nodes-info';
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch machines and nodes info');
      }
      const data = await response.json();
      
      if (data.success) {
        setMachines(data.machines || []);
        setSummary(data.summary || null);
      } else {
        toast.error('Failed to load machines and nodes info');
      }
    } catch (error: any) {
      console.error('Error fetching machines and nodes info:', error);
      toast.error('Error loading machines and nodes info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLabId) {
      fetchMachinesNodesInfo(selectedLabId);
    } else if (labs.length === 0) {
      fetchMachinesNodesInfo();
    }
  }, [selectedLabId]);

  const getSensorTypeColor = (sensorType: string | null) => {
    if (!sensorType) return 'text-gray-500';
    const lowerType = sensorType.toLowerCase();
    if (lowerType.includes('vibration')) return 'text-yellow-400 bg-yellow-400/20';
    if (lowerType.includes('current')) return 'text-blue-400 bg-blue-400/20';
    if (lowerType.includes('temperature') || lowerType.includes('temp')) return 'text-red-400 bg-red-400/20';
    if (lowerType.includes('pressure')) return 'text-purple-400 bg-purple-400/20';
    if (lowerType.includes('humidity')) return 'text-green-400 bg-green-400/20';
    return 'text-gray-400 bg-gray-400/20';
  };

  const getNodeTypeColor = (nodeType: string | null) => {
    if (!nodeType) return 'text-gray-500';
    return 'text-sage-400';
  };

  if (loading && !user) {
    return (
      <div className="bg-dark-bg text-dark-text p-6 min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-dark-bg text-dark-text p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <ShopfloorsIcon className="w-6 h-6 text-sage-400" />
          <h1 className="heading-inter heading-inter-lg">Machines & Nodes</h1>
        </div>

        {/* Lab Selection */}
        <div className="flex items-center gap-4">
          <label className="text-gray-400">Filter by Lab:</label>
          <select
            value={selectedLabId}
            onChange={(e) => setSelectedLabId(e.target.value)}
            className="bg-dark-panel border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500 min-w-[200px]"
          >
            <option value="">All Labs</option>
            {labs.map((lab) => (
              <option key={lab._id} value={lab._id}>
                {lab.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark-panel border border-dark-border rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Total Machines</div>
            <div className="text-2xl font-bold text-white">{summary.totalMachines}</div>
          </div>
          <div className="bg-dark-panel border border-dark-border rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Total Nodes</div>
            <div className="text-2xl font-bold text-white">{summary.totalNodes}</div>
          </div>
          <div className="bg-dark-panel border border-dark-border rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Sensor Types</div>
            <div className="text-lg font-semibold text-white">
              {Object.keys(summary.sensorTypes).length} types
            </div>

          </div>
          <div className="bg-dark-panel border border-dark-border rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Node Types</div>
            <div className="text-lg font-semibold text-white">
              {Object.keys(summary.nodeTypes).length} types
            </div>
          </div>
        </div>
      )}

      {/* Machines Table */}
      <div className="bg-dark-panel border border-dark-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-bg border-b border-dark-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Machine</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Lab</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nodes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Node Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {machines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    {loading ? 'Loading...' : 'No machines found'}
                  </td>
                </tr>
              ) : (
                machines.map((machine) => (
                  <tr key={machine.machineId} className="hover:bg-dark-bg/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{machine.machineName}</div>
                      {machine.description && (
                        <div className="text-xs text-gray-500 mt-1">{machine.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{machine.labName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        machine.status === 'active' 
                          ? 'bg-sage-500/20 text-sage-400' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {machine.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{machine.nodeCount}</div>
                    </td>
                    <td className="px-6 py-4">
                      {machine.nodes.length > 0 ? (
                        <div className="space-y-2">
                          {machine.nodes.map((node, idx) => (
                            <div key={idx} className="inline-flex items-center gap-2 px-2 py-1 bg-dark-bg/50 border border-dark-border rounded text-xs">
                              <span className="font-mono text-gray-400">{node.mac}</span>
                              {node.nodeType && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getNodeTypeColor(node.nodeType)} bg-sage-500/10`}>
                                  {node.nodeType}
                                </span>
                              )}
                              {node.sensorType && (
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getSensorTypeColor(node.sensorType)}`}>
                                  {node.sensorType}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">No nodes</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sensor Types Breakdown */}
      {summary && Object.keys(summary.sensorTypes).length > 0 && (
        <div className="mt-6 bg-dark-panel border border-dark-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Sensor Types Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(summary.sensorTypes).map(([type, count]) => (
              <div key={type} className="bg-dark-bg border border-dark-border rounded p-4">
                <div className={`text-sm font-medium mb-1 ${getSensorTypeColor(type)}`}>
                  {type}
                </div>
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-xs text-gray-500 mt-1">nodes</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


