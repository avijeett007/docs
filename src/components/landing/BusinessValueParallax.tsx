"use client";
import React, { useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  MotionValue,
  AnimatePresence,
} from "framer-motion";
// import Image from "next/image"; // TODO: Add actual images for business value cards
import { ArrowRight, Check, X } from "lucide-react";


const businessValues = [
  {
    title: "Stop Clients From Going Direct to AI Providers",
    subtitle: "Multi-Provider Comparison Keeps You Essential",
    description: "Compare VAPI, Retell, Ultravox, ElevenLabs, and GHL costs in real-time. Your clients need YOU to get the best deals - they can't get this anywhere else.",
    features: ["Real-time cost comparison", "Provider arbitrage profits", "Client dependency creation", "Competitive intelligence"],
    thumbnail: "/placeholder-gifs/multi-provider.gif",
    gradient: "from-blue-500 to-cyan-500",
    icon: "🔒"
  },
  {
    title: "Your Brand Everywhere - Never Ours",
    subtitle: "Complete White-Label Client Lock-In",
    description: "Clients see YOUR brand on everything - domains, portals, emails, invoices. They think you built the entire platform. Perfect client retention.",
    features: ["Custom domains", "Full branding control", "Zero Knotie mentions", "Client portal ownership"],
    thumbnail: "/placeholder-gifs/whitelabel.gif",
    gradient: "from-purple-500 to-pink-500",
    icon: "🎨"
  },
  {
    title: "Keep Your GHL & N8N Clients Happy",
    subtitle: "Seamless Integration Without Platform Switching",
    description: "Your existing GHL and N8N clients get Voice AI without changing their workflow. They stay with you, not the AI provider.",
    features: ["GHL native integration", "N8N custom nodes", "No client migration", "Workflow continuity"],
    thumbnail: "/placeholder-gifs/integrations.gif",
    gradient: "from-green-500 to-teal-500",
    icon: "🔗"
  },
  {
    title: "Clients Manage Everything - You Stay Essential",
    subtitle: "Self-Service Dashboards That Lock Them In",
    description: "Clients get full transparency and control through YOUR branded dashboard. They're self-sufficient but can't leave because everything runs through you.",
    features: ["Real-time analytics", "Usage tracking", "Billing transparency", "Branded experience"],
    thumbnail: "/placeholder-gifs/dashboards.gif",
    gradient: "from-orange-500 to-red-500",
    icon: "📊"
  },
  {
    title: "Close Deals Faster With Instant Demos",
    subtitle: "Industry-Specific Templates That Sell",
    description: "Healthcare, real estate, e-commerce templates ready to demo. Show prospects working Voice AI in their industry within minutes.",
    features: ["Industry templates", "Instant demos", "Customizable prompts", "Sales-ready agents"],
    thumbnail: "/placeholder-gifs/templates.gif",
    gradient: "from-indigo-500 to-purple-500",
    icon: "🎯"
  },
  {
    title: "Scale Without Hiring Technical Staff",
    subtitle: "We Handle All The Complex Stuff",
    description: "24/7 support, unlimited scaling, dedicated success manager. Focus on sales while we handle the technical complexity.",
    features: ["24/7 live support", "Dedicated success manager", "Unlimited scaling", "Technical expertise"],
    thumbnail: "/placeholder-gifs/support.gif",
    gradient: "from-teal-500 to-blue-500",
    icon: "🚀"
  },
  {
    title: "Maximize Profit Margins on Every Call",
    subtitle: "No Usage Limits = Higher Profits",
    description: "No per-minute charges or hidden fees. Your markup stays consistent regardless of usage. More client usage = more profit for you.",
    features: ["No usage limits", "Consistent margins", "Bulk provider discounts", "Profit optimization"],
    thumbnail: "/placeholder-gifs/unlimited.gif",
    gradient: "from-yellow-500 to-orange-500",
    icon: "💰"
  },
  {
    title: "Beat Competitors to Market",
    subtitle: "Launch in 20 Minutes While They Take Months",
    description: "From signup to first paying client in under 20 minutes. While competitors build from scratch, you're already earning revenue.",
    features: ["20-minute setup", "Instant market entry", "First-mover advantage", "Revenue acceleration"],
    thumbnail: "/placeholder-gifs/quick-launch.gif",
    gradient: "from-pink-500 to-rose-500",
    icon: "⚡"
  },
  {
    title: "Set Your Own Prices & Keep More Profit",
    subtitle: "Automated Billing That Maximizes Revenue",
    description: "Set custom markup percentages, create tiered pricing, automate everything with Stripe. You control pricing, we handle the complexity.",
    features: ["Custom markup control", "Automated billing", "Stripe integration", "Revenue optimization"],
    thumbnail: "/placeholder-gifs/billing.gif",
    gradient: "from-cyan-500 to-blue-500",
    icon: "💳"
  },
  {
    title: "Sell Like a Pro From Day One",
    subtitle: "Proven Marketing Materials That Convert",
    description: "Complete sales toolkit with scripts that close deals, email sequences that convert, and case studies that build trust. Start selling immediately.",
    features: ["Proven sales scripts", "Converting email templates", "Trust-building case studies", "Professional presentations"],
    thumbnail: "/placeholder-gifs/marketing.gif",
    gradient: "from-violet-500 to-purple-500",
    icon: "📈"
  }
];

