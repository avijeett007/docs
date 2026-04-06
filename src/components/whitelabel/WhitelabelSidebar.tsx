'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiHome, FiFileText, FiGlobe, FiDatabase,
  FiCalendar, FiChevronDown, FiChevronRight,
  FiMessageSquare, FiBarChart2, FiGrid,
  FiChevronLeft, FiKey, FiCreditCard, FiPhone,
  FiHelpCircle, FiZap
} from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Permission, hasPermission } from '@/lib/rbac';
import { loadLanguageDataWithLocale, getTranslatedText, type LanguageData, type SupportedLanguage } from '@/lib/languages';
import CreditBalanceWidget from './CreditBalanceWidget';
import CustomerSupportModal from './CustomerSupportModal';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  href: string;
  isComingSoon?: boolean;
  comingSoonText?: string;
  section?: string;
}

interface MenuGroupProps {
  title: string;
  items: MenuItem[];
  isOpen: boolean;
  onToggle: () => void;
  pathname: string | null;
}

interface CustomerFeatures {
  enableAdvancedAnalytics: boolean;
  enableDetailedCallAnalysis: boolean;
  enableActionPointAnalysis: boolean;
  showKnowledgeBase: boolean;
  showIntegration: boolean;
  showDocsAndMedia: boolean;
  showScheduleMeeting: boolean;
  enableApiAccess: boolean;
  showApiKeys: boolean;
  showBilling: boolean;
  showPhoneNumbers: boolean;
  aiCreditsEnabled: boolean;
  aiGatewayEnabled: boolean;
}

interface WhitelabelSidebarProps {
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  onAddCreditsClick?: () => void;
  creditRefreshTrigger?: number;
  onCreditUpdate?: (credits: number) => void; // Add callback for credit updates
}

