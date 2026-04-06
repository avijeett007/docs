import React from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  provider: string;
  isAssigned: boolean;
  hasAgentAssignment: boolean;
}

interface UnassignAgentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  phoneNumber: PhoneNumber | null;
  isLoading?: boolean;
}

export default function UnassignAgentConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  phoneNumber,
  isLoading = false
}: UnassignAgentConfirmModalProps) {
  if (!isOpen || !phoneNumber) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <FiAlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              Unassign Agent
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-300 mb-4">
            Are you sure you want to unassign the agent from{' '}
            <span className="font-semibold text-white">{phoneNumber.phoneNumber}</span>?
          </p>
          
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-200">
                <p className="font-medium mb-1">This action will:</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-300">
                  <li>Remove the phone number from Retell</li>
                  <li>Make the number available for reassignment</li>
                  <li>Stop routing calls to the current agent</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Unassigning...
              </>
            ) : (
              'Unassign Agent'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
