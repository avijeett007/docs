'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiPhone, FiCheck, FiAlertCircle } from 'react-icons/fi';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  provider: string;
  status: string;
  customer: {
    id: string;
    name: string;
    email: string;
    subaccountStatus?: string;
  } | null;
  isAssigned: boolean;
}

interface PhoneNumberSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  onPhoneNumberAssigned: (phoneNumber: PhoneNumber) => void;
}

export default function PhoneNumberSelectionModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  onPhoneNumberAssigned
}: PhoneNumberSelectionModalProps) {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadPhoneNumbers();
      setSelectedPhoneNumberId('');
      setError('');
    }
  }, [isOpen, customerId]);

  const loadPhoneNumbers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      const response = await fetch('/api/partner/phone-numbers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch phone numbers');
      }

      const data = await response.json();

      // Filter phone numbers that are either unassigned or assigned to this customer
      const availableNumbers = (data.phoneNumbers || []).filter((number: PhoneNumber) =>
        !number.customer || (number.customer && number.customer.id === customerId)
      );

      setPhoneNumbers(availableNumbers);
      
      // Pre-select if customer already has a number assigned
      const customerNumber = availableNumbers.find((number: PhoneNumber) => 
        number.customer && number.customer.id === customerId
      );
      if (customerNumber) {
        setSelectedPhoneNumberId(customerNumber.id);
      }
      
    } catch (error) {
      console.error('Error loading phone numbers:', error);
      setError('Failed to load phone numbers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPhoneNumber = async () => {
    if (!selectedPhoneNumberId) {
      setError('Please select a phone number');
      return;
    }

    const selectedNumber = phoneNumbers.find(num => num.id === selectedPhoneNumberId);
    if (!selectedNumber) {
      setError('Selected phone number not found');
      return;
    }

    // If the number is already assigned to this customer, no need to reassign
    if (selectedNumber.customer && selectedNumber.customer.id === customerId) {
      onPhoneNumberAssigned(selectedNumber);
      onClose();
      return;
    }

    setAssigning(true);
    setError('');

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      const response = await fetch(`/api/partner/phone-numbers/${selectedPhoneNumberId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: customerId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign phone number');
      }

      const data = await response.json();
      onPhoneNumberAssigned(data.data.phoneNumber);
      onClose();

    } catch (error) {
      console.error('Error assigning phone number:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign phone number. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-white flex items-center gap-2">
              <FiPhone className="w-5 h-5 text-orange-500" />
              Select Phone Number
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-gray-300 text-sm">
              Select a phone number for <span className="font-medium text-white">{customerName}</span>
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading phone numbers...</p>
            </div>
          ) : phoneNumbers.length === 0 ? (
            <div className="text-center py-8">
              <FiPhone className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No available phone numbers found</p>
              <p className="text-gray-500 text-sm mt-1">Import or purchase phone numbers first</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                {phoneNumbers.map((number) => (
                  <label
                    key={number.id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPhoneNumberId === number.id
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="phoneNumber"
                      value={number.id}
                      checked={selectedPhoneNumberId === number.id}
                      onChange={(e) => setSelectedPhoneNumberId(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{number.phoneNumber}</span>
                        {number.customer && number.customer.id === customerId && (
                          <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                            Currently Assigned
                          </span>
                        )}
                      </div>
                      {number.friendlyName && (
                        <p className="text-gray-400 text-sm mt-1">{number.friendlyName}</p>
                      )}
                      <p className="text-gray-500 text-xs mt-1">
                        {number.provider} • {number.status}
                      </p>
                    </div>
                    {selectedPhoneNumberId === number.id && (
                      <FiCheck className="w-5 h-5 text-orange-500 ml-3" />
                    )}
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignPhoneNumber}
                  disabled={!selectedPhoneNumberId || assigning}
                  className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {assigning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Assigning...
                    </>
                  ) : (
                    'Assign Number'
                  )}
                </button>
              </div>
            </>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
