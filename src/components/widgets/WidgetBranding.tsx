import React from 'react';
import { motion } from 'framer-motion';
import { WidgetConfig } from '@/providers/types';

interface WidgetBrandingProps {
  config: WidgetConfig;
  className?: string;
}

const WidgetBranding: React.FC<WidgetBrandingProps> = ({ config, className = '' }) => {
  const { branding } = config.customization;

  // Safety check for branding object
  if (!branding || !branding.enabled) {
    return null;
  }

  const getPositionClasses = () => {
    switch (branding.position) {
      case 'top-left':
        return 'absolute top-2 left-2';
      case 'top-right':
        return 'absolute top-2 right-2';
      case 'top-center':
        return 'absolute top-2 left-1/2 transform -translate-x-1/2';
      case 'bottom-left':
        return 'absolute bottom-2 left-2';
      case 'bottom-right':
        return 'absolute bottom-2 right-2';
      case 'bottom-center':
      default:
        return 'absolute bottom-2 left-1/2 transform -translate-x-1/2';
    }
  };

  const handleClick = () => {
    if (branding.url) {
      window.open(branding.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: branding.opacity }}
      className={`${getPositionClasses()} ${className} z-50 pointer-events-auto`}
      style={{
        fontSize: `${branding.fontSize}px`,
        color: config.customization.appearance.textColor
      }}
    >
      {branding.url ? (
        <button
          onClick={handleClick}
          className="hover:opacity-80 transition-opacity duration-200 cursor-pointer text-inherit bg-transparent border-none p-0 m-0"
          style={{ 
            fontSize: 'inherit',
            color: 'inherit'
          }}
        >
          {branding.text}
        </button>
      ) : (
        <span>{branding.text}</span>
      )}
    </motion.div>
  );
};

export default WidgetBranding;
