'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import UpgradeModal from './UpgradeModal';

interface PremiumFeatureProps {
  children: React.ReactNode;
  tooltipText?: string;
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg';
}

const PremiumFeature: React.FC<PremiumFeatureProps> = ({
  children,
  tooltipText,
  className = '',
  iconSize = 'md'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isFreeTier, setIsFreeTier] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
  const iconRef = useRef<HTMLDivElement>(null);

  // Consistent icon sizes - making them more visible
  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18
  };

  // Check subscription status on mount
  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  // Get appropriate tooltip text based on subscription status
  const getTooltipText = () => {
    if (tooltipText) return tooltipText;

    if (isFreeTier) {
      return "This is a Premium feature. Upgrade to a paid plan to unlock advanced capabilities and enhanced functionality for your agency.";
    } else {
      return "This is a Premium feature available with your current subscription plan.";
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setIsFreeTier(true);
        setIsCheckingSubscription(false);
        return;
      }

      const response = await fetch('/api/partner/subscription', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Free tier users have subscriptionStatus !== 'ACTIVE'
        setIsFreeTier(data.data?.partner?.subscriptionStatus !== 'ACTIVE');
      } else {
        // If API fails, assume free tier to be safe
        setIsFreeTier(true);
      }
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      // If check fails, assume free tier to be safe
      setIsFreeTier(true);
    } finally {
      setIsCheckingSubscription(false);
    }
  };

  const calculatePosition = () => {
    if (!iconRef.current) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Popup dimensions - wider for horizontal layout
    const popupWidth = 400;
    const popupHeight = 140;

    // Perfect center positioning with padding
    const left = Math.max(20, (viewportWidth - popupWidth) / 2);
    const top = Math.max(scrollTop + 50, (viewportHeight - popupHeight) / 2 + scrollTop);

    setPosition({ top, left });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isVisible) {
      calculatePosition();
    }
    setIsVisible(!isVisible);
  };

  const handleUpgradeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
    setShowUpgradeModal(true);
  };

  const handleUpgradeSuccess = () => {
    setShowUpgradeModal(false);
    toast.success('🎉 Welcome to Premium! Your account has been upgraded successfully. All premium features are now unlocked!');
    // Refresh subscription status
    checkSubscriptionStatus();
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconRef.current && !iconRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVisible]);

  // Recalculate position on scroll/resize
  useEffect(() => {
    if (isVisible) {
      const handleReposition = () => calculatePosition();
      window.addEventListener('scroll', handleReposition, { passive: true });
      window.addEventListener('resize', handleReposition);

      return () => {
        window.removeEventListener('scroll', handleReposition);
        window.removeEventListener('resize', handleReposition);
      };
    }
  }, [isVisible]);

  return (
    <>
      <div className={`relative inline-flex items-center gap-2 ${className}`}>
        {children}
        <div
          ref={iconRef}
          className="relative cursor-pointer hover:scale-110 transition-all duration-200 flex-shrink-0 ml-1"
          onClick={handleClick}
          title="Click to learn more about this premium feature"
        >
          <img
            src="/portals/diamond.svg"
            alt="Premium Feature"
            width={iconSizes[iconSize]}
            height={iconSizes[iconSize]}
            className="flex-shrink-0 opacity-90 hover:opacity-100 transition-opacity filter drop-shadow-sm"
          />
        </div>
      </div>

      {/* Portal-style popup that renders at document level */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-[99999] pointer-events-auto"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
          >
            <div className="bg-gray-900/95 backdrop-blur-sm text-white text-sm rounded-xl p-4 shadow-2xl border border-cyan-400/30 w-96 max-w-[400px]">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <img
                    src="/portals/diamond.svg"
                    alt="Premium"
                    width={18}
                    height={18}
                    className="opacity-90"
                  />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-cyan-300 mb-2 text-base">Premium Feature</h4>
                  <p className="leading-relaxed text-gray-200 text-sm mb-3">{getTooltipText()}</p>

                  {/* Show upgrade button only for free tier users */}
                  {isFreeTier && !isCheckingSubscription && (
                    <button
                      onClick={handleUpgradeClick}
                      className="w-full mt-3 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg shadow-purple-500/20"
                    >
                      Upgrade Now
                    </button>
                  )}
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => setIsVisible(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={handleUpgradeSuccess}
      />
    </>
  );
};

export default PremiumFeature;
