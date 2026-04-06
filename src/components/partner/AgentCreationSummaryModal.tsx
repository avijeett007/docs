'use client';

import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiCheck, FiZap, FiDatabase, FiSettings, FiUser, FiAlertTriangle } from 'react-icons/fi';
import clsx from 'clsx';

interface FunctionCall {
  id?: string;
  appName: string;
  toolName: string;
  customName: string;
  customDescription: string;
  isConfigured?: boolean;
  webhookUrl?: string;
  parameterValues?: Record<string, any>; // Store pre-filled parameter values
  parameters?: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  }; // JSON schema for Retell
  // Retell-specific execution settings
  speakDuringExecution?: boolean;
  speakAfterExecution?: boolean;
  executionMessageDescription?: string;
  timeoutMs?: number;
  // GHL-specific settings
  calendarId?: string;
  calendarName?: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  fileCount: number;
  totalSize: number;
  totalWebsiteUrls?: number;
  totalWebsitePages?: number;
  scrapedWebsitePages?: number;
}

interface AgentSummaryData {
  // Basic Info
  agentName: string;
  generalPrompt: string;
  customerId: string;
  customerName?: string;
  
  // Voice & Language
  voiceId: string;
  voiceName?: string;
  language: string;
  beginMessage?: string;
  
  // Advanced Settings
  advancedSettings?: {
    voiceSpeed?: number;
    voiceTemperature?: number;
    voiceModel?: string;
    model?: string;
    modelTemperature?: number;
    modelHighPriority?: boolean;
    interruptionSensitivity?: number;
    enableBackchannel?: boolean;
    normalizeForSpeech?: boolean;
    maxCallDurationMs?: number;
    endCallAfterSilenceMs?: number;
    webhookUrl?: string;
  };
  
  // Function Calls
  functionCalls: FunctionCall[];
  
  // Knowledge Bases
  knowledgeBaseIds: string[];
  knowledgeBases: KnowledgeBase[];
}

interface AgentCreationSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  agentData: AgentSummaryData;
  isCreating: boolean;
}

