'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiHelpCircle,
  FiChevronDown,
  FiChevronUp,
  FiDollarSign,
  FiActivity,
  FiUsers,
  FiBell,
  FiCreditCard,
  FiPhone
} from 'react-icons/fi';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'pricing' | 'usage' | 'billing' | 'notifications' | 'general' | 'telephony';
  icon: React.ComponentType<{ className?: string }>;
}

const faqData: FAQItem[] = [
  {
    id: 'pricing-base',
    category: 'pricing',
    icon: FiDollarSign,
    question: 'How much does each Knotie Credit cost?',
    answer: 'Knotie Credits are competitively priced with volume discounts available: 3% off for 10,000+ credits, 5% off for 50,000+ credits, up to 30% off for purchases of 500,000+ credits. Credits never expire and can be used across all AI features. Contact support for current pricing details.'
  },
  {
    id: 'usage-tracking',
    category: 'usage',
    icon: FiActivity,
    question: 'How are Knotie Credits consumed when my customers use imported agents?',
    answer: 'We don\'t track your account at other providers like Ultravox, VAPI, or Retell. While you can set Knotie Credit limits per customer for display purposes, the Knotie Credits you purchase here are separate from your external provider usage. Credits are only consumed for Knotie-native AI features.'
  },
  {
    id: 'knova-usage',
    category: 'usage',
    icon: FiActivity,
    question: 'How are credits charged when customers use Knova Agents?',
    answer: 'When customers use Knova Agents, two calculations occur: 1) Customer dashboard shows Knotie Credit usage based on rules you define, 2) Your partner dashboard deducts actual Knotie Credits based on true usage costs. This gives you control over customer billing while ensuring accurate cost tracking.'
  },
  {
    id: 'credit-uses',
    category: 'general',
    icon: FiCreditCard,
    question: 'What can I use Knotie Credits for?',
    answer: 'Knotie Credits can be used for: Knova Voice/Vision AI Agents, AI Marketing Video creation, AI Advanced Analytics on transcriptions, Customer Support Chatbots, Website Integrated Agents, AI Avatar Agents, and any other AI-powered features we offer.'
  },
  {
    id: 'customer-allocation',
    category: 'usage',
    icon: FiUsers,
    question: 'Can I allocate specific AI Credits to individual customers?',
    answer: 'Currently, partner AI Credits and customer AI Credits are managed separately. You cannot allocate specific amounts of your purchased credits to individual customers. Customer credit displays are based on rules you define and are independent of your actual credit balance.'
  },
  {
    id: 'low-credit-notifications',
    category: 'notifications',
    icon: FiBell,
    question: 'How do low credit notifications work?',
    answer: 'You can set a custom threshold (default: 1,000 credits) and enable notifications. When your balance drops to or below this threshold, you\'ll see dashboard alerts and receive email notifications (if enabled). You can configure these settings in the Credits section.'
  },
  {
    id: 'subscription-credits',
    category: 'billing',
    icon: FiCreditCard,
    question: 'Do I get monthly credits with my subscription?',
    answer: 'Yes! Based on your subscription tier: Starter (1,000 credits/month), Pro (5,000 credits/month), Ultimate Scale (12,000 credits/month). These are automatically added to your balance each month and do not roll over if unused.'
  },
  {
    id: 'credit-expiration',
    category: 'general',
    icon: FiDollarSign,
    question: 'Do purchased Knotie Credits expire?',
    answer: 'No, purchased Knotie Credits never expire. However, monthly subscription credits do not roll over - unused credits from your monthly allocation are lost at the end of each billing period.'
  },
  {
    id: 'refunds',
    category: 'billing',
    icon: FiCreditCard,
    question: 'Can I get a refund for purchased credits?',
    answer: 'Refunds are handled on a case-by-case basis. Contact our support team if you have concerns about a credit purchase. Note that credits used for AI services cannot be refunded.'
  },
  {
    id: 'bulk-discounts',
    category: 'pricing',
    icon: FiDollarSign,
    question: 'Are there discounts for large purchases?',
    answer: 'Yes! We offer automatic volume discounts: 3% off for 10,000+ credits, 5% off for 50,000+ credits, 8% off for 100,000+ credits, 15% off for 250,000+ credits, and up to 30% off for 500,000+ credits.'
  },
  {
    id: 'telephony-vs-ai',
    category: 'telephony',
    icon: FiPhone,
    question: 'What\'s the difference between AI Credits and Telephony Credits?',
    answer: 'AI Credits are used for AI features like voice agents, analytics, and chatbots. Telephony Credits are used for phone calls, SMS, and phone number purchases. They are separate systems with different pricing models.'
  },
  {
    id: 'telephony-pricing',
    category: 'telephony',
    icon: FiDollarSign,
    question: 'How are Telephony Credits priced?',
    answer: 'Telephony Credits are priced at cost with no markup. You pay exactly what we pay to providers like Twilio. This ensures transparent, fair pricing for all telephony services.'
  },
  {
    id: 'telephony-expiration',
    category: 'telephony',
    icon: FiPhone,
    question: 'Do Telephony Credits expire?',
    answer: 'No, Telephony Credits never expire. Unlike AI Credits which may have monthly allocations that don\'t roll over, Telephony Credits remain in your account indefinitely.'
  },
  {
    id: 'auto-topup',
    category: 'telephony',
    icon: FiPhone,
    question: 'How does auto top-up work for Telephony Credits?',
    answer: 'You can enable auto top-up to automatically purchase more Telephony Credits when your balance falls below a threshold you set. This ensures your customers never experience service interruptions due to low credit balance.'
  },
  {
    id: 'telephony-usage',
    category: 'telephony',
    icon: FiPhone,
    question: 'What can I use Telephony Credits for?',
    answer: 'Telephony Credits are used for: purchasing phone numbers, inbound call handling, outbound calls, SMS messaging, and other telephony services. Costs are based on actual provider rates.'
  },
  {
    id: 'credit-separation',
    category: 'general',
    icon: FiCreditCard,
    question: 'Why are AI Credits and Telephony Credits separate?',
    answer: 'They serve different purposes with different cost structures. AI Credits have volume discounts and may expire, while Telephony Credits are cost-based, never expire, and support auto top-up for uninterrupted service.'
  }
];

