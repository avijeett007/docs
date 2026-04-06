'use client';

import React from 'react';
import { FiCode, FiClock, FiPlus, FiSettings } from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';

export default function CustomToolsIntegration() {
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  return (
    <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-xl border border-gray-700/50 p-8 backdrop-blur-sm hover:border-gray-600/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center border border-green-500/30">
            <FiCode className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Custom Tools</h3>
            <p className="text-gray-400">Build your own tool integrations</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
          <FiClock className="h-4 w-4 text-amber-400" />
          <span className="text-amber-300 text-sm font-medium">Coming Soon</span>
        </div>
      </div>

      <div className="text-center py-12">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center border border-green-500/30">
          <FiCode className="h-10 w-10 text-green-400" />
        </div>
        <h4 className="text-2xl font-semibold text-white mb-3">Custom Tool Builder</h4>
        <p className="text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
          Create custom tool integrations using OpenAPI specifications.
          Connect your AI agents to any REST API or internal system with powerful automation capabilities.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
              <FiPlus className="h-6 w-6 text-blue-400" />
            </div>
            <div className="text-lg font-semibold text-white mb-2">OpenAPI Import</div>
            <div className="text-sm text-gray-400 leading-relaxed">
              Import existing API specifications and automatically generate tool integrations
            </div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-4 border border-purple-500/30">
              <FiSettings className="h-6 w-6 text-purple-400" />
            </div>
            <div className="text-lg font-semibold text-white mb-2">Visual Builder</div>
            <div className="text-sm text-gray-400 leading-relaxed">
              Build tools with intuitive drag & drop interface and visual workflow designer
            </div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4 border border-green-500/30">
              <FiCode className="h-6 w-6 text-green-400" />
            </div>
            <div className="text-lg font-semibold text-white mb-2">Code Editor</div>
            <div className="text-sm text-gray-400 leading-relaxed">
              Advanced customization with full code editor and debugging capabilities
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-xl p-6 mb-8 border border-gray-700/50 backdrop-blur-sm">
          <div className="text-lg font-semibold text-white mb-4 text-center">Supported Features</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span>REST API Integration</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span>Authentication Methods</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              <span>Request/Response Mapping</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-orange-400"></div>
              <span>Error Handling</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-pink-400"></div>
              <span>Rate Limiting</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
              <span>Webhook Support</span>
            </div>
          </div>
        </div>

        <button
          disabled
          className="px-8 py-4 rounded-xl text-gray-400 font-semibold bg-gradient-to-r from-gray-700/50 to-gray-800/50 cursor-not-allowed border border-gray-600/30 backdrop-blur-sm"
        >
          Available Soon
        </button>

        <p className="text-sm text-gray-500 mt-6 max-w-md mx-auto leading-relaxed">
          Custom tool builder will be available in the next release. Get notified when it's ready by contacting support.
        </p>
      </div>
    </div>
  );
}
