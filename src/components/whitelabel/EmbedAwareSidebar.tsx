'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEmbedContext } from '@/hooks/useEmbedContext';
import { EmbedConditional } from './EmbedAwareNavigation';
import {
  FiHome,
  FiBarChart2,
  FiMessageSquare,
  FiBook,
  FiSettings,
  FiCreditCard,
  FiUsers,
  FiKey,
  FiPhone,
  FiActivity,
  FiShield,
} from 'react-icons/fi';

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<any>;
  feature?: string;
  accessModes?: string[];
  badge?: string;
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/whitelabel/dashboard',
    icon: FiHome,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/whitelabel/analytics',
    icon: FiBarChart2,
  },
  {
    id: 'conversations',
    label: 'Conversations',
    href: '/whitelabel/conversations',
    icon: FiMessageSquare,
  },
  {
    id: 'knowledge-base',
    label: 'Knowledge Base',
    href: '/whitelabel/knowledge-base',
    icon: FiBook,
    feature: 'knowledge-base',
  },
  {
    id: 'usage',
    label: 'AI Usage',
    href: '/whitelabel/ai-usage',
    icon: FiActivity,
  },
  {
    id: 'phone-numbers',
    label: 'Phone Numbers',
    href: '/whitelabel/phone-numbers',
    icon: FiPhone,
    feature: 'phone-numbers',
  },
  {
    id: 'billing',
    label: 'Billing',
    href: '/whitelabel/billing',
    icon: FiCreditCard,
    feature: 'billing',
  },
  {
    id: 'team-members',
    label: 'Team Members',
    href: '/whitelabel/team-members',
    icon: FiUsers,
    feature: 'team-members',
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    href: '/whitelabel/api-keys',
    icon: FiKey,
    feature: 'api-keys',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/whitelabel/settings',
    icon: FiSettings,
    feature: 'account-settings',
  },
];

interface EmbedAwareSidebarProps {
  className?: string;
}

export default function EmbedAwareSidebar({ className = '' }: EmbedAwareSidebarProps) {
  const pathname = usePathname();
  const { isEmbedded, shouldHideFeature, getAccessModeLabel, getAccessModeColor } = useEmbedContext();

  const filteredItems = sidebarItems.filter(item => {
    if (!item.feature) return true;
    return !shouldHideFeature(item.feature);
  });

  return (
    <div className={`bg-gray-800 border-r border-gray-700 ${className}`}>
      <div className="p-4">
        {/* Embed Status */}
        <EmbedConditional showInEmbed={true}>
          <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <FiShield className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 font-medium">Embedded</span>
              <span className={`ml-auto text-xs ${getAccessModeColor()}`}>
                {getAccessModeLabel()}
              </span>
            </div>
          </div>
        </EmbedConditional>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href;
            
            return (
              <EmbedConditional
                key={item.id}
                feature={item.feature}
                accessModes={item.accessModes}
              >
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </EmbedConditional>
            );
          })}
        </nav>

        {/* Restricted Features Notice */}
        <EmbedConditional showInEmbed={true}>
          {sidebarItems.length > filteredItems.length && (
            <div className="mt-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="text-xs text-amber-300 font-medium mb-1">
                Limited Access
              </div>
              <div className="text-xs text-amber-200/80">
                {sidebarItems.length - filteredItems.length} features hidden in {getAccessModeLabel().toLowerCase()} mode
              </div>
            </div>
          )}
        </EmbedConditional>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-700">
          <div className="text-xs text-gray-500 text-center">
            <EmbedConditional showInEmbed={true} hideInEmbed={false}>
              <div>Embedded Portal</div>
            </EmbedConditional>
            <EmbedConditional hideInEmbed={true}>
              <div>Customer Portal</div>
            </EmbedConditional>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact version for mobile or smaller spaces
export function EmbedAwareSidebarCompact({ className = '' }: EmbedAwareSidebarProps) {
  const pathname = usePathname();
  const { shouldHideFeature } = useEmbedContext();

  const filteredItems = sidebarItems.filter(item => {
    if (!item.feature) return true;
    return !shouldHideFeature(item.feature);
  });

  return (
    <div className={`bg-gray-800 border-r border-gray-700 ${className}`}>
      <div className="p-2">
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href;
            
            return (
              <EmbedConditional
                key={item.id}
                feature={item.feature}
                accessModes={item.accessModes}
              >
                <Link
                  href={item.href}
                  className={`
                    flex items-center justify-center p-2 rounded-lg transition-colors
                    ${isActive
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                    }
                  `}
                  title={item.label}
                >
                  <item.icon className="w-5 h-5" />
                </Link>
              </EmbedConditional>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
