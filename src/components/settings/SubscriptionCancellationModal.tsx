'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  FiX,
  FiAlertTriangle,
  FiHeart,
  FiDollarSign,
  FiGift,
  FiMessageSquare,

  FiChevronRight,
  FiChevronLeft,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface RetentionOffer {
  id: string;
  type: string;
  title: string;
  description: string;
  benefits: string[];
  action: string;
  discount?: {
    percentage: number;
    duration: number;
    unit: string;
  } | null;
}

interface RetentionData {
  partnerId: string;
  reason: string;
  offers: RetentionOffer[];
  retentionVideo: {
    url: string;
    title: string;
    description: string;
  };
}

interface SubscriptionCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type CancellationStep = 'reason' | 'retention_video' | 'retention_offers' | 'confirmation';

const cancellationReasons = [
  { id: 'too_expensive', label: 'Too expensive', icon: FiDollarSign },
  { id: 'not_meeting_needs', label: 'Not meeting my needs', icon: FiAlertTriangle },
  { id: 'missing_features', label: 'Missing features I need', icon: FiMessageSquare },
  { id: 'poor_support', label: 'Poor customer support', icon: FiHeart },
  { id: 'technical_issues', label: 'Technical issues', icon: FiAlertTriangle },
  { id: 'switching_provider', label: 'Switching to another provider', icon: FiChevronRight },
  { id: 'business_closure', label: 'Closing my business', icon: FiX },
  { id: 'other', label: 'Other reason', icon: FiMessageSquare },
];

export default function SubscriptionCancellationModal({
  isOpen,
  onClose,
  onSuccess,
}: SubscriptionCancellationModalProps) {
  const [currentStep, setCurrentStep] = useState<CancellationStep>('reason');
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [retentionData, setRetentionData] = useState<RetentionData | null>(null);
  const [, setSelectedOffer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep('reason');
      setSelectedReason('');
      setCustomReason('');
      setRetentionData(null);
      setSelectedOffer(null);

    }
  }, [isOpen]);

  const fetchRetentionOffers = async (reason: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/subscription/retention-offers?reason=${reason}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch retention offers');
      }

      const data = await response.json();
      if (data.success) {
        setRetentionData(data.data);
      }
    } catch (error) {
      // Error fetching retention offers
      toast.error('Failed to load retention offers');
    }
  };

  const handleReasonNext = async () => {
    if (!selectedReason) {
      toast.error('Please select a reason for cancellation');
      return;
    }

    setLoading(true);
    await fetchRetentionOffers(selectedReason);
    setLoading(false);
    setCurrentStep('retention_video');
  };

  const handleVideoNext = () => {
    setCurrentStep('retention_offers');
  };

  const handleOfferAccept = async (offerId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      
      const response = await fetch('/api/partner/subscription/retention-offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          offerId,
          additionalData: {
            originalReason: selectedReason,
            customReason: customReason,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to accept retention offer');
      }

      const data = await response.json();
      if (data.success) {
        toast.success(data.data.message);
        onSuccess();
      } else {
        throw new Error(data.error || 'Failed to accept offer');
      }
    } catch (error) {
      // Error handled silently for production
      toast.error('Failed to accept offer');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalCancel = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      
      const response = await fetch('/api/partner/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: selectedReason,
          feedback: customReason,
          immediate: false,
          acceptedRetention: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      const data = await response.json();
      if (data.success) {
        toast.success(data.data.message);
        onSuccess();
      } else {
        throw new Error(data.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      // Error handled silently for production
      toast.error('Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const getOfferIcon = (type: string) => {
    switch (type) {
      case 'discount': return FiDollarSign;
      case 'feature_access': return FiGift;
      case 'service': return FiHeart;
      case 'pause': return FiAlertTriangle;
      default: return FiMessageSquare;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              {currentStep === 'reason' && 'We\'re sorry to see you go'}
              {currentStep === 'retention_video' && 'Before you leave...'}
              {currentStep === 'retention_offers' && 'Special offers just for you'}
              {currentStep === 'confirmation' && 'Confirm cancellation'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Reason Selection */}
            {currentStep === 'reason' && (
              <motion.div
                key="reason"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <p className="text-gray-300 mb-6">
                    Help us understand why you're cancelling so we can improve our service.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cancellationReasons.map((reason) => {
                    const Icon = reason.icon;
                    return (
                      <button
                        key={reason.id}
                        onClick={() => setSelectedReason(reason.id)}
                        className={`flex items-center gap-3 p-4 rounded-lg border transition-colors text-left ${
                          selectedReason === reason.id
                            ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                            : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{reason.label}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedReason === 'other' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Please tell us more:
                    </label>
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      rows={3}
                      placeholder="What could we have done better?"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReasonNext}
                    disabled={!selectedReason || loading}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    Continue
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Retention Video */}
            {currentStep === 'retention_video' && retentionData && (
              <motion.div
                key="video"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h3 className="text-lg font-medium text-white mb-2">
                    {retentionData.retentionVideo.title}
                  </h3>
                  <p className="text-gray-300">
                    {retentionData.retentionVideo.description}
                  </p>
                </div>

                <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                  <iframe
                    src={retentionData.retentionVideo.url}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => {}}
                  />
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentStep('reason')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCurrentStep('confirmation')}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Skip Video
                    </button>
                    <button
                      onClick={handleVideoNext}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      See Special Offers
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Retention Offers */}
            {currentStep === 'retention_offers' && retentionData && (
              <motion.div
                key="offers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h3 className="text-lg font-medium text-white mb-2">
                    We'd love to keep you as a customer
                  </h3>
                  <p className="text-gray-300">
                    Here are some special offers we can provide to address your concerns:
                  </p>
                </div>

                <div className="space-y-4">
                  {retentionData.offers.map((offer) => {
                    const Icon = getOfferIcon(offer.type);
                    return (
                      <div
                        key={offer.id}
                        className="border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Icon className="w-5 h-5 text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-white font-medium mb-2">{offer.title}</h4>
                            <p className="text-gray-300 text-sm mb-3">{offer.description}</p>
                            <ul className="space-y-1 mb-4">
                              {offer.benefits.map((benefit, index) => (
                                <li key={index} className="text-sm text-gray-400 flex items-center gap-2">
                                  <div className="w-1 h-1 bg-blue-400 rounded-full" />
                                  {benefit}
                                </li>
                              ))}
                            </ul>
                            <button
                              onClick={() => handleOfferAccept(offer.id)}
                              disabled={loading}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                            >
                              Accept This Offer
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setCurrentStep('retention_video')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={() => setCurrentStep('confirmation')}
                    className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors"
                  >
                    No thanks, cancel my subscription
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Final Confirmation */}
            {currentStep === 'confirmation' && (
              <motion.div
                key="confirmation"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiAlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    Are you sure you want to cancel?
                  </h3>
                  <p className="text-gray-300">
                    Your subscription will be cancelled at the end of your current billing period.
                    You'll lose access to all features and your data may be deleted.
                  </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <h4 className="text-red-400 font-medium mb-2">What happens when you cancel:</h4>
                  <ul className="space-y-1 text-sm text-red-300">
                    <li>• All your agents will be deactivated</li>
                    <li>• Customer access will be suspended</li>
                    <li>• Analytics data will be preserved for 90 days</li>
                    <li>• You can reactivate within 30 days to restore access</li>
                  </ul>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentStep('retention_offers')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                    Back to Offers
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Keep Subscription
                    </button>
                    <button
                      onClick={handleFinalCancel}
                      disabled={loading}
                      className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Cancelling...' : 'Yes, Cancel Subscription'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
