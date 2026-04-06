'use client';

import React, { useEffect } from 'react';
import { ExternalLink, BookOpen, ArrowRight } from 'lucide-react';

interface Props {
  params: {
    slug: string;
  };
}

export default function PartnerDocPage({ params }: Props) {
  useEffect(() => {
    // Redirect to external documentation site after a short delay
    const timer = setTimeout(() => {
      window.location.href = `https://docs.knotie-ai.pro/partners/${params.slug}`;
    }, 2000);

    return () => clearTimeout(timer);
  }, [params.slug]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full mb-6">
          <BookOpen className="h-8 w-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Documentation Moved
        </h1>

        <p className="text-gray-600 dark:text-gray-300 mb-6">
          This documentation has been moved to our comprehensive docs site.
          You'll be redirected automatically in 2 seconds.
        </p>

        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span className="text-blue-600 dark:text-blue-400">Redirecting...</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`https://docs.knotie-ai.pro/partners/${params.slug}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Go to Documentation
            <ExternalLink className="h-4 w-4" />
          </a>

          <a
            href="/partner"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
