'use client';

import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiShield, FiSmartphone, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import NeonContainer from '@/components/NeonContainer';
import { toast } from 'react-hot-toast';
import { 
  checkPasskeySupport, 
  registerPartnerPasskey, 
  registerCustomerPasskey,
  type PasskeySupport 
} from '@/lib/passkey-client';

interface PasskeySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isCustomer?: boolean;
  userDisplayName?: string;
}

export default function PasskeySetupModal({
  isOpen,
  onClose,
  onSuccess,
  isCustomer = false,
  userDisplayName,
}: PasskeySetupModalProps) {
  const [step, setStep] = useState<'intro' | 'setup' | 'success'>('intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passkeySupport, setPasskeySupport] = useState<PasskeySupport | null>(null);
  const [deviceName, setDeviceName] = useState('');

  useEffect(() => {
    if (isOpen) {
      checkSupport();
    }
  }, [isOpen]);

  const checkSupport = async () => {
    try {
      const support = await checkPasskeySupport();
      setPasskeySupport(support);
      
      if (!support.isSupported) {
        setError('Passkeys are not supported in this browser. Please use a modern browser like Chrome, Safari, or Edge.');
      }
    } catch (err) {
      setError('Failed to check passkey support');
    }
  };

  const handleSetup = async () => {
    if (!passkeySupport?.isSupported) {
      setError('Passkeys are not supported in this browser');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = isCustomer 
        ? await registerCustomerPasskey(userDisplayName, deviceName || undefined)
        : await registerPartnerPasskey(userDisplayName, deviceName || undefined);

      if (result.success) {
        setStep('success');
        toast.success('Passkey set up successfully!');
      } else {
        setError(result.error || 'Failed to set up passkey');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up passkey');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('intro');
    setError('');
    setDeviceName('');
    onClose();
  };

  const handleSuccess = () => {
    handleClose();
    onSuccess();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          open={isOpen}
          onClose={handleClose}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
          
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              as={motion.div}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md"
            >
              <NeonContainer className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <FiShield className="w-6 h-6 text-blue-400" />
                    <Dialog.Title className="text-xl font-bold text-white">
                      Set Up Passkey
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                {step === 'intro' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="text-center">
                      <FiSmartphone className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Secure & Convenient Login
                      </h3>
                      <p className="text-gray-300 text-sm">
                        Set up a passkey to log in securely using your device's biometric authentication 
                        (fingerprint, face recognition) or PIN.
                      </p>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                      <h4 className="text-white font-medium mb-2">Benefits:</h4>
                      <ul className="text-sm text-gray-300 space-y-1">
                        <li>• No more forgotten passwords</li>
                        <li>• Faster and more secure login</li>
                        <li>• Works across your devices</li>
                        <li>• Phishing-resistant authentication</li>
                      </ul>
                    </div>

                    {passkeySupport && !passkeySupport.isSupported && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <FiAlertCircle className="w-5 h-5 text-red-400" />
                          <span className="text-red-400 font-medium">Not Supported</span>
                        </div>
                        <p className="text-red-300 text-sm mt-1">
                          {error || 'Passkeys are not supported in this browser'}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Device Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={deviceName}
                          onChange={(e) => setDeviceName(e.target.value)}
                          placeholder="e.g., My iPhone, Work Laptop"
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Help identify this device in your security settings
                        </p>
                      </div>
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        onClick={handleClose}
                        className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Maybe Later
                      </button>
                      <button
                        onClick={() => setStep('setup')}
                        disabled={!passkeySupport?.isSupported}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Set Up Passkey
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 'setup' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiShield className="w-8 h-8 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Creating Your Passkey
                      </h3>
                      <p className="text-gray-300 text-sm">
                        Your browser will prompt you to authenticate using your device's security method.
                      </p>
                    </div>

                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <FiAlertCircle className="w-5 h-5 text-red-400" />
                          <span className="text-red-400 font-medium">Setup Failed</span>
                        </div>
                        <p className="text-red-300 text-sm mt-1">{error}</p>
                      </div>
                    )}

                    <div className="flex space-x-3 pt-4">
                      <button
                        onClick={() => setStep('intro')}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleSetup}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all disabled:opacity-50 flex items-center justify-center"
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Setting Up...
                          </>
                        ) : 'Create Passkey'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiCheck className="w-8 h-8 text-green-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Passkey Created Successfully!
                      </h3>
                      <p className="text-gray-300 text-sm">
                        You can now use your passkey to log in quickly and securely. 
                        Your password will still work as a backup option.
                      </p>
                    </div>

                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                      <h4 className="text-white font-medium mb-2">Next time you log in:</h4>
                      <ul className="text-sm text-gray-300 space-y-1">
                        <li>• Enter your email address</li>
                        <li>• Choose "Use Passkey" option</li>
                        <li>• Authenticate with your device</li>
                        <li>• You're logged in!</li>
                      </ul>
                    </div>

                    <button
                      onClick={handleSuccess}
                      className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all"
                    >
                      Got It!
                    </button>
                  </motion.div>
                )}
              </NeonContainer>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
