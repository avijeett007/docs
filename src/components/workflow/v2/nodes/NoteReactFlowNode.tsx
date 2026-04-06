'use client';

import React, { useState, useRef } from 'react';
import { NodeProps } from 'reactflow';
import { FiEdit3, FiTrash2, FiFileText, FiSettings } from 'react-icons/fi';
import { WorkflowNode } from '@/types/workflow';
import NoteConfigModal from '../modals/NoteConfigModal';

interface NoteNodeData {
  name: string;
  description: string;
  config: {
    content?: string;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
  };
  onUpdate?: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onSelect?: (node: any) => void;
  onDelete?: (nodeId: string) => void;
}

export default function NoteReactFlowNode({ 
  id, 
  data, 
  selected 
}: NodeProps<NoteNodeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(data.config?.content || 'Double-click to edit...');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const nodeConfig = data.config || {};
  const content = nodeConfig.content || 'Double-click to edit...';
  const backgroundColor = nodeConfig.backgroundColor || '#fbbf24';
  const textColor = nodeConfig.textColor || '#000000';
  const fontSize = nodeConfig.fontSize || 'medium';

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditContent(content);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 0);
  };

  const handleSave = () => {
    if (data.onUpdate) {
      data.onUpdate(id, {
        data: {
          ...data,
          config: {
            ...nodeConfig,
            content: editContent
          }
        }
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

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

  const handleNodeClick = () => {
    if (data.onSelect) {
      data.onSelect({ id, data });
    }
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-xs';
      case 'large': return 'text-base';
      default: return 'text-sm';
    }
  };

  return (
    <div
      className={`
        relative rounded-lg shadow-lg border-2 transition-all duration-200 select-none
        min-w-[250px] max-w-[400px] min-h-[120px]
        ${selected 
          ? 'border-yellow-400 shadow-yellow-400/50 ring-2 ring-yellow-400/30' 
          : 'border-yellow-300/50 hover:border-yellow-400/70'
        }
        ${isHovered ? 'shadow-xl scale-[1.02]' : ''}
      `}
      style={{ backgroundColor }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleNodeClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Action Buttons */}
      {isHovered && !isEditing && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/20 rounded-lg p-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDoubleClick();
            }}
            className="p-1 text-black/60 hover:text-black hover:bg-white/20 rounded transition-colors"
            title="Edit Note"
          >
            <FiEdit3 className="w-3 h-3" />
          </button>

          <button
            onClick={handleConfigClick}
            className="p-1 text-black/60 hover:text-black hover:bg-white/20 rounded transition-colors"
            title="Configure Note"
          >
            <FiSettings className="w-3 h-3" />
          </button>
          
          <button
            onClick={handleDeleteClick}
            className="p-1 text-red-600/60 hover:text-red-600 hover:bg-white/20 rounded transition-colors"
            title="Delete Note"
          >
            <FiTrash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-4 h-full">
        {isEditing ? (
          <div className="h-full flex flex-col">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`
                w-full flex-1 bg-transparent border-none outline-none resize-none
                ${getFontSizeClass()}
              `}
              style={{ color: textColor }}
              placeholder="Enter your note here..."
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSave}
                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
              >
                Save (Ctrl+Enter)
              </button>
              <button
                onClick={handleCancel}
                className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
              >
                Cancel (Esc)
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`
              w-full h-full whitespace-pre-wrap break-words cursor-text
              ${getFontSizeClass()}
            `}
            style={{ color: textColor }}
          >
            {content}
          </div>
        )}
      </div>

      {/* Note Icon */}
      <div className="absolute -top-2 -left-2">
        <div className="bg-yellow-500 text-white p-1.5 rounded-full shadow-lg">
          <FiFileText className="w-3 h-3" />
        </div>
      </div>

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none animate-pulse"></div>
      )}

      {/* Configuration Modal */}
      <NoteConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleConfigSave}
        initialConfig={nodeConfig}
      />
    </div>
  );
}