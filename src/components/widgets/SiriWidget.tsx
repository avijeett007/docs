"use client";

import React, { useState, useEffect } from 'react';
import { Mic, PhoneCall, Loader2 } from 'lucide-react';
import ReactSiriwave, { IReactSiriwaveProps } from 'react-siriwave';
import { motion, AnimatePresence } from 'framer-motion';
import { useUnifiedVoiceProvider } from '@/hooks/useUnifiedVoiceProvider';
import { WidgetConfig } from '@/providers/types';
import WidgetBranding from './WidgetBranding';
import InteractionHint from './InteractionHint';

// Define CurveStyle type
type CurveStyle = "ios" | "ios9";

interface SiriWidgetProps {
  config: WidgetConfig;
  theme?: CurveStyle;
  onError?: (error: string) => void;
  onCallStart?: () => void;
  onCallEnd?: () => void;
  previewMode?: boolean;
  // Real functionality props
  publicKey?: string;
  accessToken?: string;
  fetchCredentials?: () => Promise<{ publicKey?: string; accessToken?: string }>;
}

const SiriWidget: React.FC<SiriWidgetProps> = ({
  config,
  theme = "ios9",
  onError,
  onCallStart,
  onCallEnd,
  previewMode = false,
  publicKey,
  accessToken,
  fetchCredentials
}) => {
  const {
    isLoading,
    isConnected,
    isCallActive,
    volume,
    error,
    startCall,
    endCall,
    transcripts
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

  // Debug logging
  console.log('[SiriWidget] Config received:', {
    agentType: config.agentType,
    providerConfig: config.providerConfig,
    previewMode,
    publicKey: publicKey ? 'present' : 'missing',
    accessToken: accessToken ? 'present' : 'missing'
  });

  const [siriWaveConfig, setSiriWaveConfig] = useState<IReactSiriwaveProps>({
    theme: theme,
    ratio: 1,
    speed: 0.2,
    amplitude: 1,
    frequency: 6,
    color: config.customization.appearance.primaryColor || '#9E9E9E',
    cover: true,
    width: 300,
    height: 100,
    autostart: true,
    pixelDepth: 1,
    lerpSpeed: 0.1,
  });

  // Update wave animation based on volume (removed isCallActive dependency)
  useEffect(() => {
    setSiriWaveConfig(prevConfig => ({
      ...prevConfig,
      amplitude: volume > 0.01 ? volume * 7.5 : 0,
      speed: volume > 0.1 ? volume * 8 : 0,
      frequency: volume > 0.01 ? volume * 6 : 0,
      color: volume > 0.01
        ? config.customization.appearance.primaryColor
        : config.customization.appearance.secondaryColor || '#9E9E9E'
    }));
  }, [volume, config.customization.appearance]);

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

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleToggleCall = async () => {
    console.log('[SiriWidget] handleToggleCall called', {
      isLoading,
      isCallActive,
      isConnected,
      error,
      publicKey: publicKey ? 'present' : 'missing',
      accessToken: accessToken ? 'present' : 'missing',
      agentType: config.agentType
    });

    if (isLoading) {
      console.log('[SiriWidget] Skipping - already loading');
      return;
    }

    try {
      if (isCallActive) {
        console.log('[SiriWidget] Ending call...');
        await endCall();
      } else {
        console.log('[SiriWidget] Starting call...');

        // Fetch credentials if not available and fetchCredentials function is provided
        if (!publicKey && !accessToken && fetchCredentials) {
          console.log('[SiriWidget] Fetching credentials before starting call...');
          try {
            await fetchCredentials();
            console.log('[SiriWidget] Credentials fetched successfully');
          } catch (credError) {
            console.error('[SiriWidget] Failed to fetch credentials:', credError);
            if (onError) {
              onError('Failed to get call credentials. Please try again.');
            }
            return;
          }
        }

        await startCall();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle call';
      console.error('[SiriWidget] Call toggle error:', errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const getButtonColor = () => {
    if (isCallActive) {
      return config.customization.appearance.primaryColor;
    }
    return config.customization.appearance.secondaryColor || '#6B7280';
  };

  const getButtonIcon = () => {
    if (isLoading) {
      return <Loader2 size={20} className="animate-spin" />;
    }
    if (isCallActive) {
      return <PhoneCall size={20} />;
    }
    return <Mic size={20} />;
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

      {/* Main widget interface */}
      <div className="flex items-center justify-center relative">
        <motion.button
          key="callButton"
          onClick={handleToggleCall}
          disabled={isLoading}
          className="p-3 rounded-xl shadow-lg transition-all duration-200 relative"
          style={{
            backgroundColor: getButtonColor(),
            color: 'white',
            boxShadow: isCallActive ? `0 0 20px ${config.customization.appearance.primaryColor}40` : undefined
          }}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: isLoading ? 1 : 1.1 }}
          initial={{ x: 0 }}
          animate={{
            x: isCallActive ? -10 : 0,
            boxShadow: isCallActive ? `0 0 20px ${config.customization.appearance.primaryColor}60` : 'none'
          }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isCallActive ? 'active' : 'inactive'}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              {getButtonIcon()}
            </motion.div>
          </AnimatePresence>
        </motion.button>

        {/* Siri wave visualization */}
        <motion.div
          className="rounded-2xl p-4 overflow-hidden"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: '100%', opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{ marginLeft: '10px' }}
        >
          <ReactSiriwave {...siriWaveConfig} />
        </motion.div>

        {/* Interactive Hint */}
        <motion.div
          className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-center pointer-events-none whitespace-nowrap"
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: !isCallActive && !isLoading ? 0.7 : 0,
            y: !isCallActive && !isLoading ? 0 : 10
          }}
          transition={{ duration: 0.3 }}
          style={{ color: config.customization.appearance.textColor }}
        >
          {isLoading ? 'Connecting...' : 'Click to start conversation'}
        </motion.div>
      </div>

      {/* Call status */}
      {isCallActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs mt-2 px-3 py-1 rounded-full"
          style={{ 
            backgroundColor: config.customization.appearance.primaryColor + '20',
            color: config.customization.appearance.primaryColor
          }}
        >
          {isConnected ? 'Connected' : 'Connecting...'}
        </motion.div>
      )}

      {/* Transcripts (if enabled) */}
      {config.customization.behavior.showTranscript && transcripts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 max-w-sm max-h-32 overflow-y-auto"
        >
          <div className="text-xs space-y-1">
            {transcripts.slice(-3).map((transcript, index) => (
              <div
                key={index}
                className={`p-2 rounded ${
                  transcript.role === 'user' 
                    ? 'bg-blue-100 text-blue-800 ml-4' 
                    : 'bg-gray-100 text-gray-800 mr-4'
                }`}
              >
                {transcript.text}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Error display - only show in preview mode */}
      {error && previewMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-xs text-red-500 text-center px-4"
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

export default SiriWidget;
