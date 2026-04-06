'use client';

import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertCircle } from 'react-icons/fi';
import { useState } from 'react';
import NeonContainer from '@/components/NeonContainer';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  onSuccess
}: ChangePasswordModalProps) {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('All fields are required');
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirm password do not match');
      return false;
    }

    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/partner/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('partner_token')}`
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to change password');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error changing password:', error);
      setError(error.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          open={isOpen}
          onClose={onClose}
          className="relative z-50"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          <Dialog.Panel
            as={motion.div}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 overflow-y-auto"
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative w-full max-w-md">
                <NeonContainer>
                  <div className="relative bg-gray-900/90 backdrop-blur-xl p-8">
                    <button
                      onClick={onClose}
                      className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <FiX className="w-5 h-5" />
                    </button>

                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-white">
                        Change Password
                      </h2>
                      <p className="text-gray-400 mt-1">
                        Enter your current password and choose a new one
                      </p>
                    </div>

                    {error && (
                      <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
                        <div className="flex items-center gap-2">
                          <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
                          <p>{error}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => handleInputChange('newPassword', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        />
                      </div>

                      <div className="flex justify-end gap-3 mt-8">
                        <button
                          onClick={onClose}
                          className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSubmit}
                          disabled={loading}
                          className={`px-6 py-2 rounded-lg bg-blue-500 text-white transition-colors ${
                            loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                          }`}
                        >
                          {loading ? 'Changing...' : 'Change Password'}
                        </button>
                      </div>
                    </div>
                  </div>
                </NeonContainer>
              </div>
            </div>
          </Dialog.Panel>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
