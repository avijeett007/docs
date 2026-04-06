'use client';

import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiShield, FiMail, FiAlertCircle, FiClock } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import NeonContainer from '@/components/NeonContainer';
import { toast } from 'react-hot-toast';

interface MFAVerificationModalProps {
  isOpen: boolean;
  partnerId: string;
  onSuccess: (token: string, data: any) => void;
  onCancel: () => void;
}

export default function MFAVerificationModal({ 
  isOpen, 
  partnerId, 
  onSuccess, 
  onCancel 
}: MFAVerificationModalProps) {
  const [method, setMethod] = useState<'totp' | 'email' | 'backup'>('totp');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMethod('totp');
      setCode('');
      setError('');
      setEmailSent(false);
      setEmailLoading(false);
      setCountdown(0);
    }
  }, [isOpen]);

  // Countdown timer for email resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendEmailOTP = async () => {
    setEmailLoading(true);
    setError('');

    try {
      const response = await fetch('/api/partner/auth/mfa/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ partnerId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email OTP');
      }

      setEmailSent(true);
      setCountdown(600); // 10 minutes
      toast.success('Email OTP sent successfully');
    } catch (error: any) {
      console.error('Email OTP error:', error);
      setError(error.message || 'Failed to send email OTP');
    } finally {
      setEmailLoading(false);
    }
  };

  const verifyEmailOTP = async () => {
    if (!code.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/partner/auth/mfa/send-otp', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          partnerId,
          otp: code.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      // Now verify with the special email_verified code
      await verifyMFA('email_verified');
    } catch (error: any) {
      console.error('Email OTP verification error:', error);
      setError(error.message || 'Invalid verification code');
      setLoading(false);
    }
  };

  const verifyMFA = async (verificationCode?: string) => {
    const codeToVerify = verificationCode || code.trim();
    
    if (!codeToVerify) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/partner/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerId,
          code: codeToVerify,
          isBackupCode: method === 'backup',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      onSuccess(data.token, data);
    } catch (error: any) {
      console.error('MFA verification error:', error);
      setError(error.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (method === 'email') {
      verifyEmailOTP();
    } else {
      verifyMFA();
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Dialog
        as={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        open={isOpen}
        onClose={onCancel}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel
            as={motion.div}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md"
          >
            <NeonContainer className="relative">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <FiShield className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Two-Factor Authentication
                    </h2>
                    <p className="text-gray-400 text-sm">
                      Enter your verification code
                    </p>
                  </div>
                </div>
                <button
                  onClick={onCancel}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Method Selection */}
              <div className="mb-6">
                <div className="flex rounded-lg bg-gray-800/50 p-1">
                  <button
                    onClick={() => {
                      setMethod('totp');
                      setCode('');
                      setError('');
                    }}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      method === 'totp'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Authenticator
                  </button>
                  <button
                    onClick={() => {
                      setMethod('email');
                      setCode('');
                      setError('');
                    }}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      method === 'email'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Email
                  </button>
                  <button
                    onClick={() => {
                      setMethod('backup');
                      setCode('');
                      setError('');
                    }}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      method === 'backup'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Backup Code
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/30">
                  <div className="flex items-center gap-2">
                    <FiAlertCircle className="w-5 h-5 text-red-400" />
                    <p className="text-red-400">{error}</p>
                  </div>
                </div>
              )}

              {/* TOTP Method */}
              {method === 'totp' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Authenticator Code
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setCode(value);
                        setError('');
                      }}
                      placeholder="000000"
                      className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-xl font-mono tracking-widest focus:border-blue-500 focus:outline-none"
                      maxLength={6}
                      autoComplete="off"
                    />
                    <p className="text-gray-400 text-sm mt-2">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>
                </div>
              )}

              {/* Email Method */}
              {method === 'email' && (
                <div className="space-y-4">
                  {!emailSent ? (
                    <div className="text-center">
                      <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500/30 mb-4">
                        <FiMail className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                        <p className="text-blue-200">
                          We'll send a verification code to your email address
                        </p>
                      </div>
                      <button
                        onClick={sendEmailOTP}
                        disabled={emailLoading}
                        className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        {emailLoading ? 'Sending...' : 'Send Email Code'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Email Verification Code
                      </label>
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setCode(value);
                          setError('');
                        }}
                        placeholder="000000"
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-xl font-mono tracking-widest focus:border-blue-500 focus:outline-none"
                        maxLength={6}
                        autoComplete="off"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-gray-400 text-sm">
                          Check your email for the verification code
                        </p>
                        {countdown > 0 && (
                          <div className="flex items-center gap-1 text-amber-400 text-sm">
                            <FiClock className="w-4 h-4" />
                            <span>{formatTime(countdown)}</span>
                          </div>
                        )}
                      </div>
                      {countdown === 0 && (
                        <button
                          onClick={sendEmailOTP}
                          disabled={emailLoading}
                          className="mt-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                        >
                          Resend code
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Backup Code Method */}
              {method === 'backup' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Backup Code
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase());
                        setError('');
                      }}
                      placeholder="XXXXXXXX"
                      className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-lg font-mono tracking-widest focus:border-blue-500 focus:outline-none"
                      maxLength={8}
                      autoComplete="off"
                    />
                    <p className="text-gray-400 text-sm mt-2">
                      Enter one of your 8-character backup codes
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !code.trim() || (method === 'email' && !emailSent)}
                  className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </NeonContainer>
          </Dialog.Panel>
        </div>
      </Dialog>
    </AnimatePresence>
  );
}
