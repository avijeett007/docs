'use client';

import React from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { getThemeConfig, PortalTheme } from '@/lib/portalThemes';
import { FiArrowLeft, FiShield } from 'react-icons/fi';
import Link from 'next/link';

export default function WhitelabelPrivacyPage() {
  const { branding } = usePartnerBranding();
  const themeConfig = getThemeConfig((branding?.themePreference as PortalTheme) || PortalTheme.MODERN);

  return (
    <div className={`min-h-screen ${themeConfig.styleClasses.container}`}>
      {/* Header */}
      <header className={`${themeConfig.styleClasses.header} border-b sticky top-0 z-10`}>
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className={`flex items-center ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} transition-colors`}>
                <FiArrowLeft className="w-5 h-5 mr-2" />
                Back to Home
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              {branding?.logo && (
                <img src={branding.logo} alt={branding.businessName} className="h-8 w-auto" />
              )}
              <span className={`text-xl font-bold ${themeConfig.styleClasses.text.primary}`}>
                {branding?.businessName || 'Voice AI'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <div className={`w-16 h-16 ${themeConfig.styleClasses.featureIcon} rounded-full flex items-center justify-center mx-auto mb-6`}>
            <FiShield className={`${themeConfig.styleClasses.text.primary} w-8 h-8`} />
          </div>
          <h1 className={`text-4xl md:text-5xl font-bold mb-6 ${themeConfig.styleClasses.text.primary}`}>
            Privacy Policy
          </h1>
          <p className={`text-xl ${themeConfig.styleClasses.text.secondary} max-w-3xl mx-auto`}>
            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
          </p>
          <p className={`text-sm ${themeConfig.styleClasses.text.muted} mt-4`}>
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </section>

      {/* Privacy Content */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="prose prose-invert max-w-none">
            <div className="space-y-8">
              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Information We Collect</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    We collect information you provide directly to us, such as when you create an account,
                    use our services, or contact us for support.
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Account information (name, email, phone number)</li>
                    <li>Voice interaction data and recordings</li>
                    <li>Usage analytics and performance metrics</li>
                    <li>Device and browser information</li>
                    <li>Communication preferences</li>
                  </ul>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>How We Use Your Information</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    We use the information we collect to provide, maintain, and improve our services:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Provide and operate our voice AI services</li>
                    <li>Process voice interactions and generate responses</li>
                    <li>Analyze usage patterns to improve service quality</li>
                    <li>Send important service updates and notifications</li>
                    <li>Provide customer support and technical assistance</li>
                    <li>Comply with legal obligations and protect our rights</li>
                  </ul>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Information Sharing</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    We do not sell, trade, or otherwise transfer your personal information to third parties,
                    except in the following circumstances:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>With your explicit consent</li>
                    <li>To comply with legal requirements or court orders</li>
                    <li>To protect our rights, property, or safety</li>
                    <li>With trusted service providers who assist in our operations</li>
                    <li>In connection with a business transfer or acquisition</li>
                  </ul>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Data Security</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    We implement appropriate security measures to protect your personal information:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>End-to-end encryption for voice data transmission</li>
                    <li>Secure data storage with industry-standard encryption</li>
                    <li>Regular security audits and vulnerability assessments</li>
                    <li>Access controls and authentication requirements</li>
                    <li>Employee training on data protection practices</li>
                  </ul>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Your Rights</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    You have certain rights regarding your personal information:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Access and review your personal data</li>
                    <li>Request corrections to inaccurate information</li>
                    <li>Request deletion of your personal data</li>
                    <li>Object to processing of your information</li>
                    <li>Data portability and export options</li>
                    <li>Withdraw consent for data processing</li>
                  </ul>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Contact Us</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    If you have questions about this Privacy Policy or our data practices, please contact us:
                  </p>
                  {branding?.supportEmail && (
                    <p>
                      Email: <a href={`mailto:${branding.supportEmail}`} className={`${themeConfig.styleClasses.text.primary} hover:opacity-80 transition-opacity`}>
                        {branding.supportEmail}
                      </a>
                    </p>
                  )}
                  {branding?.companyAddress && (
                    <p>Address: {branding.companyAddress}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
