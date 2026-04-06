'use client';

import React from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <PublicHeader />
      <main className="relative isolate">
        {/* Background */}
        <div
          className="absolute inset-x-0 top-4 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
          aria-hidden="true"
        >
          <div
            className="aspect-[1108/632] w-[69.25rem] flex-none bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-20"
            style={{
              clipPath:
                'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)',
            }}
          />
        </div>

        {/* Content */}
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-8 text-center">
              Privacy Policy
            </h1>

            <div className="prose prose-lg prose-invert mx-auto">
              <div className="text-sm text-gray-400 mb-8 text-right">
                Last Updated: {new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})}
              </div>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p>
                  At Knotie-AI Pro, we take your privacy seriously. This Privacy Policy explains how we collect,
                  use, disclose, and safeguard your information when you use our Voice AI Agent platform for agencies
                  and their customers. Our platform enables Voice AI Agencies to integrate and onboard their customers
                  and AI agents through different platforms like VAPI, Retell, ElevenLabs, and others.
                </p>
                <p className="mt-4">
                  By accessing or using our platform, you agree to this Privacy Policy. If you do not agree with any part
                  of this policy, please do not use our services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                <p className="mb-4">We collect the following types of information:</p>

                <h3 className="text-xl font-semibold mb-2">2.1 Account Information</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Partner (Agency) information: name, email, business details, billing information</li>
                  <li>Customer information: name, email, business details, assigned agents</li>
                  <li>User authentication data and account preferences</li>
                  <li>API keys for third-party services (encrypted)</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">2.2 Voice AI Data</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Voice recordings from interactions with AI agents</li>
                  <li>Transcriptions of voice conversations</li>
                  <li>AI agent configuration data and prompts</li>
                  <li>Call metadata (duration, timestamps, status)</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">2.3 Analytics and Usage Data</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Performance metrics of AI agents</li>
                  <li>Conversation analytics (sentiment, topics, key moments)</li>
                  <li>Platform usage statistics</li>
                  <li>Feature utilization data</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">2.4 Technical Information</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Device information (type, operating system, browser)</li>
                  <li>IP address and location data</li>
                  <li>Log data and error reports</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>

                <h3 className="text-xl font-semibold mb-2">3.1 Service Provision and Improvement</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>To provide and maintain our Voice AI platform</li>
                  <li>To process and complete transactions</li>
                  <li>To improve and personalize user experience</li>
                  <li>To develop new features, products, and services</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">3.2 Analytics Processing</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>To analyze transcription data for insights and reporting</li>
                  <li>To generate performance metrics for AI agents</li>
                  <li>To create aggregated usage statistics</li>
                  <li>To monitor and improve system performance</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">3.3 Communication</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>To communicate with you about your account or transactions</li>
                  <li>To provide technical support and respond to inquiries</li>
                  <li>To send updates, security alerts, and administrative messages</li>
                  <li>To deliver marketing communications (with consent)</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">3.4 Security and Compliance</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>To verify identity and prevent fraud</li>
                  <li>To protect the security of our platform</li>
                  <li>To monitor for and prevent prohibited activities</li>
                  <li>To comply with legal obligations</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">4. Third-Party Integrations</h2>
                <p className="mb-4">
                  Our platform integrates with various third-party Voice AI services. When you connect these services:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>We store your API keys in an encrypted format and never share them with unauthorized parties</li>
                  <li>Data may be transmitted to these third-party services to facilitate voice AI functionality</li>
                  <li>Voice recordings and transcriptions may be processed by these integrated services</li>
                  <li>Each third-party service has its own privacy policy governing how they handle your data</li>
                  <li>We currently support integrations with Retell, VAPI, ElevenLabs, and other voice AI providers</li>
                </ul>
                <p className="mt-4">
                  We recommend reviewing the privacy policies of any third-party services you connect to our platform.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
                <p className="mb-4">We may share your information in the following circumstances:</p>

                <h3 className="text-xl font-semibold mb-2">5.1 Partner-Customer Relationship</h3>
                <p className="mb-4">
                  Our platform operates on a multi-tenant model where agencies (partners) manage their customers:
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Partners can access their customers' agent configurations and analytics</li>
                  <li>Customer data is segregated and only accessible to the partner that manages that customer</li>
                  <li>Partners are responsible for obtaining appropriate consent from their customers</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">5.2 Service Providers</h3>
                <p className="mb-4">
                  We may share data with trusted service providers who help us operate our platform, including:
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Cloud hosting and storage providers</li>
                  <li>Analytics and monitoring services</li>
                  <li>Customer support tools</li>
                  <li>Payment processors</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">5.3 Legal Requirements</h3>
                <p>
                  We may disclose your information if required by law, regulation, legal process, or governmental request.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
                <p className="mb-4">
                  We implement appropriate technical and organizational measures to protect your data:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>All data is encrypted in transit using TLS/SSL protocols</li>
                  <li>Sensitive data (including voice recordings and API keys) is encrypted at rest</li>
                  <li>Access to data is restricted to authorized personnel only</li>
                  <li>Regular security assessments and audits are conducted</li>
                  <li>We maintain incident response procedures for potential data breaches</li>
                </ul>
                <p className="mt-4">
                  While we strive to protect your information, no method of transmission or storage is 100% secure.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
                <p className="mb-4">
                  We retain different types of data for varying periods:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Account information: For as long as your account is active, plus a reasonable period thereafter</li>
                  <li>Voice recordings and transcriptions: According to your data retention settings, typically 30-90 days by default</li>
                  <li>Analytics data: Up to 12 months in identifiable form, and in aggregated form thereafter</li>
                  <li>Technical logs: Typically 30-60 days</li>
                </ul>
                <p className="mt-4">
                  Upon account termination, we will delete or anonymize your data within 90 days, except where retention is required by law.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">8. Your Rights and Choices</h2>
                <p className="mb-4">
                  Depending on your location, you may have certain rights regarding your personal information:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Access and obtain a copy of your data</li>
                  <li>Correct inaccurate or incomplete information</li>
                  <li>Delete your personal information</li>
                  <li>Restrict or object to certain processing activities</li>
                  <li>Data portability (receiving your data in a structured, machine-readable format)</li>
                  <li>Withdraw consent where processing is based on consent</li>
                </ul>
                <p className="mt-4">
                  To exercise these rights, please contact us at <a href="mailto:privacy@knotie-ai.pro" className="text-indigo-400 hover:text-indigo-300">privacy@knotie-ai.pro</a>.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">9. Cookies and Tracking</h2>
                <p className="mb-4">
                  Our platform uses cookies and similar tracking technologies to enhance your experience:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Essential cookies: Required for the platform to function properly</li>
                  <li>Analytical cookies: Help us understand how users interact with our platform</li>
                  <li>Functional cookies: Remember your preferences and settings</li>
                  <li>Marketing cookies: Used to deliver relevant advertisements (with consent)</li>
                </ul>
                <p className="mt-4">
                  You can manage cookie preferences through your browser settings.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
                <p>
                  Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If we learn that we have collected personal information from a child, we will take steps to delete that information promptly.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">11. International Data Transfers</h2>
                <p>
                  We may transfer, store, and process your information in countries other than your own. When we do so, we ensure appropriate safeguards are in place to protect your data and comply with applicable laws.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">12. Changes to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on our website and, where appropriate, by email. Your continued use of our services after such modifications constitutes your acceptance of the updated policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
                <p className="mb-4">
                  If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  <a href="mailto:privacy@knotie-ai.pro" className="text-indigo-400 hover:text-indigo-300">
                    privacy@knotie-ai.pro
                  </a>
                </p>
              </section>
            </div>

            <div className="mt-16 flex justify-center gap-4">
              <button
                onClick={() => router.push('/blog')}
                className="rounded-md bg-indigo-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              >
                Read Our Blog
                <ArrowRight className="ml-2 h-4 w-4 inline" />
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
