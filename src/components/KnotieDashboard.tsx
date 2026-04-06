import React, { useState, useEffect } from 'react';
import { Loader2, Menu, X, BookOpen, ArrowRight, Mail, Send, User, Check, Link2 } from 'lucide-react';
import { FaGithub, FaYoutube, FaTwitter, FaDiscord } from 'react-icons/fa';


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

// Import components directly since they now have SSR-safe implementations
import ReviewsSection from './landing/ReviewsSection';
import SimplifiedPricingSection from './landing/SimplifiedPricingSection';
import PainPointsSection from './landing/PainPointsSection';
import BusinessValueParallax from './landing/BusinessValueParallax';
import ProcessParallax from './landing/ProcessParallax';
import { AllInOneCRMSection } from './landing/AllInOneCRMSection';
import { AnalyticsSection } from './landing/AnalyticsSection';
import { HeroMemberCounter } from './ui/animated-counter';
import { LiveMemberNotifications } from './ui/member-join-notifications';
import { ClientOnly } from './ui/client-only';
import { LiveStatsProvider } from '../context/LiveStatsContext';
import { motion } from 'framer-motion';
import { SimpleThemeToggle } from './ui/SimpleThemeToggle';
import { HeroSection } from './hero';
import { isFeatureEnabled } from '../config/featureFlags';

interface KnotieDashboardProps {
  onStartCall: () => void;
  isProcessing?: boolean;
  isConnected?: boolean;
}

