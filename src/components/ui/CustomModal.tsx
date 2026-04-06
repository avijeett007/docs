'use client';

import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiAlertTriangle, FiInfo, FiCheckCircle, FiX, FiAlertCircle } from 'react-icons/fi';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

export default function CustomModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = false
}: CustomModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <FiAlertTriangle className="w-6 h-6 text-amber-400" />;
      case 'error':
        return <FiAlertCircle className="w-6 h-6 text-red-400" />;
      case 'success':
        return <FiCheckCircle className="w-6 h-6 text-green-400" />;
      case 'confirm':
        return <FiAlertTriangle className="w-6 h-6 text-blue-400" />;
      default:
        return <FiInfo className="w-6 h-6 text-blue-400" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/20',
          button: 'bg-yellow-600 hover:bg-yellow-700'
        };
      case 'error':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          button: 'bg-red-600 hover:bg-red-700'
        };
      case 'success':
        return {
          bg: 'bg-green-500/10',
          border: 'border-green-500/20',
          button: 'bg-green-600 hover:bg-green-700'
        };
      case 'confirm':
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          button: 'bg-blue-600 hover:bg-blue-700'
        };
      default:
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          button: 'bg-blue-600 hover:bg-blue-700'
        };
    }
  };

  const colors = getColors();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-900 border border-gray-700 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colors.bg} ${colors.border} border`}>
                      {getIcon()}
                    </div>
                    <Dialog.Title as="h3" className="text-lg font-medium text-white">
                      {title}
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-1 text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {message}
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  {showCancel && (
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                      onClick={onClose}
                    >
                      {cancelText}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${colors.button}`}
                    onClick={handleConfirm}
                  >
                    {confirmText}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