const categories = [
  { id: 'all', label: 'All Questions', icon: FiHelpCircle },
  { id: 'pricing', label: 'Pricing & Discounts', icon: FiDollarSign },
  { id: 'usage', label: 'Usage & Tracking', icon: FiActivity },
  { id: 'billing', label: 'Billing & Subscriptions', icon: FiCreditCard },
  { id: 'telephony', label: 'Telephony Credits', icon: FiPhone },
  { id: 'notifications', label: 'Notifications', icon: FiBell },
  { id: 'general', label: 'General', icon: FiHelpCircle }
];

interface CreditFAQProps {
  className?: string;
  onContactSupport?: () => void;
}

export default function CreditFAQ({ className = '', onContactSupport }: CreditFAQProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const filteredFAQs = selectedCategory === 'all' 
    ? faqData 
    : faqData.filter(item => item.category === selectedCategory);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <FiHelpCircle className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-white">Frequently Asked Questions</h2>
        </div>
        
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
                ${selectedCategory === category.id
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700 hover:text-gray-300'
                }
              `}
            >
              <category.icon className="w-3 h-3" />
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ Items */}
      <div className="p-6">
        {filteredFAQs.length === 0 ? (
          <div className="text-center py-8">
            <FiHelpCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No questions found in this category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFAQs.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-700/50 border border-gray-600 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleExpanded(item.id)}
                  className="w-full p-4 text-left hover:bg-gray-700/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-gray-800 rounded">
                        <item.icon className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="font-medium text-white">{item.question}</span>
                    </div>
                    {expandedItems.has(item.id) ? (
                      <FiChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <FiChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedItems.has(item.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0">
                        <div className="pl-11 text-gray-300 text-sm leading-relaxed">
                          {item.answer}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Support */}
      <div className="p-6 border-t border-gray-700">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiHelpCircle className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-300 mb-1">Still have questions?</h4>
              <p className="text-blue-200 text-sm mb-3">
                Can't find what you're looking for? Our support team is here to help.
              </p>
              <button
                onClick={onContactSupport}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
