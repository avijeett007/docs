'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { HeroHeading } from './HeroHeading';
import { HeroSubtitle } from './HeroSubtitle';
import { HeroButtons } from './HeroButtons';
import { TrustIndicators } from './TrustIndicators';
import { VoiceAgentInterface } from './VoiceAgentInterface';
import { LiveStatusMessage } from './LiveStatusMessage';
import { PlatformLogos } from './PlatformLogos';

interface HeroSectionProps {
  // Voice interface props
  isProcessing?: boolean;
  isRecording?: boolean;
  isActive?: boolean;
  onMicClick: () => void;
  permissionError?: string | null;
  
  // Button handlers
  onGetStarted: () => void;
  onSeeHowItWorks: () => void;
  
  // Status message for the banner
  statusMessage?: string;
  
  className?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  isProcessing = false,
  isRecording = false,
  isActive = false,
  onMicClick,
  permissionError = null,
  onGetStarted,
  onSeeHowItWorks,
  statusMessage = "Join 382+ agencies already scaling with Knotie",
  className = ''
}) => {
  return (
    <div className={`relative ${className}`}>
      {/* Live Status Message */}
      <div className="text-center pt-6 sm:pt-8 pb-2 sm:pb-4">
        <LiveStatusMessage />
      </div>

      {/* Main Hero Content */}
      <div className="container mx-auto px-4 py-8 sm:py-12 lg:py-16">
        <div className="max-w-6xl mx-auto">
          {/* Heading */}
          <HeroHeading className="mb-6 sm:mb-8" />
          
          {/* Subtitle */}
          <HeroSubtitle className="mb-8 sm:mb-10 lg:mb-12" />
          
          {/* Action Buttons */}
          <HeroButtons 
            onGetStarted={onGetStarted}
            onSeeHowItWorks={onSeeHowItWorks}
            className="mb-10 sm:mb-12 lg:mb-16"
          />
          
          {/* Trust Indicators */}
          <TrustIndicators className="mb-12 sm:mb-16 lg:mb-20" />
          
          {/* Voice Agent Interface */}
          <VoiceAgentInterface
            isProcessing={isProcessing}
            isRecording={isRecording}
            isActive={isActive}
            onMicClick={onMicClick}
            permissionError={permissionError}
          />
        </div>
      </div>

      {/* Platform Logos Section */}
      <div className="container mx-auto px-4 pb-12 sm:pb-16">
        <div className="max-w-6xl mx-auto">
          <PlatformLogos />
        </div>
      </div>
    </div>
  );
};
