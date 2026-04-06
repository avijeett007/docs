'use client';

import React, { useState } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { FiArrowLeft, FiSearch, FiMail, FiPhone, FiMessageCircle, FiBook, FiHelpCircle } from 'react-icons/fi';
import Link from 'next/link';

export default function WhitelabelHelpPage() {
  const { branding } = usePartnerBranding();
  const [searchQuery, setSearchQuery] = useState('');

  const helpCategories = [
    {
      title: "Getting Started",
      icon: FiBook,
      articles: [
        "Quick Setup Guide",
        "First Voice Agent Configuration",
        "Understanding the Dashboard",
        "Basic Settings Overview"
      ]
    },
    {
      title: "Voice Configuration",
      icon: FiMessageCircle,
      articles: [
        "Choosing the Right Voice",
        "Custom Voice Training",
        "Language Settings",
        "Voice Response Optimization"
      ]
    },
    {
      title: "Analytics & Reporting",
      icon: FiSearch,
      articles: [
        "Understanding Analytics Dashboard",
        "Custom Report Generation",
        "Performance Metrics",
        "Data Export Options"
      ]
    },
    {
      title: "Troubleshooting",
      icon: FiHelpCircle,
      articles: [
        "Common Issues & Solutions",
        "Audio Quality Problems",
        "Integration Troubleshooting",
        "Performance Optimization"
      ]
    }
  ];

  const faqs = [
    {
      question: "How do I set up my first voice agent?",
      answer: "Navigate to the dashboard, click 'Create New Agent', and follow the step-by-step wizard. You'll configure the voice, language, and basic responses."
    },
    {
      question: "Can I customize the voice responses?",
      answer: "Yes, you can fully customize voice responses, add custom scripts, and train the AI to handle specific scenarios for your business."
    },
    {
      question: "What languages are supported?",
      answer: "We support over 25 languages including English, Spanish, French, German, Italian, Portuguese, and many more."
    },
    {
      question: "How do I integrate with my existing systems?",
      answer: "We provide REST APIs, webhooks, and pre-built integrations with popular CRM and helpdesk systems. Check our API documentation for details."
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
            How Can We Help You?
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-8">
            Find answers to your questions, browse our documentation, or get in touch with our support team.
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search for help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Help Categories */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Browse by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {helpCategories.map((category, index) => (
              <div key={index} className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                  <category.icon className="text-blue-400 w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-4">{category.title}</h3>
                <ul className="space-y-2">
                  {category.articles.map((article, articleIndex) => (
                    <li key={articleIndex}>
                      <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
                        {article}
                      </a>
                    </li>
                  ))}
                </ul>
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
            {faqs.map((faq, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-3">{faq.question}</h3>
                <p className="text-gray-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Still Need Help?</h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Can't find what you're looking for? Our support team is here to help you get the most out of our platform.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {branding?.supportEmail && (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                <FiMail className="w-8 h-8 text-blue-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Email Support</h3>
                <p className="text-gray-400 mb-4">Get help via email</p>
                <a
                  href={`mailto:${branding.supportEmail}`}
                  className="text-blue-400 hover:text-blue-300"
                >
                  {branding.supportEmail}
                </a>
              </div>
            )}
            
            {branding?.companyPhone && (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                <FiPhone className="w-8 h-8 text-blue-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Phone Support</h3>
                <p className="text-gray-400 mb-4">Speak with our team</p>
                <a
                  href={`tel:${branding.companyPhone}`}
                  className="text-blue-400 hover:text-blue-300"
                >
                  {branding.companyPhone}
                </a>
              </div>
            )}
            
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <FiMessageCircle className="w-8 h-8 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Live Chat</h3>
              <p className="text-gray-400 mb-4">Chat with support</p>
              <button className="text-blue-400 hover:text-blue-300">
                Start Chat
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
