'use client';

import React, { useRef, useCallback } from 'react';
import { FiMoreVertical, FiTrash2, FiEdit2, FiCopy, FiSettings } from 'react-icons/fi';
import { WorkflowNode } from '@/types/workflow';
import { Menu, Transition } from '@headlessui/react';
import { useNodeDragging } from '@/hooks/useNodeDragging';

interface WorkflowNodeComponentProps {
  node: WorkflowNode;
  isSelected: boolean;
  hasErrors?: boolean;
  hasWarnings?: boolean;
  isConnectionTarget?: boolean;
  isValidConnectionTarget?: boolean;
  zoom: number;
  onDrag: (position: { x: number; y: number }) => void;
  onSelect: () => void;
  onDelete: () => void;
  onConnectionStart: (nodeId: string, handle: string, position: { x: number; y: number }) => void;
  onConnectionEnd: (nodeId: string, handle: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function WorkflowNodeComponent({
  node,
  isSelected,
  hasErrors = false,
  hasWarnings = false,
  isConnectionTarget = false,
  isValidConnectionTarget = false,
  zoom,
  onDrag,
  onSelect,
  onDelete,
  onConnectionStart,
  onConnectionEnd,
  onMouseEnter,
  onMouseLeave
}: WorkflowNodeComponentProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  
  const { isDragging, handleMouseDown } = useNodeDragging({
    position: node.position,
    zoom,
    onPositionChange: onDrag,
    onDragStart: onSelect
  });

  const getNodeColor = (nodeType: string) => {
    // Override colors based on validation state
    if (hasErrors) {
      return {
        gradient: 'from-red-600 to-red-700',
        border: 'border-red-300 shadow-red-300/50',
        connection: 'bg-red-400'
      };
    }
    if (hasWarnings) {
      return {
        gradient: 'from-yellow-600 to-yellow-700',
        border: 'border-yellow-300 shadow-yellow-300/50',
        connection: 'bg-yellow-400'
      };
    }
    if (isConnectionTarget) {
      if (isValidConnectionTarget) {
        return {
          gradient: 'from-green-600 to-green-700',
          border: 'border-green-300 shadow-green-300/50',
          connection: 'bg-green-400'
        };
      } else {
        return {
          gradient: 'from-red-600 to-red-700',
          border: 'border-red-300 shadow-red-300/50',
          connection: 'bg-red-400'
        };
      }
    }

    const colors: Record<string, { gradient: string; border: string; connection: string }> = {
      'webhook-trigger': {
        gradient: 'from-green-600 to-green-700',
        border: 'border-green-300 shadow-green-300/50',
        connection: 'bg-green-400'
      },
      'facebook': {
        gradient: 'from-blue-600 to-blue-700',
        border: 'border-blue-300 shadow-blue-300/50',
        connection: 'bg-blue-400'
      },
      'ghl': {
        gradient: 'from-purple-600 to-purple-700',
        border: 'border-purple-300 shadow-purple-300/50',
        connection: 'bg-purple-400'
      },
      'knova-agent': {
        gradient: 'from-indigo-600 to-indigo-700',
        border: 'border-indigo-300 shadow-indigo-300/50',
        connection: 'bg-indigo-400'
      },
      'n8n': {
        gradient: 'from-orange-600 to-orange-700',
        border: 'border-orange-300 shadow-orange-300/50',
        connection: 'bg-orange-400'
      },
      'info': {
        gradient: 'from-gray-600 to-gray-700',
        border: 'border-gray-300 shadow-gray-300/50',
        connection: 'bg-gray-400'
      },
      'action': {
        gradient: 'from-yellow-600 to-yellow-700',
        border: 'border-yellow-300 shadow-yellow-300/50',
        connection: 'bg-yellow-400'
      }
    };
    return colors[nodeType] || {
      gradient: 'from-gray-600 to-gray-700',
      border: 'border-gray-300 shadow-gray-300/50',
      connection: 'bg-gray-400'
    };
  };

  const getNodeIcon = (nodeType: string) => {
    const icons: Record<string, string> = {
      'webhook-trigger': '🔗',
      'facebook': '📱',
      'ghl': '🏢',
      'knova-agent': '🤖',
      'n8n': '⚡',
      'info': 'ℹ️',
      'action': '⚙️'
    };
    return icons[nodeType] || '📦';
  };

  // Connection handlers with proper event handling
  const handleConnectionMouseDown = useCallback((e: React.MouseEvent, isOutput: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isOutput) {
      const nodeRect = nodeRef.current?.getBoundingClientRect();
      if (nodeRect) {
        const handleRect = e.currentTarget.getBoundingClientRect();
        const position = {
          x: node.position.x + (handleRect.left - nodeRect.left + handleRect.width / 2) / zoom,
          y: node.position.y + (handleRect.top - nodeRect.top + handleRect.height / 2) / zoom
        };
        onConnectionStart(node.id, 'output', position);
      }
    }
  }, [node, zoom, onConnectionStart]);

  const handleConnectionMouseUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onConnectionEnd(node.id, 'input');
  }, [node.id, onConnectionEnd]);

  const hasInputs = ['facebook', 'ghl', 'knova-agent', 'n8n', 'action'].includes(node.type);
  const hasOutputs = ['webhook-trigger', 'facebook', 'ghl', 'knova-agent', 'n8n', 'info'].includes(node.type);

  const nodeColors = getNodeColor(node.type);

  return (
    <div
      ref={nodeRef}
      className={`
        relative bg-gradient-to-br ${nodeColors.gradient} rounded-lg shadow-lg border-2 transition-all duration-200
        ${isSelected ? `${nodeColors.border} ring-2 ring-offset-2 ring-offset-gray-900` : 'border-gray-500/50'}
        ${isDragging ? 'scale-105 shadow-2xl cursor-grabbing z-50' : 'hover:shadow-xl cursor-grab z-10'}
        min-w-[280px] max-w-[320px] select-none
      `}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        zIndex: isDragging ? 1000 : isSelected ? 100 : 10
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="p-4">
        {/* Input Handle */}
        {hasInputs && (
          <div
            className="connection-point absolute -left-3 top-1/2 transform -translate-y-1/2 cursor-crosshair z-20"
            onMouseUp={handleConnectionMouseUp}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className={`w-6 h-6 ${nodeColors.connection} rounded-full border-2 border-white shadow-lg hover:scale-125 transition-all duration-200 flex items-center justify-center`}>
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
        )}

        {/* Node Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative text-2xl">
              {getNodeIcon(node.type)}
              {node.type === 'knova-agent' && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-xs">⚙️</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-white truncate">
                {node.data.name}
              </h3>
              <p className="text-xs text-gray-400 line-clamp-2">
                {node.data.description}
              </p>
            </div>
          </div>

          {/* Node Menu */}
          <Menu as="div" className="relative">
            <Menu.Button className="no-drag p-1 hover:bg-gray-700 rounded transition-colors">
              <FiMoreVertical className="w-4 h-4 text-gray-400" />
            </Menu.Button>
            <Transition
              as={React.Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
                <div className="py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect();
                        }}
                        className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-left ${
                          active ? 'bg-gray-700 text-white' : 'text-gray-300'
                        }`}
                      >
                        <FiSettings className="w-4 h-4" />
                        Configure
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-left ${
                          active ? 'bg-gray-700 text-white' : 'text-gray-300'
                        }`}
                      >
                        <FiEdit2 className="w-4 h-4" />
                        Rename
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-left ${
                          active ? 'bg-gray-700 text-white' : 'text-gray-300'
                        }`}
                      >
                        <FiCopy className="w-4 h-4" />
                        Duplicate
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                        }}
                        className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-left ${
                          active ? 'bg-red-600 text-white' : 'text-red-400'
                        }`}
                      >
                        <FiTrash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>

        {/* Node Status */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${
              hasErrors ? 'bg-red-400' :
              hasWarnings ? 'bg-yellow-400' :
              'bg-green-400'
            }`}></div>
            <span className="text-xs text-gray-400">
              {hasErrors ? 'Error' : hasWarnings ? 'Warning' : 'Ready'}
            </span>
          </div>
          {node.data.isPublic && (
            <div className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
              Public
            </div>
          )}
          {isConnectionTarget && (
            <div className={`px-2 py-0.5 rounded text-xs ${
              isValidConnectionTarget
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {isValidConnectionTarget ? 'Valid Target' : 'Invalid Target'}
            </div>
          )}
        </div>

        {/* Configuration Indicators */}
        {Object.keys(node.data.config).length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            {Object.keys(node.data.config).length} setting{Object.keys(node.data.config).length !== 1 ? 's' : ''} configured
          </div>
        )}

        {/* Output Handle */}
        {hasOutputs && (
          <div
            className="connection-point absolute -right-3 top-1/2 transform -translate-y-1/2 cursor-crosshair z-20"
            onMouseDown={(e) => handleConnectionMouseDown(e, true)}
          >
            <div className={`w-6 h-6 ${nodeColors.connection} rounded-full border-2 border-white shadow-lg hover:scale-125 transition-all duration-200 flex items-center justify-center`}>
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}