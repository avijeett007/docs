'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiPhone, FiUser, FiSettings, FiTrash2, FiEye, FiEyeOff, FiUserPlus, FiUserMinus, FiRefreshCw, FiKey, FiCopy, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { OwnershipBadge } from './OwnershipBadge';

const CONNECT_HUB_BASE_URL = process.env.NEXT_PUBLIC_CONNECT_HUB_URL;
if (process.env.NODE_ENV === 'development' && !CONNECT_HUB_BASE_URL) {
  console.warn(
    '[PhoneNumberDetailModal] NEXT_PUBLIC_CONNECT_HUB_URL is not set – ' +
      'the outbound webhook endpoint URL will not be displayed.'
  );
}

interface AgentMapping {
  id: string;
  agentProvider: string;
  agentId: string;
  agentName: string | null;
  customerId: string;
  status: string;
  createdAt: string;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  provider: string;
  status: string;
  regulatoryStatus: string;
  verificationStatus: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  canReceiveInbound: boolean;
  canSendOutbound: boolean;
  hideFromCustomer: boolean;
  ownership: 'partner' | 'customer';
  customer: {
    id: string;
    name: string;
    email: string;
    subaccountStatus: string;
  } | null;
  monthlyRecurringCost: number;
  purchaseInfo?: {
    purchasePrice: number;
    setupFee: number;
    monthlyRecurringCost: number;
    purchasedAt: string;
    status: string;
  } | null;
  agentMappings: AgentMapping[];
  hasAgentAssignment: boolean;
  isAssigned: boolean;
  purchasedAt: string;
  isImported: boolean;
  importedAt?: string;
  originalProvider?: string;
  countryCode: string;
  type: string;
}

interface PhoneNumberDetailModalProps {
  isOpen: boolean;
  phoneNumber: PhoneNumber | null;
  onClose: () => void;
  onAssignCustomer: () => void;
  onReassignCustomer: () => void;
  onUnassignCustomer: () => void;
  onAssignAgent: () => void;
  onReassignAgent: () => void;
  onUnassignAgent: () => void;
  onToggleVisibility: () => void;
  onDeletePhoneNumber: () => void;
  onRefreshCache?: () => void;
  isRefreshingCache?: boolean;
}

