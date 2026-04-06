"use client";
import React, { useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  MotionValue,
  AnimatePresence,
  useMotionValue,
} from "framer-motion";
import { ArrowRight, Clock, CheckCircle, X, Play, ChevronLeft, ChevronRight } from "lucide-react";


const processSteps = [
  {
    step: "01",
    title: "Stop Losing Clients to Competitors",
    subtitle: "Setup Your White-Label Voice AI Platform",
    description: "Launch your branded platform in 10 minutes. Your clients can't leave because everything runs under YOUR brand, not ours.",
    timeframe: "5-10 minutes",
    thumbnail: "/placeholder-gifs/setup-agency.gif",
    gradient: "from-blue-500 to-cyan-500"
  },
  {
    step: "02",
    title: "Keep Your GHL & N8N Clients Happy",
    subtitle: "Seamless Integration Without Platform Switching",
    description: "Your existing GHL and N8N clients get Voice AI without changing their workflow. They stay with you, not the AI provider.",
    timeframe: "2 minutes per client",
    thumbnail: "/placeholder-gifs/client-onboard.gif",
    gradient: "from-purple-500 to-pink-500"
  },
  {
    step: "03",
    title: "Compare & Choose Best Voice AI Providers",
    subtitle: "VAPI, Retell, Ultravox, ElevenLabs, GHL - All In One Dashboard",
    description: "Real-time cost comparison across all providers. Pick the cheapest for each client and maximize your margins.",
    timeframe: "1 minute per agent",
    thumbnail: "/placeholder-gifs/connect-agents.gif",
    gradient: "from-green-500 to-teal-500"
  },
  {
    step: "04",
    title: "Scale Without Technical Headaches",
    subtitle: "One-Click Stripe Integration - No Coding Required",
    description: "Connect your Stripe account instantly. No API keys, no developer needed. Start billing clients immediately.",
    timeframe: "30 seconds",
    thumbnail: "/placeholder-gifs/stripe-integration.gif",
    gradient: "from-orange-500 to-red-500"
  },
  {
    step: "05",
    title: "Set Your Profit Margins",
    subtitle: "Automated Markup & Billing That Runs Itself",
    description: "Configure your markup percentages once. The platform automatically bills clients and pays providers. You keep the difference.",
    timeframe: "3 minutes",
    thumbnail: "/placeholder-gifs/billing-setup.gif",
    gradient: "from-indigo-500 to-purple-500"
  },
  {
    step: "06",
    title: "Never Chase Payments Again",
    subtitle: "Smart Reminders & Auto-Suspension Keep Cash Flowing",
    description: "Automated payment tracking, smart reminders, and graceful service suspension. Your cash flow stays healthy.",
    timeframe: "Fully automated",
    thumbnail: "/placeholder-gifs/payment-tracking.gif",
    gradient: "from-teal-500 to-blue-500"
  },
  {
    step: "07",
    title: "Keep Clients Locked In",
    subtitle: "Transparent Pricing They Can't Get Elsewhere",
    description: "Your clients see real-time usage and costs, but only through YOUR platform. They can't go direct to providers.",
    timeframe: "1 minute per client",
    thumbnail: "/placeholder-gifs/markup-pricing.gif",
    gradient: "from-yellow-500 to-orange-500"
  },
  {
    step: "08",
    title: "Build Client Trust & Retention",
    subtitle: "Full Analytics Dashboard Under Your Brand",
    description: "Clients get complete transparency on usage, performance, and costs - all branded as YOUR service, not the AI provider's.",
    timeframe: "Real-time updates",
    thumbnail: "/placeholder-gifs/analytics-view.gif",
    gradient: "from-pink-500 to-rose-500"
  },
  {
    step: "09",
    title: "Maximize Revenue Per Client",
    subtitle: "Built-In Upsell & Feature Control System",
    description: "Control which features clients can access. Create upgrade paths and upsell opportunities that increase your monthly revenue.",
    timeframe: "Ongoing revenue",
    thumbnail: "/placeholder-gifs/upsell-features.gif",
    gradient: "from-cyan-500 to-blue-500"
  },
  {
    step: "10",
    title: "Lock In Your N8N Clients Forever",
    subtitle: "Exclusive Knotie N8N Node - They Can't Leave You",
    description: "Our custom N8N node replaces standard tools. Your clients' workflows become dependent on YOUR platform - they can't run away with templates.",
    timeframe: "Unlimited potential",
    thumbnail: "/placeholder-gifs/n8n-workflows.gif",
    gradient: "from-violet-500 to-purple-500"
  },
  {
    step: "11",
    title: "Stay Ahead of Competition",
    subtitle: "Weekly Feature Updates Keep You Leading",
    description: "While competitors struggle with single providers, you get new features weekly. Your platform evolves faster than they can copy.",
    timeframe: "Weekly updates",
    thumbnail: "/placeholder-gifs/more-features.gif",
    gradient: "from-emerald-500 to-teal-500"
  }
];

