'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiLoader, FiKey } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// Validation schema
const publicKeySchema = z.object({
  publicKey: z.string().min(1, 'Public key is required').min(10, 'Public key must be at least 10 characters'),
});

type PublicKeyFormData = z.infer<typeof publicKeySchema>;

interface PublicKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  onKeyAdded?: () => void;
}

const PublicKeyModal: React.FC<PublicKeyModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName,
  onKeyAdded
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<PublicKeyFormData>({
    resolver: zodResolver(publicKeySchema),
    defaultValues: {
      publicKey: ''
    }
  });

  const onSubmit = async (data: PublicKeyFormData) => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/partner/vapi-agents/${agentId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          publicKey: data.publicKey
        })
      });

      if (response.ok) {
        toast.success('Public key added successfully!');
        onKeyAdded?.();
        handleClose();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to add public key');
      }
    } catch (error) {
      console.error('Error adding public key:', error);
      toast.error('Failed to add public key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="relative bg-gray-900 rounded-xl w-full max-w-md shadow-xl border border-gray-800">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <FiKey className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-white">
                  Add Public Key
                </Dialog.Title>
                <p className="text-sm text-gray-400">
                  For agent: {agentName}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <FiX className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="mb-6">
              <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-400 mb-2">
                  Public Key Required for Testing
                </h4>
                <p className="text-sm text-gray-300">
                  To test this agent in the browser, you need to provide a VAPI public key. 
                  This key is safe to use client-side and is different from your private API key.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  VAPI Public Key *
                </label>
                <input
                  {...register('publicKey')}
                  type="text"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  placeholder="b867fead-9ffe-4166-b7b6-4092237aabb9"
                />
                {errors.publicKey && (
                  <p className="text-red-400 text-sm mt-1">{errors.publicKey.message}</p>
                )}
                <div className="text-gray-400 text-sm mt-2 space-y-1">
                  <p>
                    Get your public key from{' '}
                    <a 
                      href="https://dashboard.vapi.ai" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      VAPI Dashboard → API Keys
                    </a>
                  </p>
                  <p className="text-xs">
                    Public keys are UUID format (e.g., b867fead-9ffe-4166-b7b6-4092237aabb9) and are safe to use in the browser.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSaving}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={clsx(
                    "px-6 py-2 rounded-lg font-medium transition-colors",
                    "bg-blue-600 hover:bg-blue-500 text-white",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isSaving ? (
                    <div className="flex items-center gap-2">
                      <FiLoader className="w-4 h-4 animate-spin" />
                      <span>Adding...</span>
                    </div>
                  ) : (
                    <span>Add Public Key</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default PublicKeyModal;
