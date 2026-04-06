'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  FiX,
  FiCheck,
  FiLock,
  FiMail,
  FiCalendar,
  FiMessageSquare,
  FiShoppingBag,
  FiFileText,
  FiDatabase,
  FiUsers,
  FiTrendingUp,
  FiGlobe,
  FiPhone
} from 'react-icons/fi';

interface AppInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  category: 'free' | 'standard' | 'premium';
}

const ALL_APPS: AppInfo[] = [
  // Free Apps
  {
    id: 'gmail',
    name: 'gmail',
    displayName: 'Gmail',
    description: 'Send and manage emails',
    icon: FiMail,
    color: '#EA4335',
    category: 'free'
  },
  {
    id: 'googlecalendar',
    name: 'googlecalendar',
    displayName: 'Google Calendar',
    description: 'Manage calendar events',
    icon: FiCalendar,
    color: '#4285F4',
    category: 'free'
  },
  // Standard Apps
  {
    id: 'ghl',
    name: 'gohighlevel',
    displayName: 'GoHighLevel',
    description: 'Calendar booking and CRM management',
    icon: FiCalendar,
    color: '#3B82F6',
    category: 'standard'
  },
  {
    id: 'slack',
    name: 'slack',
    displayName: 'Slack',
    description: 'Team communication',
    icon: FiMessageSquare,
    color: '#4A154B',
    category: 'standard'
  },
  {
    id: 'shopify',
    name: 'shopify',
    displayName: 'Shopify',
    description: 'E-commerce management',
    icon: FiShoppingBag,
    color: '#96BF48',
    category: 'standard'
  },
  {
    id: 'notion',
    name: 'notion',
    displayName: 'Notion',
    description: 'Notes and project management',
    icon: FiFileText,
    color: '#000000',
    category: 'standard'
  },
  {
    id: 'airtable',
    name: 'airtable',
    displayName: 'Airtable',
    description: 'Database and project management',
    icon: FiDatabase,
    color: '#18BFFF',
    category: 'standard'
  },
  {
    id: 'hubspot',
    name: 'hubspot',
    displayName: 'HubSpot',
    description: 'CRM and marketing',
    icon: FiUsers,
    color: '#FF7A59',
    category: 'premium'
  },
  {
    id: 'salesforce',
    name: 'salesforce',
    displayName: 'Salesforce',
    description: 'Customer relationship management',
    icon: FiTrendingUp,
    color: '#00A1E0',
    category: 'premium'
  },
  {
    id: 'firecrawl',
    name: 'firecrawl',
    displayName: 'Firecrawl',
    description: 'Web scraping and data extraction',
    icon: FiGlobe,
    color: '#FF6B35',
    category: 'standard'
  },
  {
    id: 'whatsapp',
    name: 'whatsapp',
    displayName: 'WhatsApp',
    description: 'Send messages and manage WhatsApp Business',
    icon: FiPhone,
    color: '#25D366',
    category: 'premium'
  }
];

interface AppSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedApps: string[]) => void;
  isFreeForever: boolean;
  currentApps: string[];
}

