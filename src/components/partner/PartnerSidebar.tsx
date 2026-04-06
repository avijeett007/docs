'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { isFeatureEnabled } from '@/config/featureFlags';
import {
  FiHome,
  FiList,
  FiActivity,
  FiUsers,
  FiTrendingUp,
  FiSettings,
  FiChevronLeft,
  FiChevronRight,
  FiCpu,
  FiBox,
  FiHeadphones,
  FiMessageCircle,
  FiUser,
  FiFileText,
  FiLogOut,
  FiVideo,
  FiGlobe,
  FiMonitor,
  FiBookOpen,
  FiKey,
  FiCreditCard,
  FiDollarSign,
  FiRefreshCw,
  FiDatabase,
  FiPhone,
  FiLink,
  FiPlus,
  FiMail,
  FiHelpCircle,
  FiZap,
} from 'react-icons/fi';
import Logo from '@/components/Logo';
import GHLIcon from '@/components/icons/GHLIcon';
import { Permission, hasPermission } from '@/lib/rbac';
import CreditClaimButton from '@/components/credits/CreditClaimButton';
import PremiumFeature from '@/components/ui/PremiumFeature';
import { PartnerTier } from '@/lib/portalModes';
import PartnerSupportModal from './PartnerSupportModal';
import UpgradeModal from './UpgradeModal';
import TelephonyCreditPurchaseModal from './TelephonyCreditPurchaseModal';
import CreditPurchaseModal from './CreditPurchaseModal';
import { CreditPackage } from '@/lib/types/credits';
import { logger } from '@/lib/logger';

export interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  isComingSoon?: boolean;
  isNew?: boolean;
  subItems?: MenuItem[];
  requiredPermission?: Permission;
  requiresEnterprise?: boolean;
  /** Optional section label rendered as a thin divider above this item */
  sectionLabel?: string;
}

interface PartnerSidebarProps {
  partnerName: string;
  onLogout: () => void;
  userRole?: string | null;
  isTeamMember?: boolean;
  onCreditClaimClick?: (claim: any) => void;
}

export const menuItems: MenuItem[] = [
  { icon: FiHome, label: 'Dashboard', href: '/partner/dashboard' },

  // ── CUSTOMERS ──────────────────────────────────────────────────────────────
  {
    icon: FiUsers,
    label: 'Customers',
    href: '/partner/customers',
    sectionLabel: 'CUSTOMERS',
    subItems: [
      { icon: FiList, label: 'Active Customers', href: '/partner/customers' },
      { icon: FiUsers, label: 'Prospects', href: '/partner/prospects', requiresEnterprise: true },
    ]
  },
  {
    icon: FiCreditCard,
    label: 'Billing & Invoices',
    href: '/partner/billing',
    subItems: [
      { icon: FiFileText, label: 'Invoices & Payments', href: '/partner/billing' },
      { icon: FiTrendingUp, label: 'Metered Billing', href: '/partner/metered-billing' },
    ]
  },
  {
    icon: FiDollarSign,
    label: 'Credits',
    href: '/partner/credits',
    subItems: [
      { icon: FiCpu, label: 'AI Credits', href: '/partner/credits' },
      { icon: FiPhone, label: 'Telephony Credits', href: '/partner/telephony-credits' },
    ]
  },

  // ── AI PLATFORM ────────────────────────────────────────────────────────────
  { icon: FiCpu, label: 'AI Agents', href: '/partner/ai-agents', sectionLabel: 'AI PLATFORM' },
  {
    icon: FiPhone,
    label: 'Phone Numbers',
    href: '/partner/phone-numbers',
    subItems: [
      { icon: FiPhone, label: 'All Numbers', href: '/partner/phone-numbers' },
      { icon: FiDatabase, label: 'Number Pool', href: '/partner/phone-numbers/number-pools' },
    ]
  },
  { icon: FiKey, label: 'AI Gateway', href: '/partner/ai-gateway', isNew: true },
  { icon: FiActivity, label: 'Agent Analytics', href: '/partner/ai-usage' },

  // ── GROW ───────────────────────────────────────────────────────────────────
  { icon: FiZap, label: 'One-Click Experiences', href: '/partner/experiences', requiresEnterprise: true, sectionLabel: 'GROW' },
  { icon: FiVideo, label: 'Marketing', href: '/partner/marketing' },

  // ── ACCOUNT ────────────────────────────────────────────────────────────────
  { icon: FiBookOpen, label: 'Tutorials', href: '/partner/tutorials', sectionLabel: 'ACCOUNT' },
  { icon: FiUser, label: 'Team Management', href: '/partner/team', requiredPermission: Permission.MANAGE_TEAM },
  { icon: FiSettings, label: 'Settings', href: '/partner/settings', requiredPermission: Permission.MANAGE_SETTINGS },
];

