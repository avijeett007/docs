import React from 'react';
import { motion } from 'framer-motion';
import { WidgetConfig } from '@/providers/types';

interface InteractionHintProps {
  config: WidgetConfig;
  isCallActive: boolean;
  isLoading: boolean;
  position?: 'top' | 'bottom' | 'center';
  className?: string;
}

const InteractionHint: React.FC<InteractionHintProps> = ({ 
  config, 
  isCallActive, 
  isLoading, 
  position = 'bottom',
  className = '' 
}) => {
  const { behavior, messages, branding } = config.customization;

  if (!behavior.showInteractionHints) {
    return null;
  }

  const getPositionClasses = () => {
    const baseClasses = 'absolute left-1/2 transform -translate-x-1/2 text-xs text-center pointer-events-none whitespace-nowrap';
    
    switch (position) {
      case 'top':
        return `${baseClasses} -top-8`;
      case 'center':
        return `${baseClasses} top-1/2 -translate-y-1/2`;
      case 'bottom':
      default:
        // Adjust bottom position based on branding position to avoid overlap
        const bottomOffset = branding.enabled && 
          (branding.position === 'bottom-center' || branding.position === 'bottom-left' || branding.position === 'bottom-right') 
          ? '-bottom-12' : '-bottom-8';
        return `${baseClasses} ${bottomOffset}`;
    }
  };

  const getHintText = () => {
    if (isLoading) return 'Connecting...';
    if (isCallActive) return 'Call in progress...';
    return messages.interactionHint;
  };

  return (
    <motion.div
      className={`${getPositionClasses()} ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ 
        opacity: !isCallActive && !isLoading ? 0.7 : 0,
        y: !isCallActive && !isLoading ? 0 : 10
      }}
      transition={{ duration: 0.3 }}
      style={{ 
        color: config.customization.appearance.textColor,
        zIndex: 40 // Below branding but above other elements
      }}
    >
      {getHintText()}
    </motion.div>
  );
};

export default InteractionHint;
