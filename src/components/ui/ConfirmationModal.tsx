'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertTriangle, FiTrash2, FiCheck } from 'react-icons/fi';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false
}: ConfirmationModalProps) {
  const typeConfig = {
    danger: {
      icon: FiTrash2,
      iconColor: 'text-red-400',
      iconBg: 'bg-red-500/20',
      confirmBg: 'bg-red-600 hover:bg-red-700',
      borderColor: 'border-red-500/20'
    },
    warning: {
      icon: FiAlertTriangle,
      iconColor: 'text-yellow-400',
      iconBg: 'bg-yellow-500/20',
      confirmBg: 'bg-yellow-600 hover:bg-yellow-700',
      borderColor: 'border-yellow-500/20'
    },
    info: {
      icon: FiCheck,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
      confirmBg: 'bg-blue-600 hover:bg-blue-700',
      borderColor: 'border-blue-500/20'
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full max-w-md bg-gray-900 border ${config.borderColor} rounded-xl shadow-2xl`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.iconBg}`}>
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                disabled={isLoading}
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-300 leading-relaxed">{message}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${config.confirmBg}`}
              >
                {isLoading ? 'Processing...' : confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
