'use client';

import React from 'react';

export default function HelpFAQStructuredData() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is Knotie-AI Pro?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Knotie-AI Pro is an advanced Voice AI Agent platform that helps businesses automate and enhance their customer communications through intelligent voice interactions. It's a white-label platform for agencies to integrate and onboard customers with AI agents through platforms like VAPI, Retell, ElevenLabs, and Ultravox."
        }
      },
      {
        "@type": "Question",
        "name": "How do I get started?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Sign up for an account, choose your plan, and follow our quick setup guide to create your first Voice AI Agent. Visit our comprehensive documentation at docs.knotie-ai.pro for detailed steps, tutorials, and integration guides."
        }
      },
      {
        "@type": "Question",
        "name": "What types of businesses can use Knotie-AI Pro?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our platform is designed for businesses of all sizes across various industries, including healthcare, finance, retail, and technology sectors. It's particularly valuable for marketing agencies, voice AI agencies, and businesses looking to automate customer communications."
        }
      },
      {
        "@type": "Question",
        "name": "How secure is the platform?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We implement enterprise-grade security measures, including end-to-end encryption, secure data storage, and regular security audits to protect your data. All sensitive data including voice recordings and API keys are encrypted at rest and in transit."
        }
      },
      {
        "@type": "Question",
        "name": "What languages are supported?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Currently, we support English with plans to add more languages in the future. Contact us for specific language requirements."
        }
      },
      {
        "@type": "Question",
        "name": "Where can I find detailed documentation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our comprehensive documentation is available at docs.knotie-ai.pro. It includes getting started guides, API references, tutorials, architecture overviews, and step-by-step instructions for all platform features. The documentation is always up-to-date and fully searchable."
        }
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
    />
  );
}
