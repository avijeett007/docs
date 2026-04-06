"use client";

import React, { useEffect } from 'react';
import { PhoneCall, Mic, AudioLines, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUnifiedVoiceProvider } from '@/hooks/useUnifiedVoiceProvider';
import { WidgetConfig } from '@/providers/types';
import WidgetBranding from './WidgetBranding';
import InteractionHint from './InteractionHint';

interface FloatyWidgetProps {
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

const FloatyWidget: React.FC<FloatyWidgetProps> = ({
  config,
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
    console.log('[FloatyWidget] handleToggleCall called', {
      isLoading,
      isCallActive,
      isConnected,
      error,
      publicKey: publicKey ? 'present' : 'missing',
      accessToken: accessToken ? 'present' : 'missing',
      agentType: config.agentType
    });

    if (isLoading) {
      console.log('[FloatyWidget] Skipping - already loading');
      return;
    }

    try {
      if (isCallActive) {
        console.log('[FloatyWidget] Ending call...');
        await endCall();
      } else {
        console.log('[FloatyWidget] Starting call...');

        // Fetch credentials if not available and fetchCredentials function is provided
        if (!publicKey && !accessToken && fetchCredentials) {
          console.log('[FloatyWidget] Fetching credentials before starting call...');
          try {
            await fetchCredentials();
            console.log('[FloatyWidget] Credentials fetched successfully');
          } catch (credError) {
            console.error('[FloatyWidget] Failed to fetch credentials:', credError);
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
      console.error('[FloatyWidget] Call toggle error:', errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const getIcon = () => {
    if (isLoading) {
      return <Loader2 size={24} className="animate-spin text-white" />;
    }
    if (!isCallActive) {
      return <PhoneCall size={24} className="text-white" />;
    } else if (volume > 0.1) {
      return <AudioLines size={24} className="text-white" />;
    } else {
      return <Mic size={24} className="text-white" />;
    }
  };

  const getPositionClasses = () => {
    const position = config.customization.behavior.position;
    switch (position) {
      case 'bottom-left':
        return 'bottom-5 left-5';
      case 'top-right':
        return 'top-5 right-5';
      case 'top-left':
        return 'top-5 left-5';
      case 'center':
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
      default:
        return 'bottom-5 right-5';
    }
  };

  const getSizeClasses = () => {
    const size = config.customization.behavior.size;
    switch (size) {
      case 'small':
        return 'w-12 h-12';
      case 'large':
        return 'w-20 h-20';
      default:
        return 'w-16 h-16';
    }
  };

  return (
    <>
      {/* Main floating button */}
      <div className={`fixed ${getPositionClasses()} z-50`}>
        <div className={`relative flex items-center justify-center ${getSizeClasses()}`}>
          {/* Ripple animations when speaking (removed isCallActive dependency) */}
          <AnimatePresence>
            {volume > 0.1 && (
              <>
                <motion.div
                  className={`absolute ${getSizeClasses()} rounded-full z-0`}
                  style={{ backgroundColor: config.customization.appearance.primaryColor }}
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 2, opacity: 0 }}
                  exit={{ scale: 1, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
                />
                <motion.div
                  className={`absolute ${getSizeClasses()} rounded-full z-0`}
                  style={{ backgroundColor: config.customization.appearance.primaryColor }}
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 2, opacity: 0 }}
                  exit={{ scale: 1, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                />
                <motion.div
                  className={`absolute ${getSizeClasses()} rounded-full z-0`}
                  style={{ backgroundColor: config.customization.appearance.primaryColor }}
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 2, opacity: 0 }}
                  exit={{ scale: 1, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1.5 }}
                />
              </>
            )}
          </AnimatePresence>

          {/* Main button */}
          <motion.div
            className={`relative flex items-center justify-center ${getSizeClasses()} rounded-full shadow-xl cursor-pointer z-10`}
            style={{ 
              backgroundColor: isCallActive 
                ? config.customization.appearance.primaryColor 
                : config.customization.appearance.secondaryColor,
              borderRadius: `${config.customization.appearance.borderRadius}px`
            }}
            onClick={handleToggleCall}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: isLoading ? 1 : 1.1 }}
            animate={{
              scale: volume > 0.1 ? 1.1 : 1,
              boxShadow: volume > 0.1
                ? `0 0 20px ${config.customization.appearance.primaryColor}40`
                : '0 10px 25px rgba(0,0,0,0.2)'
            }}
            transition={{ duration: 0.2 }}
          >
            {getIcon()}
          </motion.div>
        </div>

        {/* Status indicator */}
        <AnimatePresence>
          {isCallActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap"
              style={{
                backgroundColor: config.customization.appearance.backgroundColor,
                color: config.customization.appearance.textColor,
                border: `1px solid ${config.customization.appearance.primaryColor}`
              }}
            >
              {isConnected ? 'Connected' : 'Connecting...'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive Hint */}
        <AnimatePresence>
          {!isCallActive && !isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap"
              style={{
                backgroundColor: config.customization.appearance.backgroundColor,
                color: config.customization.appearance.textColor,
                border: `1px solid ${config.customization.appearance.primaryColor}40`
              }}
            >
              Click to start conversation
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error indicator - only show in preview mode */}
        <AnimatePresence>
          {error && previewMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap bg-red-500 text-white"
            >
              Error
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Welcome message overlay (when not active) */}
      <AnimatePresence>
        {!isCallActive && config.customization.messages.welcomeMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none"
          >
            <div 
              className="max-w-sm p-4 rounded-lg shadow-lg text-center"
              style={{ 
                backgroundColor: config.customization.appearance.backgroundColor,
                color: config.customization.appearance.textColor,
                borderRadius: `${config.customization.appearance.borderRadius}px`
              }}
            >
              <p className="text-sm mb-2">{config.customization.messages.welcomeMessage}</p>
              <p className="text-xs opacity-70">
                Click the button to {config.customization.messages.buttonText.toLowerCase()}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcripts overlay (if enabled) */}
      <AnimatePresence>
        {config.customization.behavior.showTranscript && transcripts.length > 0 && isCallActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 right-5 max-w-sm z-40"
          >
            <div 
              className="p-3 rounded-lg shadow-lg max-h-32 overflow-y-auto"
              style={{ 
                backgroundColor: config.customization.appearance.backgroundColor,
                color: config.customization.appearance.textColor,
                borderRadius: `${config.customization.appearance.borderRadius}px`
              }}
            >
              <div className="text-xs space-y-1">
                {transcripts.slice(-3).map((transcript, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded ${
                      transcript.role === 'user' 
                        ? 'bg-blue-100 text-blue-800 ml-2' 
                        : 'bg-gray-100 text-gray-800 mr-2'
                    }`}
                  >
                    {transcript.text}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget Branding */}
      <WidgetBranding config={config} className="fixed bottom-1 right-1 text-xs z-30" />
    </>
  );
};

export default FloatyWidget;
