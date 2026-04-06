'use client';

import React, { useState } from 'react';
import { FiSearch, FiZap, FiInfo, FiPlay, FiSettings } from 'react-icons/fi';
import { NodeType } from '@/types/workflow';

interface NodePaletteProps {
  onNodeAdd: (nodeType: string, position: { x: number; y: number }) => void;
}

const nodeTypes: NodeType[] = [
  // Trigger Nodes
  {
    id: 'webhook-trigger',
    name: 'Webhook Trigger',
    description: 'Triggers workflow when webhook is called',
    category: 'trigger',
    icon: '🔗',
    color: 'bg-green-500',
    inputs: [],
    outputs: [{ id: 'output', name: 'Trigger', type: 'trigger', required: false }],
    configSchema: []
  },

  // Integration Nodes
  {
    id: 'facebook',
    name: 'Facebook/Meta',
    description: 'Facebook Lead Generation and Ad Management',
    category: 'integration',
    icon: '📱',
    color: 'bg-blue-500',
    inputs: [{ id: 'input', name: 'Data', type: 'data', required: true }],
    outputs: [{ id: 'output', name: 'Lead Data', type: 'data', required: false }],
    configSchema: []
  },
  {
    id: 'ghl',
    name: 'Go High Level',
    description: 'GHL CRM and Workflow Integration',
    category: 'integration',
    icon: '🏢',
    color: 'bg-purple-500',
    inputs: [{ id: 'input', name: 'Contact Data', type: 'data', required: true }],
    outputs: [{ id: 'output', name: 'CRM Data', type: 'data', required: false }],
    configSchema: []
  },
  {
    id: 'n8n',
    name: 'N8N Integration',
    description: 'Connect to N8N workflows',
    category: 'integration',
    icon: '⚡',
    color: 'bg-orange-500',
    inputs: [{ id: 'input', name: 'Workflow Data', type: 'data', required: true }],
    outputs: [{ id: 'output', name: 'Result', type: 'data', required: false }],
    configSchema: []
  },

  // Agent Nodes
  {
    id: 'knova-agent',
    name: 'Knova AI Agent',
    description: 'Custom AI Voice Agent with advanced configuration',
    category: 'agent',
    icon: '🤖',
    color: 'bg-indigo-500',
    inputs: [{ id: 'input', name: 'Call Data', type: 'data', required: true }],
    outputs: [{ id: 'output', name: 'Call Result', type: 'data', required: false }],
    configSchema: [],
    isAgentNode: true,
    agentProvider: 'knova'
  },
  {
    id: 'vapi-agent',
    name: 'VAPI Agent',
    description: 'Voice AI agent powered by VAPI platform',
    category: 'agent',
    icon: '🎙️',
    color: 'bg-blue-600',
    inputs: [{ id: 'input', name: 'Call Data', type: 'data', required: true }],
    outputs: [{ id: 'output', name: 'Call Result', type: 'data', required: false }],
    configSchema: [],
    isAgentNode: true,
    agentProvider: 'vapi'
  },
  {
    id: 'retell-agent',
    name: 'Retell Agent',
    description: 'Voice AI agent powered by Retell platform',
    category: 'agent',
    icon: '📞',
    color: 'bg-emerald-600',
    inputs: [{ id: 'input', name: 'Call Data', type: 'data', required: true }],
    outputs: [{ id: 'output', name: 'Call Result', type: 'data', required: false }],
    configSchema: [],
    isAgentNode: true,
    agentProvider: 'retell'
  },
  {
    id: 'ultravox-agent',
    name: 'Ultravox Agent',
    description: 'Voice AI agent powered by Ultravox platform',
    category: 'agent',
    icon: '🔊',
    color: 'bg-violet-600',
    inputs: [{ id: 'input', name: 'Call Data', type: 'data', required: true }],
    outputs: [{ id: 'output', name: 'Call Result', type: 'data', required: false }],
    configSchema: [],
    isAgentNode: true,
    agentProvider: 'ultravox'
  },

  // Utility Nodes
  {
    id: 'note',
    name: 'Note',
    description: 'Add notes and documentation to your workflow',
    category: 'info',
    icon: '📝',
    color: 'bg-yellow-500',
    inputs: [],
    outputs: [],
    configSchema: []
  },
  {
    id: 'info',
    name: 'Information Node',
    description: 'Documentation and tutorial node',
    category: 'info',
    icon: 'ℹ️',
    color: 'bg-gray-500',
    inputs: [{ id: 'input', name: 'Data', type: 'data', required: false }],
    outputs: [{ id: 'output', name: 'Data', type: 'data', required: false }],
    configSchema: []
  }
];

export default function NodePalette({ onNodeAdd }: NodePaletteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', name: 'All', icon: FiSettings },
    { id: 'trigger', name: 'Triggers', icon: FiZap },
    { id: 'agent', name: 'AI Agents', icon: FiPlay },
    { id: 'integration', name: 'Integrations', icon: FiSettings },
    { id: 'info', name: 'Info', icon: FiInfo }
  ];

  const filteredNodes = nodeTypes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || node.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeClick = (nodeType: string) => {
    // Add node to center of canvas
    onNodeAdd(nodeType, { x: 400, y: 300 });
  };

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">Node Palette</h2>
        
        {/* Search */}
        <div className="relative mb-3">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-1">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <IconComponent className="w-3 h-3" />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredNodes.map((node) => (
          <div
            key={node.id}
            draggable
            onDragStart={(e) => handleDragStart(e, node.id)}
            onClick={() => handleNodeClick(node.id)}
            className="group p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 hover:border-gray-500 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
          >
            <div className="flex items-start gap-3">
              <div className={`relative w-10 h-10 ${node.color} rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0`}>
                {node.icon}
                {node.id === 'knova-agent' && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-xs">⚙️</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                  {node.name}
                  {node.id === 'knova-agent' && (
                    <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                      Enhanced
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                  {node.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    node.category === 'trigger' ? 'bg-green-500/20 text-green-400' :
                    node.category === 'action' ? 'bg-blue-500/20 text-blue-400' :
                    node.category === 'integration' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {node.category}
                  </span>
                  {node.inputs.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {node.inputs.length} input{node.inputs.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {node.outputs.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {node.outputs.length} output{node.outputs.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {filteredNodes.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">No nodes found</div>
            <div className="text-sm text-gray-500">
              Try adjusting your search or category filter
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center">
          Drag nodes to canvas or click to add
        </div>
      </div>
    </div>
  );
}
