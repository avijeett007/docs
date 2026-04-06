'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Building, Users, Lightbulb, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';

export default function AboutPage() {
  const router = useRouter();

  const stats = [
    { label: 'Global Partners', value: '500+' },
    { label: 'Calls Processed', value: '1M+' },
    { label: 'Uptime', value: '99.9%' },
    { label: 'Client Satisfaction', value: '4.9/5' },
  ];

  const values = [
    {
      icon: Building,
      title: "Industry Expertise",
      description: "Our business partners bring decades of industry experience across various sectors, ensuring our solutions solve real-world problems.",
      gradient: "from-cyan-400 to-blue-500",
      bgGradient: "bg-blue-500"
    },
    {
      icon: Users,
      title: "Customer-Centric",
      description: "We solve real problems faced by businesses in their day-to-day interactions, guided by direct feedback from our partner network.",
      gradient: "from-blue-500 to-purple-600",
      bgGradient: "bg-purple-600"
    },
    {
      icon: Lightbulb,
      title: "Continuous Innovation",
      description: "Our partners help us stay ahead of market trends, allowing us to continuously iterate and improve our AI voice technologies.",
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
                Transforming Business <br />
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Communication
                </span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                We are revolutionizing how businesses interact with their customers through advanced Voice AI technology. 
                Our mission is to make intelligent communication accessible to businesses of all sizes.
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

        {/* Approach Section */}
        <div className="relative isolate px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-base font-semibold leading-7 text-blue-600 dark:text-blue-400">Our Approach</h2>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                Business Partner Guided Development
              </h2>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                We are guided by industry experts and businesses worldwide who act as our partners. 
                They bring real-world challenges and insights that help shape our product to meet actual market needs.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <motion.div
                    key={value.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="relative group h-full rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700"
                  >
                    <div className={`inline-flex rounded-lg p-3 bg-gradient-to-br ${value.gradient} bg-opacity-10 mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      {value.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      {value.description}
                    </p>
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
              Ready to shape the future?
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/90">
              Join us as a partner and help build the next generation of voice AI solutions while growing your business.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => router.push('/partners')}
                className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-blue-600 shadow-lg hover:bg-gray-100 transition-all duration-200 flex items-center gap-2 group"
              >
                Become a Partner
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => router.push('/contact')}
                className="text-base font-semibold leading-6 text-white hover:text-gray-100 transition-colors"
              >
                Contact Sales <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
