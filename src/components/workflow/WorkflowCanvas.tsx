'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { WorkflowNode, WorkflowConnection, CanvasPosition, ValidationResult } from '@/types/workflow';
import WorkflowNodeComponent from './WorkflowNodeComponent';
import ConnectionLine from './ConnectionLine';
import { WorkflowValidator } from '@/lib/workflow/workflowValidator';
import { VAPIAgentNode } from './nodes/VAPIAgentNode';
import { RetellAgentNode } from './nodes/RetellAgentNode';
import { UltravoxAgentNode } from './nodes/UltravoxAgentNode';
import { KnovaAgentNode } from './nodes/KnovaAgentNode';
import { NoteNode } from './nodes/NoteNode';
import { useConnectionDragging } from '@/hooks/useConnectionDragging';

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  zoom: number;
  position: CanvasPosition;
  onNodeUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeSelect: (node: WorkflowNode | null) => void;
  onConnectionAdd: (connection: Omit<WorkflowConnection, 'id'>) => void;
  onConnectionDelete: (connectionId: string) => void;
  onCanvasMove: (position: CanvasPosition) => void;
  showGrid: boolean;
  gridSnap: boolean;
  onValidationChange?: (validation: ValidationResult) => void;
}

export default function WorkflowCanvas({
  nodes,
  connections,
  zoom,
  position,
  onNodeUpdate,
  onNodeDelete,
  onNodeSelect,
  onConnectionAdd,
  onConnectionDelete,
  onCanvasMove,
  showGrid,
  gridSnap,
  onValidationChange
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [], warnings: [] });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Connection create function
  const handleConnectionCreate = useCallback((source: string, target: string, sourceHandle: string, targetHandle: string) => {
    // Validate connection before adding
    const sourceNode = nodes.find(n => n.id === source);
    const targetNode = nodes.find(n => n.id === target);

    if (sourceNode && targetNode) {
      const connectionValidation = WorkflowValidator.validateNodeConnection(
        sourceNode,
        targetNode,
        sourceHandle,
        targetHandle
      );

      if (connectionValidation.isValid) {
        onConnectionAdd({
          source,
          target,
          sourceHandle,
          targetHandle
        });
      } else {
        // Show error message or visual feedback
        console.warn('Invalid connection:', connectionValidation.error);
      }
    }
  }, [nodes, onConnectionAdd]);

  // Use the connection dragging hook
  const {
    connectionState,
    startConnection,
    updateConnectionPosition,
    endConnection,
    cancelConnection
  } = useConnectionDragging({
    zoom,
    canvasPosition: position,
    onConnectionCreate: handleConnectionCreate
  });

  const gridSize = 20;

  // Real-time validation
  useEffect(() => {
    const workflowData = {
      id: 'temp',
      name: 'Temp Workflow',
      description: '',
      nodes,
      connections,
      settings: { autoSave: false, gridSnap, showGrid }
    };

    const newValidation = WorkflowValidator.validateWorkflow(workflowData);
    setValidation(newValidation);
    onValidationChange?.(newValidation);
  }, [nodes, connections, gridSnap, showGrid, onValidationChange]);

  // Render appropriate node component based on type
  const renderNodeComponent = (node: WorkflowNode) => {
    const baseProps = {
      node,
      isSelected: selectedNodeId === node.id,
      zoom,
      onConfigClick: (nodeId: string) => {
        // TODO: Open configuration modal
        console.log('Configure node:', nodeId);
      },
      onSelect: () => handleNodeSelect(node),
      onConnectionStart: startConnection,
      onConnectionEnd: (nodeId: string, handle: string) => {
        endConnection(nodeId, handle);
      }
    };

    switch (node.type) {
      case 'vapi-agent':
        return <VAPIAgentNode
          key={node.id}
          {...baseProps}
          isDragging={false}
          onUpdate={(nodeId: string, data: Partial<WorkflowNode['data']>) => {
            const currentNode = nodes.find(n => n.id === nodeId);
            if (currentNode) {
              onNodeUpdate(nodeId, { data: { ...currentNode.data, ...data } });
            }
          }}
        />;
      case 'retell-agent':
        return <RetellAgentNode
          key={node.id}
          {...baseProps}
          isDragging={false}
          onUpdate={(nodeId: string, data: Partial<WorkflowNode['data']>) => {
            const currentNode = nodes.find(n => n.id === nodeId);
            if (currentNode) {
              onNodeUpdate(nodeId, { data: { ...currentNode.data, ...data } });
            }
          }}
        />;
      case 'ultravox-agent':
        return <UltravoxAgentNode
          key={node.id}
          {...baseProps}
          isDragging={false}
          onUpdate={(nodeId: string, data: Partial<WorkflowNode['data']>) => {
            const currentNode = nodes.find(n => n.id === nodeId);
            if (currentNode) {
              onNodeUpdate(nodeId, { data: { ...currentNode.data, ...data } });
            }
          }}
        />;
      case 'knova-agent':
        return <KnovaAgentNode
          key={node.id}
          {...baseProps}
          onUpdate={(nodeId: string, updates: Partial<WorkflowNode>) => {
            onNodeUpdate(nodeId, updates);
          }}
        />;
      case 'note':
        return <NoteNode
          key={node.id}
          {...baseProps}
          isDragging={false}
          onUpdate={(nodeId: string, data: Partial<WorkflowNode['data']>) => {
            const currentNode = nodes.find(n => n.id === nodeId);
            if (currentNode) {
              onNodeUpdate(nodeId, { data: { ...currentNode.data, ...data } });
            }
          }}
        />;
      default:
        // Fallback to original WorkflowNodeComponent for other types
        const nodeErrors = validation.errors.filter(error => error.nodeId === node.id);
        const nodeWarnings = validation.warnings.filter(warning => warning.nodeId === node.id);
        const hasErrors = nodeErrors.length > 0;
        const hasWarnings = nodeWarnings.length > 0;

        return (
          <WorkflowNodeComponent
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            hasErrors={hasErrors}
            hasWarnings={hasWarnings}
            isConnectionTarget={connectionState.isDragging && connectionState.sourceNodeId !== node.id}
            isValidConnectionTarget={connectionState.isDragging && connectionState.sourceNodeId ? (() => {
              const sourceNode = nodes.find(n => n.id === connectionState.sourceNodeId);
              if (!sourceNode) return false;
              const connectionValidation = WorkflowValidator.validateNodeConnection(sourceNode, node);
              return connectionValidation.isValid;
            })() : false}
            zoom={zoom}
            onDrag={(position) => {
              const snappedPosition = {
                x: snapToGrid(position.x),
                y: snapToGrid(position.y)
              };
              onNodeUpdate(node.id, { position: snappedPosition });
            }}
            onSelect={() => handleNodeSelect(node)}
            onDelete={() => onNodeDelete(node.id)}
            onConnectionStart={startConnection}
            onConnectionEnd={(nodeId: string, handle: string) => {
              endConnection(nodeId, handle);
            }}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          />
        );
    }
  };

  const snapToGrid = useCallback((value: number) => {
    if (!gridSnap) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [gridSnap]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start panning if clicking on the canvas itself
    if (e.target === canvasRef.current && e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      setSelectedNodeId(null);
      onNodeSelect(null);
      e.preventDefault();
    }
  }, [position, onNodeSelect]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const newPosition = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      };
      onCanvasMove(newPosition);
    }

    // Update connection position during drag
    if (connectionState.isDragging && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      updateConnectionPosition(e.clientX, e.clientY, rect);
    }
  }, [isPanning, panStart, onCanvasMove, connectionState.isDragging, updateConnectionPosition]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    if (connectionState.isDragging) {
      cancelConnection();
    }
  }, [connectionState.isDragging, cancelConnection]);

  const handleNodeSelect = useCallback((node: WorkflowNode) => {
    setSelectedNodeId(node.id);
    onNodeSelect(node);
  }, [onNodeSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/reactflow');
    if (nodeType && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const dropPosition = {
        x: snapToGrid((e.clientX - rect.left - position.x) / zoom),
        y: snapToGrid((e.clientY - rect.top - position.y) / zoom)
      };

      // Create new node using NodeFactory
      import('@/lib/workflow/nodeFactory').then(({ NodeFactory }) => {
        const newNode = NodeFactory.createNode(nodeType, dropPosition);
        if (newNode) {
          onNodeUpdate(newNode.id, newNode);
        }
      });
    }
  }, [snapToGrid, zoom, position, onNodeUpdate]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Global mouse event handlers
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Update connection position during drag
      if (connectionState.isDragging && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        updateConnectionPosition(e.clientX, e.clientY, rect);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      if (connectionState.isDragging) {
        cancelConnection();
      }
    };

    if (connectionState.isDragging || isPanning) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [connectionState.isDragging, isPanning, updateConnectionPosition, cancelConnection]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-900">
      {/* Grid Background */}
      {showGrid && (
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, #374151 1px, transparent 1px),
              linear-gradient(to bottom, #374151 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
            backgroundPosition: `${position.x}px ${position.y}px`
          }}
        />
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`
          absolute inset-0 transition-all duration-200 ease-out
          ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}
        `}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          backgroundImage: showGrid ? `
            radial-gradient(circle, #4b5563 1px, transparent 1px),
            linear-gradient(90deg, rgba(75, 85, 99, 0.1) 1px, transparent 1px),
            linear-gradient(rgba(75, 85, 99, 0.1) 1px, transparent 1px)
          ` : 'none',
          backgroundSize: showGrid ?
            `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px` :
            'auto'
        }}
      >
        {/* Connections */}
        <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
          {connections.map((connection) => {
            const sourceNode = nodes.find(n => n.id === connection.source);
            const targetNode = nodes.find(n => n.id === connection.target);
            
            if (!sourceNode || !targetNode) return null;

            return (
              <ConnectionLine
                key={connection.id}
                id={connection.id}
                sourcePosition={{
                  x: sourceNode.position.x + 150, // Node width / 2
                  y: sourceNode.position.y + 40   // Node height / 2
                }}
                targetPosition={{
                  x: targetNode.position.x,
                  y: targetNode.position.y + 40
                }}
                isSelected={false}
                onDelete={() => onConnectionDelete(connection.id)}
              />
            );
          })}

          {/* Temporary connection while dragging */}
          {connectionState.isDragging && connectionState.sourcePosition && connectionState.currentPosition && (
            <ConnectionLine
              id="temp"
              sourcePosition={connectionState.sourcePosition}
              targetPosition={connectionState.currentPosition}
              isSelected={false}
              isTemporary={true}
              onDelete={() => {}}
            />
          )}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => renderNodeComponent(node))}
      </div>

      {/* Canvas Info */}
      <div className="absolute bottom-4 left-4 bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-400">
        <div>Zoom: {Math.round(zoom * 100)}%</div>
        <div>Position: {Math.round(position.x)}, {Math.round(position.y)}</div>
        <div>Nodes: {nodes.length}</div>
        <div>Connections: {connections.length}</div>
      </div>

      {/* Validation Status */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="absolute bottom-4 right-4 bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs max-w-xs">
          {validation.errors.length > 0 && (
            <div className="text-red-400 mb-2">
              <div className="font-medium mb-1">Errors ({validation.errors.length}):</div>
              {validation.errors.slice(0, 3).map((error, index) => (
                <div key={index} className="text-xs">• {error.message}</div>
              ))}
              {validation.errors.length > 3 && (
                <div className="text-xs">• ... and {validation.errors.length - 3} more</div>
              )}
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="text-amber-400">
              <div className="font-medium mb-1">Warnings ({validation.warnings.length}):</div>
              {validation.warnings.slice(0, 2).map((warning, index) => (
                <div key={index} className="text-xs">• {warning.message}</div>
              ))}
              {validation.warnings.length > 2 && (
                <div className="text-xs">• ... and {validation.warnings.length - 2} more</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-500">
            <div className="text-lg mb-2">🎨 Start Building Your Workflow</div>
            <div className="text-sm">Drag nodes from the palette or click to add them</div>
            <div className="text-xs mt-2">Use mouse wheel to zoom • Drag to pan</div>
          </div>
        </div>
      )}
    </div>
  );
}
