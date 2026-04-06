'use client';

import React, { useEffect } from 'react';
import { ExternalLink, BookOpen, ArrowRight } from 'lucide-react';
import { Metadata } from 'next';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';

export default function BlogRedirectPage() {
  useEffect(() => {
    // Redirect to external documentation site after a short delay
    const timer = setTimeout(() => {
      window.location.href = 'https://docs.knotie-ai.pro';
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

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
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full mb-8">
                <BookOpen className="h-10 w-10 text-white" />
              </div>

              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
                Blog Has Moved!
              </h1>

              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Our blog and all documentation have been moved to our comprehensive documentation site
                for a better reading experience.
              </p>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-8 mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                  <span className="text-blue-200">Redirecting you automatically in 3 seconds...</span>
                </div>

                <p className="text-gray-300 mb-6">
                  You'll be taken to our new documentation site where you can find:
                </p>

                <div className="grid md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto mb-6">
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                    <span>Latest blog posts and updates</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                    <span>Comprehensive guides</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="h-2 w-2 bg-teal-400 rounded-full"></div>
                    <span>API documentation</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="h-2 w-2 bg-purple-400 rounded-full"></div>
                    <span>Architecture overviews</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="https://docs.knotie-ai.pro"
                  className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold rounded-lg
                          hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105
                          relative overflow-hidden inline-flex items-center shadow-lg"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-teal-600 opacity-0
                                 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center justify-center gap-3">
                    <BookOpen className="h-5 w-5" />
                    Visit Documentation Site
                    <ExternalLink className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </a>

                <a
                  href="/"
                  className="px-8 py-4 border border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white
                           transition-all duration-300 rounded-lg inline-flex items-center gap-2"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  Back to Home
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
