'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Code, DollarSign, ArrowRight, Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';

export default function CareersPage() {
  const router = useRouter();

  const stats = [
    { label: 'Revenue Share', value: '70%' },
    { label: 'Global Reach', value: '150+' },
    { label: 'Active Partners', value: '200+' },
    { label: ' YoY Growth', value: '300%' },
  ];

  const benefits = [
    {
      icon: Code,
      title: "Developer Freedom",
      description: "Work independently on your innovations while being part of our ecosystem. Build what you love, when you want.",
      gradient: "from-cyan-400 to-blue-500",
      bgGradient: "bg-blue-500"
    },
    {
      icon: DollarSign,
      title: "Lifetime Earnings",
      description: "Earn revenue for as long as your products are being sold in our marketplace. Create once, earn forever.",
      gradient: "from-blue-500 to-purple-600",
      bgGradient: "bg-purple-600"
    },
    {
      icon: Rocket,
      title: "Priority Access",
      description: "Partners get first access to new opportunities, beta features, and exclusive positions within our network.",
      gradient: "from-purple-600 to-pink-500",
      bgGradient: "bg-pink-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black transition-colors duration-500">
      <PublicHeader />
      
      <main className="relative isolate overflow-hidden">
        {/* Background Gradients */}
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

        {/* Hero Section */}
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl mb-6">
                Join Our Developer <br />
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Partner Network
                </span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                We're revolutionizing the traditional employment model. Instead of just hiring developers,
                we're building a network of developer partners who can contribute and earn through our marketplace.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mx-auto max-w-7xl px-6 lg:px-8 mb-24">
          <motion.dl 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-2 gap-x-8 gap-y-16 text-center lg:grid-cols-4"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="mx-auto flex max-w-xs flex-col gap-y-4">
                <dt className="text-base leading-7 text-gray-600 dark:text-gray-400">{stat.label}</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Partnership Model Section */}
        <div className="relative isolate px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-base font-semibold leading-7 text-blue-600 dark:text-blue-400">Partnership Model</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                Build, Share, and Earn
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                As a developer partner, you can create and offer your insights and subproducts in knotie-ai pro,
                earning lifetime revenue through our marketplace for as long as your product is sold.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <motion.div
                    key={benefit.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="relative group h-full rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700"
                  >
                    <div className={`inline-flex rounded-lg p-3 bg-gradient-to-br ${benefit.gradient} bg-opacity-10 mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      {benefit.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      {benefit.description}
                    </p>
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${benefit.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`} />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <section className="py-16 sm:py-24 px-6 lg:px-8 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to start building?
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/90">
              Join our network of top-tier developers and start earning from your contributions today.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => router.push('/partners')}
                className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-blue-600 shadow-lg hover:bg-gray-100 transition-all duration-200 flex items-center gap-2 group"
              >
                Apply as a Developer Partner
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
