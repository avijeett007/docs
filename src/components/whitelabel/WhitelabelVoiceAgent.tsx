'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mic, Loader2 } from 'lucide-react';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface WhitelabelVoiceAgentProps {
  onStartCall: () => void;
  isProcessing?: boolean;
  isConnected?: boolean;
  className?: string;
}

const WhitelabelVoiceAgent = ({ 
  onStartCall, 
  isProcessing = false, 
  isConnected = false,
  className = ""
}: WhitelabelVoiceAgentProps) => {
  const [isActive, setIsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [animationPosition, setAnimationPosition] = useState({ x: 0, y: 0 });
  const [focusIntensity, setFocusIntensity] = useState(1);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branding } = usePartnerBranding();

  // Check for demo mode
  const isDemoMode = searchParams?.get('demo') === 'true';

  // Don't check permissions on mount - only when user clicks (like KnotieDashboard)
  // This avoids browser compatibility issues with different domains

  // Enhanced background animation effect
  useEffect(() => {
    const positionInterval = setInterval(() => {
      setAnimationPosition({
        x: Math.random() * 100 - 50,
        y: Math.random() * 100 - 50,
      });
    }, 3000);

    const intensityInterval = setInterval(() => {
      setFocusIntensity(prev => prev === 1 ? 1.2 : 1);
    }, 2000);

    return () => {
      clearInterval(positionInterval);
      clearInterval(intensityInterval);
    };
  }, []);

  // Update isActive and isRecording based on connection state
  useEffect(() => {
    if (isConnected) {
      console.log('✅ WhitelabelVoiceAgent: Connection active, updating UI state...');
      setIsActive(true);
      setIsRecording(true);
    }
  }, [isConnected]);

  // Reset states only when explicitly disconnected (like KnotieDashboard)
  useEffect(() => {
    if (!isProcessing && !isConnected) {
      console.log('🔄 WhitelabelVoiceAgent: Connection ended, resetting UI state...');
      setIsActive(false);
      setIsRecording(false);
    }
  }, [isProcessing, isConnected]);

  // Function to handle call disconnect
  const handleDisconnect = async () => {
    try {
      console.log('🔴 WhitelabelVoiceAgent: Stopping media tracks...');

      // Stop audio tracks
      console.log('🎤 WhitelabelVoiceAgent: Stopping audio tracks...');
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.getTracks().forEach(track => {
        console.log(`🔇 WhitelabelVoiceAgent: Stopping audio track`);
        track.stop();
        track.enabled = false;
      });

      // Trigger room disconnect
      if (isConnected) {
        console.log('🏃‍♂️ WhitelabelVoiceAgent: Triggering room disconnect...');
        onStartCall(); // This will toggle the connection state
      }
    } catch (error) {
      console.error('❌ WhitelabelVoiceAgent: Error during disconnect:', error);
    }
  };

  const handleMicClick = async () => {
    if (isProcessing) {
      console.log('⚠️ WhitelabelVoiceAgent: Processing in progress, ignoring click');
      return;
    }

    if (isConnected) {
      console.log('🔴 WhitelabelVoiceAgent: Currently connected, initiating disconnect...');
      await handleDisconnect();
    } else {
      console.log('🟢 WhitelabelVoiceAgent: Not connected, initiating connection...');
      try {
        // Request audio permission
        console.log('🎤 WhitelabelVoiceAgent: Requesting audio permission...');
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getTracks().forEach(track => track.stop());
        console.log('✅ WhitelabelVoiceAgent: Audio permission granted');

        setHasPermissions(true);
        setPermissionError(null);

        console.log('🎤 WhitelabelVoiceAgent: Starting call...');
        onStartCall();
      } catch (error: any) {
        console.error('❌ WhitelabelVoiceAgent: Audio permission error:', error);
        setPermissionError(error.message);
        return;
      }
    }
  };

  // Get brand colors for styling
  const primaryColor = branding.primaryColor || '#3B82F6';
  const secondaryColor = branding.secondaryColor || '#10B981';

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {/* Main Voice Agent Interface */}
      <div className="relative">
        {/* Background Animation */}
        <div 
          className="absolute inset-0 rounded-full opacity-20 blur-3xl transition-all duration-3000"
          style={{
            background: `radial-gradient(circle, ${primaryColor}40, ${secondaryColor}20)`,
            transform: `translate(${animationPosition.x}px, ${animationPosition.y}px) scale(${focusIntensity})`,
          }}
        />

        {/* Microphone Button */}
        <button
          onClick={handleMicClick}
          disabled={isProcessing}
          className={`
            relative group
            w-32 h-32 md:w-40 md:h-40 rounded-full
            backdrop-blur-lg
            border-2 transition-all duration-700
            hover:scale-105
            disabled:opacity-75
            disabled:hover:scale-100
            ${isActive ? 'scale-95' : 'scale-100'}
            ${isRecording ? 'shadow-lg' : ''}
          `}
          style={{
            background: `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}10)`,
            borderColor: isRecording ? `${primaryColor}80` : `${primaryColor}40`,
            boxShadow: isRecording ? `0 0 20px ${primaryColor}40` : 'none'
          }}
        >
          {/* Enhanced Ripple Effects */}
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`
                absolute inset-0 rounded-full
                border-2 transition-all duration-1000
                group-hover:scale-[${1.1 + i * 0.15}] group-hover:opacity-0
                animate-ripple
              `}
              style={{
                borderColor: `${primaryColor}40`,
                animationDelay: `${i * 600}ms`,
              }}
            />
          ))}

          {/* Active Ring */}
          {(isRecording || isProcessing) && (
            <div 
              className="absolute inset-0 rounded-full border-2 animate-ping" 
              style={{ borderColor: `${primaryColor}80` }}
            />
          )}

          {/* Microphone/Loading Icon */}
          {isProcessing ? (
            <Loader2
              className="w-8 h-8 md:w-10 md:h-10 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-spin"
              style={{ color: primaryColor }}
            />
          ) : isRecording ? (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="flex space-x-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-6 md:w-2 md:h-8 rounded-full animate-pulse"
                    style={{ 
                      background: `linear-gradient(to top, ${primaryColor}, ${secondaryColor})`,
                      animationDelay: `${i * 200}ms` 
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <Mic
              className={`
                w-8 h-8 md:w-10 md:h-10 absolute
                top-1/2 left-1/2
                transform -translate-x-1/2 -translate-y-1/2
                transition-all duration-500
                group-hover:scale-110
                stroke-[1.5]
              `}
              style={{ 
                color: isActive ? primaryColor : `${primaryColor}CC`
              }}
            />
          )}
        </button>

        {/* Status Label */}
        <div 
          className={`
            absolute -bottom-8 left-1/2 transform -translate-x-1/2
            whitespace-nowrap text-xs md:text-sm font-medium
            px-3 py-1 rounded-full
            transition-all duration-300
            border
          `}
          style={{
            backgroundColor: isRecording ? `${primaryColor}20` : `${primaryColor}10`,
            color: isRecording ? primaryColor : `${primaryColor}CC`,
            borderColor: isRecording ? `${primaryColor}60` : `${primaryColor}40`
          }}
        >
          {isRecording ? 'Click to End Call' : 'Click to Start Call'}
        </div>
      </div>

      {/* Permission Error */}
      {permissionError && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm max-w-sm text-center">
          <p className="font-medium mb-1">Microphone Access Required</p>
          <p className="text-xs mb-2">{permissionError}</p>
          <button
            onClick={() => setPermissionError(null)}
            className="text-red-400 hover:text-red-300 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

export default WhitelabelVoiceAgent;

// Export a wrapper component that includes LiveKit integration
export { default as WhitelabelVoiceAgentWithLiveKit } from './WhitelabelVoiceAgentWithLiveKit';