export const ProcessCard = ({
  process,
  translate,
  onClick,
  isDark,
}: {
  process: typeof processSteps[0];
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
      className="group/product h-[520px] w-[420px] relative flex-shrink-0 cursor-pointer"
      onClick={onClick}
    >
      <div className="block group-hover/product:shadow-2xl h-full">
        {/* Step Number */}
        <div className="absolute -top-4 -left-4 z-10">
          <div className={`w-16 h-16 bg-gradient-to-br ${process.gradient} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
            {process.step}
          </div>
        </div>
        
        {/*
          TODO: Replace with actual process demo GIF/video
          File path: {process.thumbnail}
          This should show step-by-step process demonstration
        */}
        <div className={`relative h-64 w-full rounded-t-xl overflow-hidden ${
          isDark
            ? 'bg-gradient-to-br from-gray-800 to-gray-900'
            : 'bg-gradient-to-br from-gray-100 to-gray-200'
        }`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${process.gradient} opacity-30`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`text-center p-6 ${
              isDark ? 'text-white' : 'text-gray-800'
            }`}>
              <div className={`w-24 h-24 bg-gradient-to-br ${process.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                <span className="text-2xl font-bold text-white">{process.step}</span>
              </div>
              <h4 className="text-lg font-bold mb-2">{process.title.split(' ').slice(0, 3).join(' ')}</h4>
              <p className={`text-sm opacity-90 leading-relaxed font-medium ${
                isDark ? 'text-green-300' : 'text-green-600'
              }`}>{process.timeframe}</p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className={`backdrop-blur-md p-6 rounded-b-xl border h-[256px] flex flex-col ${
          isDark
            ? 'bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-blue-400/20'
            : 'bg-gradient-to-br from-[#FFFFFF]/95 to-[#F8FAFC]/95 border-[#E2E8F0]'
        }`}>
          <h3 className={`text-xl font-bold mb-2 leading-tight ${
            isDark ? 'text-white' : 'text-[#0F172B]'
          }`}>
            {process.title}
          </h3>
          <p className={`text-sm font-medium bg-gradient-to-r ${process.gradient} bg-clip-text text-transparent mb-3`}>
            {process.subtitle}
          </p>
          <p className={`text-sm mb-4 flex-1 leading-relaxed ${
            isDark ? 'text-gray-300' : 'text-[#1F2937]'
          }`}>
            {process.description}
          </p>

          {/* Timeframe */}
          <div className="flex items-center gap-2 mb-4">
            <Clock className={`w-4 h-4 ${
              isDark ? 'text-teal-400' : 'text-teal-500'
            }`} />
            <span className={`text-sm font-medium ${
              isDark ? 'text-teal-400' : 'text-teal-600'
            }`}>{process.timeframe}</span>
          </div>

          {/* CTA */}
          <button
            onClick={() => {
              // Scroll to demo video section
              const demoSection = document.getElementById('demo-video');
              if (demoSection) {
                demoSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className={`w-full py-2 px-4 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center justify-center gap-2 group hover:shadow-lg ${
              isDark
                ? 'bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 hover:shadow-blue-500/25'
                : 'bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 hover:shadow-teal-500/25'
            }`}
          >
            Watch Demo
            <Play className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
      
      <div className={`absolute inset-0 h-full w-full opacity-0 group-hover/product:opacity-10 pointer-events-none rounded-xl ${
        isDark
          ? 'bg-gradient-to-br from-blue-500 to-teal-500'
          : 'bg-gradient-to-br from-teal-500 to-blue-500'
      }`}></div>
    </motion.div>
  );
};

// Mobile Process Slider Component
const MobileProcessSlider = ({
  processSteps,
  onCardClick,
  isDark
}: {
  processSteps: Array<{
    step: string;
    title: string;
    subtitle: string;
    description: string;
    timeframe: string;
    thumbnail: string;
    gradient: string;
  }>;
  onCardClick: (process: any) => void;
  isDark: boolean;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextCard = () => {
    setCurrentIndex((prev) => (prev + 1) % processSteps.length);
  };

  const prevCard = () => {
    setCurrentIndex((prev) => (prev - 1 + processSteps.length) % processSteps.length);
  };

  const goToCard = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="relative w-full">
      {/* Card Display */}
      <div className="flex justify-center mb-6">
        <div className="w-[320px]">
          <ProcessCard
            process={processSteps[currentIndex]}
            translate={useMotionValue(0)}
            onClick={() => onCardClick(processSteps[currentIndex])}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        <button
          onClick={prevCard}
          className={`p-2 rounded-full transition-colors ${
            isDark
              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              : 'bg-teal-500/20 text-teal-600 hover:bg-teal-500/30'
          }`}
          aria-label="Previous card"
        >
          <ChevronLeft size={20} />
        </button>

        <span className={`text-sm font-medium ${
          isDark ? 'text-gray-300' : 'text-[#1F2937]'
        }`}>
          {currentIndex + 1} of {processSteps.length}
        </span>

        <button
          onClick={nextCard}
          className={`p-2 rounded-full transition-colors ${
            isDark
              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              : 'bg-teal-500/20 text-teal-600 hover:bg-teal-500/30'
          }`}
          aria-label="Next card"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Dot Indicators */}
      <div className="flex justify-center space-x-2">
        {processSteps.map((_, index) => (
          <button
            key={index}
            onClick={() => goToCard(index)}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentIndex
                ? (isDark ? 'bg-blue-400' : 'bg-teal-500')
                : (isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-400 hover:bg-gray-500')
            }`}
            aria-label={`Go to card ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

const ProcessParallax = () => {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<typeof processSteps[0] | null>(null);

  // Reorganize for better visibility: 3 tiles per row
  const firstRow = processSteps.slice(0, 3);   // Steps 01, 02, 03
  const secondRow = processSteps.slice(3, 6);  // Steps 04, 05, 06
  const thirdRow = processSteps.slice(6, 9);   // Steps 07, 08, 09
  const fourthRow = processSteps.slice(9, 11); // Steps 10, 11
  const ref = React.useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const springConfig = { stiffness: 300, damping: 30, bounce: 100 };

  // Match BusinessValueParallax animation flow - smooth and fast movement
  // Using same range [0, 1] and larger offset for dramatic effect like the section you love
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
    useTransform(scrollYProgress, [0, 0.2], [-500, 300]),
    springConfig
  );
  const scale = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [0.9, 1]),
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
      <section className="py-20 px-4 relative overflow-hidden bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-4 animate-pulse"></div>
            <div className="h-6 bg-gray-200 rounded w-96 mx-auto animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(11)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="h-32 bg-gray-200 rounded-lg mb-4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
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
      className={`h-[300vh] py-40 overflow-hidden antialiased relative flex flex-col self-auto [perspective:1500px] [transform-style:preserve-3d] ${
        isDark
          ? 'bg-[#0A0A0B]'
          : 'bg-gradient-to-b from-[#F8FAFC] to-[#F2F9F9]/57'
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
              ? 'border-green-400/30 text-green-200 bg-green-900/10'
              : 'border-green-500/30 text-green-700 bg-green-50/50'
          }`}>
            <CheckCircle className={`w-4 h-4 mr-3 ${
              isDark ? 'text-green-400' : 'text-green-500'
            }`} />
            Agency Scaling Solution
          </div>

          <h1 className={`text-4xl md:text-7xl font-bold mb-8 tracking-tight leading-tight ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Stop Losing Clients &
            <span className={`text-transparent bg-clip-text block mt-3 ${
              isDark
                ? 'bg-gradient-to-r from-green-400 via-teal-400 to-blue-400'
                : 'bg-gradient-to-r from-green-500 via-teal-500 to-blue-500'
            }`}>
              Scale Your Agency
            </span>
          </h1>

          <p className={`max-w-3xl text-xl md:text-2xl mt-8 mx-auto leading-relaxed ${
            isDark ? 'text-blue-100/80' : 'text-gray-700'
          }`}>
            11 steps to transform your agency into a Voice AI powerhouse that clients can't leave.
            Perfect for GHL & N8N agencies ready to scale.
          </p>

          {/* Quick Stats */}
          <div className="flex flex-wrap justify-center items-center gap-8 mt-12">
            <div className={`flex items-center gap-2 ${
              isDark ? 'text-green-400' : 'text-green-600'
            }`}>
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Client Lock-In Technology</span>
            </div>
            <div className={`flex items-center gap-2 ${
              isDark ? 'text-teal-400' : 'text-teal-600'
            }`}>
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">GHL & N8N Integration</span>
            </div>
            <div className={`flex items-center gap-2 ${
              isDark ? 'text-blue-400' : 'text-blue-600'
            }`}>
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Multi-Provider Comparison</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Parallax Cards */}
      <motion.div
        style={{
          rotateX,
          rotateZ,
          translateY,
          opacity,
          scale,
        }}
        className="max-w-7xl mx-auto px-4"
      >
        {/* Desktop: Multiple cards with parallax, Mobile: Single card slider */}
        <div className="hidden md:block">
        {/* First Row - Steps 01-03 with left-to-right animation */}
        <motion.div className="flex flex-row justify-center space-x-20 mb-20">
          {firstRow.map((process) => (
            <ProcessCard
              process={process}
              translate={translateX}
              key={process.step}
              onClick={() => setSelectedProcess(process)}
              isDark={isDark}
            />
          ))}
        </motion.div>

        {/* Second Row - Steps 04-06 with reverse animation for visual variety */}
        <motion.div className="flex flex-row justify-center space-x-20 mb-20">
          {secondRow.map((process) => (
            <ProcessCard
              process={process}
              translate={translateXReverse}
              key={process.step}
              onClick={() => setSelectedProcess(process)}
              isDark={isDark}
            />
          ))}
        </motion.div>

        {/* Third Row - Steps 07-09 with left-to-right animation */}
        <motion.div className="flex flex-row justify-center space-x-20 mb-20">
          {thirdRow.map((process) => (
            <ProcessCard
              process={process}
              translate={translateX}
              key={process.step}
              onClick={() => setSelectedProcess(process)}
              isDark={isDark}
            />
          ))}
        </motion.div>

        {/* Fourth Row - Steps 10-11 with reverse animation */}
        <motion.div className="flex flex-row justify-center space-x-20">
          {fourthRow.map((process) => (
            <ProcessCard
              process={process}
              translate={translateXReverse}
              key={process.step}
              onClick={() => setSelectedProcess(process)}
              isDark={isDark}
            />
          ))}
        </motion.div>
        </div>

        {/* Mobile: Single card slider */}
        <div className="md:hidden">
          <MobileProcessSlider
            processSteps={processSteps}
            onCardClick={setSelectedProcess}
            isDark={isDark}
          />
        </div>
      </motion.div>

      {/* Modal for detailed view */}
      <AnimatePresence>
        {selectedProcess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedProcess(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border ${
                isDark
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-blue-400/20'
                  : 'bg-gradient-to-br from-white to-gray-50 border-teal-400/20'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedProcess(null)}
                className={`absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 ${
                  isDark
                    ? 'bg-gray-700/50 hover:bg-gray-600/50 text-white'
                    : 'bg-gray-200/50 hover:bg-gray-300/50 text-gray-800'
                }`}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8">
                {/* Step number badge */}
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-16 h-16 bg-gradient-to-br ${selectedProcess.gradient} rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                    {selectedProcess.step}
                  </div>
                  <div>
                    <h2 className={`text-3xl font-bold ${
                      isDark ? 'text-white' : 'text-gray-800'
                    }`}>
                      {selectedProcess.title}
                    </h2>
                    <p className={`text-lg font-medium bg-gradient-to-r ${selectedProcess.gradient} bg-clip-text text-transparent`}>
                      {selectedProcess.subtitle}
                    </p>
                  </div>
                </div>

                {/*
                  TODO: Replace with actual step-by-step demo video
                  File path: {selectedProcess.thumbnail}
                  This should be a detailed walkthrough of this specific step
                */}
                <div className={`w-full h-80 rounded-xl mb-8 flex items-center justify-center relative overflow-hidden ${
                  isDark
                    ? 'bg-gradient-to-br from-gray-700 to-gray-800'
                    : 'bg-gradient-to-br from-gray-200 to-gray-300'
                }`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${selectedProcess.gradient} opacity-30`} />
                  <div className={`relative text-center z-10 p-8 ${
                    isDark ? 'text-white' : 'text-gray-800'
                  }`}>
                    <div className={`w-32 h-32 bg-gradient-to-br ${selectedProcess.gradient} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl`}>
                      <span className="text-4xl font-bold text-white">{selectedProcess.step}</span>
                    </div>
                    <h3 className="text-3xl font-bold mb-4">{selectedProcess.title}</h3>
                    <p className={`text-xl max-w-2xl mx-auto leading-relaxed ${
                      isDark ? 'text-white/90' : 'text-gray-700'
                    }`}>{selectedProcess.subtitle}</p>
                    <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-medium ${
                      isDark
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-green-100/80 text-green-700'
                    }`}>
                      <Clock className="w-5 h-5" />
                      {selectedProcess.timeframe}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <p className={`text-lg leading-relaxed mb-8 ${
                      isDark ? 'text-gray-300' : 'text-[#1F2937]'
                    }`}>
                      {selectedProcess.description}
                    </p>

                    {/* Timeframe */}
                    <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${
                      isDark ? 'bg-gray-700/30' : 'bg-gray-100/50'
                    }`}>
                      <Clock className={`w-6 h-6 ${
                        isDark ? 'text-teal-400' : 'text-teal-500'
                      }`} />
                      <div>
                        <div className={`font-semibold ${
                          isDark ? 'text-white' : 'text-gray-800'
                        }`}>Time Required</div>
                        <div className={`text-lg font-bold ${
                          isDark ? 'text-teal-400' : 'text-teal-600'
                        }`}>{selectedProcess.timeframe}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-xl font-bold mb-6 ${
                      isDark ? 'text-white' : 'text-gray-800'
                    }`}>What You'll Accomplish</h3>
                    <div className="space-y-4 mb-8">
                      <div className={`flex items-start gap-3 p-4 rounded-lg ${
                        isDark ? 'bg-gray-700/30' : 'bg-gray-100/50'
                      }`}>
                        <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          isDark ? 'text-green-400' : 'text-green-500'
                        }`} />
                        <span className={`${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>Complete step {selectedProcess.step} setup</span>
                      </div>
                      <div className={`flex items-start gap-3 p-4 rounded-lg ${
                        isDark ? 'bg-gray-700/30' : 'bg-gray-100/50'
                      }`}>
                        <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          isDark ? 'text-green-400' : 'text-green-500'
                        }`} />
                        <span className={`${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>Move closer to launch</span>
                      </div>
                      <div className={`flex items-start gap-3 p-4 rounded-lg ${
                        isDark ? 'bg-gray-700/30' : 'bg-gray-100/50'
                      }`}>
                        <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          isDark ? 'text-green-400' : 'text-green-500'
                        }`} />
                        <span className={`${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>Build your Voice AI empire</span>
                      </div>
                    </div>

                    {/* CTA buttons */}
                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          // Close modal and scroll to get started button
                          setSelectedProcess(null);
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
                        Start This Step
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                      </button>
                      <button
                        onClick={() => setSelectedProcess(null)}
                        className={`px-6 py-3 rounded-lg transition-colors duration-200 ${
                          isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
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

export default ProcessParallax;
