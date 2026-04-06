import React, { useState, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useLiveStats } from '../../context/LiveStatsContext';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 2000,
  className = '',
  prefix = '',
  suffix = '',
  decimals = 0
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const spring = useSpring(0, { 
    stiffness: 100, 
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      setDisplayValue(latest);
    });

    return () => unsubscribe();
  }, [spring]);

  const formattedValue = displayValue.toFixed(decimals);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {prefix}{formattedValue}{suffix}
    </motion.span>
  );
};

interface LiveMemberCounterProps {
  initialCount?: number;
  className?: string;
  onCountUpdate?: (count: number) => void;
  baseCount?: number; // Base number to add to the live count
}

export const LiveMemberCounter: React.FC<LiveMemberCounterProps> = ({
  initialCount = 50,
  className = '',
  onCountUpdate,
  baseCount = 137
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const { getTotalCount, isLoading } = useLiveStats();

  // Get total count from context (base count + live count)
  const totalCount = getTotalCount();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && onCountUpdate) {
      onCountUpdate(totalCount);
    }
  }, [isMounted, totalCount, onCountUpdate]);

  // Prevent hydration mismatch by showing static content until mounted
  if (!isMounted) {
    return (
      <span className={`font-bold ${className}`}>
        {baseCount}+
      </span>
    );
  }

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <AnimatedCounter
        value={totalCount}
        className="font-bold"
        suffix="+"
      />

      {/* Live indicator */}
      <motion.div
        className="ml-2 flex items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className="w-2 h-2 bg-green-400 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.7, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <span className="text-xs text-green-400 font-medium">LIVE</span>
      </motion.div>

      {/* Loading indicator */}
      {isLoading && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 border border-blue-400 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
};

// Specialized counter for different contexts
export const HeroMemberCounter: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <LiveMemberCounter
      initialCount={0}
      baseCount={137}
      className={`text-transparent bg-gradient-to-r from-teal-400 via-blue-400 to-purple-400 bg-clip-text ${className}`}
    />
  );
};

export const ReviewsMemberCounter: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <LiveMemberCounter
      initialCount={0}
      baseCount={137}
      className={`text-transparent bg-gradient-to-r from-teal-400 via-blue-400 to-purple-400 bg-clip-text ${className}`}
    />
  );
};
