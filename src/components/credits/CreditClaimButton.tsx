'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, Star } from 'lucide-react';

interface PendingClaim {
  type: 'onboarding' | 'daily_challenge';
  referenceId?: string;
  credits: number;
  title: string;
  description: string;
}

interface CreditClaimButtonProps {
  partnerId: string;
  onClaimClick?: (claim: PendingClaim) => void;
  onClaimSuccess?: () => void;
  className?: string;
}

// Export the refresh function for external use
export interface CreditClaimButtonRef {
  refreshClaims: () => void;
}

export default function CreditClaimButton({
  partnerId,
  onClaimClick,
  onClaimSuccess,
  className = ''
}: CreditClaimButtonProps) {
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    fetchPendingClaims();
  }, [partnerId]);

  // Refresh claims when component mounts or partnerId changes
  const refreshClaims = () => {
    fetchPendingClaims();
  };

  // Handle external success callback
  useEffect(() => {
    if (onClaimSuccess) {
      // Create a custom event listener for claim success
      const handleClaimSuccess = () => {
        refreshClaims();
        onClaimSuccess();
      };

      // Listen for custom events or just call when needed
      window.addEventListener('creditClaimSuccess', handleClaimSuccess);
      return () => window.removeEventListener('creditClaimSuccess', handleClaimSuccess);
    }
  }, [onClaimSuccess]);

  // Listen for challenge completion events to refresh claims
  useEffect(() => {
    const handleChallengeCompleted = () => {
      console.log('Challenge completed, refreshing claims...');
      refreshClaims();
    };

    window.addEventListener('challengeCompleted', handleChallengeCompleted);
    return () => window.removeEventListener('challengeCompleted', handleChallengeCompleted);
  }, []);

  const fetchPendingClaims = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/credits/pending-claims', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingClaims(data.claims || []);
      }
    } catch (error) {
      console.error('Error fetching pending claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimClick = () => {
    setIsAnimating(true);

    // Trigger modal instead of popup
    if (onClaimClick && pendingClaims.length > 0) {
      const primaryClaim = pendingClaims.reduce((highest, current) =>
        current.credits > highest.credits ? current : highest
      );
      onClaimClick(primaryClaim);
    }

    // Reset animation after a delay
    setTimeout(() => {
      setIsAnimating(false);
    }, 1000);
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-12 bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  if (pendingClaims.length === 0) {
    return null;
  }

  // Show the highest value claim first
  const primaryClaim = pendingClaims.reduce((highest, current) => 
    current.credits > highest.credits ? current : highest
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`relative overflow-hidden ${className}`}
      >
        {/* Animated Background */}
        <motion.div
          className="absolute inset-0 rounded-lg bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20"
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            backgroundSize: '200% 200%',
          }}
        />

        {/* Sparkle Effects */}
        <div className="absolute inset-0 overflow-hidden rounded-lg">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                scale: [0, 1, 0],
                rotate: [0, 180, 360],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
                ease: 'easeInOut',
              }}
            >
              <Sparkles className="w-3 h-3 text-yellow-400" />
            </motion.div>
          ))}
        </div>

        {/* Main Button */}
        <motion.button
          onClick={handleClaimClick}
          disabled={isAnimating}
          className="relative w-full px-4 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          animate={isAnimating ? {
            scale: [1, 1.05, 1],
            rotate: [0, 2, -2, 0],
          } : {}}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-center space-x-2">
            <motion.div
              animate={isAnimating ? { rotate: 360 } : {}}
              transition={{ duration: 0.5 }}
            >
              <Gift className="w-5 h-5" />
            </motion.div>
            
            <div className="text-left">
              <div className="text-sm font-bold">
                Claim {primaryClaim.credits} Credits!
              </div>
              <div className="text-xs opacity-90">
                {primaryClaim.title}
              </div>
            </div>

            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                >
                  <Star className="w-3 h-3 text-yellow-200" fill="currentColor" />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Shine Effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent overflow-hidden"
            style={{
              transform: 'skewX(-20deg)',
            }}
            animate={{
              x: ['-50%', '150%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
              ease: 'easeInOut',
            }}
          />
        </motion.button>

        {/* Additional Claims Indicator */}
        {pendingClaims.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10"
          >
            {pendingClaims.length}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
