'use client';

import React from 'react';
import { FiUser, FiMic, FiPhone, FiFileText, FiZap, FiCpu, FiLink } from 'react-icons/fi';

interface NodeTypeInfo {
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: 'agents' | 'integrations' | 'utilities';
}

const nodeTypes: NodeTypeInfo[] = [
  // Triggers
  {
    type: 'webhook-trigger',
    name: 'Webhook Trigger',
    description: 'HTTP endpoint to trigger workflows',
    icon: <FiLink className="w-5 h-5" />,
    color: 'from-emerald-500 to-emerald-600',
    category: 'integrations',
  },

  // AI Agents
  {
    type: 'knova-agent',
    name: 'Knova Agent',
    description: 'Internal AI voice assistant with advanced features',
    icon: <FiUser className="w-5 h-5" />,
    color: 'from-indigo-500 to-indigo-600',
    category: 'agents',
  },
  {
    type: 'vapi-agent',
    name: 'VAPI Agent',
    description: 'VAPI voice agent integration',
    icon: <FiMic className="w-5 h-5" />,
    color: 'from-purple-500 to-purple-600',
    category: 'agents',
  },
  {
    type: 'retell-agent',
    name: 'Retell Agent',
    description: 'Retell AI voice agent',
    icon: <FiPhone className="w-5 h-5" />,
    color: 'from-green-500 to-green-600',
    category: 'agents',
  },
  {
    type: 'ultravox-agent',
    name: 'Ultravox Agent',
    description: 'Ultravox AI voice agent',
    icon: <FiCpu className="w-5 h-5" />,
    color: 'from-blue-500 to-blue-600',
    category: 'agents',
  },
  
  // Utilities
  {
    type: 'note',
    name: 'Note',
    description: 'Add documentation and notes to your workflow',
    icon: <FiFileText className="w-5 h-5" />,
    color: 'from-yellow-500 to-yellow-600',
    category: 'utilities',
  },
];

const categoryNames = {
  agents: 'AI Agents',
  integrations: 'Integrations',
  utilities: 'Utilities',
};

export default function ReactFlowNodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const groupedNodes = nodeTypes.reduce((acc, node) => {
    if (!acc[node.category]) {
      acc[node.category] = [];
    }
    acc[node.category].push(node);
    return acc;
  }, {} as Record<string, NodeTypeInfo[]>);

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Node Palette</h2>
        <p className="text-sm text-gray-400 mb-6">
          Drag nodes to the canvas to build your workflow
        </p>

        {Object.entries(groupedNodes).map(([category, nodes]) => (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3 uppercase tracking-wide">
              {categoryNames[category as keyof typeof categoryNames]}
            </h3>
            
            <div className="space-y-2">
              {nodes.map((node) => (
                <div
                  key={node.type}
                  className={`
                    group relative bg-gradient-to-r ${node.color} p-4 rounded-lg cursor-grab 
                    hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200
                    border border-white/10 hover:border-white/20
                  `}
                  draggable
                  onDragStart={(event) => onDragStart(event, node.type)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-white mt-0.5">
                      {node.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">
                        {node.name}
                      </h4>
                      <p className="text-xs text-white/80 mt-1 line-clamp-2">
                        {node.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Drag indicator */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-col gap-0.5">
                      <div className="w-1 h-1 bg-white/50 rounded-full"></div>
                      <div className="w-1 h-1 bg-white/50 rounded-full"></div>
                      <div className="w-1 h-1 bg-white/50 rounded-full"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Tips Section */}
        <div className="mt-8 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
          <h4 className="text-sm font-medium text-white mb-2">💡 Quick Tips</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Drag nodes from here to the canvas</li>
            <li>• Connect nodes by dragging from output to input</li>
            <li>• Click nodes to configure them</li>
            <li>• Use Ctrl/Cmd + scroll to zoom</li>
            <li>• Delete nodes with Backspace/Delete</li>
          </ul>
        </div>

        {/* Version Info */}
        <div className="mt-4 text-center">
          <div className="text-xs text-gray-500">
            React Flow v2.0
          </div>
          <div className="text-xs text-green-400 font-medium">
            ✨ Professional Designer
          </div>
        </div>
      </div>
    </div>
  );
}