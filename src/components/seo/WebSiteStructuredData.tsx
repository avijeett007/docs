'use client';

import React from 'react';

export default function WebSiteStructuredData() {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Knotie AI Pro",
    "alternateName": "Knotie AI",
    "url": "https://knotie-ai.pro",
    "description": "The ultimate white-label voice AI platform for agencies. Integrate VAPI, Retell, Ultravox. Automate calls, appointments, and customer service with AI voice agents.",
    "publisher": {
      "@type": "Organization",
      "name": "SONTI LTD",
      "url": "https://knotie-ai.pro",
      "logo": {
        "@type": "ImageObject",
        "url": "https://knotie-ai.pro/og-image.png",
        "width": 1200,
        "height": 630
      },
      "sameAs": [
        "https://twitter.com/KnotieAI",
        "https://github.com/avijeett007/knotie-ai-pro"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+44-808-501-3800",
        "contactType": "Customer Service",
        "email": "support@knotie-ai.pro",
        "availableLanguage": "English"
      }
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://knotie-ai.pro/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
    />
  );
}
