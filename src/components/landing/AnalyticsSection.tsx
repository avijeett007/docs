'use client';

import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';

// Animated Counter Component
const AnimatedCounter = ({
  value,
  duration = 2,
  delay = 0
}: {
  value: number;
  duration?: number;
  delay?: number;
}) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(count, value, {
      duration,
      delay,
      ease: "easeOut",
    });

    const unsubscribe = rounded.onChange((latest) => {
      setDisplayValue(latest);
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [count, value, duration, delay, rounded]);

  return <span>{displayValue.toLocaleString()}</span>;
};

interface AnalyticsSectionProps {
  className?: string;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({ className = '' }) => {
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

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <section className="relative py-20 px-4 overflow-hidden bg-white">
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="h-16 bg-gray-200 animate-pulse rounded mb-6" />
            <div className="h-6 bg-gray-200 animate-pulse rounded max-w-3xl mx-auto" />
          </div>
          <div className="h-96 bg-gray-200 animate-pulse rounded-2xl" />
        </div>
      </section>
    );
  }

  return (
    <section className={`
      relative py-20 px-4 overflow-hidden ${className}
      ${isDark
        ? 'bg-gradient-to-b from-[#0A0A0B] via-[#111827] to-[#0A0A0B]'
        : 'bg-gradient-to-b from-white via-gray-50 to-white'
      }
    `}>
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Orbs */}
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 ${
          isDark ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gradient-to-r from-cyan-300 to-blue-300'
        }`} />
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 ${
          isDark ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-purple-300 to-pink-300'
        }`} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className={`text-4xl md:text-6xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            Your{' '}
            <span className={`bg-gradient-to-r ${
              isDark ? 'from-[#00D3F3] to-[#8B5CF6]' : 'from-[#00D5BE] to-[#8B5CF6]'
            } bg-clip-text text-transparent`}>
              Command Center
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
            className={`text-xl max-w-3xl mx-auto leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
          >
            Instantly see performance, costs, and conversations.
            <br />
            Visualized in real time so you can act faster and scale smarter.
          </motion.p>
        </motion.div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          viewport={{ once: true }}
          className="relative max-w-6xl mx-auto"
        >
          {/* Dashboard Image with Subtle Animation */}
          <motion.div
            className={`
              relative rounded-2xl overflow-hidden border shadow-2xl
              ${isDark
                ? 'border-gray-700/50 shadow-black/50'
                : 'border-gray-200/50 shadow-gray-900/10'
              }
            `}
            whileHover={{
              scale: 1.02,
              transition: { duration: 0.3 }
            }}
          >
            <motion.img
              src={isDark ? '/logos/analytics-dark.svg' : '/logos/analytics-light.svg'}
              alt="Analytics Dashboard"
              className="w-full h-auto"
              initial={{ scale: 1.1 }}
              whileInView={{ scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              viewport={{ once: true }}
            />

            {/* Subtle glow effect */}
            <div className={`
              absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-500
              ${isDark
                ? 'bg-gradient-to-t from-cyan-500/10 via-transparent to-purple-500/10'
                : 'bg-gradient-to-t from-blue-500/5 via-transparent to-purple-500/5'
              }
            `} />
          </motion.div>

          {/* Floating Stats Cards - Positioned to not interfere with SVG content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            viewport={{ once: true }}
            className={`
              absolute -left-6 top-1/3 p-4 rounded-xl border backdrop-blur-md shadow-lg
              ${isDark
                ? 'bg-gray-900/90 border-gray-700/50'
                : 'bg-white/90 border-gray-200/50'
              }
            `}
          >
            <div className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Total Calls
            </div>
            <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <AnimatedCounter value={3880} duration={2} delay={1.2} />
            </div>
            <motion.div
              className="text-green-500 text-sm"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
              viewport={{ once: true }}
            >
              ↗ +12%
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            viewport={{ once: true }}
            className={`
              absolute -right-6 top-1/2 p-4 rounded-xl border backdrop-blur-md shadow-lg
              ${isDark
                ? 'bg-gray-900/90 border-gray-700/50'
                : 'bg-white/90 border-gray-200/50'
              }
            `}
          >
            <div className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Success Rate
            </div>
            <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <AnimatedCounter value={95} duration={2} delay={1.4} />%
            </div>
            <motion.div
              className="text-green-500 text-sm"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 2.7 }}
              viewport={{ once: true }}
            >
              ↗ +3%
            </motion.div>
          </motion.div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          viewport={{ once: true }}
          className="text-center mt-16 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const demoSection = document.getElementById('demo-video');
              if (demoSection) {
                demoSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className={`
              inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg
              transition-all duration-300
              ${isDark
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 hover:shadow-lg hover:shadow-purple-500/25'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 hover:shadow-lg hover:shadow-purple-500/25'
              }
            `}
          >
            <Play className="w-5 h-5" />
            Watch Demo
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              window.open('https://discord.gg/AQCdM68BTr', '_blank');
            }}
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
            Join our Discord
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};
