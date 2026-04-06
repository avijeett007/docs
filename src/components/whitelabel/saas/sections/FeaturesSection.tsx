'use client';

import { motion } from 'framer-motion';
import {
  FiPhone,
  FiCalendar,
  FiMessageSquare,
  FiClock,
  FiUsers,
  FiTrendingUp,
  FiMail,
  FiSettings,
  FiBarChart2,
  FiShield,
  FiCheckCircle
} from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';

interface FeaturesSectionProps {
  branding: PartnerBranding;
  brandName: string;
  getTranslation: (key: string, fallback?: string) => string;
}

// Feature keys for translation lookup
const featureKeys = [
  { key: 'neverMissCall', icon: FiPhone, color: 'blue' },
  { key: 'smartBooking', icon: FiCalendar, color: 'green' },
  { key: 'naturalConversations', icon: FiMessageSquare, color: 'purple' },
  { key: 'availability24_7', icon: FiClock, color: 'orange' },
  { key: 'customerInfo', icon: FiUsers, color: 'pink' },
  { key: 'growBusiness', icon: FiTrendingUp, color: 'indigo' },
  { key: 'instantNotifications', icon: FiMail, color: 'red' },
  { key: 'easySetup', icon: FiSettings, color: 'teal' }
];

// Default features for fallback
const defaultFeatures = [
  { title: 'Never Miss a Call', description: 'Your AI receptionist answers every call instantly, even when you\'re busy or after hours.' },
  { title: 'Smart Appointment Booking', description: 'Automatically schedules appointments based on your availability and business rules.' },
  { title: 'Natural Conversations', description: 'Engages customers with human-like conversations tailored to your business.' },
  { title: '24/7 Availability', description: 'Works around the clock to capture leads and serve customers when you can\'t.' },
  { title: 'Customer Information', description: 'Collects and organizes customer details for better service and follow-up.' },
  { title: 'Grow Your Business', description: 'Converts more calls into customers with professional, consistent service.' },
  { title: 'Instant Notifications', description: 'Get notified immediately about important calls and customer requests.' },
  { title: 'Easy Setup', description: 'Get your AI receptionist up and running in just 5 minutes with our guided setup.' }
];

const colorMap = {
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  purple: 'from-purple-500 to-purple-600',
  orange: 'from-orange-500 to-orange-600',
  pink: 'from-pink-500 to-pink-600',
  indigo: 'from-indigo-500 to-indigo-600',
  red: 'from-red-500 to-red-600',
  teal: 'from-teal-500 to-teal-600'
};

// Helper function to get icon component from string
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    FiPhone,
    FiCalendar,
    FiMessageSquare,
    FiClock,
    FiUsers,
    FiTrendingUp,
    FiMail,
    FiSettings,
    FiBarChart2,
    FiShield,
    FiCheckCircle
  };
  return iconMap[iconName] || FiPhone;
};

// Helper function to get color for index
const getColorForIndex = (index: number) => {
  const colors = ['blue', 'green', 'purple', 'orange', 'red', 'indigo', 'pink', 'teal'];
  return colors[index % colors.length];
};

export default function FeaturesSection({ branding, brandName, getTranslation }: FeaturesSectionProps) {
  // Build features with translations
  const buildTranslatedFeatures = () => {
    return featureKeys.map((featureKey, index) => ({
      icon: featureKey.icon,
      title: getTranslation(`features.items.${featureKey.key}.title`, defaultFeatures[index].title),
      description: getTranslation(`features.items.${featureKey.key}.description`, defaultFeatures[index].description),
      color: featureKey.color
    }));
  };

  // Parse custom features if available, otherwise use translated defaults
  let displayFeatures = buildTranslatedFeatures();

  if (branding.features) {
    try {
      const customFeatures = JSON.parse(branding.features);
      if (Array.isArray(customFeatures) && customFeatures.length > 0) {
        // Map custom features to the expected format
        displayFeatures = customFeatures.map((feature: any, index: number) => ({
          icon: getIconComponent(feature.icon),
          title: feature.title,
          description: feature.description,
          color: getColorForIndex(index)
        }));
      }
    } catch (error) {
      console.warn('Failed to parse custom features, using defaults');
    }
  }

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {getTranslation('features.whyChoose', 'Why Choose')}{' '}
            <span
              className="bg-gradient-to-r bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${branding.primaryColor || '#3B82F6'}, ${branding.secondaryColor || '#8B5CF6'})`
              }}
            >
              {brandName}
            </span>
            ?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {getTranslation('features.subtitle', 'Transform your business with AI-powered customer service that works 24/7 to grow your revenue and delight your customers.')}
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {displayFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
            >
              {/* Icon */}
              <div className={`w-12 h-12 bg-gradient-to-r ${colorMap[feature.color as keyof typeof colorMap]} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="text-white text-xl" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="bg-white rounded-2xl p-8 shadow-lg max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {getTranslation('features.cta.title', 'Ready to Transform Your Business?')}
            </h3>
            <p className="text-gray-600 mb-6">
              {getTranslation('features.cta.subtitle', `Join thousands of businesses that never miss a customer call with ${brandName}.`)}
            </p>
            <button
              onClick={() => window.location.href = '/platform/onboarding/step-1'}
              className="inline-flex items-center justify-center px-8 py-3 text-lg font-semibold text-white rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${branding.primaryColor || '#3B82F6'}, ${branding.secondaryColor || '#8B5CF6'})`
              }}
            >
              {getTranslation('features.cta.button', 'Get Started Now')}
              <span className="ml-2">→</span>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
