'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Users,
  TrendingUp,
  Star,
  CheckCircle,
  Loader2,
  Mail,
  Globe,
  Instagram,
  Youtube,
  Twitter,
  X,
  User,
  Send,
  ArrowRight,
  Sparkles,
  Target,
  Award,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Logo from '@/components/Logo';
import { SimpleThemeToggle } from '@/components/ui/SimpleThemeToggle';
import { ClientOnly } from '@/components/ui/client-only';
import { HeroMemberCounter } from '@/components/ui/animated-counter';
import Link from 'next/link';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  website: string;
  phoneNumber: string;
  socialMedia: {
    instagram: string;
    youtube: string;
    twitter: string;
    other: string;
  };
  audienceSize: string;
  experience: string;
  marketingStrategy: string;
  agreeToTerms: boolean;
}

const COMMISSION_TIERS = [
  {
    tier: 'public',
    title: 'Public Affiliate',
    commission: '10%',
    duration: '6 months',
    description: 'Perfect for getting started with affiliate marketing',
    features: ['10% commission on all referrals', 'Up to 6 months duration', 'Basic affiliate tools', 'Email support'],
    badge: 'Getting Started',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: Target,
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    tier: 'free_signup',
    title: 'Free Member',
    commission: '20%',
    duration: '1 year',
    description: 'Sign up for free to unlock enhanced commission rates',
    features: ['20% commission on all referrals', 'Up to 1 year duration', 'Advanced affiliate tools', 'Priority support'],
    badge: 'Popular',
    badgeColor: 'bg-green-500/10 text-green-400 border-green-500/20',
    icon: Award,
    gradient: 'from-green-500/20 to-teal-500/20',
  },
  {
    tier: 'subscriber',
    title: 'Premium Subscriber',
    commission: '40%',
    duration: 'Lifetime',
    description: 'Become a subscriber for the highest commission rates',
    features: ['40% commission on all referrals', 'Lifetime duration', 'Premium affiliate tools', 'Dedicated support'],
    badge: 'Limited Time',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: Zap,
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
];

export default function AffiliatePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    website: '',
    phoneNumber: '',
    socialMedia: {
      instagram: '',
      youtube: '',
      twitter: '',
      other: '',
    },
    audienceSize: '',
    experience: '',
    marketingStrategy: '',
    agreeToTerms: false,
  });

  // Theme detection
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const handleInputChange = (field: string, value: string | boolean) => {
    if (field.startsWith('socialMedia.')) {
      const socialField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        socialMedia: {
          ...prev.socialMedia,
          [socialField]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agreeToTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the terms and conditions to continue.",
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/affiliates/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit application');
      }

      setSubmitted(true);
      setShowApplicationModal(false);
      toast({
        title: "✅ Application Submitted!",
        description: "Thank you for your interest! Our team will contact you soon.",
        className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
      });
    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast({
        title: "❌ Submission Failed",
        description: error.message || 'Failed to submit application. Please try again.',
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full text-center bg-white/90 dark:bg-gray-900/80 backdrop-blur-lg rounded-2xl p-8 border border-gray-200/30 dark:border-blue-400/20 shadow-xl"
        >
          <div className="mx-auto w-20 h-20 bg-gradient-to-r from-green-500/20 to-teal-500/20 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Application Submitted!</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
            Thank you for your interest in becoming a Knotie AI Pro affiliate. Our team will review your application and contact you within 2-3 business days.
          </p>

          <div className="p-4 bg-gradient-to-r from-blue-500/10 to-teal-500/10 rounded-xl border border-blue-500/20 mb-8">
            <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Mail className="h-4 w-4 mr-2" />
              Check your email for a confirmation message
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/'}
            className="w-full py-3 px-6 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-teal-500/25"
          >
            Return to Homepage
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
      <div className="relative min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black overflow-hidden transition-colors duration-500">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/30 dark:border-blue-400/20 transition-colors duration-500">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-6">
              <SimpleThemeToggle size="sm" />
              <Link
                href="/partner/login"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:from-blue-600 hover:to-teal-600 transition-all duration-300"
              >
                Partner Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-gradient-to-r from-purple-600 via-blue-500 to-teal-500 text-white px-4 py-3 text-center text-sm sm:text-base border-b border-blue-400/20"
      >
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span>Join our exclusive affiliate program and earn up to 40% commission</span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </motion.div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5"></div>
        <div className="relative container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight mb-8">
                <span className="text-gray-900 dark:text-white">
                  Become a
                </span>
                <br />
                <span className="text-transparent bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 bg-clip-text">
                  Knotie AI Pro
                </span>
                <br />
                <span className="text-gray-900 dark:text-white">
                  Affiliate
                </span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              Join our affiliate program and earn generous commissions by promoting the ultimate Voice AI platform for businesses.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-8 mb-16 text-gray-600 dark:text-gray-300"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500/20 to-teal-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <span className="font-medium">High Conversion Rates</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500/20 to-teal-500/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <span className="font-medium">Up to 40% Commission</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500/20 to-teal-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
                <span className="font-medium">Growing Market</span>
              </div>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-12"
            >
              <span>Join</span>
              <ClientOnly fallback={<span className="text-teal-400 font-bold">137+</span>}>
                <HeroMemberCounter className="text-teal-400 font-bold" />
              </ClientOnly>
              <span>successful affiliates already earning with Knotie AI Pro</span>
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.0 }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowApplicationModal(true)}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold text-lg transition-all duration-300 shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/40 relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Apply for Affiliate Program
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Commission Tiers */}
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Choose Your <span className="text-transparent bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text">Commission Tier</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Start earning today with our flexible affiliate program designed for every level of marketer
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {COMMISSION_TIERS.map((tier, index) => {
            const IconComponent = tier.icon;
            return (
              <motion.div
                key={tier.tier}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                whileHover={{ y: -10 }}
                className={`
                  relative bg-white/90 dark:bg-gray-900/80 backdrop-blur-lg rounded-2xl p-8
                  border border-gray-200/30 dark:border-blue-400/20 shadow-xl
                  ${index === 1 ? 'ring-2 ring-teal-500/50 scale-105 z-10' : ''}
                  transition-all duration-300 group
                `}
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${tier.gradient} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

                {/* Content */}
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${tier.badgeColor}`}>
                      {tier.badge}
                    </div>
                    {index === 1 && <Star className="h-6 w-6 text-yellow-500 fill-current" />}
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-teal-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
                    <IconComponent className="h-8 w-8 text-teal-500" />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{tier.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">{tier.description}</p>

                  {/* Commission */}
                  <div className="mb-8">
                    <div className="flex items-baseline mb-2">
                      <span className="text-5xl font-bold text-gray-900 dark:text-white">
                        {tier.commission}
                      </span>
                      <span className="text-lg text-gray-500 dark:text-gray-400 ml-2">
                        commission
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {tier.duration === 'Lifetime' ? 'Lifetime duration' : `For ${tier.duration}`}
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-r from-green-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Application Modal */}
      <AnimatePresence>
        {showApplicationModal && (
          <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200/30 dark:border-blue-400/20 shadow-2xl"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-b border-gray-200/30 dark:border-blue-400/20 p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Apply to Become an Affiliate</h2>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">
                      Fill out the form below and our team will review your application
                    </p>
                  </div>
                  <button
                    onClick={() => setShowApplicationModal(false)}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Personal Information */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <User className="h-5 w-5 text-teal-500" />
                      Personal Information
                    </h3>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name *</label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                          placeholder="Your first name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name *</label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                          placeholder="Your last name"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address *</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                            placeholder="your@email.com"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
                        <input
                          type="tel"
                          value={formData.phoneNumber}
                          onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company/Business Name</label>
                        <input
                          type="text"
                          value={formData.company}
                          onChange={(e) => handleInputChange('company', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                          placeholder="Your company name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Website URL</label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <input
                            type="url"
                            value={formData.website}
                            onChange={(e) => handleInputChange('website', e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                            placeholder="https://yourwebsite.com"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Social Media & Audience */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-teal-500" />
                      Social Media & Audience Information
                    </h3>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Instagram className="h-4 w-4" />
                          Instagram Handle
                        </label>
                        <input
                          type="text"
                          value={formData.socialMedia.instagram}
                          onChange={(e) => handleInputChange('socialMedia.instagram', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                          placeholder="@yourusername"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Youtube className="h-4 w-4" />
                          YouTube Channel
                        </label>
                        <input
                          type="text"
                          value={formData.socialMedia.youtube}
                          onChange={(e) => handleInputChange('socialMedia.youtube', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                          placeholder="Channel URL or name"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Twitter className="h-4 w-4" />
                          Twitter/X Handle
                        </label>
                        <input
                          type="text"
                          value={formData.socialMedia.twitter}
                          onChange={(e) => handleInputChange('socialMedia.twitter', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                          placeholder="@yourusername"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Other Social Media</label>
                        <input
                          type="text"
                          value={formData.socialMedia.other}
                          onChange={(e) => handleInputChange('socialMedia.other', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                          placeholder="LinkedIn, TikTok, etc."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Total Audience Size *</label>
                      <input
                        type="text"
                        value={formData.audienceSize}
                        onChange={(e) => handleInputChange('audienceSize', e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                        placeholder="e.g., 10,000 Instagram followers, 5,000 email subscribers"
                        required
                      />
                    </div>
                  </div>

                  {/* Experience & Strategy */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Target className="h-5 w-5 text-teal-500" />
                      Experience & Strategy
                    </h3>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Marketing Experience *</label>
                      <textarea
                        value={formData.experience}
                        onChange={(e) => handleInputChange('experience', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors resize-none"
                        placeholder="Describe your experience with affiliate marketing, content creation, or promoting business tools..."
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Marketing Strategy *</label>
                      <textarea
                        value={formData.marketingStrategy}
                        onChange={(e) => handleInputChange('marketingStrategy', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors resize-none"
                        placeholder="How do you plan to promote Knotie AI Pro? What channels will you use?"
                        required
                      />
                    </div>
                  </div>

                  {/* Terms and Conditions */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="agreeToTerms"
                        checked={formData.agreeToTerms}
                        onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                        className="mt-1 w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                      />
                      <label htmlFor="agreeToTerms" className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        I agree to the affiliate program terms and conditions, including maintaining ethical marketing practices,
                        providing accurate information about Knotie AI Pro, and complying with all applicable laws and regulations.
                        I understand that commission rates and terms may be subject to change with notice.
                      </label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => setShowApplicationModal(false)}
                      className="flex-1 py-3 px-6 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 px-6 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold transition-all duration-300 shadow-lg shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5" />
                          Submit Application
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
  );
}
