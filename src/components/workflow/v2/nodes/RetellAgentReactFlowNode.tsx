'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { FiSettings, FiMic, FiPhone, FiTrash2, FiVolumeX } from 'react-icons/fi';
import { WorkflowNode } from '@/types/workflow';
import EnhancedRetellAgentConfigModal from '../modals/EnhancedRetellAgentConfigModal';

interface RetellAgentNodeData {
  name: string;
  description: string;
  config: {
    apiKey?: string;
    agentId?: string;
    phoneNumber?: string;
    voice?: string;
    language?: string;
    responseFormat?: string;
    interruption?: boolean;
    id?: string;
    name?: string;
    voiceId?: string;
    voiceModel?: string;
    responseEngine?: any;
    voiceConfig?: any;
    callConfig?: any;
    recordingEnabled?: boolean;
    customerId?: string;
    isActive?: boolean;
  };
  onUpdate?: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onSelect?: (node: any) => void;
  onDelete?: (nodeId: string) => void;
  nodePosition?: { x: number; y: number };
  customerId?: string;
}

export default function RetellAgentReactFlowNode({ 
  id, 
  data, 
  selected,
  xPos,
  yPos
}: NodeProps<RetellAgentNodeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const { project } = useReactFlow();

  const nodeConfig = data.config || {};
  const apiKey = nodeConfig.apiKey || 'Not Set';
  const agentId = nodeConfig.agentId || nodeConfig.id || 'Not Set';
  const agentName = nodeConfig.name || 'Unnamed Agent';
  const voice = nodeConfig.voice || nodeConfig.voiceId || 'Liam';
  const language = nodeConfig.language || 'en-US';
  const interruption = nodeConfig.interruption !== false;
  const isConfigured = !!(nodeConfig.id || (nodeConfig.apiKey && nodeConfig.agentId));

  const handleConfigClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfigModalOpen(true);
  };

  const getScreenPosition = useCallback(() => {
    if (xPos !== undefined && yPos !== undefined) {
      // Convert canvas coordinates to screen coordinates
      const screenPosition = project({ x: xPos, y: yPos });
      return screenPosition;
    }
    return { x: 0, y: 0 };
  }, [xPos, yPos, project]);

  const handleConfigSave = (newConfig: any) => {
    if (data.onUpdate) {
      data.onUpdate(id, { 
        data: { 
          ...data, 
          config: newConfig 
        } 
      });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

  const handleNodeClick = () => {
    if (data.onSelect) {
      data.onSelect({ id, data });
    }
  };

  return (
    <div
      className={`
        relative bg-gradient-to-br from-green-600 to-green-700 rounded-lg shadow-lg 
        border-2 transition-all duration-200 min-w-[280px] max-w-[320px] select-none
        ${selected 
          ? 'border-green-300 shadow-green-300/50 ring-2 ring-green-400/30' 
          : 'border-green-500/50 hover:border-green-400/70'
        }
        ${isHovered ? 'shadow-xl scale-[1.02]' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleNodeClick}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 !bg-green-400 !border-2 !border-white shadow-lg"
        style={{ left: -6 }}
      />

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 !bg-green-400 !border-2 !border-white shadow-lg"
        style={{ right: -6 }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <FiPhone className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400 rounded-full flex items-center justify-center">
                <span className="text-xs">🎙️</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{agentName}</h3>
              <p className="text-xs text-green-200">Retell Agent</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleConfigClick}
              className="p-1.5 text-green-200 hover:text-white hover:bg-green-600 rounded transition-colors"
              title="Configure Agent"
            >
              <FiSettings className="w-4 h-4" />
            </button>
            
            {isHovered && (
              <button
                onClick={handleDeleteClick}
                className="p-1.5 text-red-300 hover:text-red-100 hover:bg-red-600 rounded transition-colors"
                title="Delete Node"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Agent Configuration */}
        <div className="space-y-3">
          <div className="bg-green-800/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <FiMic className="w-4 h-4 text-green-300" />
              <span className="text-xs font-medium text-green-200">Retell Configuration</span>
            </div>
            <div className="space-y-2 text-xs text-green-100">
              <div className="flex justify-between">
                <span>API Key:</span>
                <span className="text-green-200 font-medium">
                  {apiKey === 'Not Set' ? 'Not Set' : '••••••••'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Agent:</span>
                <span className="text-green-200 font-medium truncate ml-2" title={agentName}>
                  {agentName}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Voice:</span>
                <span className="text-green-200 font-medium">{voice}</span>
              </div>
              <div className="flex justify-between">
                <span>Language:</span>
                <span className="text-green-200 font-medium">{language}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Interruption:</span>
                <div className="flex items-center gap-1">
                  {interruption ? (
                    <FiMic className="w-3 h-3 text-green-300" />
                  ) : (
                    <FiVolumeX className="w-3 h-3 text-red-300" />
                  )}
                  <span className="text-green-200 font-medium">
                    {interruption ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <span className="text-xs text-green-200">
                {isConfigured ? 'Ready' : 'Configuration Required'}
              </span>
            </div>
            <button
              onClick={handleConfigClick}
              className="text-xs text-green-300 hover:text-white transition-colors"
            >
              Configure →
            </button>
          </div>
        </div>
      </div>

      {/* Node Type Badge */}
      <div className="absolute -top-2 -left-2">
        <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full shadow-lg font-medium">
          Retell
        </div>
      </div>

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none animate-pulse"></div>
      )}

      {/* Configuration Modal */}
      <EnhancedRetellAgentConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleConfigSave}
        initialConfig={nodeConfig}
        nodePosition={getScreenPosition()}
        customerId={data.customerId}
      />
    </div>
  );
}