export const aiAgentMenuItems: MenuItem[] = [
  { icon: FiBox, label: 'Manage VAPI Agents', href: '/partner/ai-agents/vapi' },
  { icon: FiHeadphones, label: 'Manage Ultravox Agents', href: '/partner/ai-agents/ultravox' },
  { icon: FiMessageCircle, label: 'Manage Retell Agents', href: '/partner/ai-agents/retell' },
  { icon: FiMessageCircle, label: 'Retell Chat Agents', href: '/partner/ai-agents/retell-chat' },
  { icon: GHLIcon, label: 'Manage GHL Agents', href: '/partner/ai-agents/ghl' },
  { icon: FiRefreshCw, label: 'Agent Migration', href: '/partner/agents/migration' },
  { icon: FiLink, label: 'N8N Automation', href: '/partner/ai-agents/n8n' },
  { icon: FiMessageCircle, label: 'N8N Chat Agents', href: '/partner/ai-agents/n8n-chat' },
  { icon: FiKey, label: 'N8N Tokens', href: '/partner/ai-agents/n8n/tokens' },
  { icon: FiLink, label: 'MCP Tokens', href: '/partner/ai-agents/mcp/tokens' },
  { icon: FiMessageCircle, label: 'Manage ElevenLabs Agents', href: '/partner/ai-agents/elevenlabs' },
  { icon: FiBox, label: 'Manage Knotie Agents', href: '/partner/ai-agents/knotie', isComingSoon: true },
  { icon: FiCpu, label: 'Manage Knova Agents', href: '/partner/ai-agents/knova', isComingSoon: true },
];

