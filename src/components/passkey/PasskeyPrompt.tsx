'use client';

import { useState, useEffect } from 'react';
import { FiShield, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { checkPasskeySupport } from '@/lib/passkey-client';
import PasskeySetupModal from './PasskeySetupModal';

interface PasskeyPromptProps {
  isCustomer?: boolean;
  userDisplayName?: string;
  onSetupComplete?: () => void;
  onDismiss?: () => void;
  autoShow?: boolean;
}

export default function PasskeyPrompt({
  isCustomer = false,
  userDisplayName,
  onSetupComplete,
  onDismiss,
  autoShow = true,
}: PasskeyPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (autoShow) {
      checkSupportAndShow();
    }
  }, [autoShow]); // checkSupportAndShow is defined inline

  const checkExistingPasskeys = async (): Promise<boolean> => {
    try {
      // Get current user's email from localStorage or other source
      const userEmail = isCustomer
        ? localStorage.getItem('customer_email')
        : localStorage.getItem('partner_email');

      if (!userEmail) {
        return false;
      }

      const endpoint = isCustomer
        ? '/api/whitelabel/auth/passkey/status'
        : '/api/partner/auth/passkey/status';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.hasPasskeys;
      }

      return false;
    } catch (error) {
      console.error('Error checking existing passkeys:', error);
      return false;
    }
  };

  const checkSupportAndShow = async () => {
    try {
      const support = await checkPasskeySupport();
      setIsSupported(support.isSupported);

      if (support.isSupported) {
        // Check if user already has passkeys set up
        const hasExistingPasskeys = await checkExistingPasskeys();

        if (hasExistingPasskeys) {
          // User already has passkeys, don't show prompt
          return;
        }

        // Check if user has already dismissed this prompt recently
        const dismissedKey = `passkey-prompt-dismissed-${isCustomer ? 'customer' : 'partner'}`;
        const lastDismissed = localStorage.getItem(dismissedKey);
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

        if (!lastDismissed || parseInt(lastDismissed) < oneDayAgo) {
          setShowPrompt(true);
        }
      }
    } catch (error) {
      console.error('Error checking passkey support:', error);
    }
  };

  const handleSetup = () => {
    setShowPrompt(false);
    setShowSetupModal(true);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    
    // Remember dismissal for 24 hours
    const dismissedKey = `passkey-prompt-dismissed-${isCustomer ? 'customer' : 'partner'}`;
    localStorage.setItem(dismissedKey, Date.now().toString());
    
    onDismiss?.();
  };

  const handleSetupComplete = () => {
    setShowSetupModal(false);
    onSetupComplete?.();
  };

  if (!isSupported) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-40 w-80"
          >
            <div className="bg-gradient-to-r from-blue-900/90 to-teal-900/90 backdrop-blur-sm border border-blue-500/30 rounded-lg p-4 shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <FiShield className="w-5 h-5 text-blue-400" />
                  <h3 className="text-white font-medium">Secure Your Account</h3>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
              
              <p className="text-gray-300 text-sm mb-4">
                Set up a passkey for faster, more secure login using your device's biometric authentication.
              </p>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-3 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Maybe Later
                </button>
                <button
                  onClick={handleSetup}
                  className="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all flex items-center justify-center space-x-1"
                >
                  <FiShield className="w-4 h-4" />
                  <span>Set Up</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

// Inline prompt component for settings pages
export function PasskeyInlinePrompt({
  isCustomer = false,
  userDisplayName,
  onSetupComplete,
}: Omit<PasskeyPromptProps, 'autoShow' | 'onDismiss'>) {
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    checkSupport();
  }, []);

  const checkSupport = async () => {
    try {
      const support = await checkPasskeySupport();
      setIsSupported(support.isSupported);
    } catch (error) {
      console.error('Error checking passkey support:', error);
    }
  };

  const handleSetupComplete = () => {
    setShowSetupModal(false);
    onSetupComplete?.();
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <FiShield className="w-5 h-5 text-amber-400" />
          <h3 className="text-white font-medium">Passkeys Not Available</h3>
        </div>
        <p className="text-gray-300 text-sm mt-2">
          Passkeys are not supported in this browser. Please use a modern browser like Chrome, Safari, or Edge to enable passkey authentication.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <FiShield className="w-5 h-5 text-blue-400" />
              <h3 className="text-white font-medium">Enhanced Security</h3>
            </div>
            <p className="text-gray-300 text-sm">
              Set up passkey authentication for faster, more secure login using biometric authentication.
            </p>
          </div>
          <button
            onClick={() => setShowSetupModal(true)}
            className="ml-4 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all flex items-center space-x-2"
          >
            <FiShield className="w-4 h-4" />
            <span>Set Up Passkey</span>
          </button>
        </div>
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
