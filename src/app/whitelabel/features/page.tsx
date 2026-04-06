'use client';

import React from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { FiPhone, FiBarChart2, FiMessageSquare, FiShield, FiUsers, FiClock, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';

export default function WhitelabelFeaturesPage() {
  const { branding } = usePartnerBranding();

  const defaultFeatures = [
    {
      icon: "FiPhone",
      title: "24/7 Availability",
      description: "Ensure your business is always accessible to customers with AI-powered voice responses.",
      benefits: ["Never miss a call", "Instant response time", "Global timezone support"]
    },
    {
      icon: "FiBarChart2",
      title: "Advanced Analytics",
      description: "Get detailed insights into customer interactions and conversation patterns.",
      benefits: ["Real-time dashboards", "Performance metrics", "Custom reports"]
    },
    {
      icon: "FiMessageSquare",
      title: "Natural Conversations",
      description: "AI that understands context and provides human-like interactions.",
      benefits: ["Context awareness", "Multi-language support", "Emotional intelligence"]
    },
    {
      icon: "FiShield",
      title: "Enterprise Security",
      description: "Bank-grade security with end-to-end encryption and compliance.",
      benefits: ["Data encryption", "GDPR compliant", "SOC 2 certified"]
    },
    {
      icon: "FiUsers",
      title: "Team Collaboration",
      description: "Seamlessly integrate with your existing team workflows.",
      benefits: ["Team dashboards", "Role-based access", "Collaboration tools"]
    },
    {
      icon: "FiClock",
      title: "Quick Setup",
      description: "Get started in minutes with our easy-to-use setup process.",
      benefits: ["5-minute setup", "No coding required", "Guided onboarding"]
    }
  ];

  // Parse custom features if available
  let features = defaultFeatures;
  try {
    if (branding?.features) {
      const customFeatures = JSON.parse(branding.features);
      if (Array.isArray(customFeatures) && customFeatures.length > 0) {
        features = customFeatures;
      }
    }
  } catch (error) {
    console.error('Error parsing custom features:', error);
  }

  const iconMap: Record<string, any> = {
    FiPhone, FiBarChart2, FiMessageSquare, FiShield, FiUsers, FiClock, FiCheckCircle
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center text-blue-400 hover:text-blue-300">
                <FiArrowLeft className="w-5 h-5 mr-2" />
                Back to Home
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              {branding?.logo && (
                <img src={branding.logo} alt={branding.businessName} className="h-8 w-auto" />
              )}
              <span className="text-xl font-bold">{branding?.businessName || 'Voice AI'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Powerful Features for Your Business
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Discover how our AI-powered voice solutions can transform your customer experience
            and streamline your business operations.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const IconComponent = iconMap[feature.icon] || FiCheckCircle;
              return (
                <div key={index} className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-6">
                    <IconComponent className="text-blue-400 w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">{feature.title}</h3>
                  <p className="text-gray-400 mb-6">{feature.description}</p>
                  {feature.benefits && (
                    <ul className="space-y-2">
                      {feature.benefits.map((benefit: string, benefitIndex: number) => (
                        <li key={benefitIndex} className="flex items-center text-sm text-gray-300">
                          <FiCheckCircle className="w-4 h-4 text-green-400 mr-2 flex-shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gray-800/50">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses already using our AI voice solutions to enhance their customer experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Start Free Trial
            </Link>
            {branding?.supportEmail && (
              <a
                href={`mailto:${branding.supportEmail}`}
                className="px-8 py-4 border border-gray-600 hover:border-gray-500 text-white rounded-lg font-medium transition-colors"
              >
                Contact Sales
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
