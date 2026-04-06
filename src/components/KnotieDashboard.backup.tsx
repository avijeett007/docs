import React, { useState, useEffect } from 'react';
import { Mic, Loader2, Menu, X, BookOpen, ArrowRight, Mail, Send, User, Check, Link2 } from 'lucide-react';
import { FaGithub, FaYoutube, FaTwitter, FaDiscord } from 'react-icons/fa';

import PricingSection from './PricingSection';
import Footer from './Footer';
import LimitedOfferPopup from './LimitedOfferPopup';
import SimplifiedSignupModal from './SimplifiedSignupModal';
import { isOfferExpired } from '../utils/offerUtils';
import heroConfig from '../config/dashboard/hero.json';
import navigation from '../config/dashboard/navigation.json';
import Logo from './Logo';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

import ReviewsSection from './landing/ReviewsSection';
import PainPointsSection from './landing/PainPointsSection';
import dynamic from 'next/dynamic';

// Lazy load heavy parallax components for better performance
const BusinessValueParallax = dynamic(() => import('./landing/BusinessValueParallax'), {
  loading: () => (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white">Loading Business Values...</p>
      </div>
    </div>
  ),
  ssr: false // Disable SSR for better performance
});

const ProcessParallax = dynamic(() => import('./landing/ProcessParallax'), {
  loading: () => (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white">Loading Process Steps...</p>
      </div>
    </div>
  ),
  ssr: false // Disable SSR for better performance
});
import { AnimatedHero } from './ui/animated-hero';
import { HeroMemberCounter } from './ui/animated-counter';
import { LiveMemberNotifications } from './ui/member-join-notifications';
import { ClientOnly } from './ui/client-only';
import { LiveStatsProvider } from '../context/LiveStatsContext';
import { motion } from 'framer-motion';
import { SimpleThemeToggle } from './ui/SimpleThemeToggle';

interface KnotieDashboardProps {
  onStartCall: () => void;
  isProcessing?: boolean;
  isConnected?: boolean;
}