const KnotieDashboard = ({ onStartCall, isProcessing = false, isConnected = false }: KnotieDashboardProps) => {
  const [isActive, setIsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const router = useRouter();
  // const searchParams = useSearchParams(); // TODO: Implement search params handling

  // Theme detection
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    // Initial check
    checkTheme();

    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);



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

  // AI Curve signup state (same functionality as newsletter)
  const [showAiCurveModal, setShowAiCurveModal] = useState(false);
  const [aiCurveFormData, setAiCurveFormData] = useState({ name: '', email: '', referralCode: '' });
  const [isAiCurveSubmitting, setIsAiCurveSubmitting] = useState(false);
  const [aiCurveSuccess, setAiCurveSuccess] = useState(false);
  const [aiCurveAlreadyRegistered, setAiCurveAlreadyRegistered] = useState(false);
  const [aiCurveSuccessData, setAiCurveSuccessData] = useState<{
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

  // Handle AI Curve form submission (same functionality as newsletter)
  const handleAiCurveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!aiCurveFormData.name || !aiCurveFormData.email) {
      toast.error('Please provide both your name and email');
      return;
    }

    try {
      setIsAiCurveSubmitting(true);

      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aiCurveFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Something went wrong');
      }

      // Get position and referral code from response
      const data = await response.json();
      setAiCurveSuccessData({
        position: data.position,
        referralCode: data.referralCode
      });

      setAiCurveSuccess(true);
      toast.success('Thank you for staying ahead of the AI curve!');

    } catch (error) {
      console.error('Error subscribing to AI curve updates:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe. Please try again.';

      // Check if it's an "already registered" error
      if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('waitlist')) {
        setAiCurveAlreadyRegistered(true);
        toast.success('You\'re already on our waitlist! Thanks for your continued interest.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsAiCurveSubmitting(false);
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

  // Handle copy AI Curve referral link to clipboard
  const handleCopyAiCurveReferralLink = () => {
    if (aiCurveSuccessData?.referralCode) {
      const referralLink = `https://knotie-ai.pro/waitlist?ref=${aiCurveSuccessData.referralCode}`;
      navigator.clipboard.writeText(referralLink)
        .then(() => toast.success('Referral link copied to clipboard!'))
        .catch(() => toast.error('Failed to copy. Please try again.'));
    }
  };

  return (
    <LiveStatsProvider baseCount={137}>
      <div id="knotie-dashboard" className="relative min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black overflow-hidden flex flex-col transition-colors duration-500">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/30 dark:border-blue-400/20 transition-colors duration-500">
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
                  className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 font-medium"
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
                  className="px-4 py-2 rounded-lg border border-blue-500/50 dark:border-blue-400/30 text-blue-600 dark:text-blue-200 hover:border-blue-600/70 dark:hover:border-blue-400/50 hover:text-blue-700 dark:hover:text-white transition-all duration-300 flex items-center gap-2"
                >
                  <BookOpen size={16} />
                  Docs
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
                className="md:hidden text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
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
                    className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 font-medium"
                  >
                    {item.text}
                  </button>
                ))}
                <Link
                  href="/docs"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full px-3 py-2 rounded-md text-base font-medium border border-blue-500/50 dark:border-blue-400/30 text-blue-600 dark:text-blue-200 hover:border-blue-600/70 dark:hover:border-blue-400/50 hover:text-blue-700 dark:hover:text-white transition-all duration-300 text-center"
                >
                  Documentation
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
                <div className="flex items-center gap-4 pt-4 border-t border-gray-300 dark:border-gray-700">
                  <SimpleThemeToggle size="sm" />
                  {renderSocialIcons()}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10">
        {/* New Hero Section */}
        <HeroSection
          isProcessing={isProcessing}
          isRecording={isRecording}
          isActive={isActive}
          onMicClick={handleMicClick}
          permissionError={permissionError}
          onGetStarted={() => {
            console.log('🎯 Get Started button clicked - opening modal');
            setShowSignupModal(true);
          }}
          onSeeHowItWorks={() => {
            const demoSection = document.getElementById('demo-video');
            if (demoSection) {
              demoSection.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          statusMessage={getStatusMessage()}
        />

        {/* New Landing Page Sections */}

        {/* All-in-One CRM Section */}
        <AllInOneCRMSection onGetAccess={() => setShowSignupModal(true)} />

        {/* Analytics Section */}
        <AnalyticsSection />

        {/* Reviews Section */}
        <ReviewsSection />

        {/* Simplified Pricing Section */}
        <SimplifiedPricingSection />

        {/* Pain Points Section */}
        {/* <PainPointsSection /> */}

        {/* Business Value Parallax Section */}
        {/* <BusinessValueParallax /> */}

        {/* Process Parallax Section */}
        {/* <ProcessParallax /> */}

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
                className={`text-4xl md:text-6xl font-bold mb-6 tracking-tight ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                See How Easy It Is to
                <span className="text-transparent bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 bg-clip-text block mt-3">
                  Build Your Voice AI Empire
                </span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                viewport={{ once: true }}
                className={`text-xl mb-12 max-w-3xl mx-auto leading-relaxed ${
                  isDark ? 'text-blue-100/80' : 'text-gray-700'
                }`}
              >
                This comprehensive 20-minute platform overview shows our key features at a high level.
                <br />
                <span className="text-cyan-600 dark:text-cyan-300 font-medium">
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
            <div className={`inline-flex items-center rounded-full border px-6 py-2.5 text-sm backdrop-blur-md mb-8 ${
              isDark
                ? 'border-teal-400/30 text-teal-200 bg-teal-900/10'
                : 'border-teal-400/40 text-teal-700 bg-teal-100/80'
            }`}>
              <span className="text-2xl mr-3">⚡</span>
              Limited Time Opportunity
            </div>
            <div className="max-w-4xl mx-auto">
              <h2 className={`text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Don't Miss This
                <span className="text-transparent bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 bg-clip-text block mt-3">
                  AI Gold Rush
                </span>
              </h2>
              <p className={`text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed ${
                isDark ? 'text-blue-100/80' : 'text-gray-700'
              }`}>
                If You Are Reading This, You Know That You Are In The Forefront Of It.
                <span className={`font-semibold block mt-2 ${
                  isDark ? 'text-cyan-400' : 'text-cyan-600'
                }`}>So, Don't Miss It.</span>
              </p>

              {/* Urgency Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className={`p-6 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-500/20'
                    : 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-300/30 shadow-lg'
                }`}>
                  <div className={`text-3xl font-bold mb-2 ${
                    isDark ? 'text-blue-400' : 'text-blue-600'
                  }`}>73%</div>
                  <div className={`font-semibold mb-1 ${
                    isDark ? 'text-white' : 'text-gray-800'
                  }`}>Of Agencies</div>
                  <div className={`text-sm ${
                    isDark ? 'text-blue-200/70' : 'text-blue-700/80'
                  }`}>Already Moving to Voice AI</div>
                </div>
                <div className={`p-6 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-purple-900/20 to-teal-900/20 border-purple-500/20'
                    : 'bg-gradient-to-br from-purple-50 to-teal-50 border-purple-300/30 shadow-lg'
                }`}>
                  <div className={`text-3xl font-bold mb-2 ${
                    isDark ? 'text-purple-400' : 'text-purple-600'
                  }`}>$1.3M+</div>
                  <div className={`font-semibold mb-1 ${
                    isDark ? 'text-white' : 'text-gray-800'
                  }`}>Revenue Generated</div>
                  <div className={`text-sm ${
                    isDark ? 'text-purple-200/70' : 'text-purple-700/80'
                  }`}>By Our Partner Agencies</div>
                </div>
                <div className={`p-6 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-cyan-500/20'
                    : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-300/30 shadow-lg'
                }`}>
                  <div className={`text-3xl font-bold mb-2 ${
                    isDark ? 'text-cyan-400' : 'text-cyan-600'
                  }`}>20 Min</div>
                  <div className={`font-semibold mb-1 ${
                    isDark ? 'text-white' : 'text-gray-800'
                  }`}>Setup Time</div>
                  <div className={`text-sm ${
                    isDark ? 'text-cyan-200/70' : 'text-cyan-700/80'
                  }`}>From Zero to First Client</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <button
                  onClick={() => setShowSignupModal(true)}
                  className="px-10 py-5 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500 text-white font-bold text-xl hover:from-blue-600 hover:via-purple-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 relative overflow-hidden group shadow-2xl shadow-blue-500/30"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center justify-center gap-3">
                    🚀 Claim Your Spot in the AI Gold Rush
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </button>
              </div>

              <p className={`mt-6 text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Join <ClientOnly fallback={<span className="text-teal-400 font-bold">250+</span>}>
                  <HeroMemberCounter className="text-teal-400 font-bold" />
                </ClientOnly> agencies already scaling with Knotie • Setup in under 20 minutes
              </p>
            </div>
          </div>
        </div>



          {/* Stay Ahead of the AI Curve Section */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="py-20 px-4"
          >
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-3xl p-12 text-center relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 via-blue-400/20 to-purple-500/20 rounded-3xl"></div>

                <div className="relative z-10">
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
                    Stay Ahead of the AI Curve
                  </h2>

                  <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
                    <div className="flex-1">
                      <input
                        type="email"
                        placeholder="Get the Latest Updates →"
                        className="w-full px-6 py-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/70
                                 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all duration-300"
                        onClick={() => setShowAiCurveModal(true)}
                        readOnly
                      />
                    </div>
                    <button
                      onClick={() => setShowAiCurveModal(true)}
                      className="px-8 py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl
                               transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-500/30"
                    >
                      Subscribe
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        <Footer />

        {/* Live Member Join Notifications - Feature Flag Controlled */}
        {isFeatureEnabled('liveStats.memberNotifications') && (
          <ClientOnly>
            <LiveMemberNotifications position="bottom-right" />
          </ClientOnly>
        )}

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
                  Join <ClientOnly fallback={<span className="text-teal-400 font-bold">250+</span>}>
                    <HeroMemberCounter className="text-teal-400 font-bold" />
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

      {/* AI Curve Signup Modal */}
      {showAiCurveModal && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div
            className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-xl max-w-md w-full border border-cyan-500/30
                      shadow-xl shadow-cyan-500/10 animate-fadeIn"
          >
            {!aiCurveSuccess && !aiCurveAlreadyRegistered ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-white">Stay Ahead of the AI Curve</h3>
                  <button
                    onClick={() => setShowAiCurveModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <p className="text-gray-300 mb-6 leading-relaxed">
                  Get exclusive access to <span className="text-cyan-400 font-semibold">cutting-edge AI insights</span>,
                  <span className="text-blue-400 font-semibold"> industry trends</span>, and
                  <span className="text-purple-400 font-semibold"> early access</span> to revolutionary AI tools and features.
                </p>

                <form onSubmit={handleAiCurveSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="ai-curve-name" className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                    <div className="relative">
                      <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        id="ai-curve-name"
                        value={aiCurveFormData.name}
                        onChange={(e) => setAiCurveFormData({...aiCurveFormData, name: e.target.value})}
                        className="w-full px-10 py-3 rounded-lg bg-gray-900/50 border border-cyan-500/30 text-white placeholder-gray-500
                                focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        placeholder="Your name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="ai-curve-email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        id="ai-curve-email"
                        value={aiCurveFormData.email}
                        onChange={(e) => setAiCurveFormData({...aiCurveFormData, email: e.target.value})}
                        className="w-full px-10 py-3 rounded-lg bg-gray-900/50 border border-cyan-500/30 text-white placeholder-gray-500
                                focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAiCurveSubmitting}
                    className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600
                            text-white rounded-lg font-medium transition-colors duration-300 flex items-center justify-center"
                  >
                    {isAiCurveSubmitting ? (
                      <Loader2 size={20} className="animate-spin mr-2" />
                    ) : (
                      <Send size={18} className="mr-2" />
                    )}
                    {isAiCurveSubmitting ? 'Subscribing...' : 'Stay Ahead of the Curve'}
                  </button>
                </form>

                <p className="text-gray-400 text-xs mt-4 text-center">
                  Join <ClientOnly fallback={<span className="text-cyan-400 font-bold">250+</span>}>
                    <HeroMemberCounter className="text-cyan-400 font-bold" />
                  </ClientOnly> forward-thinking professionals • Latest AI insights • Unsubscribe anytime • No spam, ever
                </p>
              </>
            ) : aiCurveSuccess ? (
              <div className="animate-fadeIn text-center">
                <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check size={30} className="text-cyan-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Welcome to the Future!</h3>
                <p className="text-blue-200/80 mb-6">
                  Thank you for joining! You're now part of our exclusive community staying ahead of the AI curve.
                  You are subscriber <span className="text-cyan-400 font-bold">#{aiCurveSuccessData?.position}</span>.
                </p>

                {/* Referral section */}
                <div className="bg-gray-900/50 p-4 rounded-lg border border-cyan-500/20 mb-6">
                  <h4 className="text-lg font-semibold text-white mb-2">Spread the AI Revolution!</h4>
                  <p className="text-sm text-blue-200/80 mb-4">
                    Share our AI insights with other professionals and help them stay ahead of the curve!
                  </p>

                  <div className="relative">
                    <input
                      type="text"
                      value={`https://knotie-ai.pro/waitlist?ref=${aiCurveSuccessData?.referralCode}`}
                      className="w-full px-3 py-2 pr-12 text-xs bg-gray-800 border border-cyan-500/30 rounded-lg text-white"
                      readOnly
                    />
                    <button
                      onClick={handleCopyAiCurveReferralLink}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300"
                    >
                      <Link2 size={16} />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowAiCurveModal(false);
                    setAiCurveSuccess(false);
                    setAiCurveFormData({ name: '', email: '', referralCode: '' });
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
                <h3 className="text-2xl font-bold text-white mb-4">You're Already Ahead!</h3>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Great news! You're already subscribed and staying ahead of the AI curve.
                  We'll keep you updated with the latest AI insights, trends, and early access opportunities.
                </p>

                <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-2xl">🚀</span>
                    <span className="text-lg font-semibold text-white">You're in the AI Elite!</span>
                  </div>
                  <p className="text-sm text-blue-200/80">
                    Keep an eye on your inbox for exclusive AI insights and early access to cutting-edge features.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowAiCurveModal(false);
                    setAiCurveAlreadyRegistered(false);
                    setAiCurveFormData({ name: '', email: '', referralCode: '' });
                  }}
                  className="py-3 px-8 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg transition-colors font-medium"
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