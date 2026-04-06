'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  BarChart3,
  Zap,
  Shield,
  Lock,
  Lightbulb,
  ArrowRight
} from 'lucide-react';

interface AllInOneCRMSectionProps {
  className?: string;
  onGetAccess?: () => void;
}

export const AllInOneCRMSection: React.FC<AllInOneCRMSectionProps> = ({ className = '', onGetAccess }) => {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Handle hydration and theme detection
  useEffect(() => {
    setMounted(true);

    // Function to check current theme
    const checkTheme = () => {
      try {
        const themeContext = document.documentElement.classList.contains('dark');
        setIsDark(themeContext);
      } catch (error) {
        setIsDark(false);
      }
    };

    // Initial theme check
    checkTheme();

    // Create a MutationObserver to watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });

    // Start observing the document element for class changes
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Cleanup observer on unmount
    return () => observer.disconnect();
  }, []);

  const crmFeatures = [
    {
      icon: Shield,
      title: "White-Label Platform",
      description: "Complete branded platform that keeps clients from discovering providers directly. Your brand, your control.",
      iconColor: "#00D5BE"
    },
    {
      icon: Zap,
      title: "Multi-Provider Comparison",
      description: "Real-time cost analysis across all major Voice AI providers. Save up to 40% on operational costs.",
      iconColor: "#8B5CF6"
    },
    {
      icon: Users,
      title: "Client Retention Intelligence",
      description: "Proprietary features that make switching costly for clients. Reduce churn by 85%.",
      iconColor: "#3B82F6"
    },
    {
      icon: Lock,
      title: "Enterprise-Grade Security",
      description: "Bank-level encryption and compliance. SOC 2 Type II certified with 99.99% uptime SLA.",
      iconColor: "#8B5CF6"
    },
    {
      icon: BarChart3,
      title: "GHL & N8N Integration",
      description: "Seamless integration with Go High Level and N8N workflows. Deploy in minutes, not weeks and automate your stack.",
      iconColor: "#00D5BE"
    },
    {
      icon: Lightbulb,
      title: "Client Lock-In Technology",
      description: "Proprietary features that make switching costly for clients. Reduce churn by 85%.",
      iconColor: "#8B5CF6"
    }
  ];



  // Prevent hydration mismatch by showing a loading state during SSR
  if (!mounted) {
    return (
      <div className={`relative py-20 bg-white dark:bg-[#0A0A0B] ${className}`}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="w-8 h-8 bg-[#00D5BE] rounded-full animate-pulse mx-auto mb-4"></div>
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse max-w-2xl mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className={`relative ${className}`}
    >
      {/* Background with theme-appropriate styling */}
      <div className={`
        ${isDark
          ? 'bg-[#0A0A0B] border-b border-[#1E2939]'
          : 'bg-gradient-to-b from-gray-50 to-white border-b border-gray-200'
        }
        py-20
      `}>
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            
            {/* Header Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              {/* Badge */}
              <div className={`
                inline-flex items-center gap-2 px-6 py-2 rounded-full mb-6
                ${isDark
                  ? 'bg-[rgba(16,24,40,0.5)] border border-[rgba(54,65,83,0.5)]'
                  : 'bg-white border border-gray-200 shadow-sm'
                }
              `}>
                <motion.div
                  className={`flex h-2 w-2 rounded-full ${isDark ? 'bg-[#00D3F3]' : 'bg-[#00D5BE]'}`}
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <span className={`text-sm font-semibold ${isDark ? 'text-[#D1D5DC]' : 'text-gray-700'}`}>
                  Complete CRM Solution
                </span>
              </div>

              {/* Main Heading */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true }}
                className={`text-4xl md:text-6xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                All-in-One CRM{' '}
                <span className={`bg-gradient-to-r ${isDark ? 'from-[#00D3F3] to-[#8B5CF6]' : 'from-[#00D5BE] to-[#8B5CF6]'} bg-clip-text text-transparent`}>
                  Built to Scale Your Agency
                </span>
              </motion.h2>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: true }}
                className={`text-xl max-w-3xl mx-auto leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Designed for agencies that have proven AI demand
                <br />
                and are ready to productize and scale.
              </motion.p>
            </motion.div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
              {crmFeatures.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className={`
                    relative p-8 rounded-2xl border transition-all duration-300 hover:scale-105
                    ${isDark 
                      ? 'bg-[rgba(16,24,40,0.5)] border-[#1E2939] hover:border-[#364153]' 
                      : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-lg'
                    }
                  `}
                  whileHover={{ y: -5 }}
                >
                  {/* Icon */}
                  <div className={`
                    w-16 h-16 rounded-xl mb-6 flex items-center justify-center
                    ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'}
                  `}>
                    <feature.icon
                      className="w-8 h-8"
                      style={{ color: feature.iconColor }}
                    />
                  </div>

                  {/* Content */}
                  <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {feature.title}
                  </h3>
                  <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                    {feature.description}
                  </p>

                </motion.div>
              ))}
            </div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-center mt-12"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onGetAccess}
                className={`
                  inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg
                  transition-all duration-300
                  ${isDark
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 hover:shadow-lg hover:shadow-cyan-500/25'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 hover:shadow-lg hover:shadow-cyan-500/25'
                  }
                `}
              >
                <ArrowRight className="w-5 h-5" />
                Get Access
              </motion.button>
            </motion.div>

          </div>
        </div>
      </div>
    </motion.div>
  );
};
