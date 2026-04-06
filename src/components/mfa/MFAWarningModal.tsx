'use client';

import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiShield, FiAlertTriangle, FiCheck, FiClock } from 'react-icons/fi';
import { useState } from 'react';
import NeonContainer from '@/components/NeonContainer';
import { logger } from '@/lib/logger';

interface MFAWarningModalProps {
  isOpen: boolean;
  isMandatory: boolean;
  message: string;
  onSetupMFA: () => void;
  onDismiss: () => void;
}

export default function MFAWarningModal({ 
  isOpen, 
  isMandatory, 
  message, 
  onSetupMFA, 
  onDismiss 
}: MFAWarningModalProps) {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    if (isMandatory) {
      // Can't dismiss mandatory warnings
      return;
    }

    setDismissing(true);

    try {
      const response = await fetch('/api/partner/auth/mfa/dismiss-warning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        onDismiss();
      }
    } catch (error) {
      logger.error('Partner MFA warning dismissal failed', error instanceof Error ? error : undefined, {
        operation: 'partner_mfa_warning_dismiss',
      });
    } finally {
      setDismissing(false);
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
        onClose={isMandatory ? () => {} : handleDismiss}
        className="relative z-[1000001]"
      >
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-5">
          <Dialog.Panel
            as={motion.div}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-[30rem]"
          >
            <NeonContainer className="relative rounded-[22px] border border-cyan-400/25 bg-slate-950/95 p-[1px] shadow-[0_18px_70px_rgba(0,0,0,0.55)]">
              <div className="rounded-[21px] border border-white/8 bg-slate-900/96 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.06)] sm:px-4.5 sm:py-4.5">
                {isMandatory ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/12">
                        <FiAlertTriangle className="h-4.5 w-4.5 text-red-300" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[1.05rem] font-semibold leading-5 text-white sm:text-[1.2rem]">
                          Action Required
                        </h2>
                        <p className="mt-0.5 text-[13px] leading-5 text-gray-200">
                          Multi-Factor Authentication
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[12px] border border-red-400/35 bg-red-500/22 px-3.5 py-2.5 text-[13px] leading-6 text-red-100">
                      {message}
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-[13px] font-semibold leading-5 text-white sm:text-[14px]">
                        Why enable Multi-Factor Authentication?
                      </h3>
                      <div className="space-y-1.5 text-[13px] leading-5.5 text-gray-100">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/18">
                            <FiCheck className="h-3 w-3 text-green-400" />
                          </span>
                          <span>Protect your account from unauthorized access</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/18">
                            <FiCheck className="h-3 w-3 text-green-400" />
                          </span>
                          <span>Secure your customers' data and conversations</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/18">
                            <FiCheck className="h-3 w-3 text-green-400" />
                          </span>
                          <span>Required for Stripe Connect payment processing</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[12px] bg-white/[0.03] px-3.5 py-3">
                      <h3 className="text-[13px] font-semibold leading-5 text-white sm:text-[14px]">
                        Quick Setup
                      </h3>
                      <ol className="mt-2 space-y-1 text-[13px] leading-5.5 text-gray-100">
                        <li>1. Click &quot;Enable MFA&quot; below</li>
                        <li>2. Scan QR code with your authenticator app</li>
                        <li>3. Enter verification code to confirm</li>
                      </ol>
                      <p className="mt-2 text-[11px] leading-4.5 text-gray-300">
                        Setup takes less than 2 minutes
                      </p>
                    </div>

                    <button
                      onClick={onSetupMFA}
                      className="w-full rounded-xl border border-blue-300/25 bg-blue-500 py-2.5 text-[14px] font-medium text-white shadow-[0_10px_30px_rgba(59,130,246,0.24)] transition-colors hover:bg-blue-600"
                    >
                      Enable MFA Now
                    </button>

                    <div className="px-2 text-center text-[10px] leading-4 text-gray-300">
                      <p>
                        MFA is required for Stripe Connect partners to ensure secure payment processing
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/12 shadow-inner">
                          <FiShield className="h-5 w-5 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                            Account security
                          </p>
                          <h2 className="mt-1.5 text-[1.75rem] font-bold leading-tight text-white sm:text-[1.95rem]">
                            Strengthen your sign-in security
                          </h2>
                          <p className="mt-1.5 max-w-xl text-sm leading-6 text-gray-400 sm:text-[15px]">
                            Add one more security step to protect access to your workspace, customer data, and billing settings.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleDismiss}
                        className="rounded-xl border border-white/8 p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                      >
                        <FiX className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/18 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-4.5">
                      <div className="flex items-start gap-2.5">
                        <FiClock className="mt-0.5 h-4.5 w-4.5 text-amber-300" />
                        <p className="text-sm leading-6 text-amber-200">
                          {message}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-[20px] border border-white/8 bg-slate-950/55 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-4.5">
                        <div className="mb-2.5 flex items-center gap-2 text-white">
                          <FiCheck className="h-4 w-4 text-green-400" />
                          <h3 className="font-medium">Why it matters</h3>
                        </div>
                        <div className="space-y-2.5">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                              <FiCheck className="h-3 w-3 text-green-400" />
                            </div>
                            <span className="text-sm leading-6 text-gray-300">
                              Protect your account from unauthorized access
                            </span>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                              <FiCheck className="h-3 w-3 text-green-400" />
                            </div>
                            <span className="text-sm leading-6 text-gray-300">
                              Secure your customers' data and conversations
                            </span>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                              <FiCheck className="h-3 w-3 text-green-400" />
                            </div>
                            <span className="text-sm leading-6 text-gray-300">
                              Recommended for business-critical access
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-white/8 bg-slate-950/55 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-4.5">
                        <div className="mb-2.5 flex items-center gap-2 text-white">
                          <FiShield className="h-4 w-4 text-cyan-300" />
                          <h3 className="font-medium">Quick setup</h3>
                        </div>
                        <ol className="space-y-2.5 text-sm leading-6 text-gray-300">
                          <li className="flex items-start gap-2.5">
                            <span className="mt-0.5 inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 text-[11px] font-semibold text-cyan-200">1</span>
                            <span>Open your authenticator app</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="mt-0.5 inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 text-[11px] font-semibold text-cyan-200">2</span>
                            <span>Scan the QR code we generate for you</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="mt-0.5 inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 text-[11px] font-semibold text-cyan-200">3</span>
                            <span>Enter the 6-digit code to confirm</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="mt-0.5 inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 text-[11px] font-semibold text-cyan-200">4</span>
                            <span>Save the backup codes somewhere safe</span>
                          </li>
                        </ol>
                        <p className="mt-3 text-xs text-gray-400 sm:text-sm">
                          Setup usually takes less than 2 minutes.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-cyan-500/20 bg-cyan-500/6 px-4 py-3.5 sm:px-4.5">
                      <h3 className="font-medium text-white">
                        You can enable MFA right now
                      </h3>
                      <p className="mt-1.5 text-sm leading-6 text-gray-300">
                        If you are not ready right now, you can come back from Settings at any time.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <button
                        onClick={handleDismiss}
                        disabled={dismissing}
                        className="flex-1 rounded-2xl border border-white/10 bg-gray-700/90 px-4 py-3 text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-600"
                      >
                        {dismissing ? 'Dismissing...' : 'Remind Later'}
                      </button>
                      <button
                        onClick={onSetupMFA}
                        className="flex-1 rounded-2xl border border-cyan-200/30 bg-blue-500 py-2.5 font-medium text-white shadow-[0_10px_30px_rgba(59,130,246,0.28)] transition-colors hover:bg-blue-600"
                      >
                        Enable MFA
                      </button>
                    </div>

                    <div className="pt-0.5 text-center text-[11px] leading-5 text-gray-400">
                      <p>
                        This reminder will show again in 7 days if dismissed
                      </p>
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
