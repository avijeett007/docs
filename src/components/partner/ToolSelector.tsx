'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiSearch, FiLoader, FiZap, FiFilter, FiCheck } from 'react-icons/fi';
import clsx from 'clsx';

// Retell built-in tools available out of the box
const RETELL_BUILTIN_TOOLS: ToolSchema[] = [
  {
    appName: 'retell',
    toolName: 'end_call',
    displayName: 'End Call',
    description: 'End the call with user',
    category: 'call_control',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    appName: 'retell',
    toolName: 'transfer_call',
    displayName: 'Transfer Call',
    description: 'Transfer call to another number or agent',
    category: 'call_control',
    inputSchema: {
      type: 'object',
      properties: {
        transfer_destination: {
          type: 'object',
          description: 'Destination to transfer the call to'
        },
        transfer_option: {
          type: 'object',
          description: 'Transfer options (cold/warm transfer settings)'
        }
      },
      required: ['transfer_destination', 'transfer_option']
    }
  },

  {
    appName: 'retell',
    toolName: 'send_sms',
    displayName: 'Send SMS',
    description: 'Send SMS message to user',
    category: 'communication',
    inputSchema: {
      type: 'object',
      properties: {
        sms_content: {
          type: 'object',
          description: 'SMS content configuration (predefined or inferred)'
        }
      },
      required: ['sms_content']
    }
  },
  {
    appName: 'retell',
    toolName: 'press_digit',
    displayName: 'Press Digit',
    description: 'Press DTMF digit during call (for IVR navigation)',
    category: 'call_control',
    inputSchema: {
      type: 'object',
      properties: {
        delay_ms: {
          type: 'integer',
          description: 'Delay in milliseconds before pressing digit (0-5000ms)',
          default: 1000
        }
      }
    }
  },
  {
    appName: 'retell',
    toolName: 'extract_dynamic_variable',
    displayName: 'Extract Dynamic Variable',
    description: 'Extract and store dynamic variables from conversation',
    category: 'data_extraction',
    inputSchema: {
      type: 'object',
      properties: {
        variables: {
          type: 'array',
          description: 'Array of variables to extract from the conversation'
        }
      },
      required: ['variables']
    }
  }
];

interface ToolSchema {
  appName: string;
  toolName: string;
  displayName: string;
  description: string;
  category?: string;
  inputSchema: any;
  outputSchema?: any;
  examples?: any;
}

interface ToolSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  availableApps: Record<string, ToolSchema[]>;
  isLoading: boolean;
  onSelectTool: (selection: { appName: string; toolName: string; toolSchema: ToolSchema }) => void;
  existingFunctionCalls: Array<{ appName: string; toolName: string }>;
  includeRetellTools?: boolean; // Optional prop to include Retell built-in tools
}

