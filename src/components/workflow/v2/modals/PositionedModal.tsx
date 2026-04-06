'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiMaximize, FiMinimize } from 'react-icons/fi';

interface PositionedModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodePosition?: { x: number; y: number };
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  maxHeight?: string;
}

export default function PositionedModal({
  isOpen,
  onClose,
  nodePosition,
  title,
  icon,
  children,
  maxWidth = 'w-[800px] max-w-[90vw]',
  maxHeight = 'max-h-[90vh]',
}: PositionedModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && nodePosition && !isFullscreen) {
      // Calculate optimal position near the node
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const modalWidth = 800; // Increased width for better UX
      const modalHeight = 700; // Increased height for better content display

      // Find the ReactFlow wrapper to get the canvas bounds
      const reactFlowWrapper = document.querySelector('.react-flow');
      let canvasX = nodePosition.x;
      let canvasY = nodePosition.y;

      if (reactFlowWrapper) {
        const bounds = reactFlowWrapper.getBoundingClientRect();
        // Convert canvas coordinates to screen coordinates
        canvasX = bounds.left + nodePosition.x;
        canvasY = bounds.top + nodePosition.y;
      }

      let x = canvasX + 280; // Position to the right of node
      let y = canvasY - 50; // Slightly above the node

      // Adjust if modal would go off-screen
      if (x + modalWidth > viewportWidth - 50) {
        x = canvasX - modalWidth - 20; // Position to the left
      }

      if (y + modalHeight > viewportHeight - 50) {
        y = viewportHeight - modalHeight - 50;
      }

      if (y < 50) {
        y = 50;
      }

      if (x < 50) {
        x = 50;
      }

      setModalPosition({ x, y });
    } else {
      setModalPosition(null);
    }
  }, [isOpen, nodePosition, isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!isOpen) return null;

  const modalClasses = isFullscreen
    ? "fixed inset-4 z-50"
    : `fixed z-50 ${maxWidth} ${maxHeight}`;

  const modalStyle = isFullscreen
    ? {}
    : modalPosition
    ? { left: modalPosition.x, top: modalPosition.y }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className={`${modalClasses} bg-gray-800 rounded-xl shadow-2xl border border-gray-600 overflow-hidden flex flex-col`}
        style={modalStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-600 bg-gray-800/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="text-sm text-gray-400">Configure node settings</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <FiMinimize className="w-4 h-4" /> : <FiMaximize className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}