const KnotieDashboard = ({ onStartCall, isProcessing = false, isConnected = false }: KnotieDashboardProps) => {
  const [isActive, setIsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [animationPosition, setAnimationPosition] = useState({ x: 0, y: 0 });
  const [focusIntensity, setFocusIntensity] = useState(1);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const router = useRouter();
  // const searchParams = useSearchParams(); // TODO: Implement search params handling



  // Limited offer popup state
  const [showLimitedOfferPopup, setShowLimitedOfferPopup] = useState(false);

  // Simplified signup modal state
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Newsletter signup state (actually waitlist functionality)
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [newsletterFormData, setNewsletterFormData] = useState({ name: '', email: '', referralCode: '' });
  const [isNewsletterSubmitting, setIsNewsletterSubmitting] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [newsletterAlreadyRegistered, setNewsletterAlreadyRegistered] = useState(false);
  const [newsletterSuccessData, setNewsletterSuccessData] = useState<{
    position: number;
    referralCode: string;
  } | null>(null);



  // Show limited offer popup randomly after a few seconds
  // IMPORTANT: This popup will automatically stop showing after June 7, 2025 23:59:59
  // No manual intervention needed - the isOfferExpired() check prevents it from appearing
  useEffect(() => {
    // Check if popup has been shown before in this session
    const hasShownPopup = sessionStorage.getItem('limitedOfferPopupShown');

    // Only show popup if offer hasn't expired and hasn't been shown this session
    if (!isOfferExpired() && !hasShownPopup) {
      // Random delay between 5-15 seconds
      const randomDelay = Math.random() * 10000 + 5000;

      const timer = setTimeout(() => {
        setShowLimitedOfferPopup(true);
        sessionStorage.setItem('limitedOfferPopupShown', 'true');
      }, randomDelay);

      return () => clearTimeout(timer);
    }
  }, []);

  // Enhanced background animation effect
  useEffect(() => {
    const positionInterval = setInterval(() => {
      setAnimationPosition({
        x: Math.random() * 100 - 50,
        y: Math.random() * 100 - 50,
      });
    }, 3000);

    const intensityInterval = setInterval(() => {
      setFocusIntensity(prev => prev === 1 ? 1.2 : 1);
    }, 2000);

    return () => {
      clearInterval(positionInterval);
      clearInterval(intensityInterval);
    };
  }, []);

  // Update isActive and isRecording based on connection state
  useEffect(() => {
    if (isConnected) {
      console.log('✅ KnotieDashboard: Connection active, updating UI state...');
      setIsActive(true);
      setIsRecording(true);
    }
  }, [isConnected]);

  // Reset states only when explicitly disconnected
  useEffect(() => {
    if (!isProcessing && !isConnected) {
      console.log('🔄 KnotieDashboard: Connection ended, resetting UI state...');
      setIsActive(false);
      setIsRecording(false);
    }
  }, [isProcessing, isConnected]);

  // Function to handle call disconnect
  const handleDisconnect = async () => {
    try {
      console.log('🔴 KnotieDashboard: Stopping media tracks...');

      // Stop audio tracks
      console.log('🎤 KnotieDashboard: Stopping audio tracks...');
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.getTracks().forEach(track => {
        console.log(`🔇 KnotieDashboard: Stopping audio track`);
        track.stop();
        track.enabled = false;
      });

      // Trigger room disconnect
      if (isConnected) {
        console.log('🏃‍♂️ KnotieDashboard: Triggering room disconnect...');
        onStartCall(); // This will toggle the connection state
      }
    } catch (error) {
      console.error('❌ KnotieDashboard: Error during disconnect:', error);
    }
  };

  const handleMicClick = async () => {
    if (isProcessing) {
      console.log('⚠️ KnotieDashboard: Processing in progress, ignoring click');
      return;
    }

    if (isConnected) {
      console.log('🔴 KnotieDashboard: Currently connected, initiating disconnect...');
      await handleDisconnect();
    } else {
      console.log('🟢 KnotieDashboard: Not connected, initiating connection...');
      try {
        // Request audio permission
        console.log('🎤 KnotieDashboard: Requesting audio permission...');
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getTracks().forEach(track => track.stop());
        console.log('✅ KnotieDashboard: Audio permission granted');

        setHasPermissions(true);
        setPermissionError(null);

        console.log('🎤 KnotieDashboard: Starting call...');
        onStartCall();
      } catch (error: any) {
        console.error('❌ KnotieDashboard: Audio permission error:', error);
        setPermissionError(error.message);
        return;
      }
    }
  };

  // Get the current status message from config
  const getStatusMessage = () => {
    if (isProcessing) return heroConfig.statusMessages.processing;
    if (isRecording) return heroConfig.statusMessages.listening;
    return heroConfig.statusMessages.ready;
  };

  const handleNavigation = (to: string, isAnchor: boolean) => {
    if (isAnchor) {
      const element = document.querySelector(to);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.location.href = to;
    }
  };

  // Function to render social icons
  const renderSocialIcons = () => {
    const iconComponents = {
      FaGithub,
      FaYoutube,
      FaTwitter,
      FaDiscord
    };

    return navigation.social.map((item, index) => {
      const IconComponent = iconComponents[item.icon as keyof typeof iconComponents];
      return (
        <a
          key={index}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-gray-400 hover:text-${item.hoverColor} transition-colors duration-200`}
        >
          <IconComponent size={20} />
        </a>
      );
    });
  };

  // Handle newsletter form submission (actually waitlist)
  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newsletterFormData.name || !newsletterFormData.email) {
      toast.error('Please provide both your name and email');
      return;
    }

    try {
      setIsNewsletterSubmitting(true);

      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newsletterFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Something went wrong');
      }

      // Get position and referral code from response
      const data = await response.json();
      setNewsletterSuccessData({
        position: data.position,
        referralCode: data.referralCode
      });

      setNewsletterSuccess(true);
      toast.success('Thank you for subscribing to our newsletter!');

    } catch (error) {
      console.error('Error subscribing to newsletter:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe. Please try again.';

      // Check if it's an "already registered" error
      if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('waitlist')) {
        setNewsletterAlreadyRegistered(true);
        toast.success('You\'re already on our waitlist! Thanks for your continued interest.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsNewsletterSubmitting(false);
    }
  };

  // Handle copy referral link to clipboard
  const handleCopyNewsletterReferralLink = () => {
    if (newsletterSuccessData?.referralCode) {
      const referralLink = `https://knotie-ai.pro/waitlist?ref=${newsletterSuccessData.referralCode}`;
      navigator.clipboard.writeText(referralLink)
        .then(() => toast.success('Referral link copied to clipboard!'))
        .catch(() => toast.error('Failed to copy. Please try again.'));
    }
  };

  return (
    <LiveStatsProvider baseCount={137}>
      <div id="knotie-dashboard" className="relative min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black overflow-hidden flex flex-col transition-colors duration-500">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/20 dark:border-blue-400/20 transition-colors duration-500">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Logo />

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center justify-center flex-1 space-x-8">
              {navigation.navigation.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleNavigation(item.to, item.isAnchor)}
                  className="text-gray-300 hover:text-white transition-colors duration-200"
                >
                  {item.text}
                </button>
              ))}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-4">
                <SimpleThemeToggle size="sm" />
                {renderSocialIcons()}
                <Link
                  href="/docs"
                  className="px-4 py-2 rounded-lg border border-blue-400/30 text-blue-200 hover:border-blue-400/50 hover:text-white transition-all duration-300 flex items-center gap-2"
                >
                  <BookOpen size={16} />
                  API Docs
                </Link>
                <Link
                  href="/partner/login"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:from-blue-600 hover:to-teal-600 transition-all duration-300"
                >
                  Partner Login
                </Link>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden text-gray-300 hover:text-white"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4">
              <div className="flex flex-col space-y-4">
                {navigation.navigation.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      handleNavigation(item.to, item.isAnchor);
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-gray-300 hover:text-white transition-colors duration-200"
                  >
                    {item.text}
                  </button>
                ))}
                <Link
                  href="/docs"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full px-3 py-2 rounded-md text-base font-medium border border-blue-400/30 text-blue-200 hover:border-blue-400/50 hover:text-white transition-all duration-300 text-center"
                >
                  API Documentation
                </Link>
                <button
                  onClick={() => {
                    router.push('/partners');
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 rounded-md text-base font-medium bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:from-blue-600 hover:to-teal-600"
                >
                  Partner Portal
                </button>
                <div className="flex items-center gap-4 pt-4 border-t border-gray-700">
                  <SimpleThemeToggle size="sm" />
                  {renderSocialIcons()}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Development Status Banner */}
      <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm sm:text-base border-b border-blue-400/20 relative z-[9999]">
        🚧 Knotie-AI Pro is under active development. Join our exclusive waitlist for early access and special offers! 🚀
      </div>

      {/* Enhanced background animation effect */}
      <div className="absolute inset-0">
        <div
          className={`
            absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
            w-[1200px] h-[1200px]
            bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,rgba(147,51,234,0.1)_25%,rgba(20,184,166,0.1)_50%,transparent_100%)]
            rounded-full blur-[130px]
            transition-all duration-1500 ease-in-out
            ${isActive ? 'opacity-90 scale-110' : 'opacity-60'}
          `}
          style={{
            transform: `translate(calc(-50% + ${animationPosition.x}px), calc(-50% + ${animationPosition.y}px)) scale(${focusIntensity})`,
          }}
        />

        {/* Additional ambient light */}
        <div
          className="absolute top-0 left-0 w-full h-full opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.1) 0%, transparent 50%)',
            animation: 'pulse 8s infinite'
          }}
        />
      </div>

      {/* Enhanced floating particles effect */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(40)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-gradient-to-br from-blue-400 to-teal-400 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${20 + Math.random() * 15}s`,
              opacity: 0.3 + Math.random() * 0.7,
              transform: `scale(${0.5 + Math.random()})`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <div className="container mx-auto px-4 pt-24 pb-36">
          <div className="max-w-4xl mx-auto text-center">
            <div
              className="inline-flex items-center rounded-full border border-blue-400/30 px-6 py-2.5 text-sm text-blue-200
                         backdrop-blur-md bg-blue-900/10 mb-10 group hover:border-blue-400/50 transition-all duration-300"
            >
              <span className="flex h-2 w-2 rounded-full bg-teal-400 mr-3 group-hover:animate-ping"></span>
              {getStatusMessage()}
            </div>

            <AnimatedHero
              staticText={heroConfig.hero.title}
              animatedTexts={heroConfig.hero.animatedTexts}
              className="mb-8"
            />

            <p className="text-xl md:text-2xl text-blue-100/80 mb-8 max-w-2xl mx-auto leading-relaxed
                         font-light tracking-wide">
              Join <ClientOnly fallback={<span className="text-transparent bg-gradient-to-r from-teal-400 via-blue-400 to-purple-400 bg-clip-text font-bold mx-1">137+</span>}>
                <HeroMemberCounter className="mx-1" />
              </ClientOnly> Agencies Who Struggled to Scale Voice AI - Until Now. Get Multi-Provider Cost Comparison, Complete White-Label Platform & Client Lock-In Technology That Prevents Clients From Churning Away.
            </p>

            {/* Retell AI Partnership Badge */}
            <div className="flex items-center justify-center mb-14">
              <a
                href="https://www.retellai.com/app-partner/knotie-ai-pro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10
                         border border-blue-400/30 backdrop-blur-md hover:border-blue-400/50 transition-all duration-300
                         hover:scale-105 group"
              >
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">R</span>
                </div>
                <div className="text-left">
                  <div className="text-blue-200 font-semibold text-sm">Official Retell AI</div>
                  <div className="text-blue-300/80 text-xs">App Partner</div>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform duration-300" />
              </a>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-20">
              <button
                data-action="get-started"
                onClick={() => {
                  console.log('🎯 Get Started button clicked - opening modal');
                  setShowSignupModal(true);
                }}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold text-lg
                        hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105
                        relative overflow-hidden group shadow-xl shadow-blue-500/20"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-teal-600 opacity-0
                               group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative flex items-center justify-center gap-2">
                  Get Started Now
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
              </button>

              <button
                onClick={() => {
                  // Scroll to demo video section (we'll add this later)
                  const demoSection = document.getElementById('demo-video');
                  if (demoSection) {
                    demoSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="px-8 py-4 rounded-xl border-2 border-purple-400/50 text-purple-200 font-semibold text-lg
                        hover:border-purple-400 hover:text-white hover:bg-purple-400/10 transition-all duration-300
                        transform hover:scale-105 relative overflow-hidden group"
              >
                <span className="relative flex items-center justify-center gap-2">
                  <span className="text-2xl mr-2">🎬</span>
                  Click here for a Demo
                </span>
              </button>
            </div>

            {/* Enhanced Interactive Microphone */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative">
                {permissionError && (
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                    {permissionError}
                    <button
                      onClick={() => setPermissionError(null)}
                      className="ml-2 text-white hover:text-gray-200"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <button
                  onClick={handleMicClick}
                  disabled={isProcessing}
                  className={`
                    relative group
                    w-48 h-48 md:w-52 md:h-52 rounded-full
                    bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-teal-500/10
                    backdrop-blur-lg
                    border-2 border-blue-400/20
                    transition-all duration-700
                    hover:border-blue-400/40
                    hover:scale-105
                    disabled:opacity-75
                    disabled:hover:scale-100
                    ${isActive ? 'scale-95' : 'scale-100'}
                    ${isRecording ? 'border-red-400/50 shadow-lg shadow-red-500/20' : ''}
                  `}
                >
                  {/* Enhanced Ripple Effects */}
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={`
                        absolute inset-0 rounded-full
                        border-2 border-blue-400/20
                        transition-all duration-1000
                        group-hover:scale-[${1.1 + i * 0.15}] group-hover:opacity-0
                        animate-ripple
                      `}
                      style={{
                        animationDelay: `${i * 600}ms`,
                      }}
                    />
                  ))}

                  {/* Active Ring */}
                  {(isRecording || isProcessing) && (
                    <div className="absolute inset-0 rounded-full border-2 border-red-400/50 animate-ping" />
                  )}

                  {/* Microphone/Loading Icon */}
                  {isProcessing ? (
                    <Loader2
                      className="w-14 h-14 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                                animate-spin text-teal-400"
                    />
                  ) : isRecording ? (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="flex space-x-3">
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="w-2.5 h-10 bg-gradient-to-t from-red-400 to-blue-400 rounded-full animate-pulse"
                            style={{ animationDelay: `${i * 200}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Mic
                      className={`
                        w-14 h-14 absolute
                        top-1/2 left-1/2
                        transform -translate-x-1/2 -translate-y-1/2
                        transition-all duration-500
                        ${isActive ? 'text-red-400 scale-110' : 'text-blue-200'}
                        group-hover:scale-110 group-hover:text-blue-100
                        stroke-[1.5]
                      `}
                    />
                  )}

                  {/* Status Label */}
                  <div className={`
                    absolute -bottom-10 left-1/2 transform -translate-x-1/2
                    whitespace-nowrap text-sm font-medium
                    px-4 py-1.5 rounded-full
                    transition-all duration-300
                    ${isRecording
                      ? 'bg-red-500/20 text-red-200 border border-red-400/30'
                      : 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                    }
                  `}>
                    {isRecording ? 'Click to End Call' : 'Hi, I\'m Knotie. Tap me to Talk!'}
                  </div>
                </button>
              </div>

              {permissionError && (
                <p className="text-red-400 mt-4 text-center max-w-xs">
                  {permissionError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* New Landing Page Sections */}

        {/* Reviews Section */}
        <ReviewsSection />

        {/* Pain Points Section */}
        <PainPointsSection />

        {/* Business Value Parallax Section */}
        <BusinessValueParallax />

        {/* Process Parallax Section */}
        <ProcessParallax />

        {/* Rest of the sections with different background */}
        <div className="container mx-auto px-4 pb-20">

          {/* Demo Video Section */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            id="demo-video"
            className="text-center mt-20 mb-20"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="inline-flex items-center rounded-full border border-purple-400/30 px-6 py-2.5 text-sm text-purple-200 backdrop-blur-md bg-purple-900/10 mb-8"
            >
              <span className="text-2xl mr-3">🎬</span>
              20-Minute Platform Deep Dive
            </motion.div>
            <div className="max-w-4xl mx-auto">
              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                viewport={{ once: true }}
                className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight"
              >
                See How Easy It Is to
                <span className="text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text block mt-3">
                  Build Your Voice AI Empire
                </span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                viewport={{ once: true }}
                className="text-xl text-blue-100/80 mb-12 max-w-3xl mx-auto leading-relaxed"
              >
                This comprehensive 20-minute platform overview shows our key features at a high level.
                <br />
                <span className="text-purple-300 font-medium">
                  Even in 20 minutes, we've only scratched the surface of what's possible.
                </span>
              </motion.p>

              {/* YouTube Video */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                viewport={{ once: true }}
                className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 border border-purple-400/20 mb-8"
              >
                <div className="aspect-video rounded-xl overflow-hidden">
                  <iframe
                    src={`https://www.youtube.com/embed/${process.env.NEXT_PUBLIC_DEMO_VIDEO_ID || '1wgE_3YCCGY'}`}
                    title="Knotie AI Platform - 20 Minute Deep Dive Demo"
                    style={{ border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full"
                  ></iframe>
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                viewport={{ once: true }}
                onClick={() => setShowSignupModal(true)}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 relative overflow-hidden group shadow-xl shadow-purple-500/20"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative flex items-center justify-center gap-2">
                  Start Building Your Agency Now
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
              </motion.button>
            </div>
          </motion.div>

          {/* Final CTA Section - Don't Miss This Gold Rush */}
          <div className="text-center mt-20 mb-20">
            <div className="inline-flex items-center rounded-full border border-yellow-400/30 px-6 py-2.5 text-sm text-yellow-200 backdrop-blur-md bg-yellow-900/10 mb-8">
              <span className="text-2xl mr-3">⚡</span>
              Limited Time Opportunity
            </div>
            <div className="max-w-4xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight leading-tight">
                Don't Miss This
                <span className="text-transparent bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text block mt-3">
                  AI Gold Rush
                </span>
              </h2>
              <p className="text-xl md:text-2xl text-blue-100/80 mb-8 max-w-3xl mx-auto leading-relaxed">
                If You Are Reading This, You Know That You Are In The Forefront Of It.
                <span className="text-yellow-400 font-semibold block mt-2">So, Don't Miss It.</span>
              </p>

              {/* Urgency Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 p-6 rounded-xl border border-yellow-500/20">
                  <div className="text-3xl font-bold text-yellow-400 mb-2">73%</div>
                  <div className="text-white font-semibold mb-1">Of Agencies</div>
                  <div className="text-yellow-200/70 text-sm">Already Moving to Voice AI</div>
                </div>
                <div className="bg-gradient-to-br from-pink-900/20 to-red-900/20 p-6 rounded-xl border border-orange-500/20">
                  <div className="text-3xl font-bold text-blue-400 mb-2">$1.3M+</div>
                  <div className="text-white font-semibold mb-1">Revenue Generated</div>
                  <div className="text-blue-200/70 text-sm">By Our Partner Agencies</div>
                </div>
                <div className="bg-gradient-to-br from-red-900/20 to-pink-900/20 p-6 rounded-xl border border-red-500/20">
                  <div className="text-3xl font-bold text-red-400 mb-2">20 Min</div>
                  <div className="text-white font-semibold mb-1">Setup Time</div>
                  <div className="text-red-200/70 text-sm">From Zero to First Client</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <button
                  onClick={() => setShowSignupModal(true)}
                  className="px-10 py-5 rounded-xl bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white font-bold text-xl hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 transition-all duration-300 transform hover:scale-105 relative overflow-hidden group shadow-2xl shadow-orange-500/30"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center justify-center gap-3">
                    🚀 Claim Your Spot in the AI Gold Rush
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </button>
              </div>

              <p className="text-gray-400 mt-6 text-sm">
                Join <ClientOnly fallback={<span className="text-teal-400 font-bold">137+</span>}>
                  <HeroMemberCounter className="text-teal-400" />
                </ClientOnly> agencies already building their Voice AI empire • Setup in under 20 minutes
              </p>
            </div>
          </div>
        </div>

          {/* Pricing Section */}
          <div id="pricing" className="text-center mt-16">
            <div className="inline-flex items-center rounded-full border border-blue-400/30 px-4 py-2 text-sm text-blue-200 backdrop-blur-sm mb-4">
              <span className="flex h-2 w-2 rounded-full bg-teal-400 mr-2"></span>
              Transparent Pricing
            </div>
            <PricingSection />
          </div>

          {/* Newsletter Signup Section */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mt-20 mb-20"
          >
            <div className="inline-flex items-center rounded-full border border-green-400/30 px-6 py-2.5 text-sm text-green-200 backdrop-blur-md bg-green-900/10 mb-8">
              <span className="text-2xl mr-3">📧</span>
              Still Deciding? Stay In The Loop
            </div>
            <div className="max-w-4xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight leading-tight">
                Get Insider Access to
                <span className="text-transparent bg-gradient-to-r from-green-400 via-teal-400 to-blue-400 bg-clip-text block mt-3">
                  Voice AI Secrets
                </span>
              </h2>
              <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                Join our exclusive newsletter and get the latest platform updates, insider tips, and proven strategies to
                <span className="text-green-400 font-semibold"> sell Voice AI services like a pro</span>.
              </p>

              {/* Benefits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-br from-green-900/20 to-teal-900/20 p-6 rounded-xl border border-green-500/20"
                >
                  <div className="text-3xl mb-3">🚀</div>
                  <h3 className="text-lg font-bold text-white mb-2">Platform Updates</h3>
                  <p className="text-gray-400 text-sm">Be the first to know about new features, integrations, and improvements</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-br from-teal-900/20 to-blue-900/20 p-6 rounded-xl border border-teal-500/20"
                >
                  <div className="text-3xl mb-3">💡</div>
                  <h3 className="text-lg font-bold text-white mb-2">Sales Strategies</h3>
                  <p className="text-gray-400 text-sm">Proven tactics and scripts to close more Voice AI deals</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 p-6 rounded-xl border border-blue-500/20"
                >
                  <div className="text-3xl mb-3">🎯</div>
                  <h3 className="text-lg font-bold text-white mb-2">Industry Insights</h3>
                  <p className="text-gray-400 text-sm">Market trends, case studies, and success stories from our community</p>
                </motion.div>
              </div>

              <button
                onClick={() => setShowNewsletterModal(true)}
                className="px-10 py-5 rounded-xl bg-gradient-to-r from-green-500 via-teal-500 to-blue-500 text-white font-bold text-xl hover:from-green-600 hover:via-teal-600 hover:to-blue-600 transition-all duration-300 transform hover:scale-105 relative overflow-hidden group shadow-2xl shadow-green-500/30"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative flex items-center justify-center gap-3">
                  📧 Subscribe to Our Newsletter
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
              </button>

              <p className="text-gray-400 mt-6 text-sm">
                Join <ClientOnly fallback={<span className="text-teal-400 font-bold">137+</span>}>
                  <HeroMemberCounter className="text-teal-400" />
                </ClientOnly> agency owners getting weekly insights • Unsubscribe anytime • No spam, ever
              </p>
            </div>
          </motion.div>
        </div>
        <Footer />

        {/* Live Member Join Notifications */}
        <ClientOnly>
          <LiveMemberNotifications position="bottom-right" />
        </ClientOnly>

        {/* Limited Offer Popup */}
      <LimitedOfferPopup
        isVisible={showLimitedOfferPopup}
        onClose={() => setShowLimitedOfferPopup(false)}
        onGetOffer={() => {
          setShowLimitedOfferPopup(false);
          // Scroll to pricing section
          const pricingSection = document.getElementById('pricing');
          if (pricingSection) {
            pricingSection.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      {/* Simplified Signup Modal */}
      <SimplifiedSignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
      />

      {/* Newsletter Signup Modal */}
      {showNewsletterModal && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div
            className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-xl max-w-md w-full border border-green-500/30
                      shadow-xl shadow-green-500/10 animate-fadeIn"
          >
            {!newsletterSuccess && !newsletterAlreadyRegistered ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-white">Subscribe to Our Newsletter</h3>
                  <button
                    onClick={() => setShowNewsletterModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <p className="text-blue-200/80 mb-6">
                  Get exclusive access to <span className="text-green-400 font-semibold">platform updates</span>,
                  <span className="text-teal-400 font-semibold"> proven sales strategies</span>, and
                  <span className="text-blue-400 font-semibold"> insider tips</span> to sell Voice AI services like a pro.
                </p>

                <form onSubmit={handleNewsletterSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="newsletter-name" className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                    <div className="relative">
                      <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        id="newsletter-name"
                        value={newsletterFormData.name}
                        onChange={(e) => setNewsletterFormData({...newsletterFormData, name: e.target.value})}
                        className="w-full px-10 py-3 rounded-lg bg-gray-900/50 border border-green-500/30 text-white placeholder-gray-500
                                focus:outline-none focus:ring-2 focus:ring-green-500/50"
                        placeholder="Your name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="newsletter-email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        id="newsletter-email"
                        value={newsletterFormData.email}
                        onChange={(e) => setNewsletterFormData({...newsletterFormData, email: e.target.value})}
                        className="w-full px-10 py-3 rounded-lg bg-gray-900/50 border border-green-500/30 text-white placeholder-gray-500
                                focus:outline-none focus:ring-2 focus:ring-green-500/50"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isNewsletterSubmitting}
                    className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600
                            text-white rounded-lg font-medium transition-colors duration-300 flex items-center justify-center"
                  >
                    {isNewsletterSubmitting ? (
                      <Loader2 size={20} className="animate-spin mr-2" />
                    ) : (
                      <Send size={18} className="mr-2" />
                    )}
                    {isNewsletterSubmitting ? 'Subscribing...' : 'Subscribe to Newsletter'}
                  </button>
                </form>

                <p className="text-gray-400 text-xs mt-4 text-center">
                  Join <ClientOnly fallback={<span className="text-teal-400 font-bold">137+</span>}>
                    <HeroMemberCounter className="text-teal-400" />
                  </ClientOnly> agency owners • Weekly insights • Unsubscribe anytime • No spam, ever
                </p>
              </>
            ) : newsletterSuccess ? (
              <div className="animate-fadeIn text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check size={30} className="text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Welcome to the Community!</h3>
                <p className="text-blue-200/80 mb-6">
                  Thank you for subscribing! You're now part of our exclusive community of Voice AI professionals.
                  You are subscriber <span className="text-green-400 font-bold">#{newsletterSuccessData?.position}</span>.
                </p>

                {/* Referral section */}
                <div className="bg-gray-900/50 p-4 rounded-lg border border-green-500/20 mb-6">
                  <h4 className="text-lg font-semibold text-white mb-2">Spread the Word!</h4>
                  <p className="text-sm text-blue-200/80 mb-4">
                    Share our newsletter with other agency owners and help them stay ahead in the Voice AI revolution!
                  </p>

                  <div className="relative">
                    <input
                      type="text"
                      value={`https://knotie-ai.pro/waitlist?ref=${newsletterSuccessData?.referralCode}`}
                      className="w-full px-3 py-2 pr-12 text-xs bg-gray-800 border border-green-500/30 rounded-lg text-white"
                      readOnly
                    />
                    <button
                      onClick={handleCopyNewsletterReferralLink}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-green-400 hover:text-green-300"
                    >
                      <Link2 size={16} />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowNewsletterModal(false);
                    setNewsletterSuccess(false);
                    setNewsletterFormData({ name: '', email: '', referralCode: '' });
                  }}
                  className="py-2 px-6 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              // Already Registered State
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✅</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">You're Already on Our List!</h3>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Great news! You're already subscribed to our newsletter and on our exclusive waitlist.
                  We'll keep you updated with the latest platform updates, insider tips, and early access opportunities.
                </p>

                <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-blue-400">📧</span>
                    <span className="text-blue-200 font-medium">What's Next?</span>
                  </div>
                  <p className="text-blue-100/80 text-sm">
                    Keep an eye on your inbox for exclusive updates, early access invitations, and special offers just for our community members.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowNewsletterModal(false);
                    setNewsletterAlreadyRegistered(false);
                    setNewsletterFormData({ name: '', email: '', referralCode: '' });
                  }}
                  className="py-3 px-8 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-lg transition-colors font-medium"
                >
                  Got It, Thanks!
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </LiveStatsProvider>
  );
};

export default KnotieDashboard;
