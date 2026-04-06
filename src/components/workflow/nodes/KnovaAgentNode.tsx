import React from 'react';
import { FiMic, FiUser } from 'react-icons/fi';
import { WorkflowNode } from '@/types/workflow';
import { BaseNode } from './BaseNode';

interface KnovaAgentNodeProps {
  node: WorkflowNode;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onConfigClick: (nodeId: string) => void;
  onSelect: () => void;
  onConnectionStart: (nodeId: string, handle: string, position: { x: number; y: number }) => void;
  onConnectionEnd: (nodeId: string, handle: string) => void;
  isSelected: boolean;
  zoom?: number;
}

export const KnovaAgentNode: React.FC<KnovaAgentNodeProps> = ({
  node,
  onUpdate,
  onConfigClick,
  onSelect,
  onConnectionStart,
  onConnectionEnd,
  isSelected,
  zoom = 1
}) => {
  const nodeConfig = node.data.config || {};
  const agentType = nodeConfig.agentType || 'Not Configured';
  const channel = nodeConfig.channel || 'Not Set';
  const voice = nodeConfig.voice || 'Default';
  const isConfigured = agentType !== 'Not Configured';

  const nodeColor = {
    gradient: 'from-indigo-600 to-indigo-700',
    border: 'border-indigo-300 shadow-indigo-300/50',
    connection: 'bg-indigo-500'
  };

  const icon = (
    <div className="relative">
      <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
        <FiUser className="w-5 h-5 text-white" />
      </div>
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
        <span className="text-xs">🤖</span>
      </div>
    </div>
  );

  return (
    <BaseNode
      node={node}
      isSelected={isSelected}
      zoom={zoom}
      onUpdate={onUpdate}
      onSelect={onSelect}
      onConnectionStart={onConnectionStart}
      onConnectionEnd={onConnectionEnd}
      onConfigClick={() => onConfigClick(node.id)}
      color={nodeColor}
      icon={icon}
      title="Knova Agent"
      subtitle="AI Voice Assistant"
    >
      {/* Agent Configuration */}
      <div className="space-y-3">
        <div className="bg-indigo-800/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <FiMic className="w-4 h-4 text-indigo-300" />
            <span className="text-xs font-medium text-indigo-200">Configuration</span>
          </div>
          <div className="space-y-2 text-xs text-indigo-100">
            <div className="flex justify-between">
              <span>Agent Type:</span>
              <span className="text-indigo-200">{agentType}</span>
            </div>
            <div className="flex justify-between">
              <span>Channel:</span>
              <span className="text-indigo-200">{channel}</span>
            </div>
            <div className="flex justify-between">
              <span>Voice:</span>
              <span className="text-indigo-200">{voice}</span>
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
            onClick={(e) => {
              e.stopPropagation();
              onConfigClick(node.id);
            }}
            className="no-drag text-xs text-indigo-300 hover:text-white transition-colors"
          >
            Configure →
          </button>
        </div>
      </div>
    </BaseNode>
  );
};

export default KnovaAgentNode;
