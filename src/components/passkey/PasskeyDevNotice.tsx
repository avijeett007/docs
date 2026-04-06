'use client';

import { useState, useEffect } from 'react';
import { FiInfo, FiX } from 'react-icons/fi';

export default function PasskeyDevNotice() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Always call hooks in the same order
  useEffect(() => {
    // Check if already dismissed this session
    const wasDismissed = sessionStorage.getItem('passkey-dev-notice-dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Only show in development on HTTP localhost
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'http:' &&
      window.location.hostname === 'localhost'
    ) {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    // Remember dismissal for this session
    sessionStorage.setItem('passkey-dev-notice-dismissed', 'true');
  };

  // Don't render if dismissed or shouldn't show
  if (dismissed || !show) return null;

  return (
    <div className="fixed top-4 right-4 max-w-md bg-blue-900/90 backdrop-blur-sm border border-blue-700 rounded-lg p-4 text-white shadow-lg z-50">
      <div className="flex items-start gap-3">
        <FiInfo className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold text-blue-100 mb-1">
            Passkey Testing Available
          </h4>
          <p className="text-sm text-blue-200 mb-3">
            Passkeys require HTTPS. To test passkey authentication locally:
          </p>
          <div className="bg-blue-800/50 rounded p-2 mb-3">
            <code className="text-xs text-blue-100 block">
              npm run setup-certs<br />
              npm run dev:https
            </code>
          </div>
          <p className="text-xs text-blue-300">
            Then visit <strong>https://localhost:3001</strong> and accept the security warning.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-blue-400 hover:text-blue-200 transition-colors"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
