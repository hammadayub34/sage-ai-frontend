'use client';

import { ShopfloorsIcon, PlusIcon } from '@/components/Icons';
import { MachineForm } from '@/components/MachineForm';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

interface Lab {
  _id: string;
  name: string;
  description?: string;
}

interface Node {
  mac: string;
  nodeType: string | null;
  sensorType: string | null;
}

interface Machine {
  _id: string;
  machineName: string;
  labId: string;
  status: 'active' | 'inactive';
  description?: string;
  nodeId?: string;
  nodes?: Node[];
  lastSeen?: string | null;
}

type ViewMode = 'list' | 'cards';

export default function ShopfloorsPage() {
  const router = useRouter();
  const [isMachineFormOpen, setIsMachineFormOpen] = useState(false);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Check if user is logged in and get user data
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
      setLoading(true);
      const response = await fetch(`/api/labs/user?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setLabs(data.labs || []);
        // Auto-select Dawlance lab if available, otherwise first lab
        if (data.labs && data.labs.length > 0) {
          const dawlanceLab = data.labs.find((lab: Lab) => 
            lab.name.toLowerCase().includes('dawlance')
          );
          const labToSelect = dawlanceLab || data.labs[0];
          setSelectedLabId(labToSelect._id);
          fetchMachinesForLab(labToSelect._id);
        }
      } else {
        toast.error('Failed to fetch labs');
      }
    } catch (error) {
      console.error('Error fetching labs:', error);
      toast.error('Error loading labs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch machines for selected lab
  const fetchMachinesForLab = async (labId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/machines?labId=${labId}`);
      const data = await response.json();

      if (data.success) {
        const machinesList = data.machines || [];
        
        // Set machines immediately without waiting for last seen timestamps
        setMachines(machinesList.map((machine: Machine) => ({
          ...machine,
          lastSeen: null, // Will be populated asynchronously
        })));
        
        // Fetch last seen timestamps asynchronously (don't block UI)
        Promise.all(
          machinesList.map(async (machine: Machine) => {
            try {
              const lastSeenResponse = await fetch(`/api/influxdb/last-seen?machineId=${machine._id}`);
              if (lastSeenResponse.ok) {
                const lastSeenData = await lastSeenResponse.json();
                // Update the specific machine's last seen timestamp
                setMachines(prev => prev.map(m => 
                  m._id === machine._id 
                    ? { ...m, lastSeen: lastSeenData.lastSeen || null }
                    : m
                ));
              }
            } catch (error) {
              console.error(`Error fetching last seen for machine ${machine._id}:`, error);
            }
          })
        ).catch(error => {
          console.error('Error fetching last seen timestamps:', error);
        });
      } else {
        toast.error('Failed to fetch machines');
        setMachines([]);
      }
    } catch (error) {
      console.error('Error fetching machines:', error);
      toast.error('Error loading machines');
      setMachines([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle lab selection change
  const handleLabChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const labId = e.target.value;
    setSelectedLabId(labId);
    if (labId) {
      fetchMachinesForLab(labId);
    } else {
      setMachines([]);
    }
  };

  const handleMachineCreated = () => {
    setIsMachineFormOpen(false);
    // Refresh machines for current lab
    if (selectedLabId) {
      fetchMachinesForLab(selectedLabId);
    }
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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ShopfloorsIcon className="w-8 h-8 text-sage-400" />
            <h1 className="heading-inter heading-inter-lg">Equipments</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-dark-panel border border-dark-border rounded p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-sage-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-sage-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Cards
              </button>
            </div>
            <button
              onClick={() => setIsMachineFormOpen(true)}
              className="bg-midnight-300 hover:bg-midnight-400 text-dark-text border border-dark-border p-2 rounded transition-colors flex items-center justify-center"
              title="Add Equipment"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lab/Shopfloor Dropdown */}
        <div className="flex items-center gap-4 mt-4">
          <label className="text-gray-400">Shopfloor/Lab:</label>
          <select
            value={selectedLabId}
            onChange={handleLabChange}
            className="bg-dark-panel border border-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500 min-w-[200px]"
            disabled={loading || labs.length === 0}
          >
            <option value="">
              {loading ? 'Loading labs...' : labs.length === 0 ? 'No labs available' : 'Select a lab...'}
            </option>
            {labs.map((lab) => (
              <option key={lab._id} value={lab._id}>
                {lab.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Machines Display */}
      {loading ? (
        <div className="bg-dark-panel border border-dark-border rounded-lg p-8">
          <div className="text-center text-gray-400">Loading machines...</div>
        </div>
      ) : selectedLabId && machines.length > 0 ? (
        viewMode === 'list' ? (
          // List View - Each machine in separate card
          <div className="space-y-4">
            {machines.map((machine) => (
              <div
                key={machine._id}
                className="bg-dark-panel border border-dark-border rounded-lg p-3 hover:border-sage-500/50 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-white mb-1 line-clamp-2">{machine.machineName}</h3>
                    {machine.description && (
                      <p className="text-xs text-gray-400 line-clamp-1">{machine.description}</p>
                    )}
                    {machine.lastSeen && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last seen: {new Date(machine.lastSeen).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                      machine.status === 'active'
                        ? 'bg-sage-500/20 text-sage-400 border border-sage-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}
                  >
                    {machine.status}
                  </span>
                </div>
                
                <div className="mt-auto">
                  <div className="text-xs font-medium text-gray-300 mb-1.5">
                    Nodes {machine.nodes && machine.nodes.length > 0 && `(${machine.nodes.length})`}
                  </div>
                  {machine.nodes && machine.nodes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {machine.nodes.map((node, idx) => {
                        const getSensorTypeColor = (sensorType: string | null) => {
                          if (!sensorType) return 'text-gray-500 bg-gray-500/20';
                          const lowerType = sensorType.toLowerCase();
                          if (lowerType.includes('vibration')) return 'text-yellow-400 bg-yellow-400/20';
                          if (lowerType.includes('current')) return 'text-blue-400 bg-blue-400/20';
                          if (lowerType.includes('temperature') || lowerType.includes('temp')) return 'text-red-400 bg-red-400/20';
                          if (lowerType.includes('pressure')) return 'text-purple-400 bg-purple-400/20';
                          if (lowerType.includes('humidity')) return 'text-green-400 bg-green-400/20';
                          return 'text-gray-400 bg-gray-400/20';
                        };
                        
                        return (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-xs hover:border-sage-500/50 transition-all cursor-default"
                          >
                            <span className="font-mono text-white text-xs">{node.mac}</span>
                            {node.nodeType && (
                              <span className="text-xs text-sage-400 font-medium bg-sage-500/10 px-1 py-0.5 rounded">
                                {node.nodeType}
                              </span>
                            )}
                            {node.sensorType && (
                              <span className={`text-xs font-semibold px-1 py-0.5 rounded ${getSensorTypeColor(node.sensorType)}`}>
                                {node.sensorType.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-xs">No nodes connected</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Cards View
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {machines.map((machine) => (
              <div
                key={machine._id}
                className="bg-dark-panel border border-dark-border rounded-lg p-3 hover:border-sage-500/50 transition-all aspect-[4/3] flex flex-col"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white line-clamp-2">{machine.machineName}</h3>
                    {machine.lastSeen && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last seen: {new Date(machine.lastSeen).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                      machine.status === 'active'
                        ? 'bg-sage-500/20 text-sage-400 border border-sage-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}
                  >
                    {machine.status}
                  </span>
                </div>
                
                {machine.description && (
                  <p className="text-xs text-gray-400 mb-2 line-clamp-1">{machine.description}</p>
                )}
                
                <div className="mt-auto">
                  <div className="text-xs font-medium text-gray-300 mb-1.5">
                    Nodes {machine.nodes && machine.nodes.length > 0 && `(${machine.nodes.length})`}
                  </div>
                  {machine.nodes && machine.nodes.length > 0 ? (
                    <div className="flex flex-wrap gap-1 overflow-y-auto max-h-24">
                      {machine.nodes.slice(0, 3).map((node, idx) => {
                        const getSensorTypeColor = (sensorType: string | null) => {
                          if (!sensorType) return 'text-gray-500 bg-gray-500/20';
                          const lowerType = sensorType.toLowerCase();
                          if (lowerType.includes('vibration')) return 'text-yellow-400 bg-yellow-400/20';
                          if (lowerType.includes('current')) return 'text-blue-400 bg-blue-400/20';
                          if (lowerType.includes('temperature') || lowerType.includes('temp')) return 'text-red-400 bg-red-400/20';
                          if (lowerType.includes('pressure')) return 'text-purple-400 bg-purple-400/20';
                          if (lowerType.includes('humidity')) return 'text-green-400 bg-green-400/20';
                          return 'text-gray-400 bg-gray-400/20';
                        };
                        
                        return (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-xs hover:border-sage-500/50 transition-all cursor-default"
                          >
                            <span className="font-mono text-white text-xs">{node.mac}</span>
                            {node.sensorType && (
                              <span className={`font-semibold px-1 py-0.5 rounded text-xs ${getSensorTypeColor(node.sensorType)}`}>
                                {node.sensorType.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {machine.nodes.length > 3 && (
                        <span className="text-xs text-gray-500">+{machine.nodes.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-xs">No nodes</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : selectedLabId ? (
        <div className="bg-dark-panel border border-dark-border rounded-lg p-8">
          <div className="text-center text-gray-400">
            <p className="text-lg mb-2">No machines found in this lab</p>
            <p className="text-sm">Click the + button to add equipment</p>
          </div>
        </div>
      ) : (
        <div className="bg-dark-panel border border-dark-border rounded-lg p-8">
          <div className="text-center text-gray-400">
            <p className="text-lg mb-2">Please select a shopfloor/lab</p>
            <p className="text-sm">Select a lab from the dropdown above to view machines</p>
          </div>
        </div>
      )}

      {/* Machine Form Modal */}
      <MachineForm 
        isOpen={isMachineFormOpen} 
        onClose={() => setIsMachineFormOpen(false)} 
        onSuccess={handleMachineCreated}
      />
    </div>
  );
}