const AgentCreationSummaryModal: React.FC<AgentCreationSummaryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  agentData,
  isCreating
}) => {
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
      googlecalendar: '📅'
    };
    return iconMap[appName.toLowerCase()] || '🔧';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
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
          <div className="fixed inset-0 bg-black/75" />
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
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <FiCheck className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-white">
                        Confirm Agent Creation
                      </Dialog.Title>
                      <p className="text-gray-400 text-sm">
                        Review your agent configuration before creating
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
                  {/* Basic Information */}
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      <FiUser className="w-5 h-5 text-blue-400" />
                      <h3 className="font-semibold text-white">Basic Information</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-400">Agent Name</label>
                        <p className="text-white font-medium">{agentData.agentName}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Customer</label>
                        <p className="text-white font-medium">{agentData.customerName || agentData.customerId}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Voice</label>
                        <p className="text-white font-medium">{agentData.voiceName || agentData.voiceId}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Language</label>
                        <p className="text-white font-medium">{agentData.language}</p>
                      </div>
                    </div>
                    {agentData.beginMessage && (
                      <div className="mt-4">
                        <label className="text-sm font-medium text-gray-400">Begin Message</label>
                        <p className="text-white bg-gray-800 p-3 rounded-lg mt-1">{agentData.beginMessage}</p>
                      </div>
                    )}
                    <div className="mt-4">
                      <label className="text-sm font-medium text-gray-400">General Prompt</label>
                      <p className="text-white bg-gray-800 p-3 rounded-lg mt-1 max-h-32 overflow-y-auto">{agentData.generalPrompt}</p>
                    </div>
                  </div>

                  {/* Function Calls */}
                  {agentData.functionCalls.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <FiZap className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-white">Function Calls ({agentData.functionCalls.length})</h3>
                      </div>
                      <div className="space-y-3">
                        {agentData.functionCalls.map((fc, index) => (
                          <div key={index} className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                            <div className="flex items-start gap-3">
                              <div className="text-xl">{getAppIcon(fc.appName)}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-white">{fc.customName}</h4>
                                  {fc.appName === 'retell' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      Built-in
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400 mb-2">{fc.customDescription}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>App: {fc.appName}</span>
                                  <span>Tool: {fc.toolName}</span>
                                  {fc.timeoutMs && <span>Timeout: {formatDuration(fc.timeoutMs)}</span>}
                                </div>
                                {fc.executionMessageDescription && (
                                  <p className="text-xs text-purple-300 mt-2 italic">
                                    "{fc.executionMessageDescription}"
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Knowledge Bases */}
                  {agentData.knowledgeBases.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <FiDatabase className="w-5 h-5 text-green-400" />
                        <h3 className="font-semibold text-white">Knowledge Bases ({agentData.knowledgeBases.length})</h3>
                      </div>
                      <div className="space-y-3">
                        {agentData.knowledgeBases.map((kb) => (
                          <div key={kb.id} className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-white">{kb.name}</h4>
                                {kb.description && (
                                  <p className="text-sm text-gray-400 mt-1">{kb.description}</p>
                                )}
                              </div>
                              <div className="text-right text-sm text-gray-400">
                                <div>{kb.fileCount} files</div>
                                {(kb.totalWebsiteUrls || 0) > 0 && (
                                  <div>{kb.totalWebsiteUrls} websites ({kb.totalWebsitePages || 0} pages)</div>
                                )}
                                <div>{formatFileSize(kb.totalSize)}</div>
                                {(kb.scrapedWebsitePages || 0) > 0 && (
                                  <div className="text-green-400">{kb.scrapedWebsitePages} pages ready</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Advanced Settings */}
                  {agentData.advancedSettings && (
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <FiSettings className="w-5 h-5 text-orange-400" />
                        <h3 className="font-semibold text-white">Advanced Settings</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        {agentData.advancedSettings.model && (
                          <div>
                            <label className="text-gray-400">Model</label>
                            <p className="text-white font-medium">{agentData.advancedSettings.model}</p>
                          </div>
                        )}
                        {agentData.advancedSettings.modelTemperature !== undefined && (
                          <div>
                            <label className="text-gray-400">Model Temperature</label>
                            <p className="text-white font-medium">{agentData.advancedSettings.modelTemperature}</p>
                          </div>
                        )}
                        {agentData.advancedSettings.voiceSpeed !== undefined && (
                          <div>
                            <label className="text-gray-400">Voice Speed</label>
                            <p className="text-white font-medium">{agentData.advancedSettings.voiceSpeed}x</p>
                          </div>
                        )}
                        {agentData.advancedSettings.interruptionSensitivity !== undefined && (
                          <div>
                            <label className="text-gray-400">Interruption Sensitivity</label>
                            <p className="text-white font-medium">{agentData.advancedSettings.interruptionSensitivity}</p>
                          </div>
                        )}
                        {agentData.advancedSettings.maxCallDurationMs && (
                          <div>
                            <label className="text-gray-400">Max Call Duration</label>
                            <p className="text-white font-medium">{formatDuration(agentData.advancedSettings.maxCallDurationMs)}</p>
                          </div>
                        )}
                        {agentData.advancedSettings.webhookUrl && (
                          <div className="md:col-span-3">
                            <label className="text-gray-400">Webhook URL</label>
                            <p className="text-white font-medium break-all">{agentData.advancedSettings.webhookUrl}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Warning if no functions or knowledge bases */}
                  {agentData.functionCalls.length === 0 && agentData.knowledgeBases.length === 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FiAlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-400">Basic Agent Configuration</h4>
                          <p className="text-yellow-300 text-sm mt-1">
                            This agent will be created with basic capabilities only. No function calls or knowledge bases are configured.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800/30">
                  <div className="text-sm text-gray-400">
                    This will create a new Retell agent with the configuration above.
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={onClose}
                      disabled={isCreating}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onConfirm}
                      disabled={isCreating}
                      className={clsx(
                        'flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors',
                        isCreating
                          ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      )}
                    >
                      {isCreating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-blue-200 border-t-transparent rounded-full animate-spin" />
                          Creating Agent...
                        </>
                      ) : (
                        <>
                          <FiCheck className="w-4 h-4" />
                          Create Agent
                        </>
                      )}
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
};

export default AgentCreationSummaryModal;
