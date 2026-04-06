'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';
import SimplifiedPricingSection from '@/components/landing/SimplifiedPricingSection';
import PricingStructuredData from '@/components/seo/PricingStructuredData';
import SimplifiedSignupModal from '@/components/SimplifiedSignupModal';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function PricingPage() {
  const router = useRouter();
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  const benefits = [
    'No credit card required to start',
    'Cancel anytime, no questions asked',
    'Dedicated support for all paid plans',
    'White-label ready from day one',
    'Seamless migration assistance',
    'Regular feature updates included'
  ];

  return (
    <>
      <PricingStructuredData />
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black transition-colors duration-500">
        <PublicHeader />
      
      {/* Hero Section */}
      <section className="relative isolate px-6 pt-14 lg:px-8">
        <div
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>

        <div className="mx-auto max-w-4xl py-16 sm:py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
              Plans That{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                Scale With You
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Start free and grow at your own pace. Every plan includes white-label capabilities, 
              multi-provider integration, and enterprise-grade security. No hidden fees, no surprises.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-8 px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-center gap-3 text-gray-700 dark:text-gray-300"
              >
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-8 px-6 lg:px-8">
        <SimplifiedPricingSection />
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-24 px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need to know about our pricing and plans
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="group bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 className="w-6 h-6 text-cyan-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Can I switch plans anytime?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                    and we'll prorate any charges or credits.
                  </p>
                </div>
              </div>
            </div>

            <div className="group bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    What payment methods do you accept?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    We accept all major credit cards (Visa, Mastercard, American Express) and support 
                    Stripe for secure payment processing.
                  </p>
                </div>
              </div>
            </div>

            <div className="group bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 className="w-6 h-6 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Is there a setup fee?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    No setup fees, ever. You only pay for your monthly or annual subscription. 
                    We also provide free migration assistance for all paid plans.
                  </p>
                </div>
              </div>
            </div>

            <div className="group bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 className="w-6 h-6 text-teal-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    What's included in the Free Forever plan?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    The Free Forever plan includes up to 2 customers, unlimited Knova agents, 
                    subdomain white-label portal, and community support. Perfect for testing the platform.
                  </p>
                </div>
              </div>
            </div>

            <div className="group bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Do you offer custom enterprise plans?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    Yes! For agencies with unique requirements, we offer custom enterprise plans with 
                    dedicated support, custom integrations, and volume discounts. Contact our sales team to discuss.
                  </p>
                </div>
              </div>
            </div>

            <div className="group bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 className="w-6 h-6 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    What happens if I exceed my customer limit?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    We'll notify you when you're approaching your limit. You can easily upgrade to a higher 
                    tier to add more customers. No service interruption.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-6 lg:px-8 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to Transform Your Agency?
          </h2>
          <p className="mt-6 text-lg leading-8 text-white/90">
            Start with our Free Forever plan and scale as you grow. No credit card required.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <button
              onClick={() => setIsSignupModalOpen(true)}
              className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-blue-600 shadow-lg hover:bg-gray-100 transition-all duration-200"
            >
              Start Free Now
              <ArrowRight className="ml-2 h-5 w-5 inline" />
            </button>
            <button
              onClick={() => router.push('/partners')}
              className="text-base font-semibold leading-6 text-white hover:text-gray-100 transition-colors"
            >
              Talk to Sales <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

        <Footer />
      </div>

      <SimplifiedSignupModal 
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
      />
    </>
  );
}
