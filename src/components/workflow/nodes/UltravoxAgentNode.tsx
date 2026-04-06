import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiSettings, FiMic, FiUser, FiEdit3, FiClock, FiTool } from 'react-icons/fi';
import { WorkflowNode, UltravoxAgentData } from '@/types/workflow';

interface UltravoxAgentNodeProps {
  node: WorkflowNode;
  onUpdate: (nodeId: string, data: Partial<WorkflowNode['data']>) => void;
  onConfigClick: (nodeId: string) => void;
  onDrag?: (position: { x: number; y: number }) => void;
  onSelect?: () => void;
  onConnectionStart?: (nodeId: string, handle: string, position: { x: number; y: number }) => void;
  onConnectionEnd?: (nodeId: string, handle: string) => void;
  isSelected: boolean;
  isDragging: boolean;
  zoom?: number;
}

export const UltravoxAgentNode: React.FC<UltravoxAgentNodeProps> = ({
  node,
  onUpdate,
  onConfigClick,
  onDrag,
  onSelect,
  onConnectionStart,
  onConnectionEnd,
  isSelected,
  isDragging,
  zoom = 1
}) => {
  const [availableAgents, setAvailableAgents] = useState<UltravoxAgentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isNodeDragging, setIsNodeDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAvailableAgents();
  }, []);

  // Dragging functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // Prevent dragging when interacting with form elements or connection points
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'SELECT' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'TEXTAREA' ||
      target.closest('select') ||
      target.closest('input') ||
      target.closest('button') ||
      target.closest('textarea') ||
      target.closest('[role="button"]') ||
      target.closest('[role="combobox"]') ||
      target.closest('.connection-point') ||
      target.classList.contains('connection-point')
    ) {
      return;
    }

    setIsNodeDragging(true);
    setDragStart({
      x: e.clientX - node.position.x * zoom,
      y: e.clientY - node.position.y * zoom
    });

    onSelect?.();
  }, [node.position, zoom, onSelect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isNodeDragging || !onDrag) return;

    const newPosition = {
      x: (e.clientX - dragStart.x) / zoom,
      y: (e.clientY - dragStart.y) / zoom
    };

    onDrag(newPosition);
  }, [isNodeDragging, dragStart, zoom, onDrag]);

  const handleMouseUp = useCallback(() => {
    setIsNodeDragging(false);
  }, []);

  useEffect(() => {
    if (isNodeDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isNodeDragging, handleMouseMove, handleMouseUp]);

  const handleConnectionStart = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConnectionStart) {
      // Calculate the connection point position relative to the canvas
      const connectionPosition = {
        x: handle === 'output' ? node.position.x + 300 : node.position.x, // Right edge for output, left edge for input
        y: node.position.y + 40 // Center vertically
      };
      onConnectionStart(node.id, handle, connectionPosition);
    }
  };

  const handleConnectionEnd = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onConnectionEnd?.(node.id, handle);
  };

  const loadAvailableAgents = async () => {
    try {
      setLoading(true);
      // Get partner and customer info from localStorage or context
      const partnerId = localStorage.getItem('partner_id') || 'demo_partner';
      const customerId = localStorage.getItem('current_customer_id') || 'demo_customer';
      
      // TODO: Replace with actual API call
      // For now, simulate loading from localStorage or API
      const mockAgents: UltravoxAgentData[] = [
        {
          id: 'ultravox_agent_1',
          name: 'Advanced Assistant',
          systemPrompt: 'You are a helpful AI assistant',
          temperature: 0.7,
          model: 'gpt-4',
          voice: 'terrence',
          languageHint: 'en',
          recordingEnabled: true,
          maxDuration: '30m',
          timeExceededMessage: 'Call time exceeded',
          selectedTools: ['web_search', 'calculator'],
          customerId: customerId,
          isActive: true
        }
      ];
      
      setAvailableAgents(mockAgents);
    } catch (error) {
      console.error('Error loading Ultravox agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentSelect = (agentId: string) => {
    const selectedAgent = availableAgents.find(agent => agent.id === agentId);
    if (selectedAgent) {
      onUpdate(node.id, {
        agentId,
        agentData: selectedAgent,
        name: `Ultravox: ${selectedAgent.name}`
      });
    }
  };

  const selectedAgent = node.data.agentData as UltravoxAgentData | undefined;

  return (
    <div
      ref={nodeRef}
      className={`
        relative bg-gradient-to-br from-violet-600 to-violet-700 rounded-lg shadow-lg border-2 transition-all duration-200
        ${isSelected ? 'border-violet-300 shadow-violet-300/50' : 'border-violet-500/50'}
        ${isDragging || isNodeDragging ? 'scale-105 shadow-xl cursor-grabbing' : 'hover:shadow-xl cursor-grab'}
        min-w-[280px] max-w-[320px] select-none
      `}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        zIndex: isSelected ? 1000 : 1
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-violet-500/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center">
            <FiMic className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">Ultravox Agent</h3>
            <p className="text-violet-200 text-xs">Advanced Voice AI</p>
          </div>
        </div>
        <button
          onClick={() => onConfigClick(node.id)}
          className="p-1.5 text-violet-200 hover:text-white hover:bg-violet-500/30 rounded transition-colors"
        >
          <FiSettings className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {!node.data.agentId ? (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-violet-200">
              Select Ultravox Agent
            </label>
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin w-5 h-5 border-2 border-violet-300 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-violet-200 text-xs mt-2">Loading agents...</p>
              </div>
            ) : (
              <select
                value={node.data.agentId || ''}
                onChange={(e) => handleAgentSelect(e.target.value)}
                className="w-full px-3 py-2 bg-violet-800/50 border border-violet-500/50 rounded-lg text-white text-sm focus:outline-none focus:border-violet-400"
              >
                <option value="">Choose an agent...</option>
                {availableAgents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} {!agent.isActive && '(Inactive)'}
                  </option>
                ))}
              </select>
            )}
            {availableAgents.length === 0 && !loading && (
              <p className="text-violet-300 text-xs text-center py-2">
                No available Ultravox agents found
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiUser className="w-4 h-4 text-violet-300" />
                <span className="text-white text-sm font-medium">
                  {selectedAgent?.name || 'Unknown Agent'}
                </span>
              </div>
              <button
                onClick={() => onUpdate(node.id, { agentId: undefined, agentData: undefined, name: 'Ultravox Agent' })}
                className="text-violet-300 hover:text-white text-xs"
              >
                <FiEdit3 className="w-3 h-3" />
              </button>
            </div>

            {selectedAgent && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <FiMic className="w-3 h-3 text-violet-300" />
                  <span className="text-violet-200">
                    Voice: {selectedAgent.voice || 'Default'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                  <span className="text-violet-200">
                    Model: {selectedAgent.model}
                  </span>
                </div>
                {selectedAgent.maxDuration && (
                  <div className="flex items-center gap-2">
                    <FiClock className="w-3 h-3 text-violet-300" />
                    <span className="text-violet-200">
                      Max: {selectedAgent.maxDuration}
                    </span>
                  </div>
                )}
                {selectedAgent.selectedTools && selectedAgent.selectedTools.length > 0 && (
                  <div className="flex items-center gap-2">
                    <FiTool className="w-3 h-3 text-violet-300" />
                    <span className="text-violet-200">
                      {selectedAgent.selectedTools.length} tools
                    </span>
                  </div>
                )}
                {selectedAgent.recordingEnabled && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <span className="text-violet-200">Recording Enabled</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connection Points */}
      <div
        className="connection-point absolute -left-4 top-1/2 transform -translate-y-1/2 cursor-crosshair z-10"
        onMouseDown={(e) => handleConnectionStart('input', e)}
        onMouseUp={(e) => handleConnectionEnd('input', e)}
      >
        <div className="w-8 h-8 bg-violet-500 rounded-full border-4 border-white shadow-xl hover:bg-violet-400 hover:scale-125 transition-all duration-200 flex items-center justify-center">
          <div className="w-3 h-3 bg-white rounded-full"></div>
        </div>
      </div>
      <div
        className="connection-point absolute -right-4 top-1/2 transform -translate-y-1/2 cursor-crosshair z-10"
        onMouseDown={(e) => handleConnectionStart('output', e)}
        onMouseUp={(e) => handleConnectionEnd('output', e)}
      >
        <div className="w-8 h-8 bg-violet-500 rounded-full border-4 border-white shadow-xl hover:bg-violet-400 hover:scale-125 transition-all duration-200 flex items-center justify-center">
          <div className="w-3 h-3 bg-white rounded-full"></div>
        </div>
      </div>

      {/* Status Indicator */}
      {selectedAgent && (
        <div className="absolute -top-1 -right-1">
          <div className={`w-3 h-3 rounded-full ${selectedAgent.isActive ? 'bg-green-400' : 'bg-red-400'} border border-white`}></div>
        </div>
      )}
    </div>
  );
};
