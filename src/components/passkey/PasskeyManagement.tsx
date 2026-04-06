'use client';

import { useState, useEffect } from 'react';
import { FiShield, FiTrash2, FiPlus, FiSmartphone, FiMonitor, FiAlertCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { getPasskeyCredentials, removePasskeyCredential } from '@/lib/passkey-client';
import PasskeySetupModal from './PasskeySetupModal';
import { PasskeyInlinePrompt } from './PasskeyPrompt';

interface PasskeyCredential {
  id: string;
  deviceName: string;
  deviceType: string;
  createdAt: string;
  lastUsedAt?: string;
  transports?: string[];
  backedUp: boolean;
}

interface PasskeyManagementProps {
  isCustomer?: boolean;
  userDisplayName?: string;
}

export default function PasskeyManagement({
  isCustomer = false,
  userDisplayName,
}: PasskeyManagementProps) {
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadCredentials();
  }, [isCustomer]); // loadCredentials is defined inline

  const loadCredentials = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getPasskeyCredentials(isCustomer);
      setCredentials(data.credentials || []);
      setPasskeyEnabled(data.passkeyEnabled || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passkey credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCredential = async (credentialId: string) => {
    if (!confirm('Are you sure you want to remove this passkey? You will no longer be able to use it to sign in.')) {
      return;
    }

    try {
      setDeletingId(credentialId);
      await removePasskeyCredential(credentialId, isCustomer);
      toast.success('Passkey removed successfully');
      await loadCredentials();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove passkey');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetupComplete = () => {
    setShowSetupModal(false);
    loadCredentials();
    toast.success('New passkey added successfully!');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeviceIcon = (deviceType: string, transports?: string[]) => {
    if (transports?.includes('internal') || deviceType === 'singleDevice') {
      return <FiSmartphone className="w-5 h-5 text-blue-400" />;
    }
    return <FiMonitor className="w-5 h-5 text-green-400" />;
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <FiShield className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">Passkey Authentication</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <FiShield className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">Passkey Authentication</h3>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <FiAlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">Error</span>
          </div>
          <p className="text-red-300 text-sm mt-1">{error}</p>
          <button
            onClick={loadCredentials}
            className="mt-3 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FiShield className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-semibold text-white">Passkey Authentication</h3>
          </div>
          {passkeyEnabled && (
            <button
              onClick={() => setShowSetupModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all"
            >
              <FiPlus className="w-4 h-4" />
              <span>Add Passkey</span>
            </button>
          )}
        </div>

        {!passkeyEnabled ? (
          <PasskeyInlinePrompt
            isCustomer={isCustomer}
            userDisplayName={userDisplayName}
            onSetupComplete={handleSetupComplete}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Manage your passkeys for secure, passwordless authentication. You can use multiple passkeys across different devices.
            </p>

            {credentials.length === 0 ? (
              <div className="text-center py-8">
                <FiShield className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No passkeys configured</p>
                <button
                  onClick={() => setShowSetupModal(true)}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all"
                >
                  Add Your First Passkey
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {credentials.map((credential) => (
                    <motion.div
                      key={credential.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="bg-gray-700/50 border border-gray-600 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getDeviceIcon(credential.deviceType, credential.transports)}
                          <div>
                            <h4 className="text-white font-medium">
                              {credential.deviceName || 'Unknown Device'}
                            </h4>
                            <div className="text-sm text-gray-400 space-y-1">
                              <p>Added: {formatDate(credential.createdAt)}</p>
                              {credential.lastUsedAt && (
                                <p>Last used: {formatDate(credential.lastUsedAt)}</p>
                              )}
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  credential.deviceType === 'singleDevice' 
                                    ? 'bg-blue-500/20 text-blue-300' 
                                    : 'bg-green-500/20 text-green-300'
                                }`}>
                                  {credential.deviceType === 'singleDevice' ? 'Device-bound' : 'Synced'}
                                </span>
                                {credential.backedUp && (
                                  <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-300">
                                    Backed up
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveCredential(credential.id)}
                          disabled={deletingId === credential.id}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Remove passkey"
                        >
                          {deletingId === credential.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-400"></div>
                          ) : (
                            <FiTrash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      <PasskeySetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSuccess={handleSetupComplete}
        isCustomer={isCustomer}
        userDisplayName={userDisplayName}
      />
    </>
  );
}
