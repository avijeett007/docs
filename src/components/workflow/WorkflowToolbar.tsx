'use client';

import React from 'react';
import { FiSave, FiPlay, FiPause, FiDownload, FiUpload, FiSettings, FiGrid, FiZoomIn, FiZoomOut } from 'react-icons/fi';

interface WorkflowToolbarProps {
  onSave: () => void;
  onTest: () => void;
  onExport: () => void;
  onImport: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleGrid: () => void;
  showGrid: boolean;
  zoom: number;
  isSaving?: boolean;
}

export default function WorkflowToolbar({
  onSave,
  onTest,
  onExport,
  onImport,
  onZoomIn,
  onZoomOut,
  onToggleGrid,
  showGrid,
  zoom,
  isSaving = false
}: WorkflowToolbarProps) {
  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
      {/* Left side - Main actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white text-sm transition-colors"
        >
          <FiSave className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </button>

        <button
          onClick={onTest}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors"
        >
          <FiPlay className="w-4 h-4" />
          Test
        </button>

        <div className="w-px h-6 bg-gray-600 mx-2" />

        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
        >
          <FiDownload className="w-4 h-4" />
          Export
        </button>

        <button
          onClick={onImport}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
        >
          <FiUpload className="w-4 h-4" />
          Import
        </button>
      </div>

      {/* Right side - View controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleGrid}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showGrid 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
        >
          <FiGrid className="w-4 h-4" />
          Grid
        </button>

        <div className="flex items-center gap-1 bg-gray-700 rounded-lg">
          <button
            onClick={onZoomOut}
            className="p-1.5 hover:bg-gray-600 rounded-l-lg transition-colors"
          >
            <FiZoomOut className="w-4 h-4 text-white" />
          </button>
          <span className="px-2 text-sm text-white min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            className="p-1.5 hover:bg-gray-600 rounded-r-lg transition-colors"
          >
            <FiZoomIn className="w-4 h-4 text-white" />
          </button>
        </div>

        <button
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
        >
          <FiSettings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </div>
  );
}
