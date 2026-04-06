'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import SimplifiedSignupModal from '@/components/SimplifiedSignupModal';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';
import { benefitsConfig } from '@/config/benefits';

export default function BenefitsPage() {
  const router = useRouter();
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black transition-colors duration-500">
      <PublicHeader />

      <main className="relative isolate">
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

          <div className="mx-auto max-w-4xl py-16 sm:py-24 lg:py-28 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
              Built for Agency
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent"> Growth</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Discover why agencies choose Knotie AI Pro to scale voice automation, improve margins,
              and deliver measurable client outcomes from a single platform.
            </p>

            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => setIsSignupModalOpen(true)}
                className="rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 px-6 py-3 text-base font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5 inline" />
              </button>
              <button
                onClick={() => router.push('/pricing')}
                className="text-base font-semibold leading-6 text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                View Pricing <span aria-hidden="true">&gt;</span>
              </button>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                {benefitsConfig.title}
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Outcome-driven benefits that help agencies retain clients, streamline operations,
                and scale revenue without increasing delivery overhead.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {benefitsConfig.benefits.map((benefit) => (
                <div
                  key={benefit.number}
                  className="h-full rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-700"
                >
                  <div className="text-sm font-semibold text-blue-500 dark:text-blue-400 mb-3">
                    {benefit.number}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm leading-6">
                    {benefit.description}
                  </p>
                  <div className="space-y-2">
                    {benefit.stats.map((stat) => (
                      <div
                        key={stat}
                        className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{stat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24 px-6 lg:px-8 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to turn these benefits into growth?
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/90">
              Launch your agency voice AI offer with white-label control and transparent pricing.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => setIsSignupModalOpen(true)}
                className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-blue-600 shadow-lg hover:bg-gray-100 transition-all duration-200"
              >
                Start Now
                <ArrowRight className="ml-2 h-5 w-5 inline" />
              </button>
              <button
                onClick={() => router.push('/partner/login')}
                className="text-base font-semibold leading-6 text-white hover:text-gray-100 transition-colors"
              >
                Partner Login <span aria-hidden="true">&gt;</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <SimplifiedSignupModal 
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
      />
    </div>
  );
}