export default function PhoneNumberDetailModal({
  isOpen,
  phoneNumber,
  onClose,
  onAssignCustomer,
  onReassignCustomer,
  onUnassignCustomer,
  onAssignAgent,
  onReassignAgent,
  onUnassignAgent,
  onToggleVisibility,
  onDeletePhoneNumber,
  onRefreshCache,
  isRefreshingCache = false
}: PhoneNumberDetailModalProps) {
  // Webhook key state
  const [webhookKeyInfo, setWebhookKeyInfo] = useState<{
    apiKeyPrefix: string;
    isActive: boolean;
    createdAt: string;
  } | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isLoadingWebhookKey, setIsLoadingWebhookKey] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [isRevokingKey, setIsRevokingKey] = useState(false);
  const [webhookKeyCopied, setWebhookKeyCopied] = useState(false);
  const [webhookKeyError, setWebhookKeyError] = useState<string | null>(null);

  const hasOutboundAgent = phoneNumber?.agentMappings?.some(m => m.outboundEnabled && m.status === 'active') ?? false;

  // Fetch webhook key status when modal opens with an outbound-enabled phone number
  const fetchWebhookKeyStatus = useCallback(async () => {
    if (!phoneNumber?.id || !hasOutboundAgent) return;
    setIsLoadingWebhookKey(true);
    setWebhookKeyError(null);
    try {
      const res = await fetch(`/api/partner/phone-numbers/${phoneNumber.id}/outbound-webhook-key`);
      const data = await res.json();
      if (data.success && data.data) {
        setWebhookKeyInfo(data.data);
      } else {
        setWebhookKeyInfo(null);
      }
    } catch {
      setWebhookKeyError('Failed to load webhook key status');
    } finally {
      setIsLoadingWebhookKey(false);
    }
  }, [phoneNumber?.id, hasOutboundAgent]);

  useEffect(() => {
    if (isOpen && phoneNumber && hasOutboundAgent) {
      setGeneratedKey(null);
      setWebhookKeyCopied(false);
      fetchWebhookKeyStatus();
    } else {
      setWebhookKeyInfo(null);
      setGeneratedKey(null);
      setWebhookKeyCopied(false);
      setWebhookKeyError(null);
    }
  }, [isOpen, phoneNumber?.id, hasOutboundAgent, fetchWebhookKeyStatus]);

  const handleGenerateWebhookKey = async () => {
    if (!phoneNumber?.id) return;
    setIsGeneratingKey(true);
    setWebhookKeyError(null);
    setGeneratedKey(null);
    try {
      const res = await fetch(`/api/partner/phone-numbers/${phoneNumber.id}/outbound-webhook-key`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.data?.apiKey) {
        setGeneratedKey(data.data.apiKey);
        setWebhookKeyInfo({
          apiKeyPrefix: data.data.apiKeyPrefix,
          isActive: true,
          createdAt: data.data.createdAt,
        });
      } else {
        setWebhookKeyError(data.error || 'Failed to generate webhook key');
      }
    } catch {
      setWebhookKeyError('Failed to generate webhook key');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeWebhookKey = async () => {
    if (!phoneNumber?.id) return;
    setIsRevokingKey(true);
    setWebhookKeyError(null);
    try {
      const res = await fetch(`/api/partner/phone-numbers/${phoneNumber.id}/outbound-webhook-key`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setWebhookKeyInfo(null);
        setGeneratedKey(null);
      } else {
        setWebhookKeyError(data.error || 'Failed to revoke webhook key');
      }
    } catch {
      setWebhookKeyError('Failed to revoke webhook key');
    } finally {
      setIsRevokingKey(false);
    }
  };

  const handleCopyWebhookKey = async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      setWebhookKeyCopied(true);
      setTimeout(() => setWebhookKeyCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = generatedKey;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setWebhookKeyCopied(true);
      setTimeout(() => setWebhookKeyCopied(false), 2000);
    }
  };

  if (!isOpen || !phoneNumber) return null;

  const connectHubUrl = CONNECT_HUB_BASE_URL;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'in-use':
        return 'text-green-400 bg-green-400/10';
      case 'inactive':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'suspended':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'twilio':
        return 'text-red-400 bg-red-400/10';
      case 'telnyx':
        return 'text-purple-400 bg-purple-400/10';
      default:
        return 'text-blue-400 bg-blue-400/10';
    }
  };

  const getCapabilityBadges = (capabilities: PhoneNumber['capabilities']) => {
    const badges = [];
    if (capabilities.voice) badges.push('Voice');
    if (capabilities.sms) badges.push('SMS');
    if (capabilities.mms) badges.push('MMS');
    if (capabilities.fax) badges.push('Fax');
    return badges;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FiPhone className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-white">{phoneNumber.phoneNumber}</h2>
              {phoneNumber.friendlyName && (
                <p className="text-gray-400 text-sm">{phoneNumber.friendlyName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Basic Information</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Provider</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProviderColor(phoneNumber.provider)}`}>
                    {phoneNumber.provider.replace('imported_', '').charAt(0).toUpperCase() + phoneNumber.provider.replace('imported_', '').slice(1)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(phoneNumber.status)}`}>
                    {phoneNumber.status.charAt(0).toUpperCase() + phoneNumber.status.slice(1)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Ownership</span>
                  <OwnershipBadge
                    ownership={phoneNumber.ownership}
                    customerName={phoneNumber.customer?.name}
                    size="sm"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Visibility</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    phoneNumber.hideFromCustomer
                      ? 'bg-red-400/10 text-red-400'
                      : 'bg-green-400/10 text-green-400'
                  }`}>
                    {phoneNumber.hideFromCustomer ? 'Hidden' : 'Visible'}
                  </span>
                </div>
              </div>
            </div>

            {/* Capabilities */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Capabilities</h3>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {getCapabilityBadges(phoneNumber.capabilities).map((capability) => (
                    <span
                      key={capability}
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-400/10 text-blue-400"
                    >
                      {capability}
                    </span>
                  ))}
                  {phoneNumber.canSendOutbound && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-400/10 text-green-400">
                      Outbound
                    </span>
                  )}
                  {phoneNumber.canReceiveInbound && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-400/10 text-green-400">
                      Inbound Ready
                    </span>
                  )}
                </div>

                {phoneNumber.isImported && (
                  <div className="flex items-center gap-2 text-purple-400">
                    <span className="text-sm">📥 Imported Number</span>
                    {phoneNumber.importedAt && (
                      <span className="text-xs text-gray-400">
                        {new Date(phoneNumber.importedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer Assignment */}
          {phoneNumber.customer && (
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Customer Assignment</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Customer</span>
                  <span className="text-white font-medium">{phoneNumber.customer.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Email</span>
                  <span className="text-gray-300">{phoneNumber.customer.email}</span>
                </div>
                {phoneNumber.monthlyRecurringCost > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Monthly Cost</span>
                    <span className="text-green-400 font-medium">${phoneNumber.monthlyRecurringCost.toFixed(2)}/month</span>
                  </div>
                )}
                {phoneNumber.purchaseInfo && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Purchase Price</span>
                    <span className="text-gray-300">
                      ${phoneNumber.purchaseInfo.purchasePrice.toFixed(2)}
                      {phoneNumber.purchaseInfo.setupFee > 0 && ` + $${phoneNumber.purchaseInfo.setupFee.toFixed(2)} setup`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agent Assignments */}
          {phoneNumber.hasAgentAssignment && phoneNumber.agentMappings.length > 0 && (
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Agent Assignments</h3>
              <div className="space-y-3">
                {phoneNumber.agentMappings.map((mapping) => (
                  <div key={mapping.id} className="flex items-center justify-between p-3 bg-gray-600/30 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          mapping.agentProvider === 'retell'
                            ? 'bg-blue-400/10 text-blue-400'
                            : mapping.agentProvider === 'vapi'
                            ? 'bg-purple-400/10 text-purple-400'
                            : 'bg-green-400/10 text-green-400'
                        }`}>
                          {mapping.agentProvider.charAt(0).toUpperCase() + mapping.agentProvider.slice(1)}
                        </span>
                        <span className="text-white font-medium">{mapping.agentName || mapping.agentId}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {mapping.inboundEnabled && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-400/10 text-blue-400">
                            ↓ Inbound
                          </span>
                        )}
                        {mapping.outboundEnabled && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-400/10 text-purple-400">
                            ↑ Outbound
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      mapping.status === 'active' ? 'bg-green-400/10 text-green-400' : 'bg-gray-400/10 text-gray-400'
                    }`}>
                      {mapping.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outbound Webhook Key Management */}
          {hasOutboundAgent && (
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <FiKey className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-white">Outbound Webhook</h3>
              </div>

              {isLoadingWebhookKey ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading webhook key status...</span>
                </div>
              ) : (
                <>
                  {webhookKeyError && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-red-500/10 rounded text-red-400 text-sm">
                      <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{webhookKeyError}</span>
                    </div>
                  )}

                  {/* Generated key display (shown once after generation) */}
                  {generatedKey && (
                    <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-amber-400 text-xs font-medium mb-2">
                        ⚠️ Copy this key now — it won&apos;t be shown again!
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs text-white bg-gray-800 px-3 py-2 rounded font-mono break-all">
                          {generatedKey}
                        </code>
                        <button
                          onClick={handleCopyWebhookKey}
                          className="flex-shrink-0 p-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                          title="Copy to clipboard"
                        >
                          {webhookKeyCopied ? (
                            <FiCheck className="w-4 h-4 text-green-400" />
                          ) : (
                            <FiCopy className="w-4 h-4 text-white" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Key status */}
                  {webhookKeyInfo && webhookKeyInfo.isActive ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-600/30 rounded-lg">
                        <div>
                          <span className="text-gray-400 text-xs">API Key</span>
                          <div className="text-white font-mono text-sm">{webhookKeyInfo.apiKeyPrefix}••••••••</div>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-400/10 text-green-400">
                          Active
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleGenerateWebhookKey}
                          disabled={isGeneratingKey}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                        >
                          <FiKey className="w-3.5 h-3.5" />
                          {isGeneratingKey ? 'Regenerating...' : 'Regenerate Key'}
                        </button>
                        <button
                          onClick={handleRevokeWebhookKey}
                          disabled={isRevokingKey}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                          {isRevokingKey ? 'Revoking...' : 'Revoke'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-gray-400 text-sm">
                        Generate a webhook key to enable outbound calls from external platforms (GHL, N8N, etc.).
                      </p>
                      <button
                        onClick={handleGenerateWebhookKey}
                        disabled={isGeneratingKey}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                      >
                        <FiKey className="w-4 h-4" />
                        {isGeneratingKey ? 'Generating...' : 'Generate Webhook Key'}
                      </button>
                    </div>
                  )}

                  {/* Usage instructions (shown when key exists) */}
                  {webhookKeyInfo && webhookKeyInfo.isActive && connectHubUrl && (
                    <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                      <p className="text-gray-300 text-xs font-medium mb-2">Usage Example:</p>
                      <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap font-mono">
{`curl -X POST ${connectHubUrl}/api/outbound-call \\
  -H "Authorization: Bearer YOUR_WEBHOOK_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from_number": "${phoneNumber.phoneNumber}",
    "to_number": "+1234567890",
    "metadata": { "campaign": "my_campaign" }
  }'`}
                      </pre>
                    </div>
                  )}
                  {webhookKeyInfo && webhookKeyInfo.isActive && !connectHubUrl && (
                    <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                      <p className="text-yellow-400 text-xs">
                        <FiAlertCircle className="inline w-3 h-3 mr-1" />
                        Webhook endpoint URL is not configured. Please set the <code className="text-yellow-300">NEXT_PUBLIC_CONNECT_HUB_URL</code> environment variable.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Customer Actions */}
              {!phoneNumber.isAssigned ? (
                <button
                  onClick={onAssignCustomer}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <FiUserPlus className="w-4 h-4" />
                  Assign Customer
                </button>
              ) : (
                <>
                  <button
                    onClick={onReassignCustomer}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                  >
                    <FiUser className="w-4 h-4" />
                    Reassign Customer
                  </button>
                  <button
                    onClick={onUnassignCustomer}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                  >
                    <FiUserMinus className="w-4 h-4" />
                    Unassign Customer
                  </button>
                </>
              )}

              {/* Agent Actions */}
              {!phoneNumber.hasAgentAssignment ? (
                <button
                  onClick={onAssignAgent}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  <FiSettings className="w-4 h-4" />
                  Assign Agent
                </button>
              ) : (
                <>
                  <button
                    onClick={onReassignAgent}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    <FiSettings className="w-4 h-4" />
                    Reassign Agent
                  </button>
                  <button
                    onClick={onUnassignAgent}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    <FiUserMinus className="w-4 h-4" />
                    Unassign Agent
                  </button>
                </>
              )}

              {/* Visibility Toggle */}
              <button
                onClick={onToggleVisibility}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                  phoneNumber.hideFromCustomer
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                {phoneNumber.hideFromCustomer ? <FiEye className="w-4 h-4" /> : <FiEyeOff className="w-4 h-4" />}
                {phoneNumber.hideFromCustomer ? 'Show to Customer' : 'Hide from Customer'}
              </button>

              {/* Refresh Cache - Only for Knova agents */}
              {phoneNumber.agentMappings.some(m => m.agentProvider === 'knova') && onRefreshCache && (
                <button
                  onClick={onRefreshCache}
                  disabled={isRefreshingCache}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  <FiRefreshCw className={`w-4 h-4 ${isRefreshingCache ? 'animate-spin' : ''}`} />
                  {isRefreshingCache ? 'Refreshing...' : 'Refresh Cache'}
                </button>
              )}

              {/* Delete */}
              <button
                onClick={onDeletePhoneNumber}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <FiTrash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
