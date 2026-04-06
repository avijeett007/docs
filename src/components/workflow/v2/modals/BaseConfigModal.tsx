'use client';

import React from 'react';
import { FiX, FiSave, FiRotateCcw } from 'react-icons/fi';

interface BaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  canSave?: boolean;
  onReset?: () => void;
}

export default function BaseConfigModal({
  isOpen,
  onClose,
  onSave,
  title,
  icon,
  children,
  canSave = true,
  onReset,
}: BaseConfigModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 rounded-xl shadow-2xl border border-gray-600 w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="text-sm text-gray-400">Configure node settings</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {children}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-600 bg-gray-800/50">
          <div className="flex items-center gap-2">
            {onReset && (
              <button
                onClick={onReset}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <FiRotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!canSave}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                canSave
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              <FiSave className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}