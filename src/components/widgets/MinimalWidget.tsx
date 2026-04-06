"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MicOff, Mic, PhoneCall, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUnifiedVoiceProvider } from '@/hooks/useUnifiedVoiceProvider';
import { WidgetConfig } from '@/providers/types';
import WidgetBranding from './WidgetBranding';
import InteractionHint from './InteractionHint';

interface MinimalWidgetProps {
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

const AudioVisualizer: React.FC<{ 
  volume: number; 
  isActive: boolean; 
  color: string;
}> = ({ volume, isActive, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (isActive) {
      draw();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Clear canvas
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [volume, isActive, color]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);

    // Generate audio visualization bars
    const barCount = 20;
    const barWidth = width / barCount;
    const centerY = height / 2;

    context.fillStyle = color;

    for (let i = 0; i < barCount; i++) {
      // Create pseudo-random heights based on volume and time
      const time = Date.now() * 0.001;
      const baseHeight = Math.sin(time + i * 0.5) * volume * 20;
      const randomHeight = Math.random() * volume * 15;
      const barHeight = Math.max(2, Math.abs(baseHeight + randomHeight));

      const x = i * barWidth + barWidth * 0.2;
      const y = centerY - barHeight / 2;

      context.fillRect(x, y, barWidth * 0.6, barHeight);
    }

    if (isActive) {
      animationRef.current = requestAnimationFrame(draw);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16"
      style={{ background: 'transparent' }}
    />
  );
};

const MinimalWidget: React.FC<MinimalWidgetProps> = ({
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

  const [isMuted, setIsMuted] = useState(false);

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
    console.log('[MinimalWidget] handleToggleCall called', {
      isLoading,
      isCallActive,
      isConnected,
      error,
      publicKey: publicKey ? 'present' : 'missing',
      accessToken: accessToken ? 'present' : 'missing',
      agentType: config.agentType
    });

    if (isLoading) {
      console.log('[MinimalWidget] Skipping - already loading');
      return;
    }

    try {
      if (isCallActive) {
        console.log('[MinimalWidget] Ending call...');
        await endCall();
      } else {
        console.log('[MinimalWidget] Starting call...');

        // Fetch credentials if not available and fetchCredentials function is provided
        if (!publicKey && !accessToken && fetchCredentials) {
          console.log('[MinimalWidget] Fetching credentials before starting call...');
          try {
            await fetchCredentials();
            console.log('[MinimalWidget] Credentials fetched successfully');
          } catch (credError) {
            console.error('[MinimalWidget] Failed to fetch credentials:', credError);
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
      console.error('[MinimalWidget] Call toggle error:', errorMessage);
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
      return isMuted ? <MicOff size={20} /> : <Mic size={20} />;
    }
    return <PhoneCall size={20} />;
  };

  const getButtonText = () => {
    if (isLoading) return 'Loading...';
    if (isCallActive) return config.customization.messages.endCallText;
    return config.customization.messages.buttonText;
  };

  return (
    <div 
      className="flex flex-col items-center justify-center p-6 min-h-full"
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
          className="text-center mb-6"
          style={{ color: config.customization.appearance.textColor }}
        >
          <h3 className="text-lg font-medium mb-2">
            {config.customization.messages.welcomeMessage}
          </h3>
          <p className="text-sm opacity-70">
            Click the button below to start your conversation
          </p>
        </motion.div>
      )}

      {/* Audio Visualizer */}
      <AnimatePresence>
        {volume > 0.01 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full max-w-md mb-6"
          >
            <AudioVisualizer
              volume={volume}
              isActive={volume > 0.01}
              color={config.customization.appearance.primaryColor}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Control Button */}
      <motion.button
        onClick={handleToggleCall}
        disabled={isLoading}
        className="flex items-center gap-3 px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg"
        style={{ 
          backgroundColor: isCallActive 
            ? config.customization.appearance.primaryColor 
            : config.customization.appearance.secondaryColor,
          color: 'white'
        }}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: isLoading ? 1 : 1.05 }}
        animate={{ 
          boxShadow: isCallActive 
            ? `0 0 20px ${config.customization.appearance.primaryColor}40`
            : '0 4px 15px rgba(0,0,0,0.2)'
        }}
      >
        {getButtonIcon()}
        <span>{getButtonText()}</span>
      </motion.button>

      {/* Call Status */}
      <AnimatePresence>
        {isCallActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 text-sm text-center"
          >
            <div 
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
              style={{ 
                backgroundColor: config.customization.appearance.primaryColor + '20',
                color: config.customization.appearance.primaryColor
              }}
            >
              <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
              {isConnected ? 'Connected' : 'Connecting...'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcripts */}
      <AnimatePresence>
        {config.customization.behavior.showTranscript && transcripts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 w-full max-w-md"
          >
            <div className="text-xs font-medium mb-2 opacity-70">
              Conversation
            </div>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {transcripts.slice(-5).map((transcript, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: transcript.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-2 rounded text-xs ${
                    transcript.role === 'user' 
                      ? 'bg-blue-100 text-blue-800 ml-8' 
                      : 'bg-gray-100 text-gray-800 mr-8'
                  }`}
                >
                  <div className="font-medium capitalize mb-1">
                    {transcript.role}
                  </div>
                  {transcript.text}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </div>
  );
};

export default MinimalWidget;
