'use client';

import React from 'react';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import { FiCode } from 'react-icons/fi';
import ToolIntegrationsGrid from '@/components/integrations/ToolIntegrationsGrid';

export default function IntegrationPage() {

  return (
    <WhitelabelLayout>
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-3">Integration Hub</h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Connect your AI voice agents to external tools and services, or integrate them into your applications
          </p>
        </div>

        {/* Tool Integrations */}
        <div>
          <ToolIntegrationsGrid />
        </div>

        {/* Custom Tools Section */}
        <div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-3">Custom Integrations</h2>
            <p className="text-gray-400 max-w-3xl mx-auto">
              Build custom tool integrations using OpenAPI specifications or connect to any REST API to extend your AI agents' capabilities.
            </p>
          </div>
          <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-xl border border-gray-700/50 p-8 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center border border-green-500/30">
                <FiCode className="h-10 w-10 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Custom Tool Builder</h3>
              <p className="text-gray-400 mb-6 max-w-lg mx-auto">
                Create custom integrations with any API or service. Import OpenAPI specs, build visual workflows, or write custom code.
              </p>
              <div className="flex items-center justify-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 mb-6">
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                <span className="text-amber-300 text-sm font-medium">Coming Soon</span>
              </div>
              <button
                disabled
                className="px-8 py-3 rounded-xl text-gray-400 font-medium bg-gradient-to-r from-gray-700/50 to-gray-800/50 cursor-not-allowed border border-gray-600/30"
              >
                Get Notified
              </button>
            </div>
          </div>
        </div>


      </div>
    </WhitelabelLayout>
  );
}
