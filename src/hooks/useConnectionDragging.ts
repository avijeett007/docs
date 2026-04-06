import { useState, useCallback, useEffect } from 'react';

interface ConnectionDragState {
  isDragging: boolean;
  sourceNodeId: string | null;
  sourceHandle: string | null;
  sourcePosition: { x: number; y: number } | null;
  currentPosition: { x: number; y: number } | null;
}

interface UseConnectionDraggingProps {
  zoom: number;
  canvasPosition: { x: number; y: number };
  onConnectionCreate: (source: string, target: string, sourceHandle: string, targetHandle: string) => void;
}

export function useConnectionDragging({
  zoom,
  canvasPosition,
  onConnectionCreate
}: UseConnectionDraggingProps) {
  const [dragState, setDragState] = useState<ConnectionDragState>({
    isDragging: false,
    sourceNodeId: null,
    sourceHandle: null,
    sourcePosition: null,
    currentPosition: null
  });

  const startConnection = useCallback((nodeId: string, handle: string, position: { x: number; y: number }) => {
    setDragState({
      isDragging: true,
      sourceNodeId: nodeId,
      sourceHandle: handle,
      sourcePosition: position,
      currentPosition: position
    });
  }, []);

  const updateConnectionPosition = useCallback((clientX: number, clientY: number, canvasRect: DOMRect) => {
    if (!dragState.isDragging) return;

    const x = (clientX - canvasRect.left - canvasPosition.x) / zoom;
    const y = (clientY - canvasRect.top - canvasPosition.y) / zoom;

    setDragState(prev => ({
      ...prev,
      currentPosition: { x, y }
    }));
  }, [dragState.isDragging, zoom, canvasPosition]);

  const endConnection = useCallback((targetNodeId?: string, targetHandle?: string) => {
    if (dragState.isDragging && dragState.sourceNodeId && targetNodeId && targetHandle && dragState.sourceHandle) {
      if (dragState.sourceNodeId !== targetNodeId) {
        onConnectionCreate(dragState.sourceNodeId, targetNodeId, dragState.sourceHandle, targetHandle);
      }
    }

    setDragState({
      isDragging: false,
      sourceNodeId: null,
      sourceHandle: null,
      sourcePosition: null,
      currentPosition: null
    });
  }, [dragState, onConnectionCreate]);

  const cancelConnection = useCallback(() => {
    setDragState({
      isDragging: false,
      sourceNodeId: null,
      sourceHandle: null,
      sourcePosition: null,
      currentPosition: null
    });
  }, []);

  // Handle escape key to cancel connection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.isDragging) {
        cancelConnection();
      }
    };

    if (dragState.isDragging) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [dragState.isDragging, cancelConnection]);

  return {
    connectionState: dragState,
    startConnection,
    updateConnectionPosition,
    endConnection,
    cancelConnection
  };
}