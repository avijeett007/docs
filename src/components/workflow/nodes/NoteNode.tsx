import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiEdit3, FiType, FiDroplet, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { WorkflowNode, NoteNodeData } from '@/types/workflow';

interface NoteNodeProps {
  node: WorkflowNode;
  onUpdate: (nodeId: string, data: Partial<WorkflowNode['data']>) => void;
  onDrag?: (position: { x: number; y: number }) => void;
  onSelect?: () => void;
  isSelected: boolean;
  isDragging: boolean;
  zoom?: number;
}

export const NoteNode: React.FC<NoteNodeProps> = ({
  node,
  onUpdate,
  onDrag,
  onSelect,
  isSelected,
  isDragging,
  zoom = 1
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isNodeDragging, setIsNodeDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const noteData: NoteNodeData = {
    content: node.data.config?.content || 'Double-click to edit this note...',
    backgroundColor: node.data.config?.backgroundColor || '#fbbf24',
    textColor: node.data.config?.textColor || '#000000',
    fontSize: node.data.config?.fontSize || 'medium',
    width: node.data.config?.width || 280,
    height: node.data.config?.height || 160
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Dragging functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || isEditing) return;

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
  }, [node.position, zoom, onSelect, isEditing]);

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

  const handleContentChange = (content: string) => {
    onUpdate(node.id, {
      config: { ...node.data.config, content }
    });
  };

  const handleStyleChange = (key: keyof NoteNodeData, value: any) => {
    onUpdate(node.id, {
      config: { ...node.data.config, [key]: value }
    });
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const getFontSizeClass = () => {
    switch (noteData.fontSize) {
      case 'small': return 'text-xs';
      case 'large': return 'text-base';
      default: return 'text-sm';
    }
  };

  const backgroundColors = [
    { name: 'Yellow', value: '#fbbf24' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Gray', value: '#6b7280' }
  ];

  return (
    <div
      ref={nodeRef}
      className={`
        relative rounded-lg shadow-lg border-2 transition-all duration-200 resize overflow-hidden select-none
        ${isSelected ? 'border-yellow-400 shadow-yellow-400/50' : 'border-yellow-300/50'}
        ${isDragging || isNodeDragging ? 'scale-105 shadow-xl cursor-grabbing' : 'hover:shadow-xl cursor-grab'}
      `}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        backgroundColor: noteData.backgroundColor,
        width: `${noteData.width}px`,
        height: `${noteData.height}px`,
        minWidth: '200px',
        minHeight: '120px',
        maxWidth: '500px',
        maxHeight: '400px',
        zIndex: isSelected ? 1000 : 1
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Controls */}
      {showControls && !isEditing && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/20 rounded-lg p-1">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-black/60 hover:text-black hover:bg-white/20 rounded transition-colors"
            title="Edit note"
          >
            <FiEdit3 className="w-3 h-3" />
          </button>
          
          {/* Font Size */}
          <select
            value={noteData.fontSize}
            onChange={(e) => handleStyleChange('fontSize', e.target.value)}
            className="text-xs bg-white/20 border-none rounded px-1 py-0.5 text-black"
            title="Font size"
          >
            <option value="small">S</option>
            <option value="medium">M</option>
            <option value="large">L</option>
          </select>

          {/* Color Picker */}
          <div className="relative group">
            <button className="p-1 text-black/60 hover:text-black hover:bg-white/20 rounded transition-colors">
              <FiDroplet className="w-3 h-3" />
            </button>
            <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <div className="grid grid-cols-4 gap-1">
                {backgroundColors.map(color => (
                  <button
                    key={color.value}
                    onClick={() => handleStyleChange('backgroundColor', color.value)}
                    className="w-6 h-6 rounded border-2 border-gray-200 hover:border-gray-400 transition-colors"
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-3 h-full">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={noteData.content}
            onChange={(e) => handleContentChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`
              w-full h-full bg-transparent border-none outline-none resize-none
              ${getFontSizeClass()}
            `}
            style={{ color: noteData.textColor }}
            placeholder="Enter your note here..."
          />
        ) : (
          <div
            className={`
              w-full h-full cursor-text whitespace-pre-wrap break-words
              ${getFontSizeClass()}
            `}
            style={{ color: noteData.textColor }}
            onDoubleClick={handleDoubleClick}
          >
            {noteData.content}
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize">
        <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-black/30"></div>
      </div>

      {/* Note Icon */}
      <div className="absolute -top-2 -left-2">
        <div className="w-6 h-6 bg-yellow-400 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
          <span className="text-xs">📝</span>
        </div>
      </div>
    </div>
  );
};
