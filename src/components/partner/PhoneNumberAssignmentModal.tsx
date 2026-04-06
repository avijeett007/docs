'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiAlertCircle, FiUser, FiPhone } from 'react-icons/fi';

interface Customer {
  id: string;
  name: string;
  email: string;
  subaccountStatus?: string;
}

interface CustomerRecord {
  id: string;
  customerId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  companyName: string | null;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  customer: Customer | null;
  isAssigned: boolean;
}

interface PhoneNumberAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: PhoneNumber | null;
  onAssignmentComplete: () => void;
}

export default function PhoneNumberAssignmentModal({ 
  isOpen, 
  onClose, 
  phoneNumber, 
  onAssignmentComplete 
}: PhoneNumberAssignmentModalProps) {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && phoneNumber) {
      loadCustomers();
      setSelectedCustomerId(phoneNumber.customer?.id || '');
      setError('');
      setSuccess(false);
    }
  }, [isOpen, phoneNumber]);

  const loadCustomers = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/customers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Only include customers that have a valid Customer record (customerId)
        const validCustomers = (data.data || []).filter((customer: CustomerRecord) => customer.customerId);
        setCustomers(validCustomers);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const handleAssignment = async () => {
    if (!phoneNumber) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      const response = await fetch(`/api/partner/phone-numbers/${phoneNumber.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.customerId || null : null
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          onAssignmentComplete();
          onClose();
          resetModal();
        }, 1500);
      } else {
        setError(data.message || 'Failed to update assignment');
      }
    } catch (error) {
      setError('Failed to update assignment');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setSelectedCustomerId('');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    onClose();
    resetModal();
  };

  if (!isOpen || !phoneNumber) return null;

  const isUnassigning = phoneNumber.isAssigned && !selectedCustomerId;
  const isReassigning = phoneNumber.isAssigned && selectedCustomerId && selectedCustomerId !== phoneNumber.customer?.id;
  const isAssigning = !phoneNumber.isAssigned && selectedCustomerId;
  const noChange = phoneNumber.customer?.id === selectedCustomerId;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {phoneNumber.isAssigned ? 'Manage Assignment' : 'Assign Phone Number'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
              <FiCheck className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm">Assignment updated successfully!</span>
            </div>
          )}

          {/* Phone Number Info */}
          <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <FiPhone className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-white font-medium">{phoneNumber.phoneNumber}</div>
                {phoneNumber.customer && (
                  <div className="text-gray-400 text-sm">
                    Currently assigned to: {phoneNumber.customer.name}
                  </div>
                )}
                {!phoneNumber.customer && (
                  <div className="text-gray-400 text-sm">Currently unassigned</div>
                )}
              </div>
            </div>
          </div>

          {/* Customer Selection */}
          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Assign to Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Unassigned (Partner Inventory) --</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim()} ({customer.email})
                </option>
              ))}
            </select>
            <p className="text-gray-400 text-xs mt-1">
              Select a customer to assign this number, or leave unassigned to keep in partner inventory.
            </p>
          </div>

          {/* Action Preview */}
          <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="text-blue-400 text-sm">
              {noChange && "No changes will be made."}
              {isAssigning && `This number will be assigned to ${customers.find(c => c.id === selectedCustomerId)?.companyName || `${customers.find(c => c.id === selectedCustomerId)?.firstName || ''} ${customers.find(c => c.id === selectedCustomerId)?.lastName || ''}`.trim()}.`}
              {isReassigning && `This number will be reassigned from ${phoneNumber.customer?.name} to ${customers.find(c => c.id === selectedCustomerId)?.companyName || `${customers.find(c => c.id === selectedCustomerId)?.firstName || ''} ${customers.find(c => c.id === selectedCustomerId)?.lastName || ''}`.trim()}.`}
              {isUnassigning && `This number will be unassigned and returned to partner inventory.`}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-300 hover:text-white"
          >
            Cancel
          </button>

          <button
            onClick={handleAssignment}
            disabled={loading || noChange}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isAssigning && 'Assign Number'}
            {isReassigning && 'Reassign Number'}
            {isUnassigning && 'Unassign Number'}
            {noChange && 'No Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
