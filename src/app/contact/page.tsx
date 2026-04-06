'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white selection:bg-blue-500/30">
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
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl mb-6">
                  Contact <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">Us</span>
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-300 max-w-2xl mx-auto">
                  We're here to help! Get in touch with us for any questions, support needs, or just to say hello.
                </p>
              </motion.div>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Contact Info Column */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="space-y-8"
              >
                {/* Email Card */}
                <div className="relative group rounded-3xl bg-gray-900/50 p-8 border border-gray-800 hover:border-blue-500/50 transition-colors duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative flex items-start gap-6">
                    <div className="inline-flex p-3 rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">Email Us</h3>
                      <p className="text-gray-400 mb-4">Our team is ready to answer your questions via email.</p>
                      <a href="mailto:support@knotie-ai.pro" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        support@knotie-ai.pro
                      </a>
                    </div>
                  </div>
                </div>

                {/* Phone Card */}
                <div className="relative group rounded-3xl bg-gray-900/50 p-8 border border-gray-800 hover:border-purple-500/50 transition-colors duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative flex items-start gap-6">
                    <div className="inline-flex p-3 rounded-xl bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">Call Us</h3>
                      <p className="text-gray-400 mb-4">Mon-Fri from 9am to 6pm GMT.</p>
                      <a href="tel:+448085013800" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                        +44 808 501 3800
                      </a>
                    </div>
                  </div>
                </div>

                {/* Office Card */}
                <div className="relative group rounded-3xl bg-gray-900/50 p-8 border border-gray-800 hover:border-cyan-500/50 transition-colors duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-teal-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative flex items-start gap-6">
                    <div className="inline-flex p-3 rounded-xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">Visit Us</h3>
                      <p className="text-gray-400">
                        <span className="block font-semibold text-gray-300 mb-1">SONTI LTD</span>
                        Suite A 82 James Carter Road<br />
                        Mildenhall, Ipswich, IP28 7DE<br />
                        United Kingdom
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Contact Form Column */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="relative rounded-3xl bg-white/5 p-8 sm:p-10 border border-white/10 shadow-2xl backdrop-blur-sm"
              >
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">Send us a message</h3>
                  <p className="text-gray-400">Fill out the form below and we'll get back to you as soon as possible.</p>
                </div>

                <form className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="first-name" className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                      <input
                        type="text"
                        id="first-name"
                        className="block w-full rounded-xl border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label htmlFor="last-name" className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                      <input
                        type="text"
                        id="last-name"
                        className="block w-full rounded-xl border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                    <input
                      type="email"
                      id="email"
                      className="block w-full rounded-xl border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                    <textarea
                      id="message"
                      rows={4}
                      className="block w-full rounded-xl border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                      placeholder="How can we help you?"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-200"
                  >
                    Send Message
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