const MenuGroup: React.FC<MenuGroupProps> = ({
  title,
  items,
  isOpen,
  onToggle,
  pathname
}) => {
  const { branding } = usePartnerBranding();
  const { primaryColor } = branding;

  return (
    <div className="mb-3 md:mb-4 px-2 md:px-4">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-2 py-1.5 md:py-2 text-gray-400 hover:text-white transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        {isOpen ? (
          <FiChevronDown className="h-3 w-3 md:h-4 md:w-4" />
        ) : (
          <FiChevronRight className="h-3 w-3 md:h-4 md:w-4" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="space-y-1 mt-1 md:mt-2">
              {items.map((item, index) => {
                const isActive = pathname === item.href;

                return (
                  <li key={index}>
                    <Link href={item.href} passHref>
                      <div
                        className={`flex items-center px-2 md:px-3 py-1.5 md:py-2 rounded-lg cursor-pointer
                                  ${isActive ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
                                  transition-colors`}
                        style={isActive ? {
                          backgroundColor: `${primaryColor || '#3b82f6'}15`,
                          borderLeft: `2px solid ${primaryColor || '#3b82f6'}`
                        } : {}}
                      >
                        <item.icon className={`h-4 w-4 md:h-5 md:w-5 mr-2 md:mr-3 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                        <span className={`text-sm md:text-base ${isActive ? 'text-white' : 'text-gray-400'}`}>{item.label}</span>
                        {item.isComingSoon && (
                          <span className="ml-auto text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full bg-opacity-20"
                                style={{
                                  backgroundColor: `${primaryColor || '#3b82f6'}22`,
                                  color: primaryColor || '#3b82f6'
                                }}>
                            {item.comingSoonText || 'Coming Soon'}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const WhitelabelSidebar: React.FC<WhitelabelSidebarProps> = ({
  collapsed = false,
  onToggle,
  onAddCreditsClick,
  creditRefreshTrigger,
  onCreditUpdate
}) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  const [isManagementOpen, setIsManagementOpen] = useState(true);
  const [isSettingsSecurityOpen, setIsSettingsSecurityOpen] = useState(true);
  const [isToolsOpen, setIsToolsOpen] = useState(true);
  const [currentCredits, setCurrentCredits] = useState<number>(0);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Get user role and team member status for permission checking
  const { role, isTeamMember } = useCustomerAuth();

  // Handle credit updates from the widget
  const handleCreditUpdate = (credits: number) => {
    setCurrentCredits(credits);
    if (onCreditUpdate) {
      onCreditUpdate(credits);
    }
  };

  const [customerFeatures, setCustomerFeatures] = useState<CustomerFeatures>({
    enableAdvancedAnalytics: false,
    enableDetailedCallAnalysis: false,
    enableActionPointAnalysis: false,
    showKnowledgeBase: false,
    showIntegration: false,
    showDocsAndMedia: false,
    showScheduleMeeting: false,
    enableApiAccess: false,
    showApiKeys: false,
    showBilling: false,
    showPhoneNumbers: false,
    aiCreditsEnabled: false,
    aiGatewayEnabled: false
  });
  const { branding } = usePartnerBranding();
  const pathname = usePathname();

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [languageData, setLanguageData] = useState<LanguageData | null>(null);
  const [languageLoaded, setLanguageLoaded] = useState(false);

  // Helper function for translations
  const getTranslation = (path: string, fallback?: string) => {
    if (!languageData) return fallback || path;
    return getTranslatedText(
      languageData,
      path,
      fallback,
      branding?.businessName,
      branding?.translatedTexts,
      selectedLanguage
    );
  };

  // Load language data
  useEffect(() => {
    const loadLanguageData = async () => {
      if (!branding || languageLoaded) return;
      try {
        const { languageData: data, selectedLanguage: lang } = await loadLanguageDataWithLocale(
          branding.basicPortalLanguage
        );
        setLanguageData(data);
        setSelectedLanguage(lang);
        setLanguageLoaded(true);
      } catch (error) {
        console.error('Failed to load language:', error);
      }
    };
    loadLanguageData();
  }, [branding, languageLoaded]);

  // Fetch customer features when component mounts
  useEffect(() => {
    let cancelled = false;

    const fetchCustomerFeatures = async () => {
      try {
        const response = await fetch('/api/whitelabel/customer/features');
        if (response.ok && !cancelled) {
          const data = await response.json();
          setCustomerFeatures(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching customer features:', error);
        }
      }
    };

    fetchCustomerFeatures();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onToggle) {
      onToggle(newState);
    }
  };

  // Default items that are always shown
  const overviewItems: MenuItem[] = [
    { icon: FiHome, label: getTranslation('portal.sidebar.overview.dashboard', 'Dashboard'), href: '/whitelabel/dashboard', isComingSoon: false },
    { icon: FiFileText, label: getTranslation('portal.sidebar.overview.detailedUsage', 'Detailed Usage'), href: '/whitelabel/ai-usage', isComingSoon: false },
    { icon: FiMessageSquare, label: getTranslation('portal.sidebar.overview.callHistory', 'Conversations'), href: '/whitelabel/conversations', isComingSoon: false },
  ];

  // Add Advanced Analytics conditionally
  if (customerFeatures.enableAdvancedAnalytics) {
    overviewItems.push({ icon: FiBarChart2, label: getTranslation('portal.sidebar.overview.advancedAnalytics', 'Advanced Analytics'), href: '/whitelabel/usage', isComingSoon: false });
  }

  // Management items - conditionally added based on features
  const managementItems: MenuItem[] = [];

  // Add Knowledge Base if enabled
  if (customerFeatures.showKnowledgeBase) {
    managementItems.push({ icon: FiFileText, label: getTranslation('portal.sidebar.management.knowledgeBase', 'Knowledge Base'), href: '/whitelabel/knowledge-base', isComingSoon: false });
  }

  // Add Phone Numbers if enabled
  if (customerFeatures.showPhoneNumbers) {
    managementItems.push({ icon: FiPhone, label: getTranslation('portal.sidebar.management.phoneNumbers', 'Phone Numbers'), href: '/whitelabel/phone-numbers', isComingSoon: false });
  }

  // Add Integration if enabled
  if (customerFeatures.showIntegration) {
    managementItems.push({ icon: FiGlobe, label: getTranslation('portal.sidebar.management.integration', 'Integration'), href: '/whitelabel/integration', isComingSoon: false });
  }

  // Add Docs & Media if enabled
  if (customerFeatures.showDocsAndMedia) {
    managementItems.push({
      icon: FiDatabase,
      label: getTranslation('portal.sidebar.management.docsMedia', 'My Docs & Media'),
      href: '/whitelabel/media',
      isComingSoon: true,
      comingSoonText: getTranslation('portal.sidebar.comingSoon', 'Coming Soon')
    });
  }

  // Settings is always shown
  const settingsSecurityItems: MenuItem[] = [
    { icon: FiGrid, label: getTranslation('portal.sidebar.settings.settings', 'Settings'), href: '/whitelabel/account-settings' }
  ];

  // Add Billing if enabled
  if (customerFeatures.showBilling) {
    settingsSecurityItems.push({
      icon: FiCreditCard,
      label: getTranslation('portal.sidebar.settings.billing', 'Billing & Payments'),
      href: '/whitelabel/billing'
    });
  }

  // Add API Keys if API access is enabled
  if (customerFeatures.enableApiAccess && customerFeatures.showApiKeys) {
    settingsSecurityItems.push({
      icon: FiKey,
      label: getTranslation('portal.sidebar.settings.apiKeys', 'API Keys'),
      href: '/whitelabel/settings/api-keys'
    });
  }

  // Add AI Gateway if enabled for the customer
  if (customerFeatures.aiGatewayEnabled) {
    settingsSecurityItems.push({
      icon: FiZap,
      label: getTranslation('portal.sidebar.settings.aiGateway', 'AI Gateway'),
      href: '/whitelabel/ai-gateway'
    });
  }

  // Tools items - conditionally added based on features
  const toolsItems: MenuItem[] = [];

  // Add Schedule Meeting if enabled
  if (customerFeatures.showScheduleMeeting) {
    toolsItems.push({
      icon: FiCalendar,
      label: getTranslation('portal.sidebar.tools.scheduleMeeting', 'Schedule Meeting'),
      href: '/whitelabel/schedule',
      isComingSoon: true,
      comingSoonText: getTranslation('portal.sidebar.comingSoon', 'Coming Soon')
    });
  }

  return (
    <div className={`bg-gray-900 border-r border-gray-800 transition-all duration-300 h-full overflow-y-auto relative
                ${isCollapsed ? 'w-16 md:w-20' : 'w-56 md:w-64'}`}>
      <div className="flex flex-col h-full">
        {/* Collapse Button */}
        <button
          onClick={handleToggle}
          className="absolute top-4 right-0 transform translate-x-1/2 bg-gray-800 rounded-full p-1.5 border border-gray-700 text-gray-400 hover:text-white transition-colors z-10"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <FiChevronRight className="w-4 h-4" /> : <FiChevronLeft className="w-4 h-4" />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {!isCollapsed ? (
            <>
              <MenuGroup
                title={getTranslation('portal.sidebar.sections.core', 'Core')}
                items={overviewItems}
                isOpen={isOverviewOpen}
                onToggle={() => setIsOverviewOpen(!isOverviewOpen)}
                pathname={pathname}
              />

              {/* Only render Management section if there are items */}
              {managementItems.length > 0 && (
                <MenuGroup
                  title={getTranslation('portal.sidebar.sections.management', 'Management')}
                  items={managementItems}
                  isOpen={isManagementOpen}
                  onToggle={() => setIsManagementOpen(!isManagementOpen)}
                  pathname={pathname}
                />
              )}

              {/* Only show Settings & Security section for admin users or non-team members */}
              {hasPermission(role, Permission.MANAGE_SETTINGS, isTeamMember) && (
                <MenuGroup
                  title={getTranslation('portal.sidebar.sections.settingsSecurity', 'Settings & Security')}
                  items={settingsSecurityItems}
                  isOpen={isSettingsSecurityOpen}
                  onToggle={() => setIsSettingsSecurityOpen(!isSettingsSecurityOpen)}
                  pathname={pathname}
                />
              )}

              {/* Only render Tools section if there are items */}
              {toolsItems.length > 0 && (
                <MenuGroup
                  title={getTranslation('portal.sidebar.sections.tools', 'Tools')}
                  items={toolsItems}
                  isOpen={isToolsOpen}
                  onToggle={() => setIsToolsOpen(!isToolsOpen)}
                  pathname={pathname}
                />
              )}
            </>
          ) : (
            <div className="px-1 md:px-2 space-y-3 md:space-y-4">
              {/* Core items */}
              {overviewItems.map((item, index) => {
                const isActive = pathname === item.href;

                return (
                  <Link key={`overview-${index}`} href={item.href}>
                    <div
                      className={`flex flex-col items-center justify-center p-1 md:p-2 rounded-lg cursor-pointer
                                ${isActive ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
                                transition-colors`}
                      style={isActive ? {
                        backgroundColor: `${branding.primaryColor || '#3b82f6'}15`,
                        borderTop: `2px solid ${branding.primaryColor || '#3b82f6'}`
                      } : {}}
                    >
                      <item.icon className={`h-4 w-4 md:h-5 md:w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      <span className={`text-[10px] md:text-xs mt-1 ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {item.label.split(' ')[0]}
                      </span>
                    </div>
                  </Link>
                );
              })}

              {/* Management items */}
              {managementItems.length > 0 && managementItems.map((item, index) => {
                const isActive = pathname === item.href;

                return (
                  <Link key={`management-${index}`} href={item.href}>
                    <div
                      className={`flex flex-col items-center justify-center p-1 md:p-2 rounded-lg cursor-pointer
                                ${isActive ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
                                transition-colors`}
                      style={isActive ? {
                        backgroundColor: `${branding.primaryColor || '#3b82f6'}15`,
                        borderTop: `2px solid ${branding.primaryColor || '#3b82f6'}`
                      } : {}}
                    >
                      <item.icon className={`h-4 w-4 md:h-5 md:w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      <span className={`text-[10px] md:text-xs mt-1 ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {item.label.split(' ')[0]}
                      </span>
                    </div>
                  </Link>
                );
              })}

              {/* Settings items */}
              {settingsSecurityItems.map((item, index) => {
                const isActive = pathname === item.href;

                return (
                  <Link key={`settings-${index}`} href={item.href}>
                    <div
                      className={`flex flex-col items-center justify-center p-1 md:p-2 rounded-lg cursor-pointer
                                ${isActive ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
                                transition-colors`}
                      style={isActive ? {
                        backgroundColor: `${branding.primaryColor || '#3b82f6'}15`,
                        borderTop: `2px solid ${branding.primaryColor || '#3b82f6'}`
                      } : {}}
                    >
                      <item.icon className={`h-4 w-4 md:h-5 md:w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      <span className={`text-[10px] md:text-xs mt-1 ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {item.label.split(' ')[0]}
                      </span>
                    </div>
                  </Link>
                );
              })}

              {/* Tools items */}
              {toolsItems.length > 0 && toolsItems.map((item, index) => {
                const isActive = pathname === item.href;

                return (
                  <Link key={`tools-${index}`} href={item.href}>
                    <div
                      className={`flex flex-col items-center justify-center p-1 md:p-2 rounded-lg cursor-pointer
                                ${isActive ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
                                transition-colors`}
                      style={isActive ? {
                        backgroundColor: `${branding.primaryColor || '#3b82f6'}15`,
                        borderTop: `2px solid ${branding.primaryColor || '#3b82f6'}`
                      } : {}}
                    >
                      <item.icon className={`h-4 w-4 md:h-5 md:w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      <span className={`text-[10px] md:text-xs mt-1 ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {item.label.split(' ')[0]}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Support Button */}
        <div className="px-2 md:px-4 mb-3">
          {!isCollapsed ? (
            <button
              onClick={() => setShowSupportModal(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 text-gray-400 hover:text-white transition-all duration-200 group"
              style={{
                '--hover-color': branding.primaryColor || '#3b82f6'
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = branding.primaryColor || '#3b82f6';
                e.currentTarget.style.backgroundColor = `${branding.primaryColor || '#3b82f6'}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.backgroundColor = '';
              }}
            >
              <FiHelpCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{getTranslation('portal.sidebar.support.getSupport', 'Get Support')}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowSupportModal(true)}
              className="w-full flex flex-col items-center justify-center p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 text-gray-400 hover:text-white transition-all duration-200"
              style={{
                '--hover-color': branding.primaryColor || '#3b82f6'
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = branding.primaryColor || '#3b82f6';
                e.currentTarget.style.backgroundColor = `${branding.primaryColor || '#3b82f6'}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.backgroundColor = '';
              }}
            >
              <FiHelpCircle className="w-5 h-5" />
              <span className="text-xs mt-1">{getTranslation('portal.sidebar.support.support', 'Support')}</span>
            </button>
          )}
        </div>

        {/* Credit Balance Widget */}
        <div className="mt-auto">
          <CreditBalanceWidget
            collapsed={isCollapsed}
            onAddCreditsClick={onAddCreditsClick}
            refreshTrigger={creditRefreshTrigger}
            onCreditUpdate={handleCreditUpdate}
          />
        </div>
      </div>

      {/* Customer Support Modal */}
      <CustomerSupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        defaultCategory="general"
        defaultSubject="Support Request"
        defaultDetails="I need assistance with my account."
      />
    </div>
  );
};

export default WhitelabelSidebar;
