'use client';

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FiSettings, FiLink, FiGlobe, FiTrash2, FiClock } from 'react-icons/fi';
import { WorkflowNode } from '@/types/workflow';
import WebhookTriggerConfigModal from '../modals/WebhookTriggerConfigModal';

interface WebhookTriggerNodeData {
  name: string;
  description: string;
  config: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    authentication?: string;
    timeout?: number;
  };
  onUpdate?: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onSelect?: (node: any) => void;
  onDelete?: (nodeId: string) => void;
}

export default function WebhookTriggerReactFlowNode({ 
  id, 
  data, 
  selected 
}: NodeProps<WebhookTriggerNodeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const nodeConfig = data.config || {};
  const url = nodeConfig.url || 'Not Set';
  const method = nodeConfig.method || 'POST';
  const authentication = nodeConfig.authentication || 'none';
  const timeout = nodeConfig.timeout || 30000;
  const headerCount = Object.keys(nodeConfig.headers || {}).length;
  const isConfigured = url !== 'Not Set';

  const handleConfigClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfigModalOpen(true);
  };

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

  const formatTimeout = (ms: number) => {
    return ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`;
  };

  return (
    <div
      className={`
        relative bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg shadow-lg 
        border-2 transition-all duration-200 min-w-[280px] max-w-[320px] select-none
        ${selected 
          ? 'border-emerald-300 shadow-emerald-300/50 ring-2 ring-emerald-400/30' 
          : 'border-emerald-500/50 hover:border-emerald-400/70'
        }
        ${isHovered ? 'shadow-xl scale-[1.02]' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleNodeClick}
    >
      {/* Only Output Handle - Webhook triggers start workflows */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 !bg-emerald-400 !border-2 !border-white shadow-lg"
        style={{ right: -6 }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                <FiLink className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full flex items-center justify-center">
                <FiGlobe className="w-2 h-2 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Webhook Trigger</h3>
              <p className="text-xs text-emerald-200">HTTP Endpoint</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleConfigClick}
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-600 rounded transition-colors"
              title="Configure Webhook"
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

        {/* Webhook Configuration */}
        <div className="space-y-3">
          <div className="bg-emerald-800/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <FiGlobe className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-medium text-emerald-200">Webhook Configuration</span>
            </div>
            <div className="space-y-2 text-xs text-emerald-100">
              <div className="flex justify-between">
                <span>URL:</span>
                <span className="text-emerald-200 font-medium truncate ml-2" title={url}>
                  {url === 'Not Set' ? 'Not Set' : url.length > 20 ? `${url.substring(0, 20)}...` : url}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Method:</span>
                <span className="text-emerald-200 font-medium bg-emerald-600/30 px-2 py-0.5 rounded">
                  {method}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Auth:</span>
                <span className="text-emerald-200 font-medium">
                  {authentication === 'none' ? 'None' : authentication}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Timeout:</span>
                <div className="flex items-center gap-1">
                  <FiClock className="w-3 h-3 text-emerald-300" />
                  <span className="text-emerald-200 font-medium">
                    {formatTimeout(timeout)}
                  </span>
                </div>
              </div>
              {headerCount > 0 && (
                <div className="flex justify-between">
                  <span>Headers:</span>
                  <span className="text-emerald-200 font-medium">
                    {headerCount} header{headerCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <span className="text-xs text-emerald-200">
                {isConfigured ? 'Ready to Trigger' : 'Configuration Required'}
              </span>
            </div>
            <button
              onClick={handleConfigClick}
              className="text-xs text-emerald-300 hover:text-white transition-colors"
            >
              Configure →
            </button>
          </div>
        </div>
      </div>

      {/* Node Type Badge */}
      <div className="absolute -top-2 -left-2">
        <div className="bg-emerald-500 text-white text-xs px-2 py-1 rounded-full shadow-lg font-medium">
          Trigger
        </div>
      </div>

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none animate-pulse"></div>
      )}

      {/* Configuration Modal */}
      <WebhookTriggerConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleConfigSave}
        initialConfig={nodeConfig}
      />
    </div>
  );
}