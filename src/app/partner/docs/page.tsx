'use client';

import React, { useEffect } from 'react';
import { ExternalLink, BookOpen, ArrowRight, FileText, Users, Settings } from 'lucide-react';

export default function PartnerDocs() {
  useEffect(() => {
    // Redirect to external documentation site after a short delay
    const timer = setTimeout(() => {
      window.location.href = 'https://docs.knotie-ai.pro/partners';
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full mb-8">
            <BookOpen className="h-10 w-10 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
            Partner Documentation Has Moved!
          </h1>

          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            All partner documentation has been moved to our comprehensive documentation site
            for a better experience with enhanced search and navigation.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-8 mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="text-blue-700 dark:text-blue-300">Redirecting you automatically in 3 seconds...</span>
            </div>

            <p className="text-gray-700 dark:text-gray-300 mb-6">
              You'll find comprehensive partner documentation including:
            </p>

            <div className="grid md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto mb-6">
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <FileText className="h-5 w-5 text-blue-500" />
                <span>API Integration Guides</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <Users className="h-5 w-5 text-green-500" />
                <span>Customer Management</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <Settings className="h-5 w-5 text-purple-500" />
                <span>Platform Configuration</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://docs.knotie-ai.pro/partners"
              className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold rounded-lg
                      hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105
                      relative overflow-hidden inline-flex items-center shadow-lg"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-teal-600 opacity-0
                             group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative flex items-center justify-center gap-3">
                <BookOpen className="h-5 w-5" />
                Visit Partner Documentation
                <ExternalLink className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </a>

            <a
              href="/partner"
              className="px-8 py-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                       hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-white
                       transition-all duration-300 rounded-lg inline-flex items-center gap-2"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
