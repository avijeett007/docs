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

export default function CreditClaimPopup() {
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<PendingClaim | null>(null);
  const [step, setStep] = useState<'loading' | 'select' | 'choose' | 'claiming' | 'success' | 'social_success'>('loading');
  const [claimResult, setClaimResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPendingClaims();

    // Debug: Check if this is actually a popup
    console.log('Popup window details:', {
      isPopup: window.opener !== null,
      windowName: window.name,
      windowFeatures: {
        width: window.outerWidth,
        height: window.outerHeight,
        toolbar: window.toolbar?.visible,
        menubar: window.menubar?.visible,
        location: window.location.href
      }
    });
  }, []);

  const fetchPendingClaims = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        window.close();
        return;
      }

      const response = await fetch('/api/partner/credits/pending-claims', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const pendingClaims = data.claims || [];
        setClaims(pendingClaims);
        
        if (pendingClaims.length === 0) {
          // No claims available, close popup
          setTimeout(() => window.close(), 2000);
          setStep('loading');
        } else if (pendingClaims.length === 1) {
          // Auto-select single claim
          setSelectedClaim(pendingClaims[0]);
          setStep('choose');
        } else {
          // Multiple claims, show selection
          setStep('select');
        }
      } else {
        window.close();
      }
    } catch (error) {
      console.error('Error fetching pending claims:', error);
      window.close();
    }
  };

  const triggerConfetti = () => {
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

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleClaimSelect = (claim: PendingClaim) => {
    setSelectedClaim(claim);
    setStep('choose');
  };

  const handleDirectClaim = async () => {
    if (!selectedClaim) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      const endpoint = selectedClaim.type === 'onboarding' 
        ? '/api/partner/credits/claim-onboarding'
        : '/api/partner/credits/claim-challenge';

      const body = selectedClaim.type === 'onboarding'
        ? { claimMethod: 'direct' }
        : { challengeId: selectedClaim.referenceId, claimMethod: 'direct' };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (result.success) {
        setClaimResult(result);
        setStep('success');
        triggerConfetti();
        
        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'CREDIT_CLAIM_SUCCESS', 
            credits: result.creditsAwarded 
          }, '*');
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
    if (!selectedClaim) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      const endpoint = selectedClaim.type === 'onboarding' 
        ? '/api/partner/credits/claim-onboarding'
        : '/api/partner/credits/claim-challenge';

      const body = selectedClaim.type === 'onboarding'
        ? { claimMethod: 'social_share' }
        : { challengeId: selectedClaim.referenceId, claimMethod: 'social_share' };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (result.success) {
        setClaimResult(result);
        setStep('social_success');
        triggerConfetti();
        
        // Open Twitter share in new tab
        if (result.socialShareUrl) {
          window.open(result.socialShareUrl, '_blank');
        }

        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'CREDIT_CLAIM_SUCCESS', 
            credits: result.creditsAwarded,
            bonusCredits: result.bonusCredits
          }, '*');
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
    window.close();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Claim Your Credits!</h1>
              <p className="text-gray-400 text-sm">Reward yourself for your progress</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-gray-300">
                {claims.length === 0 ? 'No credits available to claim' : 'Loading your rewards...'}
              </p>
            </motion.div>
          )}

          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold mb-4">Choose a reward to claim:</h2>
              {claims.map((claim, index) => (
                <motion.button
                  key={index}
                  onClick={() => handleClaimSelect(claim)}
                  className="w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{claim.title}</div>
                      <div className="text-sm text-gray-400">{claim.description}</div>
                    </div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {claim.credits}
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}

          {step === 'choose' && selectedClaim && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-2">
                  {selectedClaim.credits} Credits Available!
                </div>
                <p className="text-gray-300 mb-1">{selectedClaim.title}</p>
                <p className="text-sm text-gray-400">{selectedClaim.description}</p>
              </div>

              <div className="space-y-4">
                {/* Direct Claim Option */}
                <motion.button
                  onClick={handleDirectClaim}
                  disabled={loading}
                  className="w-full p-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg transition-all duration-200 disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Coins className="w-6 h-6" />
                      <div className="text-left">
                        <div className="font-semibold">Claim Now</div>
                        <div className="text-sm opacity-90">Get {selectedClaim.credits} credits immediately</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold">{selectedClaim.credits}</div>
                  </div>
                </motion.button>

                {/* Social Share Option */}
                <motion.button
                  onClick={handleSocialClaim}
                  disabled={loading}
                  className="w-full p-4 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white rounded-lg transition-all duration-200 disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Twitter className="w-6 h-6" />
                      <div className="text-left">
                        <div className="font-semibold">Share & Get Double!</div>
                        <div className="text-sm opacity-90">Share on X for {selectedClaim.credits * 2} total credits</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold">{selectedClaim.credits * 2}</div>
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
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
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
                
                <div className="bg-gray-800 rounded-lg p-4">
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
              key="social_success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
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
                  <div className="bg-gray-800 rounded-lg p-4">
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
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-gray-900/80 flex items-center justify-center"
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
    </div>
  );
}
