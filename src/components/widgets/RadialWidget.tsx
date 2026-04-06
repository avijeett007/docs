"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useUnifiedVoiceProvider } from '@/hooks/useUnifiedVoiceProvider';
import { WidgetConfig } from '@/providers/types';
import WidgetBranding from './WidgetBranding';
import InteractionHint from './InteractionHint';

interface RadialWidgetProps {
  config: WidgetConfig;
  onError?: (error: string) => void;
  onCallStart?: () => void;
  onCallEnd?: () => void;
  previewMode?: boolean;
  // Real functionality props
  publicKey?: string;
  accessToken?: string;
  fetchCredentials?: () => Promise<{ publicKey?: string; accessToken?: string }>;
}

const RadialWidget: React.FC<RadialWidgetProps> = ({
  config,
  onError,
  onCallStart,
  onCallEnd,
  previewMode = false,
  publicKey,
  accessToken
}) => {
  const {
    isLoading,
    isConnected,
    isCallActive,
    volume,
    error,
    startCall,
    endCall
  } = useUnifiedVoiceProvider({
    providerName: config.agentType,
    config: config.providerConfig,
    autoInitialize: !previewMode,
    previewMode,
    publicKey,
    accessToken,
    onCallStart,
    onCallEnd,
    onError: onError ? (err) => onError(err.message) : undefined
  });

  const [bars, setBars] = useState(Array(50).fill(0));
  const animationFrameRef = useRef<number>();
  const currentVolumeRef = useRef<number>(0);

  // Define animation functions first
  // Continuous animation function like OrbWidget
  const animateBars = useCallback(() => {
    const volumeLevel = currentVolumeRef.current;
    if (volumeLevel > 0) {
      setBars(prevBars => prevBars.map((_, index) => {
        // Add some variation based on bar position for more natural look
        const baseHeight = volumeLevel * 40; // Base height from volume
        const variation = Math.sin(Date.now() * 0.01 + index * 0.5) * volumeLevel * 10; // Smooth variation
        const randomness = Math.random() * volumeLevel * 20; // Random component
        return Math.max(0, baseHeight + variation + randomness);
      }));
    }
    animationFrameRef.current = requestAnimationFrame(animateBars);
  }, []);

  const updateBars = useCallback((volumeLevel: number) => {
    currentVolumeRef.current = volumeLevel;

    // Start continuous animation if not already running
    if (volumeLevel > 0 && !animationFrameRef.current) {
      animateBars();
    }
  }, [animateBars]);

  const resetBars = useCallback(() => {
    currentVolumeRef.current = 0;
    // Stop animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    setBars(Array(50).fill(0));
  }, []);

  // Handle call events
  useEffect(() => {
    if (isCallActive && onCallStart) {
      onCallStart();
    }
  }, [isCallActive, onCallStart]);

  useEffect(() => {
    if (!isCallActive && onCallEnd) {
      onCallEnd();
    }
  }, [isCallActive, onCallEnd]);

  // Update bars based on volume (animate when we have volume, regardless of call state)
  useEffect(() => {
    if (volume > 0) {
      // Animate when we have volume, regardless of call state (like OrbWidget)
      updateBars(volume);
    } else if (isCallActive) {
      // Active but no volume - gentle animation
      updateBars(0.1);
    } else {
      resetBars();
    }
  }, [volume, isCallActive, updateBars, resetBars]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleToggleCall = async () => {
    try {
      if (isCallActive) {
        await endCall();
      } else {
        await startCall();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle call';
      console.error('[RadialWidget] Call toggle error:', errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const getButtonIcon = () => {
    if (isLoading) {
      return <Loader2 size={24} className="animate-spin" />;
    }
    if (isCallActive) {
      return <MicOff size={24} />;
    }
    return <Mic size={28} />;
  };

  const getButtonColor = () => {
    if (isCallActive) {
      return config.customization.appearance.primaryColor;
    }
    return config.customization.appearance.secondaryColor || '#6B7280';
  };

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-full"
      style={{ 
        backgroundColor: config.customization.appearance.backgroundColor,
        color: config.customization.appearance.textColor,
        borderRadius: `${config.customization.appearance.borderRadius}px`
      }}
    >
      {/* Welcome message */}
      {!isCallActive && config.customization.messages.welcomeMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-center mb-4 px-4"
          style={{ color: config.customization.appearance.textColor }}
        >
          {config.customization.messages.welcomeMessage}
        </motion.div>
      )}

      {/* Radial Visualization Container */}
      <div className="relative flex items-center justify-center" style={{ width: '300px', height: '300px' }}>
        {/* Central Button */}
        <button
          onClick={handleToggleCall}
          disabled={isLoading}
          className="relative z-10 flex items-center justify-center rounded-full transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-opacity-50"
          style={{
            backgroundColor: getButtonColor(),
            color: 'white',
            width: '60px',
            height: '60px',
            boxShadow: `0 4px 20px ${getButtonColor()}40`
          }}
        >
          {getButtonIcon()}
        </button>

        {/* Radial Bars */}
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 300 300" 
          className="absolute top-0 left-0"
        >
          {bars.map((height, index) => {
            const angle = (index / bars.length) * 360;
            const radians = (angle * Math.PI) / 180;
            const x1 = 150 + Math.cos(radians) * 50;
            const y1 = 150 + Math.sin(radians) * 50;
            const x2 = 150 + Math.cos(radians) * (100 + height);
            const y2 = 150 + Math.sin(radians) * (100 + height);

            return (
              <motion.line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={config.customization.appearance.primaryColor}
                strokeWidth="2"
                opacity={0.7}
                initial={{ x2: x1, y2: y1 }}
                animate={{ x2, y2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
            );
          })}
        </svg>

        {/* Glow Effect */}
        {isCallActive && (
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-30"
            style={{
              backgroundColor: config.customization.appearance.primaryColor,
              width: '200px',
              height: '200px'
            }}
          />
        )}
      </div>

      {/* Button Text */}
      {config.customization.messages.buttonText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-center mt-4"
          style={{ color: config.customization.appearance.textColor }}
        >
          {config.customization.messages.buttonText}
        </motion.div>
      )}

      {/* Status Display */}
      {isCallActive && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-center mt-2 px-3 py-1 rounded-full"
          style={{ 
            backgroundColor: `${config.customization.appearance.primaryColor}20`,
            color: config.customization.appearance.textColor
          }}
        >
          {isConnected ? 'Connected' : 'Connecting...'}
        </motion.div>
      )}

      {/* Error Display - only show in preview mode */}
      {error && previewMode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 rounded-lg bg-red-100 text-red-800 text-sm text-center max-w-md"
        >
          {error}
        </motion.div>
      )}

      {/* Interactive Hint */}
      <InteractionHint
        config={config}
        isCallActive={isCallActive}
        isLoading={isLoading}
        position="bottom"
      />

      {/* Widget Branding */}
      <WidgetBranding config={config} />
    </div>
  );
};

export default RadialWidget;
