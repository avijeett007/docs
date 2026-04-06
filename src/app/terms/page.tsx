'use client';

import React from 'react';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';

export default function TermsPage() {
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
              Terms of Service
            </h1>

            <div className="prose prose-lg prose-invert mx-auto">
              <div className="text-sm text-gray-400 mb-8 text-right">
                Last Updated: {new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})}
              </div>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">1. Introduction and Acceptance</h2>
                <p className="mb-4">
                  Welcome to Knotie-AI Pro. These Terms of Service ("Terms") govern your access to and use of the Knotie-AI Pro platform,
                  including any associated websites, APIs, and services (collectively, the "Service").
                </p>
                <p className="mb-4">
                  By accessing or using our Service, you agree to be bound by these Terms. If you are using the Service on behalf of an
                  organization, you represent that you have the authority to bind that organization, and these Terms apply to that organization.
                </p>
                <p>
                  If you do not agree with any part of these Terms, you may not access or use our Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">2. Service Description</h2>
                <p className="mb-4">
                  Knotie-AI Pro is a platform for Voice AI Agencies that enables the integration and onboarding of customers and AI agents
                  through different platforms like VAPI, Retell, ElevenLabs, and others. Our services include:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Voice AI agent management and deployment</li>
                  <li>Multi-platform integration with various voice AI providers</li>
                  <li>Analytics processing for transcription data</li>
                  <li>White-labeled customer portals for agencies</li>
                  <li>Customizable pricing and markup capabilities</li>
                </ul>
                <p className="mt-4">
                  The specific features and functionality available to you depend on your subscription plan and role
                  (partner/agency or customer).
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">3. Account Registration and Security</h2>
                <p className="mb-4">
                  To access certain features of the Service, you must register for an account. You agree to provide accurate,
                  current, and complete information during the registration process and to update such information to keep it
                  accurate, current, and complete.
                </p>
                <p className="mb-4">
                  You are responsible for:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Safeguarding your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Promptly notifying us of any unauthorized use of your account</li>
                  <li>Ensuring the security of API keys and other sensitive credentials</li>
                </ul>
                <p className="mt-4">
                  We reserve the right to disable any user account if we believe you have violated these Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">4. Partner-Customer Relationship</h2>
                <p className="mb-4">
                  Our platform operates on a multi-tenant model where agencies (partners) can manage their customers:
                </p>
                <h3 className="text-xl font-semibold mb-2">4.1 Partner Responsibilities</h3>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Partners are responsible for their customers' compliance with these Terms</li>
                  <li>Partners must obtain appropriate consent from their customers for data processing</li>
                  <li>Partners must maintain the confidentiality of their customers' information</li>
                  <li>Partners are responsible for setting appropriate pricing for their customers</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">4.2 Customer Access</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Customers may access the Service through their partner's portal</li>
                  <li>Customer data is segregated and only accessible to the partner that manages that customer</li>
                  <li>Customers must comply with these Terms and any additional terms set by their partner</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">5. White-Labeling Terms</h2>
                <p className="mb-4">
                  Our platform offers white-labeling capabilities for partners to provide branded experiences to their customers:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Partners may customize the appearance of customer portals with their branding</li>
                  <li>Partners may use custom domains or subdomains for customer access</li>
                  <li>Partners may not remove or obscure Knotie-AI Pro's underlying copyright notices or attributions in the platform code</li>
                  <li>Partners are responsible for ensuring their branding and customizations comply with applicable laws</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">6. Usage Rights and Limitations</h2>
                <h3 className="text-xl font-semibold mb-2">6.1 License Grant</h3>
                <p className="mb-4">
                  Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable,
                  non-sublicensable license to access and use the Service for your internal business purposes.
                </p>

                <h3 className="text-xl font-semibold mb-2">6.2 Restrictions</h3>
                <p className="mb-4">You may not:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Reverse engineer, decompile, or disassemble the Service</li>
                  <li>Attempt to gain unauthorized access to the Service or its related systems</li>
                  <li>Use the Service to store or transmit malicious code or infringing material</li>
                  <li>Interfere with or disrupt the integrity or performance of the Service</li>
                  <li>Create a competing product using ideas, features, or functions similar to the Service</li>
                  <li>Exceed usage limits or API call volumes specified in your subscription plan</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">6.3 API Usage and Rate Limits</h3>
                <p className="mb-4">
                  Use of our APIs is subject to rate limits and other restrictions as specified in our documentation.
                  We reserve the right to throttle or block API access that exceeds reasonable usage patterns.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">7. Third-Party Integrations</h2>
                <p className="mb-4">
                  Our Service integrates with third-party voice AI platforms and other services. When using these integrations:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You are responsible for complying with the terms of service of those third-party services</li>
                  <li>You must provide valid API credentials for any third-party services you wish to use</li>
                  <li>We are not responsible for the availability or functionality of third-party services</li>
                  <li>You acknowledge that we may transmit data to these third-party services on your behalf</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">8. Pricing and Payment</h2>
                <h3 className="text-xl font-semibold mb-2">8.1 Subscription Plans</h3>
                <p className="mb-4">
                  We offer various subscription plans with different features and usage limits. The fees for each plan
                  are as specified on our pricing page or in a separate agreement with you.
                </p>

                <h3 className="text-xl font-semibold mb-2">8.2 Partner Markup Pricing</h3>
                <p className="mb-4">
                  Partners may set custom markup pricing for their customers. Partners are responsible for:
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Setting appropriate pricing for their customers</li>
                  <li>Communicating pricing terms to their customers</li>
                  <li>Managing billing relationships with their customers</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">8.3 Payment Terms</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>All fees are exclusive of taxes unless stated otherwise</li>
                  <li>Payments are due according to the billing cycle specified in your subscription plan</li>
                  <li>We may suspend access to the Service if payments are not received when due</li>
                  <li>All fees are non-refundable unless required by law or stated otherwise in these Terms</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">9. Intellectual Property Rights</h2>
                <h3 className="text-xl font-semibold mb-2">9.1 Our Intellectual Property</h3>
                <p className="mb-4">
                  The Service, including its software, design, text, graphics, and other content, is owned by us and is protected
                  by copyright, trademark, and other intellectual property laws. These Terms do not grant you any rights to our
                  trademarks, logos, or other brand features.
                </p>

                <h3 className="text-xl font-semibold mb-2">9.2 Your Content</h3>
                <p className="mb-4">
                  You retain ownership of any content you upload to the Service. You grant us a worldwide, non-exclusive,
                  royalty-free license to use, reproduce, modify, and distribute your content solely for the purpose of
                  providing and improving the Service.
                </p>

                <h3 className="text-xl font-semibold mb-2">9.3 AI Model Training</h3>
                <p>
                  By using our Service, you grant us permission to use voice interactions and feedback to improve our AI models.
                  We ensure all data used for training is anonymized and protected according to our Privacy Policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">10. Prohibited Uses</h2>
                <p className="mb-4">
                  You may not use the Service for any purpose that is unlawful or prohibited by these Terms. Prohibited uses include:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Impersonating individuals without their consent</li>
                  <li>Engaging in fraudulent or deceptive practices</li>
                  <li>Harassing, threatening, or intimidating others</li>
                  <li>Creating or distributing spam or unwanted communications</li>
                  <li>Collecting or harvesting personal information without consent</li>
                  <li>Violating the privacy or intellectual property rights of others</li>
                  <li>Using voice AI technology to spread misinformation or engage in political manipulation</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">11. Service Level Agreement</h2>
                <p className="mb-4">
                  We strive to maintain high availability and performance of the Service:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>We target 99.9% uptime for the Voice AI platform, excluding scheduled maintenance</li>
                  <li>We aim to respond to support requests within 24 hours during business days</li>
                  <li>We perform regular maintenance and updates with advance notice when possible</li>
                  <li>We maintain disaster recovery and backup procedures to protect your data</li>
                </ul>
                <p className="mt-4">
                  Specific service level commitments may vary based on your subscription plan.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">12. Compliance and Security</h2>
                <p className="mb-4">
                  We implement reasonable security measures to protect your data:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>We encrypt sensitive data both in transit and at rest</li>
                  <li>We regularly review and update our security practices</li>
                  <li>We maintain incident response procedures for potential security breaches</li>
                  <li>We comply with applicable data protection regulations</li>
                </ul>
                <p className="mt-4">
                  You are responsible for ensuring your use of the Service complies with all applicable laws and regulations.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">13. Limitation of Liability</h2>
                <p className="mb-4">
                  To the maximum extent permitted by law:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>We provide the Service "as is" without warranties of any kind, either express or implied</li>
                  <li>We are not liable for any indirect, incidental, special, consequential, or punitive damages</li>
                  <li>Our total liability for any claim arising from or related to these Terms shall not exceed the amount
                      paid by you to us in the 12 months preceding the claim</li>
                  <li>We are not liable for any loss or damage resulting from your use of third-party integrations</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">14. Indemnification</h2>
                <p>
                  You agree to indemnify, defend, and hold harmless Knotie-AI Pro and its officers, directors, employees, and agents
                  from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees,
                  arising from or relating to your use of the Service, your violation of these Terms, or your violation of any rights
                  of another.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">15. Termination</h2>
                <p className="mb-4">
                  Either party may terminate these Terms:
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Partners may terminate with 30 days written notice</li>
                  <li>Customers may terminate according to their agreement with their partner</li>
                  <li>We may terminate immediately if you violate these Terms</li>
                </ul>
                <p className="mb-4">
                  Upon termination:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You must cease use of the Service and remove all integrations</li>
                  <li>You remain liable for any outstanding fees</li>
                  <li>Data retention and deletion policies will apply as per our Privacy Policy</li>
                  <li>Sections of these Terms that by their nature should survive termination will survive</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">16. Dispute Resolution</h2>
                <p>
                  Any dispute arising from these Terms shall be resolved through good faith negotiations. If negotiations fail,
                  the dispute shall be submitted to binding arbitration in accordance with the rules of the London Court of International
                  Arbitration (LCIA). The arbitration shall take place in London, United Kingdom, and the language of arbitration shall be English.
                  The decision of the arbitrator shall be final and binding.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">17. Governing Law</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of England and Wales, without regard
                  to its conflict of law provisions. The United Nations Convention on Contracts for the International Sale of Goods
                  does not apply to these Terms.
                </p>
                <p className="mt-4">
                  If you are a consumer, you will benefit from any mandatory provisions of the law of the country in which you are resident.
                  Nothing in these Terms affects your rights as a consumer to rely on such mandatory provisions of local law.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">18. Changes to Terms</h2>
                <p>
                  We may update these Terms from time to time. We will notify you of any significant changes by posting the new Terms
                  on our website and, where appropriate, by email. Your continued use of the Service after such changes constitutes
                  your acceptance of the new Terms. If you do not agree to the changes, you must stop using the Service.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
