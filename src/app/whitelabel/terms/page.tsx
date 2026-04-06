'use client';

import React from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { getThemeConfig, PortalTheme } from '@/lib/portalThemes';
import { FiArrowLeft, FiFileText } from 'react-icons/fi';
import Link from 'next/link';

export default function WhitelabelTermsPage() {
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
            <FiFileText className={`${themeConfig.styleClasses.text.primary} w-8 h-8`} />
          </div>
          <h1 className={`text-4xl md:text-5xl font-bold mb-6 ${themeConfig.styleClasses.text.primary}`}>
            Terms of Service
          </h1>
          <p className={`text-xl ${themeConfig.styleClasses.text.secondary} max-w-3xl mx-auto`}>
            Please read these terms carefully before using our voice AI services.
          </p>
          <p className={`text-sm ${themeConfig.styleClasses.text.muted} mt-4`}>
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </section>

      {/* Terms Content */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="prose prose-invert max-w-none">
            <div className="space-y-8">
              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Acceptance of Terms</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    By accessing and using our voice AI services, you accept and agree to be bound by the terms
                    and provision of this agreement. If you do not agree to abide by the above, please do not
                    use this service.
                  </p>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Service Description</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    Our platform provides AI-powered voice interaction services including:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Voice agent creation and management</li>
                    <li>Real-time voice processing and responses</li>
                    <li>Analytics and reporting tools</li>
                    <li>Integration capabilities with third-party systems</li>
                    <li>Customer support and documentation</li>
                  </ul>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>User Responsibilities</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    As a user of our services, you agree to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Provide accurate and complete information</li>
                    <li>Maintain the security of your account credentials</li>
                    <li>Use the service in compliance with applicable laws</li>
                    <li>Not engage in any harmful or malicious activities</li>
                    <li>Respect intellectual property rights</li>
                    <li>Report any security vulnerabilities or issues</li>
                  </ul>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Prohibited Uses</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    You may not use our service for:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Illegal activities or fraud</li>
                    <li>Harassment, abuse, or harmful content</li>
                    <li>Spam or unsolicited communications</li>
                    <li>Violating privacy or data protection laws</li>
                    <li>Reverse engineering or unauthorized access</li>
                    <li>Competing services or commercial exploitation</li>
                  </ul>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Payment and Billing</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    For paid services:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Fees are charged according to your selected plan</li>
                    <li>Payments are processed securely through our payment partners</li>
                    <li>Refunds are subject to our refund policy</li>
                    <li>You are responsible for all applicable taxes</li>
                    <li>Services may be suspended for non-payment</li>
                  </ul>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Limitation of Liability</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    To the maximum extent permitted by law, we shall not be liable for:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Indirect, incidental, or consequential damages</li>
                    <li>Loss of profits, data, or business opportunities</li>
                    <li>Service interruptions or technical issues</li>
                    <li>Third-party actions or content</li>
                    <li>Force majeure events beyond our control</li>
                  </ul>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Termination</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    Either party may terminate this agreement:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>At any time with proper notice</li>
                    <li>Immediately for breach of terms</li>
                    <li>For non-payment of fees</li>
                    <li>For violation of acceptable use policies</li>
                  </ul>
                  <p className="mt-4">
                    Upon termination, your access to the service will be discontinued and data may be deleted
                    according to our data retention policy.
                  </p>
                </div>
              </div>

              <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border`}>
                <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>Contact Information</h2>
                <div className={`space-y-4 ${themeConfig.styleClasses.text.secondary}`}>
                  <p>
                    For questions about these Terms of Service, please contact us:
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
