'use client';

import React from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { FiArrowLeft, FiSettings } from 'react-icons/fi';
import Link from 'next/link';

export default function WhitelabelCookiesPage() {
  const { branding } = usePartnerBranding();

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
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiSettings className="text-blue-400 w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Cookie Policy
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Learn about how we use cookies and similar technologies to improve your experience.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </section>

      {/* Cookie Content */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="prose prose-invert max-w-none">
            <div className="space-y-8">
              <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
                <h2 className="text-2xl font-bold mb-4">What Are Cookies?</h2>
                <div className="space-y-4 text-gray-300">
                  <p>
                    Cookies are small text files that are stored on your device when you visit our website. 
                    They help us provide you with a better experience by remembering your preferences and 
                    understanding how you use our service.
                  </p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
                <h2 className="text-2xl font-bold mb-4">Types of Cookies We Use</h2>
                <div className="space-y-6 text-gray-300">
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-white">Essential Cookies</h3>
                    <p>
                      These cookies are necessary for the website to function properly. They enable core 
                      functionality such as security, network management, and accessibility.
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                      <li>Authentication and login status</li>
                      <li>Security and fraud prevention</li>
                      <li>Load balancing and performance</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-white">Functional Cookies</h3>
                    <p>
                      These cookies allow us to remember choices you make and provide enhanced features 
                      and personal content.
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                      <li>Language and region preferences</li>
                      <li>User interface customizations</li>
                      <li>Form data and settings</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-white">Analytics Cookies</h3>
                    <p>
                      These cookies help us understand how visitors interact with our website by collecting 
                      and reporting information anonymously.
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                      <li>Page views and user journeys</li>
                      <li>Performance and error tracking</li>
                      <li>Feature usage statistics</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-white">Marketing Cookies</h3>
                    <p>
                      These cookies are used to track visitors across websites to display relevant 
                      advertisements and measure campaign effectiveness.
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                      <li>Targeted advertising</li>
                      <li>Social media integration</li>
                      <li>Campaign tracking</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
                <h2 className="text-2xl font-bold mb-4">Third-Party Cookies</h2>
                <div className="space-y-4 text-gray-300">
                  <p>
                    We may use third-party services that set cookies on our behalf:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Google Analytics:</strong> For website analytics and performance monitoring</li>
                    <li><strong>Stripe:</strong> For secure payment processing</li>
                    <li><strong>Intercom:</strong> For customer support and communication</li>
                    <li><strong>Social Media Platforms:</strong> For social sharing and login features</li>
                  </ul>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
                <h2 className="text-2xl font-bold mb-4">Managing Your Cookie Preferences</h2>
                <div className="space-y-4 text-gray-300">
                  <p>
                    You have several options for managing cookies:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Browser Settings:</strong> Most browsers allow you to control cookies through their settings</li>
                    <li><strong>Cookie Banner:</strong> Use our cookie consent banner to manage preferences</li>
                    <li><strong>Opt-out Links:</strong> Use third-party opt-out tools for marketing cookies</li>
                    <li><strong>Do Not Track:</strong> We respect browser Do Not Track signals</li>
                  </ul>
                  <p className="mt-4">
                    Please note that disabling certain cookies may affect the functionality of our website 
                    and your user experience.
                  </p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
                <h2 className="text-2xl font-bold mb-4">Cookie Retention</h2>
                <div className="space-y-4 text-gray-300">
                  <p>
                    Different types of cookies are stored for different periods:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
                    <li><strong>Persistent Cookies:</strong> Stored for a specific period (typically 1-2 years)</li>
                    <li><strong>Essential Cookies:</strong> Stored as long as necessary for functionality</li>
                    <li><strong>Analytics Cookies:</strong> Typically stored for 2 years</li>
                  </ul>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
                <h2 className="text-2xl font-bold mb-4">Updates to This Policy</h2>
                <div className="space-y-4 text-gray-300">
                  <p>
                    We may update this Cookie Policy from time to time to reflect changes in our practices 
                    or for other operational, legal, or regulatory reasons. We will notify you of any 
                    material changes by posting the updated policy on our website.
                  </p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
                <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
                <div className="space-y-4 text-gray-300">
                  <p>
                    If you have questions about our use of cookies, please contact us:
                  </p>
                  {branding?.supportEmail && (
                    <p>
                      Email: <a href={`mailto:${branding.supportEmail}`} className="text-blue-400 hover:text-blue-300">
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
