"use client";
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, TrendingDown, Users, DollarSign, Settings, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ClientOnly } from '../ui/client-only';
import { HeroMemberCounter } from '../ui/animated-counter';

const painPoints = [
  {
    icon: <Users className="w-8 h-8" />,
    title: "Clients Going Direct to AI Providers",
    description: "Your clients discover VAPI, Retell, or ElevenLabs and cut you out completely",
    impact: "Losing 60% of clients"
  },
  {
    icon: <DollarSign className="w-8 h-8" />,
    title: "Can't Scale Without Losing Margins",
    description: "More clients = more complexity, higher costs, and shrinking profit margins",
    impact: "Stuck at $10K/month"
  },
  {
    icon: <AlertTriangle className="w-8 h-8" />,
    title: "GHL & N8N Clients Want Voice AI",
    description: "Your existing clients demand Voice AI but you can't deliver without losing them",
    impact: "Client churn to competitors"
  },
  {
    icon: <Settings className="w-8 h-8" />,
    title: "Technical Complexity Blocking Growth",
    description: "Need developers, API management, and technical expertise you don't have",
    impact: "6+ months to launch"
  },
  {
    icon: <TrendingDown className="w-8 h-8" />,
    title: "No Competitive Advantage",
    description: "Everyone has access to the same AI providers - nothing makes you special",
    impact: "Race to the bottom pricing"
  },
  {
    icon: <Clock className="w-8 h-8" />,
    title: "Competitors Moving Faster",
    description: "While you're figuring it out, competitors are already selling and scaling",
    impact: "Missing the AI gold rush"
  }
];

const PainPointCard = ({ painPoint, index, isDark }: { painPoint: typeof painPoints[0], index: number, isDark: boolean }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className={`
        group relative backdrop-blur-md p-6 rounded-xl border transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl
        ${isDark
          ? 'bg-gradient-to-br from-red-900/20 to-orange-900/20 border-red-400/20 hover:border-red-400/40 hover:shadow-red-500/10'
          : 'bg-gradient-to-br from-red-50/80 to-orange-50/80 border-red-300/30 hover:border-red-400/50 hover:shadow-red-500/20'
        }
      `}
    >
      {/* Warning indicator */}
      <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-3 h-3 text-white" />
      </div>

      <div className="flex items-start gap-4">
        <div className={`
          flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center transition-colors duration-300
          ${isDark
            ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20 text-red-400 group-hover:text-red-300'
            : 'bg-gradient-to-br from-red-100/80 to-orange-100/80 text-red-600 group-hover:text-red-500'
          }
        `}>
          {painPoint.icon}
        </div>

        <div className="flex-1">
          <h3 className={`
            text-xl font-bold mb-2 transition-colors duration-300
            ${isDark
              ? 'text-white group-hover:text-red-100'
              : 'text-gray-900 group-hover:text-red-800'
            }
          `}>
            {painPoint.title}
          </h3>
          <p className={`mb-3 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {painPoint.description}
          </p>
          <div className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
            ${isDark
              ? 'bg-red-500/20 text-red-300'
              : 'bg-red-100/80 text-red-700'
            }
          `}>
            <TrendingDown className="w-4 h-4" />
            {painPoint.impact}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const PainPointsSection = () => {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Only access theme context after mounting
    try {
      const themeContext = document.documentElement.classList.contains('dark');
      setIsDark(themeContext);
    } catch (error) {
      // Fallback to light theme if context is not available
      setIsDark(false);
    }
  }, []);

  // Show loading state during SSR
  if (!mounted) {
    return (
      <section className="py-20 px-4 relative overflow-hidden bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-4 animate-pulse"></div>
            <div className="h-6 bg-gray-200 rounded w-96 mx-auto animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="h-16 bg-gray-200 rounded-lg mb-4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`py-20 px-4 relative overflow-hidden ${
      isDark
        ? 'bg-[#0A0A0B]'
        : 'bg-gradient-to-b from-[#F8FAFC] to-[#F2F9F9]/57'
    }`}>
      {/* Background Effects */}
      <div className={`absolute inset-0 ${
        isDark
          ? 'bg-gradient-to-b from-transparent via-red-900/5 to-transparent'
          : 'bg-gradient-to-b from-transparent via-red-50/30 to-transparent'
      }`} />
      <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl ${
        isDark
          ? 'bg-gradient-to-r from-red-500/5 to-orange-500/5'
          : 'bg-gradient-to-r from-red-100/20 to-orange-100/20'
      }`} />
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className={`
            inline-flex items-center rounded-full border px-6 py-2.5 text-sm backdrop-blur-md mb-8
            ${isDark
              ? 'border-red-400/30 text-red-200 bg-red-900/10'
              : 'border-red-500/30 text-red-700 bg-red-50/50'
            }
          `}>
            <span className={`flex h-2 w-2 rounded-full mr-3 animate-pulse ${
              isDark ? 'bg-red-400' : 'bg-red-500'
            }`}></span>
            Agency Scaling Crisis
          </div>

          <h2 className={`text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Your Agency Is Stuck Because
            <span className="text-transparent bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text block mt-2">
              You Can't Scale Voice AI
            </span>
          </h2>

          <p className={`text-xl md:text-2xl mb-8 max-w-4xl mx-auto leading-relaxed ${
            isDark ? 'text-gray-300' : 'text-[#1F2937]'
          }`}>
            While competitors lock in clients with Voice AI, you're losing them to...
          </p>
          
          {/* Urgency Stats */}
          <div className="flex flex-wrap justify-center items-center gap-8 mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className={`flex items-center gap-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}
            >
              <TrendingDown className="w-5 h-5" />
              <span className="font-semibold">60% Client Loss to Direct Providers</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className={`flex items-center gap-2 ${isDark ? 'text-teal-300' : 'text-teal-600'}`}
            >
              <Clock className="w-5 h-5" />
              <span className="font-semibold">Stuck at $10K/Month Revenue</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
              className={`flex items-center gap-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}
            >
              <Users className="w-5 h-5" />
              <span className="font-semibold">
                <ClientOnly fallback={<span>250+</span>}>
                  <HeroMemberCounter />
                </ClientOnly> Agencies Already Scaling
              </span>
            </motion.div>
          </div>
        </motion.div>

        {/* Pain Points Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {painPoints.map((painPoint, index) => (
            <PainPointCard key={index} painPoint={painPoint} index={index} isDark={isDark} />
          ))}
        </div>

        {/* Solution Teaser */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
          className={`
            text-center backdrop-blur-md p-8 rounded-2xl border
            ${isDark
              ? 'bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-blue-400/20'
              : 'bg-gradient-to-r from-blue-50/80 to-teal-50/80 border-blue-300/30'
            }
          `}
        >
          <h3 className={`text-2xl md:text-3xl font-bold mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            But What If There Was A Better Way?
          </h3>
          <p className={`text-xl mb-6 max-w-3xl mx-auto ${
            isDark ? 'text-blue-200/80' : 'text-[#1F2937]'
          }`}>
            What if you could solve all these problems and start capturing your share of the AI market in just 20 minutes?
          </p>
          <button className="group px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold text-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 relative overflow-hidden">
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            <span className="relative flex items-center justify-center gap-2">
              Show Me The Solution
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
            </span>
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default PainPointsSection;
