'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiKey, FiCopy, FiCheck, FiRefreshCw, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';
import { useToast } from '@/hooks/use-toast';

interface TokenInfo {
  id: string;
  apiKeyPrefix: string;
  isActive: boolean;
  partnerId: string;
  createdAt: string;
}

interface CustomerCreditCheckEndpointProps {
  customerId: string;
  customerName: string;
}

const CONNECT_HUB_BASE_URL = process.env.NEXT_PUBLIC_CONNECT_HUB_URL;
if (process.env.NODE_ENV === 'development' && !CONNECT_HUB_BASE_URL) {
  console.warn(
    '[CustomerCreditCheckEndpoint] NEXT_PUBLIC_CONNECT_HUB_URL is not set – ' +
      'the credit check endpoint URL will not be displayed.'
  );
}

export default function CustomerCreditCheckEndpoint({
  customerId,
  customerName,
}: CustomerCreditCheckEndpointProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const authHeader = () => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('partner_token') || ''
        : '';
    return { Authorization: `Bearer ${token}` };
  };

  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/partner/customers/${customerId}/credit-check-token`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setTokenInfo(data.data);
        if (data.data.partnerId) {
          setPartnerId(data.data.partnerId);
        }
      }
    } catch {
      // ignore – no token yet
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const handleGenerate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/partner/customers/${customerId}/credit-check-token`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setNewApiKey(data.data.apiKey);
        setShowKey(true);
        if (data.data.partnerId) {
          setPartnerId(data.data.partnerId);
        }
        setTokenInfo({
          id: data.data.id,
          apiKeyPrefix: data.data.apiKeyPrefix,
          isActive: data.data.isActive,
          partnerId: data.data.partnerId,
          createdAt: data.data.createdAt,
        });
        toast({ title: 'API key generated', description: 'Copy and store it – it will not be shown again.' });
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to generate token', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Request failed', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm('Revoke this API key? The credit check endpoint will stop working immediately.')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/partner/customers/${customerId}/credit-check-token`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success) {
        setTokenInfo(prev => prev ? { ...prev, isActive: false } : null);
        setNewApiKey(null);
        toast({ title: 'API key revoked' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Request failed', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const endpointUrl =
    partnerId && CONNECT_HUB_BASE_URL
      ? `${CONNECT_HUB_BASE_URL}/api/credit-check/${partnerId}/${customerId}`
      : null;
  const curlExample = endpointUrl
    ? `curl -X GET "${endpointUrl}" \\\n  -H "X-API-Key: <your-api-key>"`
    : '';

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 space-y-5 border border-gray-700/50">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <FiKey className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-white">Credit Check Endpoint</h4>
          <p className="text-sm text-gray-400">
            Webhook URL to check if <span className="text-gray-300">{customerName}</span> has sufficient AI credits.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Endpoint URL */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Endpoint URL</label>
            {endpointUrl ? (
              <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2">
                <code className="flex-1 text-sm text-green-400 font-mono break-all">{endpointUrl}</code>
                <button
                  onClick={() => copy(endpointUrl, 'url')}
                  className="flex-shrink-0 p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  title="Copy URL"
                >
                  {copiedField === 'url' ? <FiCheck className="w-4 h-4 text-green-400" /> : <FiCopy className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Generate an API key to reveal the endpoint URL.</p>
            )}
          </div>

          {/* API Key section */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">API Key</label>
              {tokenInfo?.isActive && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Active</span>
              )}
              {tokenInfo && !tokenInfo.isActive && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Revoked</span>
              )}
            </div>

            {newApiKey ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2">
                  <code className="flex-1 text-sm text-yellow-300 font-mono break-all">
                    {showKey ? newApiKey : '•'.repeat(newApiKey.length)}
                  </code>
                  <button onClick={() => setShowKey(v => !v)} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                    {showKey ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => copy(newApiKey, 'key')} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Copy key">
                    {copiedField === 'key' ? <FiCheck className="w-4 h-4 text-green-400" /> : <FiCopy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-yellow-400 flex items-center gap-1">⚠️ Copy this key now – it will not be shown again.</p>
              </div>
            ) : tokenInfo ? (
              <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2">
                <code className="flex-1 text-sm text-gray-400 font-mono">{tokenInfo.apiKeyPrefix}••••••••••••••••••••••••••••••••••</code>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No API key generated yet.</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {actionLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <FiRefreshCw className="w-4 h-4" />}
              {tokenInfo ? 'Regenerate Key' : 'Generate API Key'}
            </button>
            {tokenInfo?.isActive && (
              <button
                onClick={handleRevoke}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600/40 disabled:opacity-50 text-red-400 text-sm rounded-lg transition-colors"
              >
                <FiTrash2 className="w-4 h-4" />
                Revoke
              </button>
            )}
          </div>

          {/* Sample cURL — only shown when endpoint URL is available */}
          {endpointUrl && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Sample Request</label>
              <div className="relative bg-gray-900/70 border border-gray-700 rounded-lg p-3">
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">{curlExample}</pre>
                <button
                  onClick={() => copy(curlExample, 'curl')}
                  className="absolute top-2 right-2 p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  title="Copy cURL"
                >
                  {copiedField === 'curl' ? <FiCheck className="w-4 h-4 text-green-400" /> : <FiCopy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Returns <code className="text-gray-300">{"{ \"success\": true, \"hasCredit\": true }"}</code> or <code className="text-gray-300">{"{ ..., \"hasCredit\": false }"}</code>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

