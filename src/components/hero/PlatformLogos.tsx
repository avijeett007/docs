'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface PlatformLogosProps {
  className?: string;
}

export const PlatformLogos: React.FC<PlatformLogosProps> = ({ className = '' }) => {
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
        // Fallback to light theme if context is not available
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

  const platforms = [
    {
      name: 'ElevenLabs',
      lightLogo: '/logos/elevenlabs-logo-light.png',
      darkLogo: '/logos/elevenlabs-logo.svg',
      alt: 'ElevenLabs Voice AI'
    },
    {
      name: 'VAPI',
      lightLogo: '/logos/vapi-logo-light.svg',
      darkLogo: '/logos/vapi-logo-dark.svg',
      alt: 'VAPI Voice AI'
    },
    {
      name: 'HighLevel',
      lightLogo: '/logos/highlevel-logo-light.png',
      darkLogo: '/logos/highlevel-logo.svg',
      alt: 'HighLevel CRM'
    },
    {
      name: 'n8n',
      lightLogo: '/logos/n8n-logo-light.png',
      darkLogo: '/logos/n8n-logo.svg',
      alt: 'n8n Workflow Automation'
    },
    {
      name: 'Retell AI',
      lightLogo: '/logos/retell-logo-light.png',
      darkLogo: '/logos/retell-logo.svg',
      alt: 'Retell AI Voice Platform'
    }
  ];

  // Prevent hydration mismatch by showing a loading state during SSR
  if (!mounted) {
    return (
      <div className={`relative py-16 bg-white dark:bg-[#0A0A0B] ${className}`}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-2 h-2 bg-[#00D5BE] rounded-full animate-pulse"></div>
              <div className="px-4 py-2 border border-[#E2E8F0] dark:border-gray-700 rounded-full">
                <span className="text-sm text-[#1F2937] dark:text-gray-300">
                  We support the most advanced AI platforms
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-6">
            {platforms.map((platform, index) => (
              <div
                key={platform.name}
                className="w-[152px] h-[62px] bg-white dark:bg-gray-800 border border-[#E2E8F0] dark:border-gray-700 rounded-[14px] shadow-sm flex items-center justify-center opacity-50"
              >
                <div className="w-20 h-8 bg-[#E2E8F0] dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1.2 }}
      className={`relative ${className}`}
    >
      {/* Exact Figma design - different layouts for light/dark */}
      <div className={`
        ${isDark
          ? 'bg-[#0A0A0B] border-b border-[#1E2939] shadow-[inset_0px_2px_4px_rgba(0,0,0,0.05)]'
          : 'bg-[#FFFFFF] border-t border-[#E2E8F0] shadow-[0px_-1px_3px_rgba(0,0,0,0.1)]'
        }
        ${isDark ? 'py-16 px-16' : 'py-12'}
      `}>
        <div className={`text-center space-y-8 ${isDark ? 'max-w-[1152px]' : 'max-w-6xl'} mx-auto ${!isDark ? 'px-4' : ''}`}>
          {/* Header with teal dot and border - exactly as in Figma */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            className="flex justify-center"
          >
            <div className={`
              inline-flex items-center gap-2 px-6 py-1 rounded-full
              ${isDark
                ? 'bg-[rgba(16,24,40,0.5)] border border-[rgba(54,65,83,0.5)]'
                : 'bg-[#FFFFFF] border border-[#E2E8F0] shadow-sm'
              }
            `}>
              <motion.span
                className={`flex h-2 w-2 rounded-full ${isDark ? 'bg-[#00D3F3]' : 'bg-[#00D5BE]'}`}
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className={`text-sm font-semibold ${isDark ? 'text-[#D1D5DC]' : 'text-[#1F2937]'}`}>
                We support the most advanced AI platforms
              </span>
            </div>
          </motion.div>

          {/* Platform Logos - Grid layout for better alignment */}
          <div className={`${isDark ? 'flex justify-center items-center gap-6 flex-wrap' : 'grid grid-cols-5 gap-4 max-w-4xl mx-auto'}`}>
            {platforms.map((platform, index) => (
              <motion.div
                key={platform.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  // Subtle floating animation with staggered timing
                  y: [0, -8, 0],
                  scale: [1, 1.02, 1]
                }}
                transition={{
                  duration: 0.6,
                  delay: 1.6 + (index * 0.1),
                  // Continuous looping animation
                  y: {
                    duration: 3 + (index * 0.3), // Staggered duration for each logo
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.5 // Staggered start times
                  },
                  scale: {
                    duration: 2.5 + (index * 0.2),
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.3
                  }
                }}
                className="group flex justify-center"
              >
                {/* Cards with different dimensions for light/dark modes */}
                <motion.div
                  className={`
                    ${isDark
                      ? 'w-[211px] h-[98px] bg-[rgba(16,24,40,0.5)] border border-[#1E2939] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] rounded-2xl'
                      : 'w-[152px] h-[62px] bg-[#FFFFFF] border border-[#E2E8F0] shadow-[0px_2px_4px_rgba(0,0,0,0.06)] rounded-[14px]'
                    }
                    flex items-center justify-center px-6 py-4 transition-all duration-300 hover:scale-105 hover:shadow-lg
                  `}
                  // Subtle glow animation on hover
                  whileHover={{
                    scale: 1.05,
                    boxShadow: isDark
                      ? "0px 20px 25px -5px rgba(0,0,0,0.3), 0px 10px 10px -5px rgba(0,0,0,0.2)"
                      : "0px 10px 15px -3px rgba(0,0,0,0.15), 0px 4px 6px -2px rgba(0,0,0,0.1)"
                  }}
                  // Gentle breathing effect for the card
                  animate={{
                    boxShadow: isDark
                      ? [
                          "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
                          "0px 15px 20px -3px rgba(0,0,0,0.15), 0px 6px 8px -4px rgba(0,0,0,0.15)",
                          "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)"
                        ]
                      : [
                          "0px 2px 4px rgba(0,0,0,0.06)",
                          "0px 4px 8px rgba(0,0,0,0.1)",
                          "0px 2px 4px rgba(0,0,0,0.06)"
                        ]
                  }}
                  transition={{
                    boxShadow: {
                      duration: 4 + (index * 0.2),
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.4
                    }
                  }}
                >
                  <motion.img
                    src={isDark ? platform.darkLogo : platform.lightLogo}
                    alt={platform.alt}
                    className={`
                      max-w-full max-h-full object-contain transition-all duration-300
                      ${isDark ? 'max-h-[50px]' : 'max-h-[30px]'}
                    `}
                    // Subtle logo breathing animation
                    animate={{
                      opacity: [0.9, 1, 0.9],
                      filter: [
                        "brightness(1) contrast(1)",
                        "brightness(1.05) contrast(1.02)",
                        "brightness(1) contrast(1)"
                      ]
                    }}
                    transition={{
                      duration: 3.5 + (index * 0.3),
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.6
                    }}
                    onError={(e) => {
                      // Fallback to text if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span class="text-sm font-semibold ${isDark ? 'text-[#D1D5DC]' : 'text-[#1F2937]'}">${platform.name}</span>`;
                      }
                    }}
                  />
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
