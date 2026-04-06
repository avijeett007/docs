'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { FiSettings, FiMic, FiUser, FiTrash2 } from 'react-icons/fi';
import { WorkflowNode, KnovaAgentNodeData } from '@/types/workflow';
import EnhancedKnovaAgentConfigModal from '../modals/EnhancedKnovaAgentConfigModal';



export default function KnovaAgentReactFlowNode({ 
  id, 
  data, 
  selected,
  xPos,
  yPos
}: NodeProps<KnovaAgentNodeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const { project } = useReactFlow();

  const agentName = data.agentName || 'Unnamed Agent';
  const agentType = data.agentType || 'inbound';
  const channel = data.communicationChannel || 'telephony';
  const voice = data.voice || 'alloy';
  const businessName = data.businessInfo?.name || 'Not Set';
  const isConfigured = !!(data.agentName && data.businessInfo?.name && data.instructions);

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
    if ((data as any).onUpdate) {
      (data as any).onUpdate(id, {
        data: {
          ...data,
          config: newConfig
        }
      });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((data as any).onDelete) {
      (data as any).onDelete(id);
    }
  };

  const handleNodeClick = () => {
    if ((data as any).onSelect) {
      (data as any).onSelect({ id, data });
    }
  };

  return (
    <div
      className={`
        relative bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg shadow-lg 
        border-2 transition-all duration-200 min-w-[280px] max-w-[320px] select-none
        ${selected 
          ? 'border-indigo-300 shadow-indigo-300/50 ring-2 ring-indigo-400/30' 
          : 'border-indigo-500/50 hover:border-indigo-400/70'
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
        className="w-3 h-3 !bg-indigo-400 !border-2 !border-white shadow-lg"
        style={{ left: -6 }}
      />

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 !bg-indigo-400 !border-2 !border-white shadow-lg"
        style={{ right: -6 }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                <FiUser className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                <span className="text-xs">🤖</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{agentName}</h3>
              <p className="text-xs text-indigo-200">Knova AI Agent</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleConfigClick}
              className="p-1.5 text-indigo-200 hover:text-white hover:bg-indigo-600 rounded transition-colors"
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
          <div className="bg-indigo-800/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <FiMic className="w-4 h-4 text-indigo-300" />
              <span className="text-xs font-medium text-indigo-200">Configuration</span>
            </div>
            <div className="space-y-2 text-xs text-indigo-100">
              <div className="flex justify-between">
                <span>Business:</span>
                <span className="text-indigo-200 font-medium truncate ml-2" title={businessName}>{businessName}</span>
              </div>
              <div className="flex justify-between">
                <span>Type:</span>
                <span className="text-indigo-200 font-medium capitalize">{agentType}</span>
              </div>
              <div className="flex justify-between">
                <span>Channel:</span>
                <span className="text-indigo-200 font-medium capitalize">{channel}</span>
              </div>
              <div className="flex justify-between">
                <span>Voice:</span>
                <span className="text-indigo-200 font-medium capitalize">{voice}</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <span className="text-xs text-indigo-200">
                {isConfigured ? 'Configured' : 'Configuration Required'}
              </span>
            </div>
            <button
              onClick={handleConfigClick}
              className="text-xs text-indigo-300 hover:text-white transition-colors"
            >
              Configure →
            </button>
          </div>
        </div>
      </div>

      {/* Node Type Badge */}
      <div className="absolute -top-2 -left-2">
        <div className="bg-indigo-500 text-white text-xs px-2 py-1 rounded-full shadow-lg font-medium">
          Knova
        </div>
      </div>

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none animate-pulse"></div>
      )}

      {/* Configuration Modal */}
      <EnhancedKnovaAgentConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleConfigSave}
        initialConfig={data}
        nodePosition={getScreenPosition()}
      />
    </div>
  );
}