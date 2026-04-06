'use client';

import { motion } from 'framer-motion';
import { 
  FiShield, 
  FiUsers, 
  FiCheckCircle, 
  FiClock, 
  FiLock, 
  FiAward, 
  FiStar, 
  FiGlobe, 
  FiTrendingUp 
} from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';

interface TrustIndicatorsSectionProps {
  branding: PartnerBranding;
  getTranslation: (key: string, fallback?: string) => string;
}

// Trust indicator keys for translation lookup
const trustIndicatorKeys = ['activeUsers', 'uptime', 'security', 'support'];

// Default trust indicators for fallback
const defaultTrustIndicators = [
  { icon: 'FiUsers', text: '10,000+ Active Users' },
  { icon: 'FiCheckCircle', text: '99.9% Uptime Guarantee' },
  { icon: 'FiShield', text: 'Enterprise Security' },
  { icon: 'FiClock', text: '24/7 Support' }
];

// Helper function to get icon component from string
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    FiShield,
    FiUsers,
    FiCheckCircle,
    FiClock,
    FiLock,
    FiAward,
    FiStar,
    FiGlobe,
    FiTrendingUp
  };
  return iconMap[iconName] || FiShield;
};

export default function TrustIndicatorsSection({ branding, getTranslation }: TrustIndicatorsSectionProps) {
  // Build translated trust indicators
  const buildTranslatedIndicators = () => {
    return trustIndicatorKeys.map((key, index) => ({
      icon: defaultTrustIndicators[index].icon,
      text: getTranslation(`trustIndicators.items.${key}`, defaultTrustIndicators[index].text)
    }));
  };

  // Parse custom trust indicators if available, otherwise use translated defaults
  let trustIndicators = buildTranslatedIndicators();

  if (branding.trustIndicators) {
    try {
      const customTrustIndicators = JSON.parse(branding.trustIndicators);
      if (Array.isArray(customTrustIndicators) && customTrustIndicators.length > 0) {
        trustIndicators = customTrustIndicators;
      }
    } catch (error) {
      console.warn('Failed to parse custom trust indicators, using defaults');
    }
  }

  // Don't render if no trust indicators
  if (!trustIndicators || trustIndicators.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-8">
            {getTranslation('trustIndicators.title', 'Trusted by Businesses Worldwide')}
          </h3>
          
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-12">
            {trustIndicators.map((indicator, index) => {
              const IconComponent = getIconComponent(indicator.icon);
              const iconColors = [
                'text-green-500',
                'text-blue-500',
                'text-purple-500',
                'text-amber-500',
                'text-teal-500',
                'text-indigo-500'
              ];
              const iconColor = iconColors[index % iconColors.length];
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-center space-x-3 group"
                >
                  <div className={`p-2 rounded-lg bg-gray-50 group-hover:bg-gray-100 transition-colors`}>
                    <IconComponent className={`w-6 h-6 ${iconColor}`} />
                  </div>
                  <span className="text-gray-700 font-medium text-sm lg:text-base">
                    {indicator.text}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
