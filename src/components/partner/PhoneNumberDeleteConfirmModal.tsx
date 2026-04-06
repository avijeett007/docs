import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FiX, FiAlertTriangle, FiTrash2 } from 'react-icons/fi';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  provider: string;
  isImported: boolean;
  monthlyRecurringCost?: number;
}

interface PhoneNumberDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: PhoneNumber | null;
  onDeleteComplete: () => void;
}

export default function PhoneNumberDeleteConfirmModal({
  isOpen,
  onClose,
  phoneNumber,
  onDeleteComplete
}: PhoneNumberDeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !phoneNumber) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/phone-numbers/${phoneNumber.id}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Phone number deleted successfully');
        onDeleteComplete();
        onClose();
      } else {
        const error = await response.json();
        toast.error(`Failed to delete phone number: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting phone number:', error);
      toast.error('Failed to delete phone number');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FiAlertTriangle className="w-5 h-5 text-red-400" />
            Delete Phone Number
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
            disabled={isDeleting}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-300 font-medium mb-1">Warning: This action cannot be undone</p>
                <p className="text-red-200 text-sm">
                  This will permanently delete the phone number from our database only.
                  The number will no longer be available for use in your account.
                </p>
              </div>
            </div>
          </div>

          {/* Billing Warning for chargeable numbers */}
          {!phoneNumber.isImported && phoneNumber.monthlyRecurringCost && phoneNumber.monthlyRecurringCost > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <FiAlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-yellow-300 font-medium mb-1">Billing Notice</p>
                  <p className="text-yellow-200 text-sm">
                    This number has a monthly charge of ${(phoneNumber.monthlyRecurringCost / 100).toFixed(2)}.
                    You will not receive a refund for the current billing period.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-sm">Phone Number</label>
              <p className="text-white font-medium">{phoneNumber.phoneNumber}</p>
            </div>
            
            {phoneNumber.friendlyName && (
              <div>
                <label className="text-gray-400 text-sm">Friendly Name</label>
                <p className="text-white">{phoneNumber.friendlyName}</p>
              </div>
            )}

            <div>
              <label className="text-gray-400 text-sm">Provider</label>
              <p className="text-white capitalize">
                {phoneNumber.provider.replace('imported_', '').replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Deleting...
              </>
            ) : (
              <>
                <FiTrash2 className="w-4 h-4" />
                Delete Phone Number
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
