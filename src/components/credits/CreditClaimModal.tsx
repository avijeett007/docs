'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, Twitter, Coins, Sparkles, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PendingClaim {
  type: 'onboarding' | 'daily_challenge';
  referenceId?: string;
  credits: number;
  title: string;
  description: string;
}

interface CreditClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  claim: PendingClaim | null;
  partnerId: string;
  onClaimSuccess?: () => void;
}

export default function CreditClaimModal({
  isOpen,
  onClose,
  claim,
  partnerId,
  onClaimSuccess
}: CreditClaimModalProps) {
  const [step, setStep] = useState<'choose' | 'claiming' | 'success' | 'social_success'>('choose');
  const [claimResult, setClaimResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && claim) {
      setStep('choose');
      setClaimResult(null);
    }
  }, [isOpen, claim]);

  const triggerConfetti = () => {
    // Multiple confetti bursts
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Left side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });

      // Right side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleDirectClaim = async () => {
    if (!claim) return;

    setLoading(true);
    try {
      const endpoint = claim.type === 'onboarding' 
        ? '/api/partner/credits/claim-onboarding'
        : '/api/partner/credits/claim-challenge';

      const body = claim.type === 'onboarding'
        ? { claimMethod: 'direct' }
        : { challengeId: claim.referenceId, claimMethod: 'direct' };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (result.success) {
        setClaimResult(result);
        setStep('success');
        triggerConfetti();
        // Notify parent component of successful claim
        if (onClaimSuccess) {
          onClaimSuccess();
        }
      } else {
        alert(result.message || 'Failed to claim credits');
      }
    } catch (error) {
      console.error('Error claiming credits:', error);
      alert('Failed to claim credits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialClaim = async () => {
    if (!claim) return;

    setLoading(true);
    try {
      const endpoint = claim.type === 'onboarding' 
        ? '/api/partner/credits/claim-onboarding'
        : '/api/partner/credits/claim-challenge';

      const body = claim.type === 'onboarding'
        ? { claimMethod: 'social_share' }
        : { challengeId: claim.referenceId, claimMethod: 'social_share' };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (result.success) {
        setClaimResult(result);
        setStep('social_success');
        triggerConfetti();

        // Notify parent component of successful claim
        if (onClaimSuccess) {
          onClaimSuccess();
        }

        // Open Twitter share in new window
        if (result.socialShareUrl) {
          window.open(result.socialShareUrl, '_blank', 'width=600,height=400');
        }
      } else {
        alert(result.message || 'Failed to claim credits');
      }
    } catch (error) {
      console.error('Error claiming credits:', error);
      alert('Failed to claim credits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('choose');
    setClaimResult(null);
    onClose();
  };

  if (!isOpen || !claim) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 text-center">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full">
                <Gift className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Claim Your Credits!</h2>
            <p className="text-gray-400 text-sm">Reward yourself for your progress</p>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            {step === 'choose' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="text-4xl font-bold text-yellow-400 mb-2">
                    {claim.credits} Credits Available!
                  </div>
                  <div className="text-lg font-semibold text-white mb-1">
                    {claim.title}
                  </div>
                  <p className="text-gray-400 text-sm mb-6">
                    {claim.description}
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Direct Claim Option */}
                  <motion.button
                    onClick={handleDirectClaim}
                    disabled={loading}
                    className="w-full p-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Coins className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-semibold text-base">Claim Now</div>
                          <div className="text-sm opacity-90">Get {claim.credits} credits immediately</div>
                        </div>
                      </div>
                      <div className="text-3xl font-bold">{claim.credits}</div>
                    </div>
                  </motion.button>

                  {/* Social Share Option */}
                  <motion.button
                    onClick={handleSocialClaim}
                    disabled={loading}
                    className="w-full p-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Twitter className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-semibold text-base">Share & Get Double!</div>
                          <div className="text-sm opacity-90">Share on X for {claim.credits * 2} total credits</div>
                        </div>
                      </div>
                      <div className="text-3xl font-bold">{claim.credits * 2}</div>
                    </div>
                  </motion.button>
                </div>

                <div className="text-center text-xs text-gray-500">
                  Bonus credits from social sharing are awarded within 1-3 days after verification
                </div>
              </motion.div>
            )}

            {step === 'success' && claimResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-6"
              >
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-20 h-20 mx-auto bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center"
                  >
                    <Sparkles className="w-10 h-10 text-white" />
                  </motion.div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Congratulations!</h3>
                  <p className="text-gray-300 mb-4">{claimResult.message}</p>
                  
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-3xl font-bold text-yellow-400">
                      +{claimResult.creditsAwarded} Credits
                    </div>
                    <div className="text-sm text-gray-400">Added to your account</div>
                  </div>
                </div>

                <motion.button
                  onClick={handleClose}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all duration-200"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Awesome!
                </motion.button>
              </motion.div>
            )}

            {step === 'social_success' && claimResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-6"
              >
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-20 h-20 mx-auto bg-gradient-to-r from-green-400 to-teal-400 rounded-full flex items-center justify-center"
                  >
                    <Twitter className="w-10 h-10 text-white" />
                  </motion.div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Credits Awarded!</h3>
                  <p className="text-gray-300 mb-4">Your base credits have been added to your account.</p>
                  
                  <div className="space-y-3">
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-400">
                        +{claimResult.creditsAwarded} Credits
                      </div>
                      <div className="text-sm text-gray-400">Added immediately</div>
                    </div>

                    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg p-4 border border-yellow-500/30">
                      <div className="text-xl font-bold text-yellow-400">
                        +{claimResult.bonusCredits} Bonus Credits
                      </div>
                      <div className="text-sm text-gray-300">Will be added within 1-3 days after we verify your share</div>
                    </div>
                  </div>
                </div>

                {claimResult.socialShareUrl && (
                  <motion.a
                    href={claimResult.socialShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Twitter className="w-4 h-4" />
                    <span>Share Again</span>
                    <ExternalLink className="w-4 h-4" />
                  </motion.a>
                )}

                <motion.button
                  onClick={handleClose}
                  className="w-full py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white rounded-lg font-semibold transition-all duration-200"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Got it!
                </motion.button>
              </motion.div>
            )}

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-gray-800/80 flex items-center justify-center rounded-2xl"
              >
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
                  />
                  <p className="text-white">Processing your claim...</p>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
