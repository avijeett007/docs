'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Search, Users, Bot, ArrowRight, Code2, BookOpen, ExternalLink, Sparkles, MessageSquare, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';
import HelpFAQStructuredData from '@/components/seo/HelpFAQStructuredData';

const faqs = [
  {
    question: "What is Knotie-AI Pro?",
    answer: "Knotie-AI Pro is an advanced Voice AI Agent platform that helps businesses automate and enhance their customer communications through intelligent voice interactions."
  },
  {
    question: "How do I get started?",
    answer: "Sign up for an account, choose your plan, and follow our quick setup guide to create your first Voice AI Agent. Visit our comprehensive documentation at docs.knotie-ai.pro for detailed steps, tutorials, and integration guides."
  },
  {
    question: "What types of businesses can use Knotie-AI Pro?",
    answer: "Our platform is designed for businesses of all sizes across various industries, including healthcare, finance, retail, and technology sectors."
  },
  {
    question: "How secure is the platform?",
    answer: "We implement enterprise-grade security measures, including end-to-end encryption, secure data storage, and regular security audits to protect your data."
  },
  {
    question: "What languages are supported?",
    answer: "Currently, we support English with plans to add more languages in the future. Contact us for specific language requirements."
  },
  {
    question: "Where can I find detailed documentation?",
    answer: "Our comprehensive documentation is available at docs.knotie-ai.pro. It includes getting started guides, API references, tutorials, architecture overviews, and step-by-step instructions for all platform features. The documentation is always up-to-date and fully searchable."
  }
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black transition-colors duration-500">
      <HelpFAQStructuredData />
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

        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-7xl">
            
            {/* Header */}
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl mb-6">
                  Help <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">Center</span>
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                  Find answers to your questions and get the support you need
                </p>
              </motion.div>
            </div>

            {/* Search Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mx-auto max-w-2xl mb-20"
            >
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-12 pr-4 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl leading-5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xl"
                    placeholder="Search help articles..."
                  />
                </div>
              </div>
            </motion.div>

            {/* Documentation Highlight */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-20"
            >
              <div className="relative overflow-hidden rounded-3xl bg-gray-900 px-6 py-12 shadow-2xl sm:px-12 lg:px-16 border border-gray-800">
                <div className="absolute top-0 left-0 -z-10 h-full w-full bg-gradient-to-br from-gray-800/50 to-black" />
                <div className="absolute top-0 right-0 -z-10 h-full w-full opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500 via-purple-500 to-transparent" />
                
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-2xl mb-6 ring-1 ring-blue-500/20">
                    <BookOpen className="h-8 w-8 text-blue-400" />
                  </div>
                  
                  <div className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1 text-sm text-blue-400 mb-6">
                    <Sparkles className="h-3 w-3 mr-2" />
                    Comprehensive Documentation Available
                  </div>

                  <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
                    Complete Platform Documentation
                  </h2>
                  <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
                    Access our comprehensive documentation site with detailed guides, tutorials,
                    API references, architecture overviews, and step-by-step instructions for all platform features.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <a
                      href="https://docs.knotie-ai.pro"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200"
                    >
                      Visit Documentation Site
                      <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-gray-900 transition-colors" />
                    </a>
                    <Link
                      href="/docs"
                      className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/5 text-white rounded-xl font-semibold hover:bg-white/10 border border-white/10 transition-all duration-200"
                    >
                      <Code2 className="h-4 w-4" />
                      API Reference
                    </Link>
                  </div>

                  <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                      <span>Always Up-to-Date</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                      <span>Searchable Content</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                      <span>Step-by-Step Guides</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Support Options */}
            <div className="grid md:grid-cols-2 gap-8 mb-20">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="group relative p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="inline-flex p-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 mb-6">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Customers</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Access customer-specific resources and support through your dashboard.
                    Our AI chatbot is available 24/7 to assist with your queries.
                  </p>
                  <Link
                    href="/partner/login"
                    className="inline-flex items-center text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition-colors"
                  >
                    Partner Login <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="group relative p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="inline-flex p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mb-6">
                    <LifeBuoy className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Partners</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Developer partners can access specialized resources and support
                    through the partner portal in their dashboard.
                  </p>
                  <Link
                    href="/partner/login"
                    className="inline-flex items-center text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-colors"
                  >
                    Partner Portal <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>
            </div>

            {/* FAQs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-20"
            >
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                  Frequently Asked Questions
                </h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {faqs.map((faq, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ y: -5 }}
                    className="rounded-2xl bg-white dark:bg-gray-800/50 p-8 shadow-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500/30 transition-all duration-300"
                  >
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                      {faq.question}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* AI Chat Teaser */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-2xl text-center"
            >
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl mb-6 ring-1 ring-blue-500/20">
                <Bot className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                AI Support Assistant Coming Soon
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                We're working on an AI chatbot to provide instant support through your dashboard.
                Stay tuned for updates!
              </p>
            </motion.div>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