// Mobile slider component for single card display
const MobileBusinessValueSlider = ({
  businessValues,
  onCardClick,
  isDark
}: {
  businessValues: Array<{
    title: string;
    subtitle: string;
    description: string;
    features: string[];
    thumbnail: string;
    gradient: string;
    icon: string;
  }>;
  onCardClick: (value: any) => void;
  isDark: boolean;
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const nextCard = () => {
    setCurrentIndex((prev) => (prev + 1) % businessValues.length);
  };

  const prevCard = () => {
    setCurrentIndex((prev) => (prev - 1 + businessValues.length) % businessValues.length);
  };

  return (
    <div className="relative px-4">
      {/* Single card display */}
      <div className="flex justify-center mb-8">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          <BusinessValueCard
            value={businessValues[currentIndex]}
            translate={useTransform(() => 0)} // No parallax on mobile
            onClick={() => onCardClick(businessValues[currentIndex])}
            isDark={isDark}
          />
        </motion.div>
      </div>

      {/* Navigation controls */}
      <div className="flex justify-center items-center gap-4 mb-6">
        <button
          onClick={prevCard}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors border ${
            isDark
              ? 'bg-gray-800/50 hover:bg-gray-700/50 text-white border-blue-400/20'
              : 'bg-[#FFFFFF]/90 hover:bg-[#FFFFFF] text-[#1F2937] border-[#E2E8F0] shadow-sm'
          }`}
        >
          <ArrowRight className="w-5 h-5 rotate-180" />
        </button>

        <div className="flex gap-2">
          {businessValues.map((_: any, index: number) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex
                  ? (isDark ? 'bg-blue-400' : 'bg-teal-500')
                  : (isDark ? 'bg-gray-600' : 'bg-[#CAD5E2]')
              }`}
            />
          ))}
        </div>

        <button
          onClick={nextCard}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors border ${
            isDark
              ? 'bg-gray-800/50 hover:bg-gray-700/50 text-white border-blue-400/20'
              : 'bg-[#FFFFFF]/90 hover:bg-[#FFFFFF] text-[#1F2937] border-[#E2E8F0] shadow-sm'
          }`}
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Card counter */}
      <div className={`text-center text-sm ${
        isDark ? 'text-gray-400' : 'text-[#64748B]'
      }`}>
        {currentIndex + 1} of {businessValues.length}
      </div>
    </div>
  );
};

export const BusinessValueCard = ({
  value,
  translate,
  onClick,
  isDark,
}: {
  value: typeof businessValues[0];
  translate: MotionValue<number>;
  onClick: () => void;
  isDark: boolean;
}) => {
  return (
    <motion.div
      style={{
        x: translate,
      }}
      whileHover={{
        y: -20,
        scale: 1.05,
      }}
      className="group/product h-[500px] w-[400px] relative flex-shrink-0 cursor-pointer"
      onClick={onClick}
    >
      <div className="block group-hover/product:shadow-2xl h-full">
        {/*
          TODO: Replace with actual demo GIF/video
          File path: {value.thumbnail}
          This should be an engaging visual demonstration of the feature
        */}
        <div className={`relative h-64 w-full rounded-t-xl overflow-hidden ${
          isDark
            ? 'bg-gradient-to-br from-gray-800 to-gray-900'
            : 'bg-gradient-to-br from-[#F8FAFC] to-[#E2E8F0]'
        }`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${value.gradient} opacity-30`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`text-center p-6 ${
              isDark ? 'text-white' : 'text-[#0F172B]'
            }`}>
              <div className={`w-20 h-20 bg-gradient-to-br ${value.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                <span className="text-3xl">{value.icon}</span>
              </div>
              <h4 className="text-lg font-bold mb-2">{value.title.split(' ').slice(0, 3).join(' ')}</h4>
              <p className="text-sm opacity-90 leading-relaxed">{value.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={`backdrop-blur-md p-6 rounded-b-xl border h-[236px] flex flex-col ${
          isDark
            ? 'bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-blue-400/20'
            : 'bg-gradient-to-br from-[#FFFFFF]/95 to-[#F8FAFC]/95 border-[#E2E8F0]'
        }`}>
          <h3 className={`text-xl font-bold mb-2 leading-tight ${
            isDark ? 'text-white' : 'text-[#0F172B]'
          }`}>
            {value.title}
          </h3>
          <p className={`text-sm font-medium bg-gradient-to-r ${value.gradient} bg-clip-text text-transparent mb-3`}>
            {value.subtitle}
          </p>
          <p className={`text-sm mb-4 flex-1 leading-relaxed ${
            isDark ? 'text-gray-300' : 'text-[#1F2937]'
          }`}>
            {value.description}
          </p>

          {/* Features */}
          <div className="space-y-1 mb-4">
            {value.features.slice(0, 2).map((feature, idx) => (
              <div key={idx} className={`flex items-center gap-2 text-xs ${
                isDark ? 'text-gray-400' : 'text-[#64748B]'
              }`}>
                <Check className={`w-3 h-3 flex-shrink-0 ${
                  isDark ? 'text-teal-400' : 'text-[#00D5BE]'
                }`} />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onClick}
            className={`w-full py-2 px-4 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center justify-center gap-2 group hover:shadow-lg ${
              isDark
                ? 'bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 hover:shadow-blue-500/25'
                : 'bg-gradient-to-r from-[#00D5BE] to-[#14B8A6] hover:from-[#00D5BE]/90 hover:to-[#14B8A6]/90 hover:shadow-[#00D5BE]/25'
            }`}
          >
            Click to Explore
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
      
      <div className={`absolute inset-0 h-full w-full opacity-0 group-hover/product:opacity-10 pointer-events-none rounded-xl ${
        isDark
          ? 'bg-gradient-to-br from-blue-500 to-teal-500'
          : 'bg-gradient-to-br from-[#00D5BE] to-[#14B8A6]'
      }`}></div>
    </motion.div>
  );
};

const BusinessValueParallax = () => {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [selectedValue, setSelectedValue] = useState<typeof businessValues[0] | null>(null);

  // Split business values into rows for parallax effect
  const firstRow = businessValues.slice(0, 4);
  const secondRow = businessValues.slice(4, 7);
  const thirdRow = businessValues.slice(7, 10);
  const ref = React.useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const springConfig = { stiffness: 300, damping: 30, bounce: 100 };

  // Changed direction: negative values move inward, positive values move outward
  const translateX = useSpring(
    useTransform(scrollYProgress, [0, 1], [-1000, 0]),
    springConfig
  );
  const translateXReverse = useSpring(
    useTransform(scrollYProgress, [0, 1], [1000, 0]),
    springConfig
  );
  const rotateX = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [15, 0]),
    springConfig
  );
  const opacity = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [0.2, 1]),
    springConfig
  );
  const rotateZ = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [20, 0]),
    springConfig
  );
  const translateY = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [-700, 500]),
    springConfig
  );

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
      <section className="py-20 px-4 relative overflow-hidden bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="h-8 bg-[#E2E8F0] rounded w-64 mx-auto mb-4 animate-pulse"></div>
            <div className="h-6 bg-[#E2E8F0] rounded w-96 mx-auto animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-[#FFFFFF] rounded-xl p-6 shadow-sm border border-[#E2E8F0]">
                <div className="h-32 bg-[#E2E8F0] rounded-lg mb-4 animate-pulse"></div>
                <div className="h-4 bg-[#E2E8F0] rounded w-3/4 mb-2 animate-pulse"></div>
                <div className="h-3 bg-[#E2E8F0] rounded w-1/2 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      ref={ref}
      className={`h-[300vh] py-40 overflow-hidden antialiased relative flex flex-col self-auto [perspective:1000px] [transform-style:preserve-3d] ${
        isDark
          ? 'bg-[#0A0A0B]'
          : 'bg-gradient-to-b from-[#FFFFFF] to-[#F8FAFC]'
      }`}
    >
      {/* Header */}
      <div className="max-w-7xl relative mx-auto py-20 md:py-40 px-4 w-full left-0 top-0">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className={`inline-flex items-center rounded-full border px-6 py-2.5 text-sm backdrop-blur-md mb-8 ${
            isDark
              ? 'border-teal-400/30 text-teal-200 bg-teal-900/10'
              : 'border-[#00D5BE]/30 text-[#00D5BE] bg-[#00D5BE]/5'
          }`}>
            <span className={`flex h-2 w-2 rounded-full mr-3 animate-pulse ${
              isDark ? 'bg-teal-400' : 'bg-[#00D5BE]'
            }`}></span>
            Client Lock-In Technology
          </div>

          <h1 className={`text-4xl md:text-7xl font-bold mb-8 tracking-tight leading-tight ${
            isDark ? 'text-white' : 'text-[#0F172B]'
          }`}>
            How We Made it Easy for You to
            <span className={`text-transparent bg-clip-text block mt-3 ${
              isDark
                ? 'bg-gradient-to-r from-teal-400 via-blue-400 to-purple-400'
                : 'bg-gradient-to-r from-[#00D5BE] via-[#14B8A6] to-[#00D5BE]'
            }`}>
              Keep Clients & Scale Your Agency
            </span>
            <span className={`block mt-3 ${
              isDark ? 'text-white' : 'text-[#0F172B]'
            }`}>Without Losing Them</span>
          </h1>

          <p className={`max-w-3xl text-xl md:text-2xl mt-8 mx-auto leading-relaxed ${
            isDark ? 'text-blue-100/80' : 'text-[#1F2937]'
          }`}>
            Everything you need to lock in clients, maximize profits, and scale your Voice AI agency.
            Perfect for GHL & N8N agencies ready to dominate.
          </p>
        </motion.div>
      </div>

      {/* Parallax Cards */}
      <motion.div
        style={{
          rotateX,
          rotateZ,
          translateY,
          opacity,
        }}
        className=""
      >
        {/* Desktop: Multiple cards with parallax, Mobile: Single card slider */}
        <div className="hidden md:block">
          {/* First Row - 4 cards with original spacing */}
          <motion.div className="flex flex-row-reverse space-x-reverse space-x-20 mb-20">
            {firstRow.map((value) => (
              <BusinessValueCard
                value={value}
                translate={translateX}
                key={value.title}
                onClick={() => setSelectedValue(value)}
                isDark={isDark}
              />
            ))}
          </motion.div>

          {/* Second Row - 3 cards with original spacing */}
          <motion.div className="flex flex-row mb-20 space-x-20">
            {secondRow.map((value) => (
              <BusinessValueCard
                value={value}
                translate={translateXReverse}
                key={value.title}
                onClick={() => setSelectedValue(value)}
                isDark={isDark}
              />
            ))}
          </motion.div>

          {/* Third Row - 3 cards with original spacing */}
          <motion.div className="flex flex-row-reverse space-x-reverse space-x-20">
            {thirdRow.map((value) => (
              <BusinessValueCard
                value={value}
                translate={translateX}
                key={value.title}
                onClick={() => setSelectedValue(value)}
                isDark={isDark}
              />
            ))}
          </motion.div>
        </div>

        {/* Mobile: Single card slider */}
        <div className="md:hidden">
          <MobileBusinessValueSlider
            businessValues={businessValues}
            onCardClick={setSelectedValue}
            isDark={isDark}
          />
        </div>
      </motion.div>

      {/* Modal for detailed view */}
      <AnimatePresence>
        {selectedValue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedValue(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border ${
                isDark
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-blue-400/20'
                  : 'bg-gradient-to-br from-[#FFFFFF] to-[#F8FAFC] border-[#E2E8F0]'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedValue(null)}
                className={`absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 ${
                  isDark
                    ? 'bg-gray-700/50 hover:bg-gray-600/50 text-white'
                    : 'bg-[#E2E8F0]/50 hover:bg-[#CAD5E2]/50 text-[#1F2937]'
                }`}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8">
                {/*
                  TODO: Replace with actual interactive demo/video
                  File path: {selectedValue.thumbnail}
                  This should be a full-width engaging demonstration
                */}
                <div className={`w-full h-80 rounded-xl mb-8 flex items-center justify-center relative overflow-hidden ${
                  isDark
                    ? 'bg-gradient-to-br from-gray-700 to-gray-800'
                    : 'bg-gradient-to-br from-[#F8FAFC] to-[#E2E8F0]'
                }`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${selectedValue.gradient} opacity-30`} />
                  <div className={`relative text-center z-10 p-8 ${
                    isDark ? 'text-white' : 'text-[#0F172B]'
                  }`}>
                    <div className={`w-32 h-32 bg-gradient-to-br ${selectedValue.gradient} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl`}>
                      <span className="text-5xl">{selectedValue.icon}</span>
                    </div>
                    <h3 className="text-3xl font-bold mb-4">{selectedValue.title}</h3>
                    <p className={`text-xl max-w-2xl mx-auto leading-relaxed ${
                      isDark ? 'text-white/90' : 'text-[#1F2937]'
                    }`}>{selectedValue.subtitle}</p>
                  </div>
                </div>

                {/* Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h2 className={`text-3xl font-bold mb-4 ${
                      isDark ? 'text-white' : 'text-[#0F172B]'
                    }`}>
                      {selectedValue.title}
                    </h2>
                    <p className={`text-lg font-medium bg-gradient-to-r ${selectedValue.gradient} bg-clip-text text-transparent mb-6`}>
                      {selectedValue.subtitle}
                    </p>
                    <p className={`text-lg leading-relaxed mb-8 ${
                      isDark ? 'text-gray-300' : 'text-[#1F2937]'
                    }`}>
                      {selectedValue.description}
                    </p>
                  </div>

                  <div>
                    <h3 className={`text-xl font-bold mb-6 ${
                      isDark ? 'text-white' : 'text-[#0F172B]'
                    }`}>Key Features</h3>
                    <div className="space-y-4">
                      {selectedValue.features.map((feature, idx) => (
                        <div key={idx} className={`flex items-start gap-3 p-4 rounded-lg ${
                          isDark ? 'bg-gray-700/30' : 'bg-[#F8FAFC]/50 border border-[#E2E8F0]'
                        }`}>
                          <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                            isDark ? 'text-teal-400' : 'text-[#00D5BE]'
                          }`} />
                          <span className={`${
                            isDark ? 'text-gray-300' : 'text-[#1F2937]'
                          }`}>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA buttons */}
                    <div className="flex gap-4 mt-8">
                      <button
                        onClick={() => {
                          // Close modal and scroll to get started button
                          setSelectedValue(null);
                          const getStartedButton = document.querySelector('[data-action="get-started"]');
                          if (getStartedButton) {
                            getStartedButton.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className={`flex-1 py-3 px-6 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 group ${
                          isDark
                            ? 'bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600'
                            : 'bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600'
                        }`}
                      >
                        Try This Feature
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                      </button>
                      <button
                        onClick={() => setSelectedValue(null)}
                        className={`px-6 py-3 rounded-lg transition-colors duration-200 ${
                          isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#1F2937] border border-[#E2E8F0]'
                        }`}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusinessValueParallax;
