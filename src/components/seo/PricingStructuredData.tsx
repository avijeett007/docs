'use client';

import React from 'react';

export default function PricingStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Knotie AI Pro",
    "description": "White-label AI voice platform for agencies with multi-provider integration, client management, and profit controls",
    "brand": {
      "@type": "Brand",
      "name": "Knotie AI Pro"
    },
    "offers": [
      {
        "@type": "Offer",
        "name": "Free Forever",
        "price": "0",
        "priceCurrency": "USD",
        "priceValidUntil": "2027-12-31",
        "availability": "https://schema.org/InStock",
        "url": "https://knotie-ai.pro/pricing",
        "description": "Get started with essential AI voice agent features at no cost"
      },
      {
        "@type": "Offer",
        "name": "Solo Agency Owner",
        "price": "149",
        "priceCurrency": "USD",
        "priceValidUntil": "2027-12-31",
        "availability": "https://schema.org/InStock",
        "url": "https://knotie-ai.pro/pricing",
        "description": "Perfect for independent agencies starting their AI journey"
      },
      {
        "@type": "Offer",
        "name": "Ultimate Scaleup Agency",
        "price": "699",
        "priceCurrency": "USD",
        "priceValidUntil": "2027-12-31",
        "availability": "https://schema.org/InStock",
        "url": "https://knotie-ai.pro/pricing",
        "description": "Complete white-label solution for agencies ready to dominate the AI market"
      }
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "127"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
