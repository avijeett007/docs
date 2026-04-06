'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Zap,
  Users,
  Lock,
  BarChart3,
  Lightbulb,
  Phone,
  Calendar,
  Headphones,
  TrendingUp,
  Globe,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';
import SimplifiedSignupModal from '@/components/SimplifiedSignupModal';

export default function FeaturesPage() {
  const router = useRouter();
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkTheme = () => {
      try {
        const themeContext = document.documentElement.classList.contains('dark');
        setIsDark(themeContext);
      } catch (error) {
        setIsDark(false);
      }
    };
    checkTheme();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    return () => observer.disconnect();
  }, []);

  const coreFeatures = [
    {
      icon: Shield,
      title: "White-Label AI Voice Platform",
      description: "Complete branded platform that keeps clients from discovering providers directly. Your brand, your control, your agency identity.",
      iconColor: "#00D5BE",
      keywords: ["white label AI voice platform", "AI calling software for agencies"]
    },
    {
      icon: Phone,
      title: "AI Phone Call Automation",
      description: "Automate inbound and outbound calls with intelligent AI voice agents. Handle appointments, lead qualification, and customer service 24/7.",
      iconColor: "#3B82F6",
      keywords: ["AI phone call automation", "AI cold calling software"]
    },
    {
      icon: Calendar,
      title: "AI Appointment Setter Software",
      description: "Never miss a booking again. AI agents schedule appointments, send reminders, and handle rescheduling automatically.",
      iconColor: "#8B5CF6",
      keywords: ["AI appointment setter software", "AI voice agent for agencies"]
    },
    {
      icon: Zap,
      title: "Multi-Provider Integration",
      description: "Seamless integration with VAPI, Retell, Ultravox, ElevenLabs, and GHL. Compare costs in real-time and save up to 40% on operational expenses.",
      iconColor: "#00D5BE",
      keywords: ["retell ai alternative", "ghl AI calling integration"]
    },
    {
      icon: BarChart3,
      title: "AI Dialer for Agencies",
      description: "Intelligent auto-dialer with predictive analytics. Optimize call timing, track performance, and maximize conversion rates.",
      iconColor: "#3B82F6",
      keywords: ["AI dialer for agencies", "AI sales call software"]
    },
    {
      icon: Headphones,
      title: "AI Receptionist Software",
      description: "Professional virtual receptionist that handles calls, transfers, takes messages, and provides information to callers.",
      iconColor: "#8B5CF6",
      keywords: ["AI receptionist software", "AI customer service voice bot"]
    },
    {
      icon: Users,
      title: "Client Retention Intelligence",
      description: "Proprietary features that make switching costly for clients. Reduce churn by 85% with our client lock-in technology.",
      iconColor: "#00D5BE",
      keywords: ["voice AI for marketing agencies", "AI voice SaaS platform"]
    },
    {
      icon: Lock,
      title: "Enterprise-Grade Security",
      description: "Bank-level encryption and compliance. SOC 2 Type II certified with 99.99% uptime SLA. Your data is always protected.",
      iconColor: "#8B5CF6",
      keywords: ["AI call center automation", "AI voice automation platform"]
    },
    {
      icon: TrendingUp,
      title: "Profit Multiplier System",
      description: "Set custom markup pricing for each client. Track margins, optimize pricing strategies, and maximize agency revenue.",
      iconColor: "#3B82F6",
      keywords: ["AI voice automation platform", "white label AI voice platform"]
    },
    {
      icon: Globe,
      title: "GHL & N8N Integration",
      description: "Seamless integration with Go High Level and N8N workflows. Deploy in minutes, not weeks, and automate your entire stack.",
      iconColor: "#00D5BE",
      keywords: ["ghl AI calling integration", "AI phone bot for business"]
    }
  ];

  const integrations = [
    { name: "VAPI", logo: "🎯" },
    { name: "Retell AI", logo: "🔄" },
    { name: "Ultravox", logo: "🎙️" },
    { name: "ElevenLabs", logo: "🔊" },
    { name: "GoHighLevel", logo: "📊" },
    { name: "N8N", logo: "⚡" }
  ];

  const useCases = [
    {
      title: "Appointment Setting",
      description: "Automate booking confirmations, reminders, and rescheduling",
      icon: Calendar
    },
    {
      title: "Cold Calling",
      description: "Scale outbound sales with AI-powered cold calling campaigns",
      icon: Phone
    },
    {
      title: "Customer Support",
      description: "Provide 24/7 customer service with intelligent voice agents",
      icon: Headphones
    },
    {
      title: "Lead Qualification",
      description: "Automatically qualify and route leads to your sales team",
      icon: TrendingUp
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black transition-colors duration-500">
      <PublicHeader />
      
      {/* Hero Section */}
      <section className="relative isolate px-6 pt-14 lg:px-8">
        <div
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>

        <div className="mx-auto max-w-4xl py-16 sm:py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
              White Label{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                AI Voice Platform
              </span>
              {' '}for Agencies
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              The ultimate AI calling software for agencies. Automate phone calls, set appointments, 
              and scale your voice AI services with our white-label platform. Integrate with VAPI, 
              Retell, and GHL in minutes.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => setIsSignupModalOpen(true)}
                className="rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 px-6 py-3 text-base font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Get Started Now
                <ArrowRight className="ml-2 h-5 w-5 inline" />
              </button>
              <button
                onClick={() => router.push('/partners')}
                className="text-base font-semibold leading-6 text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Become a Partner <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="py-16 sm:py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Everything Your{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                AI Agency Needs
              </span>
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Powerful features designed specifically for marketing agencies and resellers
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {coreFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="relative group"
                >
                  <div className="h-full rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700">
                    <div
                      className="inline-flex rounded-xl p-3 mb-4"
                      style={{ backgroundColor: `${feature.iconColor}20` }}
                    >
                      <Icon
                        className="h-6 w-6"
                        style={{ color: feature.iconColor }}
                      />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Integration Showcase */}
      <section className="py-16 sm:py-24 px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Seamless Integration with Leading Providers
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Connect your existing AI voice agents or start fresh with our native platform
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
            {integrations.map((integration, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300"
              >
                <div className="text-4xl mb-3">{integration.logo}</div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white text-center">
                  {integration.name}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 sm:py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Built for Real-World Use Cases
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              From appointment setting to cold calling, we've got you covered
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="text-center"
                >
                  <div className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 p-3 mb-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {useCase.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {useCase.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-6 lg:px-8 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to Scale Your AI Agency?
          </h2>
          <p className="mt-6 text-lg leading-8 text-white/90">
            Join leading agencies using Knotie AI Pro to deliver world-class voice AI solutions to their clients.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <button
              onClick={() => router.push('/pricing')}
              className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-blue-600 shadow-lg hover:bg-gray-100 transition-all duration-200"
            >
              View Pricing
              <ArrowRight className="ml-2 h-5 w-5 inline" />
            </button>
            <button
              onClick={() => router.push('/partners')}
              className="text-base font-semibold leading-6 text-white hover:text-gray-100 transition-colors"
            >
              Talk to Sales <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      <Footer />

      <SimplifiedSignupModal 
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
      />
    </div>
  );
}