export default function AppSelectionModal({
  isOpen,
  onClose,
  onSave,
  isFreeForever,
  currentApps
}: AppSelectionModalProps) {
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setSelectedApps(new Set(currentApps));
    }
  }, [isOpen, currentApps]);

  const freeApps = ALL_APPS.filter(app => app.category === 'free');
  const standardApps = ALL_APPS.filter(app => app.category === 'standard');
  const premiumApps = ALL_APPS.filter(app => app.category === 'premium');

  const toggleApp = (appName: string, category: 'free' | 'standard' | 'premium') => {
    if (category !== 'free' && isFreeForever) return;

    setSelectedApps(prev => {
      const next = new Set(prev);
      if (next.has(appName)) {
        next.delete(appName);
      } else {
        next.add(appName);
      }
      return next;
    });
  };

  const selectAllFree = () => {
    setSelectedApps(prev => {
      const next = new Set(prev);
      freeApps.forEach(app => next.add(app.name));
      return next;
    });
  };

  const selectAllStandard = () => {
    if (isFreeForever) return;
    setSelectedApps(prev => {
      const next = new Set(prev);
      standardApps.forEach(app => next.add(app.name));
      return next;
    });
  };

  const selectAllPremium = () => {
    if (isFreeForever) return;
    setSelectedApps(prev => {
      const next = new Set(prev);
      premiumApps.forEach(app => next.add(app.name));
      return next;
    });
  };

  const selectAll = () => {
    selectAllFree();
    if (!isFreeForever) {
      selectAllStandard();
      selectAllPremium();
    }
  };

  const clearAll = () => {
    setSelectedApps(new Set());
  };

  const handleSave = () => {
    onSave(Array.from(selectedApps));
  };

  const selectedCount = selectedApps.size;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-900 border border-gray-700 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                  <div>
                    <Dialog.Title className="text-xl font-semibold text-white">
                      Select Apps for Customer
                    </Dialog.Title>
                    <p className="text-sm text-gray-400 mt-1">
                      Choose which integrations this customer can access
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="px-6 pt-4 flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-lg hover:bg-blue-600/30 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={selectAllFree}
                    className="px-3 py-1.5 text-xs font-medium bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg hover:bg-green-600/30 transition-colors"
                  >
                    Select All Free
                  </button>
                  <button
                    onClick={selectAllPremium}
                    className="px-3 py-1.5 text-xs font-medium bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded-lg hover:bg-purple-600/30 transition-colors"
                  >
                    Select Premium
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-700/50 text-gray-400 border border-gray-600/30 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Clear All
                  </button>
                  <div className="ml-auto text-sm text-gray-400">
                    {selectedCount} app{selectedCount !== 1 ? 's' : ''} selected
                  </div>
                </div>

                {/* App Sections */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                  {/* Free Apps Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider">
                        Free Apps
                      </h3>
                      <span className="text-xs text-gray-500">Available on all plans</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {freeApps.map(app => {
                        const isSelected = selectedApps.has(app.name);
                        const Icon = app.icon;
                        return (
                          <button
                            key={app.id}
                            onClick={() => toggleApp(app.name, 'free')}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left ${
                              isSelected
                                ? 'bg-green-500/10 border-green-500/40 ring-1 ring-green-500/20'
                                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                            }`}
                          >
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${app.color}20`, border: `1px solid ${app.color}30` }}
                            >
                              <Icon className="w-5 h-5" style={{ color: app.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white">{app.displayName}</div>
                              <div className="text-xs text-gray-400 truncate">{app.description}</div>
                            </div>
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-green-500 border-green-500'
                                : 'border-gray-600'
                            }`}>
                              {isSelected && <FiCheck className="w-3 h-3 text-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Premium Apps Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">
                        Premium Apps
                      </h3>
                      <span className="text-xs text-gray-500">Available on paid plans</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {premiumApps.map(app => {
                        const isSelected = selectedApps.has(app.name);
                        const isLocked = isFreeForever;
                        const Icon = app.icon;
                        return (
                          <button
                            key={app.id}
                            onClick={() => toggleApp(app.name, 'premium')}
                            disabled={isLocked}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left ${
                              isLocked
                                ? 'bg-gray-800/30 border-gray-700/30 opacity-50 cursor-not-allowed'
                                : isSelected
                                ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/20'
                                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                            }`}
                          >
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: isLocked ? '#374151' : `${app.color}20`,
                                border: `1px solid ${isLocked ? '#4B5563' : app.color + '30'}`
                              }}
                            >
                              {isLocked ? (
                                <FiLock className="w-5 h-5 text-gray-500" />
                              ) : (
                                <Icon className="w-5 h-5" style={{ color: app.color }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white">{app.displayName}</div>
                              <div className="text-xs text-gray-400 truncate">{app.description}</div>
                            </div>
                            {isLocked ? (
                              <FiLock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            ) : (
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-purple-500 border-purple-500'
                                  : 'border-gray-600'
                              }`}>
                                {isSelected && <FiCheck className="w-3 h-3 text-white" />}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Standard Apps Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                        Standard Apps
                      </h3>
                      {isFreeForever ? (
                        <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FiLock className="w-3 h-3" />
                          Upgrade required
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Available on paid plans</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {standardApps.map(app => {
                        const isSelected = selectedApps.has(app.name);
                        const isLocked = isFreeForever;
                        const Icon = app.icon;
                        return (
                          <button
                            key={app.id}
                            onClick={() => toggleApp(app.name, 'standard')}
                            disabled={isLocked}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left ${
                              isLocked
                                ? 'bg-gray-800/30 border-gray-700/30 opacity-50 cursor-not-allowed'
                                : isSelected
                                ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20'
                                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                            }`}
                          >
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: isLocked ? '#374151' : `${app.color}20`,
                                border: `1px solid ${isLocked ? '#4B5563' : app.color + '30'}`
                              }}
                            >
                              {isLocked ? (
                                <FiLock className="w-5 h-5 text-gray-500" />
                              ) : (
                                <Icon className="w-5 h-5" style={{ color: app.color }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white">{app.displayName}</div>
                              <div className="text-xs text-gray-400 truncate">{app.description}</div>
                            </div>
                            {isLocked ? (
                              <FiLock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            ) : (
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-amber-500 border-amber-500'
                                  : 'border-gray-600'
                              }`}>
                                {isSelected && <FiCheck className="w-3 h-3 text-white" />}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-700">
                  <div className="text-sm text-gray-400">
                    {selectedCount === 0 ? (
                      <span className="text-amber-400">Select at least one app</span>
                    ) : (
                      <span>{selectedCount} app{selectedCount !== 1 ? 's' : ''} will be available to this customer</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={selectedCount === 0}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      Save Selection
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
