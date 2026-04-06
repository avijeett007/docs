'use client';

import React from 'react';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import GHLIntegration from '@/components/integrations/GHLIntegration';
import { FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';

export default function GHLIntegrationPage() {
  return (
    <WhitelabelLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <Link 
            href="/whitelabel/integration"
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-6"
          >
            <FiArrowLeft className="h-4 w-4 mr-2" />
            Back to Integrations
          </Link>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-3">GoHighLevel Integration</h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Connect your GoHighLevel account to enable calendar booking and CRM management capabilities for your AI agents.
            </p>
          </div>
        </div>

        {/* GHL Integration Component */}
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <GHLIntegration onConfigurationChange={() => {
              // Optionally refresh or redirect after configuration
            }} />
          </div>
        </div>

        {/* Features */}
        <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-xl border border-gray-700/50 p-8 backdrop-blur-sm">
          <h3 className="text-xl font-semibold text-white mb-6 text-center">What you can do with GoHighLevel</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-blue-400 mt-2"></div>
              <div>
                <h4 className="text-white font-medium mb-1">Calendar Management</h4>
                <p className="text-gray-400 text-sm">Book appointments, check availability, and manage calendar events</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-green-400 mt-2"></div>
              <div>
                <h4 className="text-white font-medium mb-1">Contact Management</h4>
                <p className="text-gray-400 text-sm">Access and update contact information and lead data</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-purple-400 mt-2"></div>
              <div>
                <h4 className="text-white font-medium mb-1">Automated Workflows</h4>
                <p className="text-gray-400 text-sm">Trigger campaigns and automation sequences</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-orange-400 mt-2"></div>
              <div>
                <h4 className="text-white font-medium mb-1">Real-time Updates</h4>
                <p className="text-gray-400 text-sm">Get instant notifications and data synchronization</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WhitelabelLayout>
  );
}
