'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiHome, FiBox, FiUsers, FiFileText, FiGlobe, 
  FiDatabase, FiKey, FiSettings, FiShare2,
  FiCalendar, FiTool, FiChevronDown, FiChevronRight,
  FiGrid, FiMenu, FiCpu, FiMessageSquare
} from 'react-icons/fi';
import CustomerSidebarLogo from './CustomerSidebarLogo';

import Image from 'next/image';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  action?: () => void;
  isComingSoon?: boolean;
  section?: string;
}

interface MenuGroupProps {
  title: string;
  items: MenuItem[];
  isOpen: boolean;
  onToggle: () => void;
  activeSection: string;
  onMenuItemClick: (section: string) => void;
}

interface SidebarProps {
  onSchedule: () => void;
  onToggle: (isCollapsed: boolean) => void;
  onShowMyDocs: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const MenuGroup: React.FC<MenuGroupProps> = ({ 
  title, 
  items, 
  isOpen, 
  onToggle, 
  activeSection,
  onMenuItemClick 
}) => {
  const { branding } = usePartnerBranding();
  const { primaryColor, secondaryColor } = branding;

  return (
    <div className="mb-4 px-4">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-2 py-2 text-gray-400 hover:text-white transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        {isOpen ? (
          <FiChevronDown className="h-4 w-4" />
        ) : (
          <FiChevronRight className="h-4 w-4" />
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
            <ul className="space-y-1 mt-2">
              {items.map((item, index) => (
                <li key={index}>
                  {item.href ? (
                    <Link href={item.href} passHref>
                      <div 
                        className={`flex items-center px-3 py-2 rounded-lg cursor-pointer
                                  ${activeSection === item.section ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
                                  transition-colors`}
                        style={activeSection === item.section ? { 
                          background: `linear-gradient(90deg, ${primaryColor || '#3b82f6'}22, transparent)`,
                          borderLeft: `2px solid ${primaryColor || '#3b82f6'}`
                        } : {}}
                      >
                        <item.icon className={`h-5 w-5 mr-3 ${activeSection === item.section ? 'text-white' : 'text-gray-400'}`} />
                        <span className={`${activeSection === item.section ? 'text-white' : 'text-gray-400'}`}>{item.label}</span>
                        {item.isComingSoon && (
                          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-opacity-20" 
                                style={{ 
                                  backgroundColor: `${primaryColor || '#3b82f6'}22`,
                                  color: primaryColor || '#3b82f6'
                                }}>
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <div
                      onClick={() => {
                        if (item.action) item.action();
                        if (item.section) onMenuItemClick(item.section);
                      }}
                      className={`flex items-center px-3 py-2 rounded-lg cursor-pointer
                                ${activeSection === item.section ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
                                transition-colors`}
                      style={activeSection === item.section ? { 
                        background: `linear-gradient(90deg, ${primaryColor || '#3b82f6'}22, transparent)`,
                        borderLeft: `2px solid ${primaryColor || '#3b82f6'}`
                      } : {}}
                    >
                      <item.icon className={`h-5 w-5 mr-3 ${activeSection === item.section ? 'text-white' : 'text-gray-400'}`} />
                      <span className={`${activeSection === item.section ? 'text-white' : 'text-gray-400'}`}>{item.label}</span>
                      {item.isComingSoon && (
                        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-opacity-20" 
                              style={{ 
                                backgroundColor: `${primaryColor || '#3b82f6'}22`,
                                color: primaryColor || '#3b82f6'
                              }}>
                          Coming Soon
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ 
  onSchedule, 
  onToggle, 
  onShowMyDocs, 
  activeSection,
  onSectionChange 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  const [isAIWorkforceOpen, setIsAIWorkforceOpen] = useState(true);
  const [isManagementOpen, setIsManagementOpen] = useState(true);
  const [isSettingsSecurityOpen, setIsSettingsSecurityOpen] = useState(true);
  const [isToolsOpen, setIsToolsOpen] = useState(true);
  // User removed - Clerk disabled
  const { branding } = usePartnerBranding();

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onToggle(newState);
  };

  const handleMenuItemClick = (section: string) => {
    onSectionChange(section);
  };

  const overviewItems: MenuItem[] = [
    { icon: FiHome, label: 'Overview', section: 'overview', action: () => onSectionChange('overview'), isComingSoon: false },
    { icon: FiFileText, label: 'Detailed Usage', section: 'detailedusage', action: () => onSectionChange('detailedusage'), isComingSoon: false },
    { icon: FiMessageSquare, label: 'Agent Conversations', section: 'conversations', action: () => onSectionChange('conversations'), isComingSoon: false },
    { icon: FiDatabase, label: 'Advanced Analytics', section: 'advancedanalytics', action: () => onSectionChange('advancedanalytics'), isComingSoon: true },
  ];

  const managementItems: MenuItem[] = [
    { icon: FiFileText, label: 'Knowledge Base', section: 'mydocs', action: () => onSectionChange('mydocs'), isComingSoon: false },
    { icon: FiGlobe, label: 'Integration', section: 'integration', action: () => onSectionChange('integration'), isComingSoon: false },
    { icon: FiDatabase, label: 'My Docs & Media', section: 'media', href: '#', isComingSoon: true }
  ];

  const settingsSecurityItems: MenuItem[] = [
    { icon: FiKey, label: 'Keys & Secrets', section: 'keys', href: '#', isComingSoon: true },
    { icon: FiSettings, label: 'Settings', section: 'settings', href: '#', isComingSoon: true }
  ];

  const toolsItems: MenuItem[] = [
    { icon: FiCalendar, label: 'Schedule Meeting', section: 'schedule', action: onSchedule, isComingSoon: true },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-800 transition-all duration-300 z-30 
                ${isCollapsed ? 'w-20' : 'w-64'}`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <CustomerSidebarLogo />
          <button
            onClick={handleToggle}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <FiMenu className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {!isCollapsed ? (
            <>
              <MenuGroup
                title="Core"
                items={overviewItems}
                isOpen={isOverviewOpen}
                onToggle={() => setIsOverviewOpen(!isOverviewOpen)}
                activeSection={activeSection}
                onMenuItemClick={handleMenuItemClick}
              />
              
              <MenuGroup
                title="Management"
                items={managementItems}
                isOpen={isManagementOpen}
                onToggle={() => setIsManagementOpen(!isManagementOpen)}
                activeSection={activeSection}
                onMenuItemClick={handleMenuItemClick}
              />
              
              <MenuGroup
                title="Settings & Security"
                items={settingsSecurityItems}
                isOpen={isSettingsSecurityOpen}
                onToggle={() => setIsSettingsSecurityOpen(!isSettingsSecurityOpen)}
                activeSection={activeSection}
                onMenuItemClick={handleMenuItemClick}
              />

              <MenuGroup
                title="Tools"
                items={toolsItems}
                isOpen={isToolsOpen}
                onToggle={() => setIsToolsOpen(!isToolsOpen)}
                activeSection={activeSection}
                onMenuItemClick={handleMenuItemClick}
              />
            </>
          ) : (
            <div className="px-2 space-y-4">
              {overviewItems.map((item, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (item.action) item.action();
                    if (item.section) handleMenuItemClick(item.section);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer
                            ${activeSection === item.section ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
                            transition-colors`}
                  style={activeSection === item.section ? { 
                    background: `linear-gradient(180deg, ${branding.primaryColor || '#3b82f6'}22, transparent)`,
                    borderTop: `2px solid ${branding.primaryColor || '#3b82f6'}`
                  } : {}}
                >
                  <item.icon className={`h-5 w-5 ${activeSection === item.section ? 'text-white' : 'text-gray-400'}`} />
                  <span className={`text-xs mt-1 ${activeSection === item.section ? 'text-white' : 'text-gray-400'}`}>
                    {item.label.split(' ')[0]}
                  </span>
                </div>
              ))}

              {managementItems.map((item, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (item.action) item.action();
                    if (item.section) handleMenuItemClick(item.section);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer
                            ${activeSection === item.section ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
                            transition-colors`}
                  style={activeSection === item.section ? { 
                    background: `linear-gradient(180deg, ${branding.primaryColor || '#3b82f6'}22, transparent)`,
                    borderTop: `2px solid ${branding.primaryColor || '#3b82f6'}`
                  } : {}}
                >
                  <item.icon className={`h-5 w-5 ${activeSection === item.section ? 'text-white' : 'text-gray-400'}`} />
                  <span className={`text-xs mt-1 ${activeSection === item.section ? 'text-white' : 'text-gray-400'}`}>
                    {item.label.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* User section removed - Clerk disabled */}
      </div>
    </aside>
  );
};

export default Sidebar;