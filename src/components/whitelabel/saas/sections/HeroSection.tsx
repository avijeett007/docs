'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiPhone, FiClock, FiUsers, FiTrendingUp } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';
import Image from 'next/image';

interface HeroSectionProps {
  branding: PartnerBranding;
  brandName: string;
  isFreeTrial: boolean;
  getTranslation: (key: string, fallback?: string) => string;
}

export default function HeroSection({ branding, brandName, isFreeTrial, getTranslation }: HeroSectionProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleGetStarted = () => {
    // Navigate to onboarding flow - Step 1: Business Information
    window.location.href = '/platform/onboarding/1';
  };

  const handleLogin = () => {
    // Use clean /login URL — middleware rewrites to internal route without exposing /whitelabel/
    window.location.href = '/login';
  };

  // Map logoSize setting to Tailwind height classes
  const getLogoSizeClass = () => {
    switch (branding.logoSize) {
      case 'small':
        return 'h-8'; // 32px
      case 'medium':
        return 'h-12'; // 48px
      case 'large':
        return 'h-16'; // 64px
      case 'extra-large':
        return 'h-20'; // 80px
      default:
        return 'h-12'; // Default to medium (48px)
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 min-h-screen flex items-center">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, ${branding.primaryColor || '#3B82F6'} 2px, transparent 2px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-left"
          >
            {/* Logo */}
            {branding.logo && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
              >
                <Image
                  src={branding.logo}
                  alt={`${branding.businessName} Logo`}
                  width={48}
                  height={48}
                  className={`${getLogoSizeClass()} w-auto mx-auto lg:mx-0 rounded-md`}
                />
              </motion.div>
            )}

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight"
            >
              {getTranslation('hero.meet', 'Meet')}{' '}
              <span
                className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${branding.primaryColor || '#3B82F6'}, ${branding.secondaryColor || '#8B5CF6'})`
                }}
              >
                {brandName}
              </span>
              <br />
              {getTranslation('hero.aiReceptionist', 'Your AI Receptionist')}
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0"
            >
              {getTranslation('hero.subheadline', `Never miss another call. ${brandName} handles your customers 24/7 with professional, intelligent conversations that book appointments, answer questions, and grow your business.`)}
            </motion.p>

            {/* Key Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto lg:mx-0"
            >
              <div className="flex items-center space-x-2">
                <FiClock className="text-blue-500 flex-shrink-0" />
                <span className="text-sm text-gray-600">{getTranslation('hero.benefit1', '24/7 Availability')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <FiPhone className="text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-600">{getTranslation('hero.benefit2', 'Never Miss Calls')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <FiUsers className="text-purple-500 flex-shrink-0" />
                <span className="text-sm text-gray-600">{getTranslation('hero.benefit3', 'Happy Customers')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <FiTrendingUp className="text-amber-600 flex-shrink-0" />
                <span className="text-sm text-gray-600">{getTranslation('hero.benefit4', 'Grow Revenue')}</span>
              </div>
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <button
                onClick={handleGetStarted}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`
                  relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white
                  rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl
                  ${isHovered ? 'shadow-2xl' : ''}
                `}
                style={{
                  background: `linear-gradient(135deg, ${branding.primaryColor || '#3B82F6'}, ${branding.secondaryColor || '#8B5CF6'})`
                }}
              >
                <motion.span
                  animate={{ scale: isHovered ? 1.05 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {isFreeTrial ? getTranslation('hero.ctaFree', "Let's Get Started For FREE") : getTranslation('hero.cta', "Let's Get Started")}
                </motion.span>
                <motion.div
                  className="ml-2"
                  animate={{ x: isHovered ? 5 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  →
                </motion.div>
              </button>

              {/* Login Button for Returning Customers */}
              <div className="mt-4">
                <button
                  onClick={handleLogin}
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors duration-200 underline decoration-dotted underline-offset-4 hover:decoration-solid"
                >
                  {getTranslation('hero.loginPrompt', 'Already have an account? Login here')}
                </button>
              </div>

              {isFreeTrial && (
                <p className="text-sm text-gray-500 mt-2">
                  {getTranslation('hero.noCreditCard', 'No credit card required • Setup in 5 minutes')}
                </p>
              )}
            </motion.div>
          </motion.div>

          {/* Right Column - Visual */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <div className="relative">
              {/* Phone mockup or illustration */}
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-auto">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiPhone className="text-white text-2xl" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {brandName} is Ready
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Professional AI receptionist handling calls with your business knowledge
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-700 text-sm font-medium">Live & Ready</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <motion.div
                animate={{ y: [-10, 10, -10] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -top-4 -right-4 bg-blue-500 text-white p-3 rounded-lg shadow-lg"
              >
                <span className="text-sm font-medium">24/7 Active</span>
              </motion.div>

              <motion.div
                animate={{ y: [10, -10, 10] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -bottom-4 -left-4 bg-green-500 text-white p-3 rounded-lg shadow-lg"
              >
                <span className="text-sm font-medium">Never Busy</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
