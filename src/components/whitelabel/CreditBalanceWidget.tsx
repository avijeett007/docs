'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiDollarSign, FiPlus, FiAlertCircle } from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface CreditBalance {
  creditBalance: number;
  monthlyCreditAllocation: number;
  lowCreditAlert: boolean;
  lowCreditThreshold: number | null;
  aiCreditsEnabled: boolean; // Add this to determine if Knotie Credits are enabled
}

interface CreditBalanceWidgetProps {
  collapsed?: boolean;
  onAddCreditsClick?: () => void;
  refreshTrigger?: number; // Add this to trigger refresh from parent
  onCreditUpdate?: (credits: number) => void; // Callback for credit updates
}

// Format a credit value: show up to 2 decimal places, but hide trailing zeros
// e.g. 12.50 → "12.5", 12.00 → "12", 0.3456 → "0.35"
const formatCredits = (val: number): string => {
  if (Number.isInteger(val)) return val.toLocaleString();
  // Show up to 2 decimal places, strip trailing zeros
  const formatted = val.toFixed(2).replace(/\.?0+$/, '');
  return formatted;
};

// Casino-style number animation component (supports fractional values)
const AnimatedNumber = ({ value, duration = 1000, primaryColor = '#10b981' }: { value: number; duration?: number; primaryColor?: string }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (displayValue === value) return;

    setIsAnimating(true);
    const startValue = displayValue;
    const difference = value - startValue;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      // Use precise intermediate values (round to 2 decimals for display smoothness)
      const currentValue = parseFloat((startValue + (difference * easeOutQuart)).toFixed(2));

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value); // Snap to exact final value
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, displayValue]);

  return (
    <motion.span
      className="font-bold"
      style={isAnimating ? { color: primaryColor } : {}}
      animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {formatCredits(displayValue)}
    </motion.span>
  );
};

const CreditBalanceWidget: React.FC<CreditBalanceWidgetProps> = ({
  collapsed = false,
  onAddCreditsClick,
  refreshTrigger,
  onCreditUpdate
}) => {
  const [creditData, setCreditData] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [previousCredits, setPreviousCredits] = useState<number>(0);
  const { branding } = usePartnerBranding();
  const pollIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchCreditBalance();

    // Start live polling every 30 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchCreditBalance();
    }, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      fetchCreditBalance();
    }
  }, [refreshTrigger]);

  // Listen for custom refresh events
  useEffect(() => {
    const handleRefreshCredits = () => {
      fetchCreditBalance();
    };

    window.addEventListener('refreshCredits', handleRefreshCredits);
    return () => {
      window.removeEventListener('refreshCredits', handleRefreshCredits);
    };
  }, []);

  const fetchCreditBalance = async () => {
    try {
      const response = await fetch('/api/whitelabel/credits/balance', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const newCreditData = data.data;
          const newCredits = newCreditData.creditBalance;

          // Update previous credits for animation
          if (creditData) {
            setPreviousCredits(creditData.creditBalance);
          }

          setCreditData(newCreditData);

          // Call the callback with new credit amount
          if (onCreditUpdate) {
            onCreditUpdate(newCredits);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching credit balance:', error);
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className={`px-2 md:px-4 pb-4 ${collapsed ? 'px-1 md:px-2' : ''}`}>
        <div className="bg-gray-800/50 rounded-lg p-3 animate-pulse">
          <div className="h-4 bg-gray-700 rounded mb-2"></div>
          <div className="h-6 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!creditData) {
    return null;
  }

  // Don't show credit widget if AI Credits are not enabled
  if (!creditData.aiCreditsEnabled) {
    return null;
  }

  if (collapsed) {
    return (
      <div className="px-1 md:px-2 pb-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gray-800/50 rounded-lg p-2 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
          onClick={onAddCreditsClick}
          style={{
            borderColor: creditData.lowCreditAlert ? '#ef4444' : `${branding.primaryColor}40`,
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1 mb-1">
              <FiDollarSign 
                className="w-3 h-3" 
                style={{ color: creditData.lowCreditAlert ? '#ef4444' : branding.primaryColor }}
              />
              {creditData.lowCreditAlert && (
                <FiAlertCircle className="w-3 h-3 text-red-400" />
              )}
            </div>
            <div
              className="text-sm"
              style={{ color: creditData.lowCreditAlert ? '#ef4444' : branding.primaryColor }}
            >
              <AnimatedNumber value={creditData.creditBalance} primaryColor={branding.primaryColor} />
            </div>
            <div className="text-[10px] text-gray-400">Credits</div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-4 pb-4">
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
        style={{
          borderColor: creditData.lowCreditAlert ? '#ef4444' : `${branding.primaryColor}40`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div 
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: `${branding.primaryColor}20` }}
            >
              <FiDollarSign 
                className="w-4 h-4" 
                style={{ color: branding.primaryColor }}
              />
            </div>
            <span className="text-sm font-medium text-gray-300">Balance</span>
          </div>
          {creditData.lowCreditAlert && (
            <FiAlertCircle className="w-4 h-4 text-red-400" />
          )}
        </div>

        {/* Credit Balance */}
        <div className="mb-3">
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl"
              style={{ color: creditData.lowCreditAlert ? '#ef4444' : branding.primaryColor }}
            >
              <AnimatedNumber value={creditData.creditBalance} primaryColor={branding.primaryColor} />
            </span>
            <span className="text-sm text-gray-400">AI Credits</span>
          </div>
          
          {creditData.monthlyCreditAllocation > 0 && (
            <div className="text-xs text-gray-400 mt-1">
              Monthly: {creditData.monthlyCreditAllocation.toLocaleString()}
            </div>
          )}
        </div>

        {/* Low Credit Warning */}
        {creditData.lowCreditAlert && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="text-xs text-red-400 font-medium">
              Low Credit Alert
            </div>
            <div className="text-xs text-red-300">
              Below {creditData.lowCreditThreshold} credits
            </div>
          </div>
        )}

        {/* Add Credits Button */}
        <button
          onClick={onAddCreditsClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors"
          style={{
            backgroundColor: branding.primaryColor,
            color: '#ffffff',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          <FiPlus className="w-4 h-4" />
          Add Credits
        </button>
      </motion.div>
    </div>
  );
};

export default CreditBalanceWidget;