const ToolSelector: React.FC<ToolSelectorProps> = ({
  isOpen,
  onClose,
  customerId,
  availableApps,
  isLoading,
  onSelectTool,
  existingFunctionCalls,
  includeRetellTools = true // Default to true for backward compatibility
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<string>('all');

  // Get all available tools with app context
  const allTools = useMemo(() => {
    const tools: (ToolSchema & { isAlreadyAdded: boolean })[] = [];

    // Add Retell built-in tools first (only if includeRetellTools is true)
    if (includeRetellTools) {
      RETELL_BUILTIN_TOOLS.forEach(tool => {
        const isAlreadyAdded = existingFunctionCalls?.some(
          fc => fc.appName === tool.appName && fc.toolName === tool.toolName
        ) || false;
        tools.push({ ...tool, isAlreadyAdded });
      });
    }

    // Add Composio tools from connected apps
    Object.entries(availableApps).forEach(([appName, appTools]) => {
      appTools.forEach(tool => {
        const isAlreadyAdded = existingFunctionCalls?.some(
          fc => fc.appName === appName && fc.toolName === tool.toolName
        ) || false;

        tools.push({
          ...tool,
          appName,
          isAlreadyAdded
        });
      });
    });

    return tools;
  }, [availableApps, existingFunctionCalls, includeRetellTools]);

  // Get unique categories and apps
  const categories = useMemo(() => {
    const cats = new Set(allTools.map(tool => tool.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [allTools]);

  const apps = useMemo(() => {
    const appList = includeRetellTools ? ['retell', ...Object.keys(availableApps)] : Object.keys(availableApps);
    return [...new Set(appList)].sort();
  }, [availableApps, includeRetellTools]);

  // Filter tools based on search and filters
  const filteredTools = useMemo(() => {
    return allTools.filter(tool => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          tool.displayName.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query) ||
          tool.appName.toLowerCase().includes(query) ||
          tool.toolName.toLowerCase().includes(query);
        
        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && tool.category !== selectedCategory) {
        return false;
      }

      // App filter
      if (selectedApp !== 'all' && tool.appName !== selectedApp) {
        return false;
      }

      return true;
    });
  }, [allTools, searchQuery, selectedCategory, selectedApp]);

  const handleSelectTool = (tool: ToolSchema) => {
    onSelectTool({
      appName: tool.appName,
      toolName: tool.toolName,
      toolSchema: tool
    });
  };

  const getAppIcon = (appName: string) => {
    const iconMap: Record<string, string> = {
      retell: '🤖',
      gmail: '📧',
      slack: '💬',
      notion: '📝',
      airtable: '📊',
      hubspot: '🏢',
      salesforce: '☁️',
      shopify: '🛍️',
      googlecalendar: '📅',
      ghl: '🎯',
      internal: '⚡' // Internal tools icon
    };
    return iconMap[appName.toLowerCase()] || '🔧';
  };

  const getCategoryColor = (category?: string) => {
    const colorMap: Record<string, string> = {
      'call_control': 'bg-red-100 text-red-800',
      'scheduling': 'bg-blue-100 text-blue-800',
      'data_extraction': 'bg-purple-100 text-purple-800',
      'communication': 'bg-green-100 text-green-800',
      'productivity': 'bg-emerald-100 text-emerald-800',
      'crm': 'bg-violet-100 text-violet-800',
      'ecommerce': 'bg-orange-100 text-orange-800',
      'analytics': 'bg-indigo-100 text-indigo-800',
      'automation': 'bg-pink-100 text-pink-800'
    };
    return colorMap[category?.toLowerCase() || ''] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-gray-900 border border-gray-700 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <FiZap className="w-6 h-6 text-amber-400" />
                    <Dialog.Title className="text-xl font-semibold text-white">
                      Select Tools for Function Calls
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Filters */}
                <div className="p-6 border-b border-gray-700 space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search tools..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  {/* Filter Row */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <FiFilter className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">Filters:</span>
                    </div>
                    
                    {/* App Filter */}
                    <select
                      value={selectedApp}
                      onChange={(e) => setSelectedApp(e.target.value)}
                      className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="all">All Apps</option>
                      {apps.map(app => (
                        <option key={app} value={app}>
                          {getAppIcon(app)} {app}
                        </option>
                      ))}
                    </select>

                    {/* Category Filter */}
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex items-center gap-3 text-gray-400">
                        <FiLoader className="w-6 h-6 animate-spin" />
                        <span>Loading available tools...</span>
                      </div>
                    </div>
                  ) : filteredTools.length === 0 ? (
                    <div className="text-center py-12">
                      <FiZap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-400 mb-2">
                        {Object.keys(availableApps).length === 0 
                          ? 'No Connected Apps' 
                          : 'No Tools Found'
                        }
                      </h4>
                      <p className="text-gray-500">
                        {Object.keys(availableApps).length === 0 
                          ? 'This customer needs to connect apps first to enable function calls.'
                          : 'Try adjusting your search or filters to find tools.'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                      {filteredTools.map((tool, index) => (
                        <div
                          key={`${tool.appName}-${tool.toolName}-${index}`}
                          className={clsx(
                            "p-4 border rounded-lg transition-all cursor-pointer",
                            tool.isAlreadyAdded
                              ? "border-green-600 bg-green-900/20"
                              : "border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-750"
                          )}
                          onClick={() => !tool.isAlreadyAdded && handleSelectTool(tool)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">{getAppIcon(tool.appName)}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-white">{tool.displayName}</h4>
                                  {tool.appName === 'retell' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      Built-in
                                    </span>
                                  )}
                                  {tool.appName === 'ghl' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                      GHL
                                    </span>
                                  )}
                                  {tool.appName === 'internal' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                      Internal
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400">{tool.appName}</p>
                              </div>
                            </div>
                            {tool.isAlreadyAdded && (
                              <div className="flex items-center gap-1 text-green-400 text-sm">
                                <FiCheck className="w-4 h-4" />
                                <span>Added</span>
                              </div>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-300 mb-3 line-clamp-2">
                            {tool.description}
                          </p>
                          
                          {tool.category && (
                            <span className={clsx(
                              "inline-block px-2 py-1 rounded-full text-xs font-medium",
                              getCategoryColor(tool.category)
                            )}>
                              {tool.category}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-700">
                  <div className="text-sm text-gray-400">
                    {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''} available
                  </div>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ToolSelector;
