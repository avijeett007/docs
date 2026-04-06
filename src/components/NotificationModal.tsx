'use client';

import React from 'react';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiX, FiAlertTriangle, FiInfo } from 'react-icons/fi';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  buttonText?: string;
}

export default function NotificationModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'success',
  buttonText = 'OK'
}: NotificationModalProps) {
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: <FiCheck className="w-6 h-6 text-green-500" />,
          iconBg: 'bg-green-100',
          button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
        };
      case 'error':
        return {
          icon: <FiX className="w-6 h-6 text-red-500" />,
          iconBg: 'bg-red-100',
          button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
        };
      case 'warning':
        return {
          icon: <FiAlertTriangle className="w-6 h-6 text-amber-500" />,
          iconBg: 'bg-yellow-100',
          button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
        };
      case 'info':
        return {
          icon: <FiInfo className="w-6 h-6 text-blue-500" />,
          iconBg: 'bg-blue-100',
          button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        };
      default:
        return {
          icon: <FiCheck className="w-6 h-6 text-green-500" />,
          iconBg: 'bg-green-100',
          button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
        };
    }
  };

  const typeStyles = getTypeStyles();

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          open={isOpen}
          onClose={onClose}
          className="fixed inset-0 z-50"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              as={motion.div}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: {
                  type: "spring",
                  damping: 25,
                  stiffness: 300
                }
              }}
              exit={{
                opacity: 0,
                y: 20,
                scale: 0.95,
                transition: {
                  duration: 0.2
                }
              }}
              className="relative bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl border border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>

              <div className="flex items-start space-x-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${typeStyles.iconBg}`}>
                  {typeStyles.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <Dialog.Title className="text-lg font-semibold text-white mb-2">
                    {title}
                  </Dialog.Title>
                  
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {message}
                  </p>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={onClose}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 transition-colors ${typeStyles.button}`}
                >
                  {buttonText}
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
