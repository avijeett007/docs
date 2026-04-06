'use client';

import Image from 'next/image';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiShield, FiCopy, FiCheck, FiDownload, FiAlertCircle } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import NeonContainer from '@/components/NeonContainer';
import { logger } from '@/lib/logger';
import { toast } from 'react-hot-toast';

interface MFASetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface MFASetupData {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
  issuer: string;
  accountName: string;
}

export default function MFASetupModal({ isOpen, onClose, onSuccess }: MFASetupModalProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const [error, setError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('setup');
      setSetupData(null);
      setVerificationCode('');
      setError('');
      setCopiedSecret(false);
      setCopiedBackupCodes(false);
      initiateMFASetup();
    }
  }, [isOpen]);

  const initiateMFASetup = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/partner/auth/mfa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup MFA');
      }

      setSetupData(data);
    } catch (error: any) {
      logger.error('Partner MFA setup initialization failed', error instanceof Error ? error : undefined, {
        operation: 'partner_mfa_setup_init',
      });
      setError(error.message || 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'secret' | 'backup') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else {
        setCopiedBackupCodes(true);
        setTimeout(() => setCopiedBackupCodes(false), 2000);
      }
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData) return;

    const content = `Knotie AI Pro - MFA Backup Codes
Generated: ${new Date().toLocaleString()}
Account: ${setupData.accountName}

IMPORTANT: Store these codes in a safe place. Each code can only be used once.

${setupData.backupCodes.map((code, index) => `${index + 1}. ${code}`).join('\n')}

Instructions:
- Use these codes if you lose access to your authenticator app
- Each code can only be used once
- Generate new codes if you run out
- Keep these codes secure and private`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knotie-mfa-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Backup codes downloaded');
  };

  const verifySetup = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/partner/auth/mfa/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: verificationCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      setStep('backup');
      toast.success('MFA enabled successfully!');
    } catch (error: any) {
      logger.error('Partner MFA setup verification failed', error instanceof Error ? error : undefined, {
        operation: 'partner_mfa_setup_verify',
      });
      setError(error.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    onSuccess();
    onClose();
  };

  const handleClose = () => {
    if (step === 'backup') {
      // If we're on backup step, MFA is already enabled
      handleComplete();
    } else {
      onClose();
    }
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
        onClose={handleClose}
        className="relative z-[1000001]"
      >
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel
            as={motion.div}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-2xl"
          >
            <NeonContainer className="relative rounded-[22px] border border-cyan-400/25 bg-slate-950/95 p-[1px] shadow-[0_18px_70px_rgba(0,0,0,0.55)]">
              <div className="rounded-[21px] border border-white/8 bg-slate-900/96 px-5 py-5 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.06)] sm:px-6 sm:py-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-blue-400/20 bg-blue-500/20 p-2">
                      <FiShield className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        Enable Multi-Factor Authentication
                      </h2>
                      <p className="text-sm text-gray-400">
                        {step === 'setup' && 'Secure your account with MFA'}
                        {step === 'verify' && 'Verify your authenticator app'}
                        {step === 'backup' && 'Save your backup codes'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-2 transition-colors hover:bg-gray-800"
                  >
                    <FiX className="h-5 w-5 text-gray-400" />
                  </button>
                </div>

                {error && (
                  <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/20 p-4">
                    <div className="flex items-center gap-2">
                      <FiAlertCircle className="h-5 w-5 text-red-400" />
                      <p className="text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                {loading && !setupData && (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-400"></div>
                    <p className="text-gray-400">Setting up MFA...</p>
                  </div>
                )}

                {step === 'setup' && setupData && (
                  <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Scan QR Code
                    </h3>
                    <p className="text-gray-400 mb-4">
                      Use your authenticator app to scan this QR code
                    </p>

                    <div className="inline-block rounded-lg bg-white p-4">
                      <Image
                        src={setupData.qrCodeUrl}
                        alt="MFA QR Code"
                        width={192}
                        height={192}
                        unoptimized
                        className="h-48 w-48"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-2">Manual Entry</h4>
                    <p className="text-gray-400 text-sm mb-3">
                      Can't scan? Enter this key manually in your authenticator app:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-gray-900 rounded text-green-400 font-mono text-sm break-all">
                        {setupData.manualEntryKey}
                      </code>
                      <button
                        onClick={() => copyToClipboard(setupData.manualEntryKey, 'secret')}
                        className="p-2 rounded bg-blue-500 hover:bg-blue-600 transition-colors"
                      >
                        {copiedSecret ? (
                          <FiCheck className="w-4 h-4 text-white" />
                        ) : (
                          <FiCopy className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setStep('verify')}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                  </div>
                )}

                {step === 'verify' && (
                  <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Enter Verification Code
                    </h3>
                    <p className="text-gray-400 mb-4">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>

                  <div className="max-w-xs mx-auto">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setVerificationCode(value);
                        setError('');
                      }}
                      placeholder="000000"
                      className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-xl font-mono tracking-widest focus:border-blue-500 focus:outline-none"
                      maxLength={6}
                      autoComplete="off"
                    />
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => setStep('setup')}
                      className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={verifySetup}
                      disabled={loading || verificationCode.length !== 6}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      {loading ? 'Verifying...' : 'Verify & Enable'}
                    </button>
                  </div>
                  </div>
                )}

                {step === 'backup' && setupData && (
                  <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiCheck className="w-6 h-6 text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      MFA Enabled Successfully!
                    </h3>
                    <p className="text-gray-400 mb-4">
                      Save these backup codes in a secure location
                    </p>
                  </div>

                  <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FiAlertCircle className="w-5 h-5 text-amber-400" />
                      <h4 className="text-amber-400 font-medium">Important</h4>
                    </div>
                    <p className="text-amber-200 text-sm">
                      These backup codes can be used to access your account if you lose your authenticator device.
                      Each code can only be used once.
                    </p>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-medium">Backup Codes</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(setupData.backupCodes.join('\n'), 'backup')}
                          className="flex items-center gap-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                        >
                          {copiedBackupCodes ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                          Copy
                        </button>
                        <button
                          onClick={downloadBackupCodes}
                          className="flex items-center gap-2 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors"
                        >
                          <FiDownload className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {setupData.backupCodes.map((code, index) => (
                        <div key={index} className="p-2 bg-gray-900 rounded font-mono text-sm text-green-400">
                          {index + 1}. {code}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleComplete}
                      className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                    >
                      Complete Setup
                    </button>
                  </div>
                  </div>
                )}
              </div>
            </NeonContainer>
          </Dialog.Panel>
        </div>
      </Dialog>
    </AnimatePresence>
  );
}
