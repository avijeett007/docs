'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { FiSettings, FiCpu, FiZap, FiTrash2 } from 'react-icons/fi';
import { WorkflowNode } from '@/types/workflow';
import EnhancedUltravoxAgentConfigModal from '../modals/EnhancedUltravoxAgentConfigModal';

interface UltravoxAgentNodeData {
  name: string;
  description: string;
  config: {
    apiKey?: string;
    modelId?: string;
    voice?: string;
    language?: string;
    temperature?: number;
    maxTokens?: number;
    id?: string;
    name?: string;
    systemPrompt?: string;
    model?: string;
    externalVoice?: any;
    languageHint?: string;
    recordingEnabled?: boolean;
    maxDuration?: string;
    timeExceededMessage?: string;
    selectedTools?: any[];
    callTemplate?: any;
    customerId?: string;
    isActive?: boolean;
  };
  onUpdate?: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onSelect?: (node: any) => void;
  onDelete?: (nodeId: string) => void;
  nodePosition?: { x: number; y: number };
  customerId?: string;
}

export default function UltravoxAgentReactFlowNode({ 
  id, 
  data, 
  selected,
  xPos,
  yPos
}: NodeProps<UltravoxAgentNodeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const { project } = useReactFlow();

  const nodeConfig = data.config || {};
  const apiKey = nodeConfig.apiKey || 'Not Set';
  const modelId = nodeConfig.modelId || nodeConfig.id || 'Not Set';
  const agentName = nodeConfig.name || 'Unnamed Agent';
  const voice = nodeConfig.voice || 'default';
  const language = nodeConfig.language || nodeConfig.languageHint || 'en';
  const temperature = nodeConfig.temperature || 0.7;
  const maxTokens = nodeConfig.maxTokens || 1000;
  const model = nodeConfig.model || 'Default';
  const isConfigured = !!(nodeConfig.id || (nodeConfig.apiKey && nodeConfig.modelId));

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
        relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg 
        border-2 transition-all duration-200 min-w-[280px] max-w-[320px] select-none
        ${selected 
          ? 'border-blue-300 shadow-blue-300/50 ring-2 ring-blue-400/30' 
          : 'border-blue-500/50 hover:border-blue-400/70'
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
        className="w-3 h-3 !bg-blue-400 !border-2 !border-white shadow-lg"
        style={{ left: -6 }}
      />

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 !bg-blue-400 !border-2 !border-white shadow-lg"
        style={{ right: -6 }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <FiCpu className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-400 rounded-full flex items-center justify-center">
                <FiZap className="w-2 h-2 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{agentName}</h3>
              <p className="text-xs text-blue-200">Ultravox Agent</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleConfigClick}
              className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-600 rounded transition-colors"
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
          <div className="bg-blue-800/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <FiZap className="w-4 h-4 text-blue-300" />
              <span className="text-xs font-medium text-blue-200">Ultravox Configuration</span>
            </div>
            <div className="space-y-2 text-xs text-blue-100">
              <div className="flex justify-between">
                <span>API Key:</span>
                <span className="text-blue-200 font-medium">
                  {apiKey === 'Not Set' ? 'Not Set' : '••••••••'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Agent:</span>
                <span className="text-blue-200 font-medium truncate ml-2" title={agentName}>
                  {agentName}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-blue-200 font-medium truncate ml-2">
                  {model}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Voice:</span>
                <span className="text-blue-200 font-medium">{voice}</span>
              </div>
              <div className="flex justify-between">
                <span>Language:</span>
                <span className="text-blue-200 font-medium">{language}</span>
              </div>
              <div className="flex justify-between">
                <span>Temperature:</span>
                <span className="text-blue-200 font-medium">{temperature}</span>
              </div>
              <div className="flex justify-between">
                <span>Max Tokens:</span>
                <span className="text-blue-200 font-medium">{maxTokens}</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <span className="text-xs text-blue-200">
                {isConfigured ? 'Ready' : 'Configuration Required'}
              </span>
            </div>
            <button
              onClick={handleConfigClick}
              className="text-xs text-blue-300 hover:text-white transition-colors"
            >
              Configure →
            </button>
          </div>
        </div>
      </div>

      {/* Node Type Badge */}
      <div className="absolute -top-2 -left-2">
        <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-lg font-medium">
          Ultravox
        </div>
      </div>

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none animate-pulse"></div>
      )}

      {/* Configuration Modal */}
      <EnhancedUltravoxAgentConfigModal
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