import React, { ReactNode } from 'react';
import { WorkflowNode } from '@/types/workflow';
import { useNodeDragging } from '@/hooks/useNodeDragging';
import { FiSettings } from 'react-icons/fi';

interface BaseNodeProps {
  node: WorkflowNode;
  isSelected: boolean;
  zoom: number;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onSelect: () => void;
  onConnectionStart: (nodeId: string, handle: string, position: { x: number; y: number }) => void;
  onConnectionEnd: (nodeId: string, handle: string) => void;
  onConfigClick?: () => void;
  
  // Customization
  color: {
    gradient: string;
    border: string;
    connection: string;
  };
  icon: ReactNode;
  title: string;
  subtitle?: string;
  showInput?: boolean;
  showOutput?: boolean;
  children?: ReactNode;
  minWidth?: string;
  maxWidth?: string;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  node,
  isSelected,
  zoom,
  onUpdate,
  onSelect,
  onConnectionStart,
  onConnectionEnd,
  onConfigClick,
  color,
  icon,
  title,
  subtitle,
  showInput = true,
  showOutput = true,
  children,
  minWidth = 'min-w-[280px]',
  maxWidth = 'max-w-[320px]'
}) => {
  const { isDragging, handleMouseDown } = useNodeDragging({
    position: node.position,
    zoom,
    onPositionChange: (newPosition) => {
      onUpdate(node.id, { position: newPosition });
    },
    onDragStart: onSelect
  });

  const handleInputMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    onConnectionEnd(node.id, 'input');
  };

  const handleInputMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConnectionEnd(node.id, 'input');
  };

  const handleOutputMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nodeElement = e.currentTarget.closest('.workflow-node');
    if (nodeElement) {
      const rect = nodeElement.getBoundingClientRect();
      const outputRect = e.currentTarget.getBoundingClientRect();
      const relativeX = outputRect.left - rect.left + outputRect.width / 2;
      const relativeY = outputRect.top - rect.top + outputRect.height / 2;
      
      onConnectionStart(node.id, 'output', {
        x: node.position.x + relativeX / zoom,
        y: node.position.y + relativeY / zoom
      });
    }
  };

  return (
    <div
      className={`
        workflow-node
        absolute rounded-lg shadow-lg border-2 transition-all duration-200
        bg-gradient-to-br ${color.gradient}
        ${isSelected ? `${color.border} ring-2 ring-offset-2 ring-offset-gray-900` : 'border-gray-500/50'}
        ${isDragging ? 'scale-105 shadow-2xl cursor-grabbing z-50' : 'hover:shadow-xl cursor-grab z-10'}
        ${minWidth} ${maxWidth}
        select-none
      `}
      style={{
        left: node.position.x,
        top: node.position.y,
        zIndex: isDragging ? 1000 : isSelected ? 100 : 10
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Input Connection Point */}
      {showInput && (
        <div
          className="connection-point absolute -left-3 top-1/2 transform -translate-y-1/2 z-20"
          onMouseDown={handleInputMouseDown}
          onMouseUp={handleInputMouseUp}
        >
          <div className={`
            w-6 h-6 ${color.connection} rounded-full 
            border-2 border-white shadow-lg 
            hover:scale-125 transition-all duration-200 
            cursor-crosshair
            flex items-center justify-center
          `}>
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        </div>
      )}

      {/* Node Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-shrink-0">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
              {subtitle && (
                <p className="text-xs text-gray-200 opacity-80 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {onConfigClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConfigClick();
              }}
              className="no-drag p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <FiSettings className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Custom Content */}
        {children}
      </div>

      {/* Output Connection Point */}
      {showOutput && (
        <div
          className="connection-point absolute -right-3 top-1/2 transform -translate-y-1/2 z-20"
          onMouseDown={handleOutputMouseDown}
        >
          <div className={`
            w-6 h-6 ${color.connection} rounded-full 
            border-2 border-white shadow-lg 
            hover:scale-125 transition-all duration-200 
            cursor-crosshair
            flex items-center justify-center
          `}>
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};