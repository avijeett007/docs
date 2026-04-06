'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FiX, FiSave, FiLoader, FiUser, FiCheck, FiSettings, FiAlertTriangle, FiZap } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import FunctionCallsPanel from './FunctionCallsPanel';

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
  customerId?: string;
}

interface RetellChatAgentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: any;
  customers: Customer[];
  onSaved: () => void;
}

type TabType = 'settings' | 'customer' | 'functions';

export default function RetellChatAgentEditModal({
  isOpen,
  onClose,
  agent,
  customers,
  onSaved,
}: RetellChatAgentEditModalProps) {
  const [currentTab, setCurrentTab] = useState<TabType>('settings');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Settings tab state
  const [agentName, setAgentName] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [status, setStatus] = useState('active');
  const [autoCloseMessage, setAutoCloseMessage] = useState('');
  const [endChatAfterSilenceMs, setEndChatAfterSilenceMs] = useState<number | null>(null);
  const [partnerWebhookUrl, setPartnerWebhookUrl] = useState('');
  const [creditConfig, setCreditConfig] = useState({
    billing_mode: 'per_conversation' as string,
    credits_per_unit: 1,
    minimum_credits: 1,
  });

  // Customer tab state
  const [customerId, setCustomerId] = useState('');

  // Functions tab state
  const [functionCalls, setFunctionCalls] = useState<any[]>([]);

  // Live data from Retell
  const [retellData, setRetellData] = useState<any>(null);

  // Initialize form when agent changes
  useEffect(() => {
    if (agent && isOpen) {
      setAgentName(agent.name || '');
      setLanguage(agent.language || 'en-US');
      setStatus(agent.status || 'active');
      setAutoCloseMessage(agent.autoCloseMessage || '');
      setEndChatAfterSilenceMs(agent.endChatAfterSilenceMs || null);
      setPartnerWebhookUrl(agent.partnerWebhookUrl || '');
      setCustomerId(agent.customerId || '');
      setCreditConfig(
        agent.creditConfig || {
          billing_mode: 'per_conversation',
          credits_per_unit: 1,
          minimum_credits: 1,
        }
      );
      setFunctionCalls(agent.functionCalls || []);
      setHasUnsavedChanges(false);

      // Set initial tab
      setCurrentTab(agent.customerId ? 'settings' : 'customer');

      // Fetch live data from Retell
      fetchLiveData();
    }
  }, [agent, isOpen]);

  const fetchLiveData = async () => {
    if (!agent?.id) return;
    try {
      setSyncing(true);
      const token = localStorage.getItem('partner_token');
      const response = await fetch(
        `/api/partner/retell-chat-agents/${agent.id}?sync=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.retellData) {
          setRetellData(data.retellData);
          // Update form with live data
          if (data.retellData.agent_name) setAgentName(data.retellData.agent_name);
          if (data.retellData.language) setLanguage(data.retellData.language);
          if (data.retellData.auto_close_message) setAutoCloseMessage(data.retellData.auto_close_message);
          if (data.retellData.end_chat_after_silence_ms) setEndChatAfterSilenceMs(data.retellData.end_chat_after_silence_ms);
        }
      }
    } catch (error) {
      console.error('[RetellChatAgentEditModal] Failed to fetch live data:', error);
    } finally {
      setSyncing(false);
    }
  };

  const markDirty = () => setHasUnsavedChanges(true);

  const getCustomerName = (c: Customer) =>
    c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;

  const handleSave = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');

      const response = await fetch(`/api/partner/retell-chat-agents/${agent.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: agentName,
          language,
          status,
          autoCloseMessage: autoCloseMessage || null,
          endChatAfterSilenceMs: endChatAfterSilenceMs || null,
          customerId: customerId || null,
          partnerWebhookUrl: partnerWebhookUrl || null,
          creditConfig,
        }),
      });

      if (response.ok) {
        toast.success('Agent settings updated');
        setHasUnsavedChanges(false);
        onSaved();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update agent');
      }
    } catch (error) {
      toast.error('Failed to update agent');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowConfirmClose(true);
      return;
    }
    onClose();
  };

  const confirmClose = () => {
    setShowConfirmClose(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  // Get system prompt from response engine (read-only display)
  const systemPrompt = retellData?.response_engine?.llm_id
    ? null // If using llm_id, prompt is managed on Retell
    : retellData?.response_engine?.system_prompt || '';

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'settings', label: 'Settings', icon: <FiSettings className="w-4 h-4" /> },
    { id: 'customer', label: 'Customer & Knowledge', icon: <FiUser className="w-4 h-4" /> },
    { id: 'functions', label: 'Functions', icon: <FiZap className="w-4 h-4" /> },
  ];

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-6xl h-[90vh] bg-gray-900 rounded-xl shadow-xl border border-gray-800 flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-white">
                        Edit Chat Agent
                      </Dialog.Title>
                      <p className="text-sm text-gray-400 mt-1">
                        {agent?.name} <span className="text-gray-600 font-mono text-xs ml-2">{agent?.id?.slice(0, 12)}…</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {syncing && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <FiLoader className="w-3 h-3 animate-spin" /> Syncing…
                        </span>
                      )}
                      {hasUnsavedChanges && (
                        <span className="text-xs text-amber-400">Unsaved changes</span>
                      )}
                      <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                        <FiX className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-gray-800 px-6">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setCurrentTab(tab.id)}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                          currentTab === tab.id
                            ? 'border-emerald-500 text-emerald-400'
                            : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                        )}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {/* ─── Settings Tab ─── */}
                    {currentTab === 'settings' && (
                      <div className="space-y-6 max-w-3xl">
                        {/* Read-only info */}
                        <div className="bg-gray-800/50 rounded-lg p-4 text-sm border border-gray-700">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-gray-400">Engine: <span className="text-gray-200">{agent?.responseEngineType}</span></div>
                            <div className="text-gray-400">Language: <span className="text-gray-200">{language}</span></div>
                            <div className="text-gray-400">Public: <span className="text-gray-200">{agent?.isPublic ? 'Yes' : 'No'}</span></div>
                            <div className="text-gray-400">Widgets: <span className="text-gray-200">{agent?.widgetCount || 0}</span></div>
                          </div>
                        </div>

                        {/* Agent Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Agent Name</label>
                          <input
                            type="text"
                            value={agentName}
                            onChange={(e) => { setAgentName(e.target.value); markDirty(); }}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          />
                        </div>

                        {/* System Prompt (read-only if managed by Retell LLM) */}
                        {systemPrompt !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              System Prompt <span className="text-gray-500 text-xs">(from Retell — read-only)</span>
                            </label>
                            <textarea
                              value={systemPrompt}
                              readOnly
                              rows={4}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 cursor-not-allowed resize-none"
                            />
                          </div>
                        )}

                        {/* Language */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
                          <select
                            value={language}
                            onChange={(e) => { setLanguage(e.target.value); markDirty(); }}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="en-US">English (US)</option>
                            <option value="en-GB">English (UK)</option>
                            <option value="es-ES">Spanish</option>
                            <option value="fr-FR">French</option>
                            <option value="de-DE">German</option>
                            <option value="pt-BR">Portuguese (BR)</option>
                            <option value="ja-JP">Japanese</option>
                            <option value="zh-CN">Chinese (Simplified)</option>
                            <option value="multi">Multilingual</option>
                          </select>
                        </div>

                        {/* Status */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                          <select
                            value={status}
                            onChange={(e) => { setStatus(e.target.value); markDirty(); }}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>

                        {/* Auto Close Message */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Auto Close Message</label>
                          <input
                            type="text"
                            value={autoCloseMessage}
                            onChange={(e) => { setAutoCloseMessage(e.target.value); markDirty(); }}
                            placeholder="Message sent when chat auto-closes"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {/* End Chat After Silence */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            End Chat After Silence (seconds)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={endChatAfterSilenceMs ? Math.round(endChatAfterSilenceMs / 1000) : ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setEndChatAfterSilenceMs(val > 0 ? val * 1000 : null);
                              markDirty();
                            }}
                            placeholder="e.g. 600 (10 minutes)"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <hr className="border-gray-700" />

                        {/* Partner Webhook URL */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Partner Webhook URL</label>
                          <input
                            type="url"
                            value={partnerWebhookUrl}
                            onChange={(e) => { setPartnerWebhookUrl(e.target.value); markDirty(); }}
                            placeholder="https://your-server.com/webhook"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">Knotie will forward chat events to this URL</p>
                        </div>

                        <hr className="border-gray-700" />

                        {/* Billing Config */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-300 mb-3">Billing Configuration</h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Billing Mode</label>
                              <select
                                value={creditConfig.billing_mode}
                                onChange={(e) => { setCreditConfig({ ...creditConfig, billing_mode: e.target.value }); markDirty(); }}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                              >
                                <option value="per_conversation">Per Conversation</option>
                                <option value="per_message_pair">Per Message Pair</option>
                                <option value="per_10_messages">Per 10 Messages</option>
                                <option value="per_minute">Per Minute</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Credits per Unit</label>
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={creditConfig.credits_per_unit}
                                  onChange={(e) => { setCreditConfig({ ...creditConfig, credits_per_unit: parseFloat(e.target.value) || 1 }); markDirty(); }}
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Minimum Credits</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={creditConfig.minimum_credits}
                                  onChange={(e) => { setCreditConfig({ ...creditConfig, minimum_credits: parseInt(e.target.value) || 1 }); markDirty(); }}
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── Customer & Knowledge Tab ─── */}
                    {currentTab === 'customer' && (
                      <div className="space-y-6 max-w-3xl">
                        {agent?.customerId ? (
                          <>
                            {/* Current Customer Info */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <FiUser className="w-5 h-5 text-emerald-400" />
                                <h3 className="text-lg font-semibold text-white">Current Customer Assignment</h3>
                              </div>
                              {(() => {
                                const currentCustomer = customers.find(c => c.id === agent.customerId || c.customerId === agent.customerId);
                                return currentCustomer ? (
                                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                      <FiCheck className="w-4 h-4" />
                                      <span className="font-medium">Agent is assigned to:</span>
                                    </div>
                                    <p className="text-white font-medium">{getCustomerName(currentCustomer)}</p>
                                    <p className="text-gray-400 text-sm mt-1">{currentCustomer.email}</p>
                                  </div>
                                ) : (
                                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                                      <FiAlertTriangle className="w-4 h-4" />
                                      <span className="font-medium">Customer not found</span>
                                    </div>
                                    <p className="text-gray-400 text-sm">
                                      The assigned customer may have been deleted or is no longer accessible.
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Reassign */}
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Reassign to Different Customer</label>
                              <select
                                value={customerId}
                                onChange={(e) => { setCustomerId(e.target.value); markDirty(); }}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                              >
                                <option value="">No customer assigned</option>
                                {customers.filter(c => c.customerId).map((c) => (
                                  <option key={c.id} value={c.id}>{getCustomerName(c)}</option>
                                ))}
                              </select>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <FiUser className="w-5 h-5 text-emerald-400" />
                              <h3 className="text-lg font-semibold text-white">Assign to Customer</h3>
                            </div>
                            <p className="text-gray-400 text-sm">
                              Assign this chat agent to a customer to enable billing and analytics tracking.
                            </p>
                            <select
                              value={customerId}
                              onChange={(e) => { setCustomerId(e.target.value); markDirty(); }}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">Select a customer...</option>
                              {customers.filter(c => c.customerId).map((c) => (
                                <option key={c.id} value={c.id}>{getCustomerName(c)}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Knowledge Base Tip */}
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <FiZap className="w-5 h-5 text-emerald-400 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-medium text-emerald-400 mb-2">💡 Knowledge Base Integration</h4>
                              <div className="space-y-1 text-sm text-emerald-300">
                                <p>Use the <span className="font-semibold">Functions</span> tab to add a <span className="font-semibold">Knowledge Base Query</span> function call.</p>
                                <p>• Cost: <span className="font-semibold text-emerald-400">2 Knotie Credits per query</span> (no monthly fee!)</p>
                                <p>• Works with your existing knowledge bases</p>
                              </div>
                              <p className="text-xs text-gray-400 mt-2">
                                Set up via <span className="text-emerald-400">Functions tab → Add Function Call → Internal Tools → Query Knowledge Base</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── Functions Tab ─── */}
                    {currentTab === 'functions' && (
                      <FunctionCallsPanel
                        customerId={customerId || agent?.customerId || ''}
                        agentId={agent?.id}
                        functionCalls={functionCalls}
                        onChange={(fcs) => { setFunctionCalls(fcs); markDirty(); }}
                        mode="edit"
                      />
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between p-6 border-t border-gray-800">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className={clsx(
                        'flex items-center gap-2 px-6 py-2 rounded-lg transition-colors',
                        loading
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      )}
                    >
                      {loading ? (
                        <>
                          <FiLoader className="w-4 h-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <FiSave className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Unsaved Changes Confirmation */}
      <Transition appear show={showConfirmClose} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowConfirmClose(false)}>
          <Transition.Child
            as="div"
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as="div"
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
                className="w-full max-w-md bg-gray-900 rounded-xl shadow-xl border border-gray-800 p-6"
              >
                <Dialog.Panel>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                      <FiAlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-white">
                        Unsaved Changes
                      </Dialog.Title>
                      <p className="text-sm text-gray-400">
                        You have unsaved changes. Are you sure you want to close?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 justify-end">
                    <button
                      onClick={() => setShowConfirmClose(false)}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmClose}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                    >
                      Close Anyway
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
