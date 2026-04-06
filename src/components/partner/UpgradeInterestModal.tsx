'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Zap, Users, Bot, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ErrorBoundary, useErrorHandler } from '@/components/common/ErrorBoundary';
import { LoadingButton, useLoadingState } from '@/components/common/LoadingStates';

interface UpgradeInterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitType: string; // e.g., "VAPI agents", "Retell agents", etc.
  currentCount: number;
  maxCount: number;
  attemptedCount: number;
}

export default function UpgradeInterestModal({
  isOpen,
  onClose,
  limitType,
  currentCount,
  maxCount,
  attemptedCount,
}: UpgradeInterestModalProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const { loading, error, startLoading, stopLoading, setLoadingError, clearError } = useLoadingState();
  const { handleError } = useErrorHandler();

  const handleInterested = async () => {
    startLoading();
    clearError();

    try {
      // Get the partner token from localStorage
      const token = localStorage.getItem('partner_token');
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch('/api/partner/upgrade-interest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          limitType,
          currentCount,
          maxCount,
          attemptedCount,
          action: 'interested'
        }),
      });

      if (response.ok) {
        setShowSuccess(true);
        toast.success('Your interest has been registered! We\'ll be in touch soon.');
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'Failed to register interest';
        toast.error(errorMessage);
        setLoadingError(new Error(errorMessage));
      }
    } catch (error) {
      console.error('Error registering upgrade interest:', error);
      const errorMessage = 'Failed to register interest. Please try again.';
      toast.error(errorMessage);
      setLoadingError(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      stopLoading();
    }
  };

  const handleMaybeLater = () => {
    onClose();
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onClose();
  };

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('UpgradeInterestModal error:', error, errorInfo);
        toast.error('Something went wrong with the upgrade modal. Please try again.');
      }}
    >
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-white border border-gray-200 shadow-xl">
          <AnimatePresence mode="wait">
          {!showSuccess ? (
            <motion.div
              key="upgrade-prompt"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white"
            >
              <DialogHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <DialogTitle className="text-xl font-bold text-gray-900" style={{ color: '#111827' }}>
                  Agent Limit Reached
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Current Situation */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-orange-800">Current Limit Reached</span>
                  </div>
                  <p className="text-sm text-orange-700" style={{ color: '#c2410c' }}>
                    You tried to import <strong className="text-orange-900" style={{ color: '#7c2d12' }}>{attemptedCount}</strong> {limitType}, but you've already reached your limit of <strong className="text-orange-900" style={{ color: '#7c2d12' }}>{maxCount}</strong> {limitType}.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                      {currentCount} / {maxCount} {limitType} used
                    </Badge>
                  </div>
                </div>

                {/* Upgrade Offer */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold text-purple-800">Unlock Unlimited Agents</span>
                  </div>
                  <p className="text-sm text-purple-700 mb-3" style={{ color: '#7c3aed' }}>
                    Ready to scale your AI operations? Get unlimited access to all agent types and unlock the full potential of Knotie AI Pro.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-purple-700 mb-1" style={{ color: '#7c3aed' }}>
                    <CheckCircle className="h-4 w-4 text-purple-600" />
                    <span>Unlimited agents across all providers</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-purple-700 mb-1" style={{ color: '#7c3aed' }}>
                    <CheckCircle className="h-4 w-4 text-purple-600" />
                    <span>Priority support & custom solutions</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-purple-700" style={{ color: '#7c3aed' }}>
                    <CheckCircle className="h-4 w-4 text-purple-600" />
                    <span>Best pricing tailored for your needs</span>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <h4 className="font-semibold text-blue-800 mb-2" style={{ color: '#1e40af' }}>
                    🎯 Let's find the perfect plan for you!
                  </h4>
                  <p className="text-sm text-blue-700" style={{ color: '#1d4ed8' }}>
                    Click below to let us know you're interested. Our team will reach out with the best offer we can provide based on your specific needs.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <LoadingButton
                    loading={loading}
                    onClick={handleInterested}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                  >
                    <>
                      I'm Interested!
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  </LoadingButton>
                  <Button
                    variant="outline"
                    onClick={handleMaybeLater}
                    disabled={loading}
                    className="px-6 border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Maybe Later
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center py-6 bg-white"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ color: '#111827' }}>
                Interest Registered! 🎉
              </h3>
              <p className="text-sm text-gray-600 mb-6" style={{ color: '#4b5563' }}>
                Thank you for your interest! Someone from our team will reach out soon with a personalized offer tailored to your needs.
              </p>
              <Button
                onClick={handleSuccessClose}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Got it!
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
    </ErrorBoundary>
  );
}
