"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useUnifiedVoiceProvider } from '@/hooks/useUnifiedVoiceProvider';
import { WidgetConfig } from '@/providers/types';
import WidgetBranding from './WidgetBranding';
import InteractionHint from './InteractionHint';

interface GlobWidgetProps {
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

const GlobWidget: React.FC<GlobWidgetProps> = ({
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

  const [globConfig, setGlobConfig] = useState({
    perlinTime: 5.0,
    perlinMorph: 0,
    perlinDNoise: 0.0,
    chromaRGBr: 7.5,
    chromaRGBg: 5.0,
    chromaRGBb: 7.0,
    chromaRGBn: 1.0,
    chromaRGBm: 1.0,
    sphereWireframe: false,
    spherePoints: false,
    spherePsize: 1.0,
    cameraSpeedY: 0.0,
    cameraSpeedX: 0.0,
    cameraZoom: 175,
    cameraGuide: false,
  });

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

  // Update glob animation based on volume (animate when we have volume, regardless of call state)
  useEffect(() => {
    if (volume > 0) {
      // Animate when we have volume, regardless of call state (like OrbWidget)
      // Make animation intensity proportional to volume (like OrbWidget's volumeLevel * 4)
      const intensity = volume * 4; // Amplify volume effect like OrbWidget
      setGlobConfig(prevConfig => ({
        ...prevConfig,
        perlinTime: 50.0 + intensity * 20, // Dynamic animation speed
        perlinMorph: 10.0 + intensity * 6,  // Dynamic morphing intensity
      }));
    } else if (isCallActive) {
      setGlobConfig(prevConfig => ({
        ...prevConfig,
        perlinTime: 25.0,
        perlinMorph: 10.0,
      }));
    } else {
      setGlobConfig(prevConfig => ({
        ...prevConfig,
        perlinTime: 5.0,
        perlinMorph: 0,
      }));
    }
  }, [isCallActive, volume]);

  const handleToggleCall = async () => {
    try {
      if (isCallActive) {
        await endCall();
      } else {
        await startCall();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle call';
      console.error('[GlobWidget] Call toggle error:', errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const getButtonIcon = () => {
    if (isLoading) {
      return <Loader2 size={20} className="animate-spin" />;
    }
    if (isCallActive) {
      return <MicOff size={20} />;
    }
    return <Mic size={20} />;
  };

  const getButtonColor = () => {
    if (isCallActive) {
      return config.customization.appearance.primaryColor;
    }
    return config.customization.appearance.secondaryColor || '#6B7280';
  };

  // Simplified 3D visualization using CSS animations instead of Three.js
  const renderSimplifiedGlob = () => (
    <div className="relative flex items-center justify-center" style={{ width: '200px', height: '200px' }}>
      {/* Animated Orb */}
      <div
        className={`relative rounded-full transition-all duration-1000 ${
          isCallActive ? 'animate-pulse' : ''
        }`}
        style={{
          width: '120px',
          height: '120px',
          background: `radial-gradient(circle at 30% 30%, ${config.customization.appearance.primaryColor}40, ${config.customization.appearance.secondaryColor}80, ${config.customization.appearance.primaryColor}20)`,
          boxShadow: `0 0 ${20 + globConfig.perlinMorph}px ${config.customization.appearance.primaryColor}60`,
          animation: isCallActive ? `morphing ${2 - (globConfig.perlinTime / 100)}s ease-in-out infinite alternate` : 'idle 4s ease-in-out infinite',
          transform: `scale(${1 + (globConfig.perlinMorph / 100)})`,
        }}
      >
        {/* Inner glow layers */}
        <div
          className="absolute inset-2 rounded-full opacity-60"
          style={{
            background: `radial-gradient(circle at 60% 40%, ${config.customization.appearance.secondaryColor}60, transparent 70%)`,
            animation: isCallActive ? `innerGlow ${1.5 - (globConfig.perlinTime / 200)}s ease-in-out infinite alternate` : 'none',
            opacity: 0.6 + (globConfig.perlinMorph / 100),
          }}
        />
        <div
          className="absolute inset-4 rounded-full opacity-40"
          style={{
            background: `radial-gradient(circle at 40% 60%, ${config.customization.appearance.primaryColor}80, transparent 60%)`,
            animation: isCallActive ? 'innerGlow2 2.2s ease-in-out infinite alternate-reverse' : 'none',
          }}
        />
      </div>

      {/* Floating particles */}
      {isCallActive && (
        <>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full opacity-60"
              style={{
                backgroundColor: config.customization.appearance.primaryColor,
                top: `${20 + Math.sin(i * 0.8) * 60}%`,
                left: `${20 + Math.cos(i * 0.8) * 60}%`,
                animation: `float${i % 3} ${2 + i * 0.2}s ease-in-out infinite`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-full relative"
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

      {/* 3D Glob Visualization */}
      <div className="relative mb-4">
        {renderSimplifiedGlob()}
        
        {/* Central Control Button */}
        <button
          onClick={handleToggleCall}
          disabled={isLoading}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-opacity-50"
          style={{
            backgroundColor: getButtonColor(),
            color: 'white',
            width: '50px',
            height: '50px',
            boxShadow: `0 4px 20px ${getButtonColor()}40`
          }}
        >
          {getButtonIcon()}
        </button>
      </div>

      {/* Button Text */}
      {config.customization.messages.buttonText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-center mb-2"
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
          className="text-xs text-center px-3 py-1 rounded-full"
          style={{ 
            backgroundColor: `${config.customization.appearance.primaryColor}20`,
            color: config.customization.appearance.textColor
          }}
        >
          {isConnected ? 'Connected' : 'Connecting...'}
        </motion.div>
      )}

      {/* Error Display - only show in preview mode */}
      <AnimatePresence>
        {error && previewMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 p-3 rounded-lg bg-red-100 text-red-800 text-sm text-center max-w-md"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Hint */}
      <InteractionHint
        config={config}
        isCallActive={isCallActive}
        isLoading={isLoading}
        position="bottom"
      />

      {/* Widget Branding */}
      <WidgetBranding config={config} />

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes morphing {
          0% { transform: scale(1) rotate(0deg); border-radius: 50%; }
          50% { transform: scale(1.1) rotate(180deg); border-radius: 40% 60% 70% 30%; }
          100% { transform: scale(1) rotate(360deg); border-radius: 50%; }
        }
        
        @keyframes idle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes innerGlow {
          0% { opacity: 0.4; transform: scale(1); }
          100% { opacity: 0.8; transform: scale(1.2); }
        }
        
        @keyframes innerGlow2 {
          0% { opacity: 0.2; transform: scale(1) rotate(0deg); }
          100% { opacity: 0.6; transform: scale(1.1) rotate(180deg); }
        }
        
        @keyframes float0 {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.6; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 1; }
        }
        
        @keyframes float1 {
          0%, 100% { transform: translateX(0px) scale(1); opacity: 0.4; }
          50% { transform: translateX(15px) scale(1.1); opacity: 0.8; }
        }
        
        @keyframes float2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); opacity: 0.5; }
          50% { transform: translate(-10px, -15px) scale(1.3); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
};

export default GlobWidget;
