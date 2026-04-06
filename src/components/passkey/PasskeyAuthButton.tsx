'use client';

import { useState } from 'react';
import { FiShield } from 'react-icons/fi';
import { 
  authenticatePartnerWithPasskey, 
  authenticateCustomerWithPasskey,
  checkPasskeySupport 
} from '@/lib/passkey-client';
import { toast } from 'react-hot-toast';

interface PasskeyAuthButtonProps {
  email: string;
  isCustomer?: boolean;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export default function PasskeyAuthButton({
  email,
  isCustomer = false,
  onSuccess,
  onError,
  disabled = false,
  className = '',
  variant = 'primary',
}: PasskeyAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePasskeyAuth = async () => {
    if (!email) {
      onError('Please enter your email address first');
      return;
    }

    setLoading(true);

    try {
      // Check browser support
      const support = await checkPasskeySupport();
      if (!support.isSupported) {
        onError('Passkeys are not supported in this browser');
        return;
      }

      // Authenticate with passkey
      const result = isCustomer 
        ? await authenticateCustomerWithPasskey(email)
        : await authenticatePartnerWithPasskey(email);

      if (result.success) {
        toast.success(`Welcome back! Authenticated with ${result.deviceName || 'passkey'}`);
        onSuccess(result);
      } else {
        onError(result.error || 'Passkey authentication failed');
      }
    } catch (error) {
      console.error('Passkey authentication error:', error);
      onError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const baseClasses = "flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:from-blue-600 hover:to-teal-600 transform hover:scale-105",
    secondary: "bg-gray-700 text-white hover:bg-gray-600 border border-gray-600 hover:border-gray-500"
  };

  return (
    <button
      onClick={handlePasskeyAuth}
      disabled={disabled || loading || !email}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Authenticating...</span>
        </>
      ) : (
        <>
          <FiShield className="w-4 h-4" />
          <span>Use Passkey</span>
        </>
      )}
    </button>
  );
}

// Compact version for inline use
export function PasskeyAuthButtonCompact({
  email,
  isCustomer = false,
  onSuccess,
  onError,
  disabled = false,
}: PasskeyAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePasskeyAuth = async () => {
    if (!email) {
      onError('Please enter your email address first');
      return;
    }

    setLoading(true);

    try {
      const support = await checkPasskeySupport();
      if (!support.isSupported) {
        onError('Passkeys are not supported in this browser');
        return;
      }

      const result = isCustomer 
        ? await authenticateCustomerWithPasskey(email)
        : await authenticatePartnerWithPasskey(email);

      if (result.success) {
        onSuccess(result);
      } else {
        onError(result.error || 'Passkey authentication failed');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePasskeyAuth}
      disabled={disabled || loading || !email}
      className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Sign in with passkey"
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <FiShield className="w-4 h-4" />
      )}
      <span>{loading ? 'Authenticating...' : 'Use passkey'}</span>
    </button>
  );
}

// Check if passkey is available for email
export function usePasskeyAvailability(email: string, isCustomer: boolean = false) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const checkAvailability = async () => {
    if (!email) {
      setIsAvailable(null);
      return;
    }

    setLoading(true);
    try {
      const endpoint = isCustomer 
        ? '/api/whitelabel/auth/passkey/authenticate-begin'
        : '/api/partner/auth/passkey/authenticate-begin';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      setIsAvailable(response.ok);
    } catch (error) {
      setIsAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAvailable, loading, checkAvailability };
}
