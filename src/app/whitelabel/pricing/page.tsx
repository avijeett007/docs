'use client';

import React from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { FiCheck, FiArrowLeft, FiMail } from 'react-icons/fi';
import Link from 'next/link';

export default function WhitelabelPricingPage() {
  const { branding } = usePartnerBranding();

  const pricingPlans = [
    {
      name: "Starter",
      price: "$29",
      period: "/month",
      description: "Perfect for small businesses getting started with AI voice",
      features: [
        "Up to 100 voice interactions/month",
        "Basic analytics dashboard",
        "Email support",
        "Standard voice models",
        "Basic integrations"
      ],
      popular: false
    },
    {
      name: "Professional",
      price: "$99",
      period: "/month",
      description: "Ideal for growing businesses with higher volume needs",
      features: [
        "Up to 1,000 voice interactions/month",
        "Advanced analytics & reporting",
        "Priority support",
        "Premium voice models",
        "Advanced integrations",
        "Custom branding",
        "API access"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "Tailored solutions for large organizations",
      features: [
        "Unlimited voice interactions",
        "Custom analytics & dashboards",
        "Dedicated account manager",
        "Custom voice models",
        "White-label solutions",
        "SLA guarantees",
        "On-premise deployment options"
      ],
      popular: false
    }
  ];

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
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Choose the perfect plan for your business. All plans include our core features
            with no hidden fees or setup costs.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-gray-800 rounded-xl border p-8 ${
                  plan.popular
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-gray-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-400">{plan.period}</span>
                  </div>
                  <p className="text-gray-400">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <FiCheck className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 bg-gray-800/50">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Can I change plans anytime?</h3>
              <p className="text-gray-400">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-gray-400">Yes, we offer a 14-day free trial with full access to all features in the Professional plan.</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-400">We accept all major credit cards, PayPal, and bank transfers for Enterprise customers.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Need a Custom Solution?</h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Our team can work with you to create a custom plan that fits your specific needs and budget.
          </p>
          {branding?.supportEmail && (
            <a
              href={`mailto:${branding.supportEmail}`}
              className="inline-flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <FiMail className="w-5 h-5 mr-2" />
              Contact Our Sales Team
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