// Grouped structure used exclusively for sidebar rendering (visual sub-labels).
// aiAgentMenuItems above is kept unchanged for any external consumers.
const aiAgentGroups: { label: string; items: MenuItem[] }[] = [
  {
    label: 'Voice Agents',
    items: [
      { icon: FiBox, label: 'VAPI Agents', href: '/partner/ai-agents/vapi' },
      { icon: FiHeadphones, label: 'Ultravox Agents', href: '/partner/ai-agents/ultravox' },
      { icon: FiMessageCircle, label: 'Retell Agents', href: '/partner/ai-agents/retell' },
      { icon: FiMessageCircle, label: 'ElevenLabs Agents', href: '/partner/ai-agents/elevenlabs' },
      { icon: GHLIcon, label: 'GHL Agents', href: '/partner/ai-agents/ghl' },
      { icon: FiBox, label: 'Knotie Agents', href: '/partner/ai-agents/knotie', isComingSoon: true },
      { icon: FiCpu, label: 'Knova Agents', href: '/partner/ai-agents/knova', isComingSoon: true },
    ],
  },
  {
    label: 'Chat Agents',
    items: [
      { icon: FiMessageCircle, label: 'Retell Chat', href: '/partner/ai-agents/retell-chat' },
      { icon: FiMessageCircle, label: 'N8N Chat Agents', href: '/partner/ai-agents/n8n-chat' },
    ],
  },
  {
    label: 'Automation & Tokens',
    items: [
      { icon: FiLink, label: 'N8N Automation', href: '/partner/ai-agents/n8n' },
      { icon: FiKey, label: 'N8N Tokens', href: '/partner/ai-agents/n8n/tokens' },
      { icon: FiLink, label: 'MCP Tokens', href: '/partner/ai-agents/mcp/tokens' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { icon: FiRefreshCw, label: 'Agent Migration', href: '/partner/agents/migration' },
    ],
  },
];

export const marketingMenuItems: MenuItem[] = [
  { icon: FiVideo, label: 'Marketing Videos', href: '/partner/marketing/videos' },
  { icon: FiFileText, label: 'Marketing Posts', href: '/partner/marketing/posts' },
  { icon: FiGlobe, label: 'Voice-Enabled Website', href: '/partner/marketing/website' },
  { icon: FiMonitor, label: 'Demo for Customers', href: '/partner/marketing/demo' },
];

// UI-only temporary restriction: keep only Customer Demo visible in sidebar.
// Other marketing items remain defined above for future enablement.
const visibleMarketingMenuItems: MenuItem[] = marketingMenuItems.filter(
  (item) => item.href === '/partner/marketing/demo'
);

export const getSettingsMenuItems = (): MenuItem[] => {
  const whitelabelEnabled = isFeatureEnabled('whitelabel.enabled');

  const items = [
    { icon: FiUser, label: 'Profile Settings', href: '/partner/settings' },
    // API Keys / AI Gateway tab removed from Settings — it is now the top-level "AI Gateway" menu item
    { icon: FiMail, label: 'Email Domain Management', href: '/partner/settings/email-domain' },
  ];

  // Only add white-label option if the feature is enabled
  if (whitelabelEnabled) {
    items.push({ icon: FiGlobe, label: 'White-Label Portal', href: '/partner/settings/whitelabel' });
  }

  return items;
};

interface PartnerStats {
  partnerId: string;
  knotieCredits: number;
  telephonyCredits: number;
  storageUsedMB: number;
  storageTotalMB: number;
}

export default function PartnerSidebar({ partnerName, onLogout, userRole, isTeamMember = false, onCreditClaimClick }: PartnerSidebarProps) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);

  const [settingsMenuItems, setSettingsMenuItems] = useState<MenuItem[]>([]);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  // AI Agent group collapsible state — Voice & Chat expanded by default
  const [expandedAgentGroups, setExpandedAgentGroups] = useState<Set<string>>(
    new Set(['Voice Agents', 'Chat Agents'])
  );
  const [partnerStats, setPartnerStats] = useState<PartnerStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [partnerTier, setPartnerTier] = useState<PartnerTier | null>(null); // Start with null to indicate loading
  const [hasSaasMode, setHasSaasMode] = useState(false); // SaaS mode enabled
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showQuickBuyModal, setShowQuickBuyModal] = useState(false);
  const [showTelephonyPurchaseModal, setShowTelephonyPurchaseModal] = useState(false);
  const [showKnotiePurchaseModal, setShowKnotiePurchaseModal] = useState(false);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);


  // Filter menu items based on user role and tier
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items.map(item => {
      // Filter subitems first
      let filteredSubItems = item.subItems;
      if (item.subItems) {
        filteredSubItems = item.subItems.filter(subItem => {
          // Check permission requirements
          if (subItem.requiredPermission && !hasPermission(userRole, subItem.requiredPermission, isTeamMember)) {
            return false;
          }
          // Always show items, but we'll handle enterprise requirements in rendering
          return true;
        });
      }

      // Check permission requirements for main item
      if (item.requiredPermission && !hasPermission(userRole, item.requiredPermission, isTeamMember)) {
        return null;
      }

      return {
        ...item,
        subItems: filteredSubItems
      };
    }).filter(Boolean) as MenuItem[];
  };

  const filteredMenuItems = filterMenuItems(menuItems);



  // Load partner stats
  const loadPartnerStats = async () => {
    setIsLoadingStats(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        logger.warn('No partner token found while loading sidebar stats', {
          operation: 'load_partner_sidebar_stats'
        });
        return;
      }

      // Load AI Credits
      const aiCreditsResponse = await fetch('/api/partner/credits/balance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Load Telephony Credits
      const telephonyCreditsResponse = await fetch('/api/partner/telephony-credits/balance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Load Storage Quota
      const storageResponse = await fetch('/api/partner/storage/quota', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Load Partner Subscription Info for tier determination
      const subscriptionResponse = await fetch('/api/partner/subscription', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Load Partner Profile for SaaS mode
      const profileResponse = await fetch('/api/partner/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const [aiCreditsData, telephonyCreditsData, storageData, subscriptionData, profileData] = await Promise.all([
        aiCreditsResponse.ok ? aiCreditsResponse.json() : null,
        telephonyCreditsResponse.ok ? telephonyCreditsResponse.json() : null,
        storageResponse.ok ? storageResponse.json() : null,
        subscriptionResponse.ok ? subscriptionResponse.json() : null,
        profileResponse.ok ? profileResponse.json() : null
      ]);

      // Determine partner tier from API response
      if (subscriptionData?.data?.subscription) {
        const subscription = subscriptionData.data.subscription;

        // Map server tier strings to PartnerTier enum
        let tier: PartnerTier;
        switch (subscription.tier) {
          case 'enterprise':
            tier = PartnerTier.ENTERPRISE;
            break;
          case 'pro':
            tier = PartnerTier.PRO;
            break;
          case 'starter':
            tier = PartnerTier.STARTER;
            break;
          case 'lifetime_pro':
            tier = PartnerTier.LIFETIME;
            break;
          case 'free_forever':
          default:
            tier = PartnerTier.FREE_FOREVER;
            break;
        }

        logger.debug('Resolved partner tier in sidebar', {
          operation: 'load_partner_sidebar_stats',
          serverTier: subscription.tier,
          mappedTier: tier,
          isEnterprise: tier === PartnerTier.ENTERPRISE
        });

        setPartnerTier(tier);
      }

      // Check SaaS mode from profile
      if (profileData) {
        const saasEnabled = profileData.saasMode || profileData.manualSaasModeEnabled;
        setHasSaasMode(saasEnabled);
        logger.debug('Resolved SaaS mode in sidebar', {
          operation: 'load_partner_sidebar_stats',
          hasSaasMode: saasEnabled
        });
      }

      logger.debug('Sidebar credit/stat APIs loaded', {
        operation: 'load_partner_sidebar_stats',
        aiCreditsStatus: aiCreditsResponse.status,
        telephonyCreditsStatus: telephonyCreditsResponse.status,
        storageStatus: storageResponse.status
      });

      const finalStats = {
        partnerId: aiCreditsData?.data?.partnerId || '',
        knotieCredits: aiCreditsData?.data?.currentBalance || 0,
        telephonyCredits: telephonyCreditsData?.data?.currentBalanceCents || 0,
        storageUsedMB: storageData?.data?.quota?.usedMB || 0,
        storageTotalMB: storageData?.data?.quota?.totalQuotaMB || 100
      };

      logger.debug('Computed partner sidebar stats', {
        operation: 'load_partner_sidebar_stats',
        knotieCredits: finalStats.knotieCredits,
        telephonyCredits: finalStats.telephonyCredits,
        storageUsedMB: finalStats.storageUsedMB,
        storageTotalMB: finalStats.storageTotalMB
      });
      setPartnerStats(finalStats);

    } catch (error) {
      logger.error('Error loading partner sidebar stats', error as Error, {
        operation: 'load_partner_sidebar_stats'
      });
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Handle credit claim success
  const handleClaimSuccess = () => {
    // Refresh partner stats when credits are claimed
    loadPartnerStats();
  };

  // Handle credit claim button click
  const handleClaimClick = (claim: any) => {
    if (onCreditClaimClick) {
      onCreditClaimClick(claim);
    }
  };

  // Load credit packages for purchase modal
  const loadCreditPackages = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/credits/packages', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.packages) {
          setCreditPackages(data.data.packages);
        }
      }
    } catch (error) {
      logger.error('Error loading credit packages for sidebar', error as Error, {
        operation: 'load_partner_credit_packages'
      });
    }
  };

  // Get feature-flagged menu items on component mount and when feature flags change
  useEffect(() => {
    setSettingsMenuItems(getSettingsMenuItems());
    loadPartnerStats();
    loadCreditPackages();

    // Add listener for localStorage changes (used by the feature flag control)
    const handleStorageChange = () => {
      setSettingsMenuItems(getSettingsMenuItems());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleSubmenu = (menuLabel: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuLabel)) {
      newExpanded.delete(menuLabel);
    } else {
      newExpanded.add(menuLabel);
    }
    setExpandedMenus(newExpanded);
  };

  const toggleAgentGroup = (groupLabel: string) => {
    setExpandedAgentGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupLabel)) next.delete(groupLabel);
      else next.add(groupLabel);
      return next;
    });
  };

  return (
    <div
      className={clsx(
        "fixed top-0 left-0 h-screen bg-gray-900/50 backdrop-blur-xl border-r border-gray-800 flex flex-col z-[100]",
        "transition-[width] duration-300 ease-in-out",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="p-4 border-b border-gray-800 flex items-center justify-between min-h-[64px]">
        <Logo collapsed={isSidebarCollapsed} />
        {/* In-header collapse button — visible when expanded */}
        {!isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            title="Collapse sidebar"
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <FiChevronLeft />
          </button>
        )}
      </div>

      {/* Floating expand tab — fixed at the right edge of the collapsed sidebar (w-20 = 80px) */}
      {isSidebarCollapsed && (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          title="Expand sidebar"
          className={clsx(
            "fixed left-[68px] top-5 z-[101]",
            "w-6 h-6 rounded-full",
            "bg-gray-800 border border-gray-700",
            "flex items-center justify-center",
            "text-gray-400 hover:text-white hover:bg-blue-600 hover:border-blue-500",
            "shadow-md transition-colors duration-200"
          )}
        >
          <FiChevronRight className="w-3 h-3" />
        </button>
      )}

      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-2">
          {filteredMenuItems.map((item) => {
            const isAIAgentsMenu = item.href === '/partner/ai-agents';
            const isAIAgentsActive = pathname?.startsWith('/partner/ai-agents');
            const isMarketingMenu = item.href === '/partner/marketing';
            const isMarketingActive = pathname?.startsWith('/partner/marketing');
            const isSettingsMenu = item.href === '/partner/settings';
            // Exclude /partner/ai-gateway — it is a dedicated top-level page, not part of Settings
            const isSettingsActive = pathname?.startsWith('/partner/settings') &&
              !pathname?.startsWith('/partner/ai-gateway');

            const isCustomersMenu = item.label === 'Customers';
            const isCustomersActive = pathname?.startsWith('/partner/customers') || pathname?.startsWith('/partner/prospects');
            const isBillingMenu = item.label === 'Billing & Invoices';
            const isBillingActive = pathname?.startsWith('/partner/billing') || pathname?.startsWith('/partner/metered-billing');
            const isCreditsMenu = item.label === 'Credits';
            const isCreditsActive = pathname?.startsWith('/partner/credits') || pathname?.startsWith('/partner/telephony-credits');
            const isPhoneNumbersMenu = item.label === 'Phone Numbers';
            const isPhoneNumbersActive = pathname?.startsWith('/partner/phone-numbers');
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = expandedMenus.has(item.label);

            return (
              <React.Fragment key={item.href}>
                {/* Section label divider */}
                {item.sectionLabel && (
                  isSidebarCollapsed
                    ? <div className="my-2 border-t border-gray-700/60" />
                    : <p className="mt-4 mb-1 px-2 text-[10px] font-semibold tracking-widest text-gray-500 uppercase select-none">
                        {item.sectionLabel}
                      </p>
                )}
                {hasSubItems ? (
                  <button
                    onClick={() => toggleSubmenu(item.label)}
                    className={clsx(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      "hover:bg-gray-800",
                      ((isCustomersMenu && isCustomersActive) || (isBillingMenu && isBillingActive) || (isCreditsMenu && isCreditsActive) || (isPhoneNumbersMenu && isPhoneNumbersActive))
                        ? "bg-blue-500/10 text-blue-500" : "text-gray-400",
                      item.isComingSoon && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!isSidebarCollapsed && (
                      <div className="flex items-center justify-between flex-1">
                        <span>{item.label}</span>
                        <div className="flex items-center gap-2">
                          {item.isComingSoon && (
                            <span className="text-xs bg-gray-800 px-2 py-1 rounded">Soon</span>
                          )}
                          <FiChevronRight className={clsx(
                            "w-4 h-4 transition-transform",
                            isExpanded && "rotate-90"
                          )} />
                        </div>
                      </div>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      "hover:bg-gray-800",
                      (pathname === item.href ||
                       (isAIAgentsMenu && isAIAgentsActive) ||
                       (isMarketingMenu && isMarketingActive) ||
                       (isSettingsMenu && isSettingsActive))
                        ? "bg-blue-500/10 text-blue-500" : "text-gray-400",
                      item.isComingSoon && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!isSidebarCollapsed && (
                      <div className="flex items-center justify-between flex-1">
                        <div className="flex items-center gap-2">
                          <span>{item.label}</span>
                          {/* Add premium indicators for specific features */}
                          {(item.label === 'Agent Analytics' ||
                            item.label === 'Manage AI Agents' ||
                            item.label === 'Marketing' ||
                            item.label === 'Team Management' ||
                            item.label === 'One-Click Experiences') && (
                            <PremiumFeature iconSize="sm">
                              <></>
                            </PremiumFeature>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {item.isNew && (
                            <span className="text-[10px] font-semibold bg-blue-500 text-white px-1.5 py-0.5 rounded-full leading-none">NEW</span>
                          )}
                          {item.isComingSoon && (
                            <span className="text-xs bg-gray-800 px-2 py-1 rounded">Soon</span>
                          )}
                          {/* Chevron for items that have an auto-shown sub-panel (AI Agents, Marketing) */}
                          {(isAIAgentsMenu || isMarketingMenu) && (
                            <FiChevronRight className={clsx(
                              "w-4 h-4 transition-transform",
                              ((isAIAgentsMenu && isAIAgentsActive) || (isMarketingMenu && isMarketingActive)) && "rotate-90"
                            )} />
                          )}
                        </div>
                      </div>
                    )}
                  </Link>
                )}

                {/* Show sub-menu when expanded */}
                {hasSubItems && isExpanded && !isSidebarCollapsed && (
                  <div className="mt-1 mb-2 space-y-1 border-l-2 border-gray-800 ml-4 pl-4">
                    {item.subItems!.map((subItem) => {
                      const isEnterpriseRequired = subItem.requiresEnterprise;
                      const hasEnterpriseAccess = partnerTier === PartnerTier.ENTERPRISE;
                      const hasSaasAccess = hasEnterpriseAccess || hasSaasMode;
                      const isLoading = partnerTier === null;
                      const isDisabled = isEnterpriseRequired && !hasSaasAccess && !isLoading;

                      return (
                        <div key={subItem.href} className="relative">
                          <Link
                            href={isDisabled ? '#' : subItem.href}
                            onClick={isDisabled ? (e) => {
                              e.preventDefault();
                              // Only show modal if not loading
                              if (!isLoading) {
                                setShowUpgradeModal(true);
                              }
                            } : undefined}
                            className={clsx(
                              "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm",
                              isLoading ? "opacity-75" : isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-800",
                              pathname === subItem.href ? "bg-blue-500/10 text-blue-500" : "text-gray-400",
                              subItem.isComingSoon && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <subItem.icon className="w-4 h-4 flex-shrink-0" />
                            <div className="flex items-center justify-between flex-1">
                              <span>{subItem.label}</span>
                              {subItem.isComingSoon && (
                                <span className="text-xs bg-gray-800 px-2 py-1 rounded">Soon</span>
                              )}
                              {isEnterpriseRequired && !hasSaasAccess && (
                                <span className="text-xs bg-purple-600 px-2 py-1 rounded">Enterprise</span>
                              )}
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Show AI Agent sub-menu (grouped + collapsible) immediately after its parent */}
                {isAIAgentsMenu && isAIAgentsActive && !isSidebarCollapsed && (
                  <div className="mt-1 mb-2 border-l-2 border-gray-800 ml-4 pl-4">
                    {aiAgentGroups.map((group, groupIndex) => {
                      const isGroupExpanded = expandedAgentGroups.has(group.label);
                      return (
                        <div key={group.label} className={clsx("mb-1", groupIndex > 0 && "mt-3 pt-3 border-t border-gray-700")}>
                          {/* Collapsible group header */}
                          <button
                            onClick={() => toggleAgentGroup(group.label)}
                            className="w-full flex items-center justify-between px-2 pt-1 pb-1 text-[10px] font-semibold tracking-widest text-gray-500 hover:text-gray-300 uppercase select-none transition-colors"
                          >
                            <span>{group.label}</span>
                            <FiChevronRight className={clsx(
                              "w-3 h-3 transition-transform duration-200",
                              isGroupExpanded && "rotate-90"
                            )} />
                          </button>
                          {isGroupExpanded && (
                            <div className="space-y-1">
                              {group.items.map((subItem) => (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  className={clsx(
                                    "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm",
                                    "hover:bg-gray-800",
                                    pathname === subItem.href ? "bg-blue-500/10 text-blue-500" : "text-gray-400",
                                    subItem.isComingSoon && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <subItem.icon className="w-4 h-4 flex-shrink-0" />
                                  <div className="flex items-center justify-between flex-1">
                                    <div className="flex items-center gap-2">
                                      <span>{subItem.label}</span>
                                      {!subItem.label.includes('Retell') && (
                                        <PremiumFeature iconSize="sm">
                                          <></>
                                        </PremiumFeature>
                                      )}
                                    </div>
                                    {subItem.isComingSoon && (
                                      <span className="text-xs bg-gray-800 px-2 py-1 rounded">Soon</span>
                                    )}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Show Marketing sub-menu immediately after its parent */}
                {isMarketingMenu && isMarketingActive && !isSidebarCollapsed && (
                  <div className="mt-1 mb-2 space-y-1 border-l-2 border-gray-800 ml-4 pl-4">
                    {visibleMarketingMenuItems.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={clsx(
                          "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm",
                          "hover:bg-gray-800",
                          pathname === subItem.href ? "bg-blue-500/10 text-blue-500" : "text-gray-400",
                          subItem.isComingSoon && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <subItem.icon className="w-4 h-4 flex-shrink-0" />
                        <div className="flex items-center justify-between flex-1">
                          <div className="flex items-center gap-2">
                            <span>{subItem.label}</span>
                            {/* Add premium indicators for marketing sub-items */}
                            <PremiumFeature iconSize="sm">
                              <></>
                            </PremiumFeature>
                          </div>
                          {subItem.isComingSoon && (
                            <span className="text-xs bg-gray-800 px-2 py-1 rounded">Soon</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Show Settings sub-menu immediately after its parent */}
                {isSettingsMenu && isSettingsActive && !isSidebarCollapsed && (
                  <div className="mt-1 mb-2 space-y-1 border-l-2 border-gray-800 ml-4 pl-4">
                    {settingsMenuItems.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={clsx(
                          "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm",
                          "hover:bg-gray-800",
                          pathname === subItem.href ? "bg-blue-500/10 text-blue-500" : "text-gray-400",
                          subItem.isComingSoon && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <subItem.icon className="w-4 h-4 flex-shrink-0" />
                        <div className="flex items-center justify-between flex-1">
                          <div className="flex items-center gap-2">
                            <span>{subItem.label}</span>
                            {/* Add premium indicators for premium settings features */}
                            {(subItem.label === 'White-Label Portal' ||
                              subItem.label === 'Email Domain Management') && (
                              <PremiumFeature iconSize="sm">
                                <></>
                              </PremiumFeature>
                            )}
                          </div>
                          {subItem.isComingSoon && (
                            <span className="text-xs bg-gray-800 px-2 py-1 rounded">Soon</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </nav>

      {/* Support Button */}
      <div className="px-4 mb-3">
        {!isSidebarCollapsed ? (
          <button
            onClick={() => setShowSupportModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 text-gray-400 hover:text-white transition-all duration-200 group"
          >
            <FiHelpCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">Get Support</span>
          </button>
        ) : (
          <button
            onClick={() => setShowSupportModal(true)}
            className="w-full flex flex-col items-center justify-center p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 text-gray-400 hover:text-white transition-all duration-200"
          >
            <FiHelpCircle className="w-5 h-5" />
            <span className="text-xs mt-1">Support</span>
          </button>
        )}
      </div>

      {/* Partner Stats Info Box */}
      {!isSidebarCollapsed && partnerStats && (
        <div className="p-4 border-t border-gray-800">
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-3">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Account Overview
            </div>

            {/* Knotie Credits */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiCpu className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-300">Knotie Credits</span>
                </div>
                <span className={`text-sm font-medium ${
                  partnerStats.knotieCredits < 100 ? 'text-red-400' : 'text-white'
                }`}>
                  {partnerStats.knotieCredits.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>

              {/* Quick Top-up Button when credits are low */}
              {partnerStats.knotieCredits < 100 && (
                <button
                  onClick={() => {
                    const popup = window.open(
                      '/partner/credits/popup',
                      'creditPurchase',
                      'width=600,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
                    );
                    if (popup) {
                      popup.focus();
                      // Listen for purchase success message
                      const handleMessage = (event: MessageEvent) => {
                        if (event.data?.type === 'CREDIT_PURCHASE_SUCCESS') {
                          loadPartnerStats(); // Refresh stats after purchase
                          window.removeEventListener('message', handleMessage);
                        }
                      };
                      window.addEventListener('message', handleMessage);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-xs text-red-300 hover:text-red-200 transition-colors"
                >
                  <FiPlus className="w-3 h-3" />
                  Quick Top-up
                </button>
              )}

              {/* Credit Claim Button */}
              <CreditClaimButton
                partnerId={partnerStats.partnerId}
                onClaimClick={handleClaimClick}
                onClaimSuccess={handleClaimSuccess}
                className="mt-2"
              />
            </div>

            {/* Telephony Credits */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiPhone className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300">Telephony</span>
              </div>
              <span className="text-sm font-medium text-white">
                ${(partnerStats.telephonyCredits / 100).toFixed(2)}
              </span>
            </div>

            {/* Quick Buy Button */}
            <button
              onClick={() => setShowQuickBuyModal(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-500 hover:to-green-500 rounded-lg text-xs text-white font-medium transition-all duration-200 shadow-lg shadow-blue-500/20"
            >
              <FiPlus className="w-3.5 h-3.5" />
              Quick Buy Credits
            </button>

            {/* Storage Usage */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiDatabase className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-300">Storage</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {partnerStats.storageUsedMB.toFixed(1)} / {partnerStats.storageTotalMB} MB
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    (partnerStats.storageUsedMB / partnerStats.storageTotalMB) * 100 > 90
                      ? 'bg-red-500'
                      : (partnerStats.storageUsedMB / partnerStats.storageTotalMB) * 100 > 75
                        ? 'bg-yellow-500'
                        : 'bg-purple-500'
                  }`}
                  style={{
                    width: `${Math.min((partnerStats.storageUsedMB / partnerStats.storageTotalMB) * 100, 100)}%`
                  }}
                />
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadPartnerStats}
              disabled={isLoadingStats}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={`w-3 h-3 ${isLoadingStats ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={() => setShowLogoutMenu(!showLogoutMenu)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors text-gray-400"
        >
          <FiUser className="w-5 h-5 flex-shrink-0" />
          {!isSidebarCollapsed && (
            <span className="truncate">{partnerName}</span>
          )}
        </button>

        {showLogoutMenu && !isSidebarCollapsed && (
          <div className="absolute bottom-20 left-4 right-4 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-red-400"
            >
              <FiLogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>

      {/* Partner Support Modal */}
      <PartnerSupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Prospects Feature"
        message="Track and manage your SaaS portal prospects with our Ultimate Scale Agency tier or enable SaaS Mode."
        upgradeButtonText="Upgrade to Ultimate Scale Agency"
      />

      {/* Quick Buy Credit Type Selection Modal - Using portal to escape sidebar z-index */}
      {showQuickBuyModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowQuickBuyModal(false)}
          />
          <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">
              Select Credit Type
            </h3>
            <p className="text-sm text-gray-400 mb-6 text-center">
              Choose which type of credits you want to purchase
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowQuickBuyModal(false);
                  setShowKnotiePurchaseModal(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all duration-200 group"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <FiCpu className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <div className="text-white font-medium group-hover:text-blue-300 transition-colors">
                    Knotie AI Credits
                  </div>
                  <div className="text-xs text-gray-400">
                    For AI conversations & agent usage
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowQuickBuyModal(false);
                  setShowTelephonyPurchaseModal(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 rounded-lg transition-all duration-200 group"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <FiPhone className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-left">
                  <div className="text-white font-medium group-hover:text-green-300 transition-colors">
                    Telephony Credits
                  </div>
                  <div className="text-xs text-gray-400">
                    For calls, SMS & phone numbers
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowQuickBuyModal(false)}
              className="w-full mt-4 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Knotie Credit Purchase Modal */}
      <CreditPurchaseModal
        isOpen={showKnotiePurchaseModal}
        onClose={() => setShowKnotiePurchaseModal(false)}
        packages={creditPackages}
        onPurchaseSuccess={() => {
          setShowKnotiePurchaseModal(false);
          loadPartnerStats();
        }}
      />

      {/* Telephony Credit Purchase Modal */}
      <TelephonyCreditPurchaseModal
        isOpen={showTelephonyPurchaseModal}
        onClose={() => setShowTelephonyPurchaseModal(false)}
        onPurchaseSuccess={() => {
          setShowTelephonyPurchaseModal(false);
          loadPartnerStats();
        }}
        minAmount={partnerTier === PartnerTier.FREE_FOREVER ? 20 : 10}
      />
    </div>
  );
}
