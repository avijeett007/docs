'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';

interface FAQsSectionProps {
  branding: PartnerBranding;
  getTranslation: (key: string, fallback?: string) => string;
}

// FAQ keys for translation lookup
const faqKeys = ['getStarted', 'dataSecurity', 'integrations', 'freeTrial', 'pricing'];

// Default FAQs for fallback
const defaultFAQs = [
  { question: "How quickly can I get started?", answer: "You can get started immediately! Sign up for a free account and you'll have access to our voice AI platform within minutes. Our setup wizard will guide you through the initial configuration." },
  { question: "Is my data secure?", answer: "Absolutely. We use enterprise-grade security with end-to-end encryption, SOC 2 compliance, and GDPR compliance. Your data is stored securely and never shared with third parties." },
  { question: "Can I integrate with my existing tools?", answer: "Yes! Our platform offers comprehensive APIs and pre-built integrations with popular CRM, helpdesk, and communication tools. We also provide webhooks for custom integrations." },
  { question: "What's included in the free trial?", answer: "Our free trial includes full access to all features for 14 days, up to 100 voice interactions, and dedicated onboarding support to help you get the most out of the platform." },
  { question: "How does pricing work?", answer: "We offer flexible pricing based on your usage needs. You can start with our free tier and scale up as your business grows. All plans include core features with additional capabilities in higher tiers." }
];

export default function FAQsSection({ branding, getTranslation }: FAQsSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Build translated FAQs
  const buildTranslatedFAQs = () => {
    return faqKeys.map((key, index) => ({
      question: getTranslation(`faqs.items.${key}.question`, defaultFAQs[index].question),
      answer: getTranslation(`faqs.items.${key}.answer`, defaultFAQs[index].answer)
    }));
  };

  // Parse custom FAQs if available, otherwise use translated defaults
  let faqs = buildTranslatedFAQs();

  if (branding.faqs) {
    try {
      const customFAQs = JSON.parse(branding.faqs);
      if (Array.isArray(customFAQs) && customFAQs.length > 0) {
        faqs = customFAQs;
      }
    } catch (error) {
      console.warn('Failed to parse custom FAQs, using defaults');
    }
  }

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {getTranslation('faqs.title', 'Frequently Asked Questions')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {getTranslation('faqs.subtitle', 'Get answers to common questions about our voice AI platform.')}
          </p>
        </motion.div>

        {/* FAQs List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900 pr-4">
                  {faq.question}
                </h3>
                <div className="flex-shrink-0">
                  {openIndex === index ? (
                    <FiChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <FiChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </button>

              <motion.div
                initial={false}
                animate={{
                  height: openIndex === index ? 'auto' : 0,
                  opacity: openIndex === index ? 1 : 0
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-4">
                  <p className="text-gray-600 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Contact Support CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-gray-600 mb-4">{getTranslation('faqs.stillHaveQuestions', 'Still have questions?')}</p>
          {branding.supportEmail ? (
            <a
              href={`mailto:${branding.supportEmail}`}
              className="inline-flex items-center px-6 py-3  text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {getTranslation('faqs.contactSupport', 'Contact Support')}
            </a>
          ) : (
            <button
              onClick={() => window.location.href = '/platform/onboarding/1'}
              style={{
                background: `linear-gradient(135deg, ${branding.primaryColor || '#3B82F6'}, ${branding.secondaryColor || '#8B5CF6'})`
              }}
              className="inline-flex items-center px-6 py-3  text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {getTranslation('faqs.getStarted', 'Get Started')}
            </button>
          )}
        </motion.div>
      </div>
    </section>
  );
}
