import { useState, useCallback, useEffect } from 'react';

interface DragState {
  isDragging: boolean;
  dragOffset: { x: number; y: number };
}

interface UseNodeDraggingProps {
  position: { x: number; y: number };
  zoom: number;
  onPositionChange: (position: { x: number; y: number }) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  enabled?: boolean;
}

export function useNodeDragging({
  position,
  zoom,
  onPositionChange,
  onDragStart,
  onDragEnd,
  enabled = true
}: UseNodeDraggingProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enabled || e.button !== 0) return;

    // Check if we should prevent dragging (e.g., clicking on interactive elements)
    const target = e.target as HTMLElement;
    const isInteractive = 
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
      target.classList.contains('connection-point') ||
      target.closest('.no-drag') ||
      target.classList.contains('no-drag');

    if (isInteractive) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDragState({
      isDragging: true,
      dragOffset: { x: offsetX, y: offsetY }
    });

    onDragStart?.();
  }, [enabled, onDragStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging) return;

    e.preventDefault();

    // Calculate new position based on mouse coordinates and initial offset
    const newX = (e.clientX - dragState.dragOffset.x) / zoom;
    const newY = (e.clientY - dragState.dragOffset.y) / zoom;

    onPositionChange({ x: newX, y: newY });
  }, [dragState, zoom, onPositionChange]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging) return;

    e.preventDefault();
    
    setDragState({
      isDragging: false,
      dragOffset: { x: 0, y: 0 }
    });

    onDragEnd?.();
  }, [dragState.isDragging, onDragEnd]);

  // Global event listeners for mouse move and up
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  return {
    isDragging: dragState.isDragging,
    handleMouseDown
  };
}