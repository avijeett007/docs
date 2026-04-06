'use client';

import React from 'react';
import { useEmbedContext } from '@/hooks/useEmbedContext';
import { EmbedConditional, EmbedAwareButton } from './EmbedAwareNavigation';
import { FiSettings, FiCreditCard, FiUsers, FiKey, FiPhone } from 'react-icons/fi';

interface DashboardAction {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<any>;
  feature?: string;
  description: string;
}

const dashboardActions: DashboardAction[] = [
  {
    id: 'analytics',
    label: 'View Analytics',
    href: '/whitelabel/analytics',
    icon: FiSettings,
    description: 'View detailed analytics and insights',
  },
  {
    id: 'billing',
    label: 'Billing & Payments',
    href: '/whitelabel/billing',
    icon: FiCreditCard,
    feature: 'billing',
    description: 'Manage your billing and payment methods',
  },
  {
    id: 'team-members',
    label: 'Team Members',
    href: '/whitelabel/team-members',
    icon: FiUsers,
    feature: 'team-members',
    description: 'Invite and manage team members',
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    href: '/whitelabel/api-keys',
    icon: FiKey,
    feature: 'api-keys',
    description: 'Generate and manage API keys',
  },
  {
    id: 'phone-numbers',
    label: 'Phone Numbers',
    href: '/whitelabel/phone-numbers',
    icon: FiPhone,
    feature: 'phone-numbers',
    description: 'Manage your phone numbers',
  },
];

export default function EmbedAwareDashboard() {
  const { isEmbedded, accessMode, shouldHideFeature } = useEmbedContext();

  const filteredActions = dashboardActions.filter(action => {
    if (!action.feature) return true;
    return !shouldHideFeature(action.feature);
  });

  return (
    <div className="space-y-6">
      {/* Embed-specific welcome message */}
      <EmbedConditional showInEmbed={true} hideInEmbed={false}>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-300 mb-2">
            Welcome to your embedded portal
          </h3>
          <p className="text-purple-200/80 text-sm">
            You're accessing this portal through an embedded interface with{' '}
            <span className="font-medium">{accessMode}</span> access.
          </p>
        </div>
      </EmbedConditional>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredActions.map((action) => (
          <EmbedConditional
            key={action.id}
            feature={action.feature}
            fallback={
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4 opacity-50">
                <div className="flex items-center gap-3 mb-2">
                  <action.icon className="w-5 h-5 text-gray-500" />
                  <h3 className="font-medium text-gray-500">{action.label}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">{action.description}</p>
                <div className="text-xs text-gray-600">
                  Not available in {accessMode} mode
                </div>
              </div>
            }
          >
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800/70 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <action.icon className="w-5 h-5 text-blue-400" />
                <h3 className="font-medium text-white">{action.label}</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">{action.description}</p>
              <EmbedAwareButton
                feature={action.feature}
                onClick={() => window.location.href = action.href}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Access →
              </EmbedAwareButton>
            </div>
          </EmbedConditional>
        ))}
      </div>

      {/* Access Mode Information */}
      <EmbedConditional showInEmbed={true}>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="font-medium text-white mb-3">Access Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Access Mode:</span>
              <div className="font-medium text-white mt-1">
                {accessMode === 'full' && (
                  <span className="text-green-400">Full Access</span>
                )}
                {accessMode === 'readonly' && (
                  <span className="text-amber-400">Read Only</span>
                )}
                {accessMode === 'lite' && (
                  <span className="text-blue-400">Lite Access</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Available Features:</span>
              <div className="font-medium text-white mt-1">
                {filteredActions.length} of {dashboardActions.length}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Embedded:</span>
              <div className="font-medium text-green-400 mt-1">
                Yes
              </div>
            </div>
          </div>
        </div>
      </EmbedConditional>

      {/* Feature Restrictions Notice */}
      <EmbedConditional accessModes={['readonly', 'lite']}>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <h4 className="font-medium text-amber-300 mb-2">Access Restrictions</h4>
          <div className="text-sm text-amber-200/80 space-y-1">
            {accessMode === 'readonly' && (
              <>
                <p>• Form editing and data modification is disabled</p>
                <p>• Billing and payment features are hidden</p>
                <p>• Team management is not available</p>
                <p>• API key generation is disabled</p>
              </>
            )}
            {accessMode === 'lite' && (
              <>
                <p>• Limited feature set available</p>
                <p>• Advanced settings are hidden</p>
                <p>• Some integrations may not be accessible</p>
                <p>• Phone number management is disabled</p>
              </>
            )}
          </div>
        </div>
      </EmbedConditional>

      {/* Debug Information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <EmbedConditional showInEmbed={true}>
          <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-4">
            <h4 className="font-medium text-gray-300 mb-2">Debug Information</h4>
            <pre className="text-xs text-gray-400 overflow-auto">
              {JSON.stringify(
                {
                  isEmbedded,
                  accessMode,
                  filteredActionsCount: filteredActions.length,
                  totalActionsCount: dashboardActions.length,
                },
                null,
                2
              )}
            </pre>
          </div>
        </EmbedConditional>
      )}
    </div>
  );
}
