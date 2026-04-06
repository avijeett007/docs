'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FiPlus,
  FiCopy,
  FiRefreshCw,
  FiTrash2,
  FiGlobe,
  FiEye,
  FiEyeOff,
  FiCalendar,
  FiActivity,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiEdit3
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface EmbedToken {
  id: string;
  token: string;
  name: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  allowedDomains: string[];
  accessMode: string;
  status: string;
  expiresAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  embedUrl: string;
}

interface CustomerEmbedTokenManagementProps {
  customerId: string;
  customerName: string;
}

export default function CustomerEmbedTokenManagement({
  customerId,
  customerName,
}: CustomerEmbedTokenManagementProps) {
  const [embedTokens, setEmbedTokens] = useState<EmbedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    allowedDomains: [''],
    accessMode: 'full',
    expiresAt: '',
  });

  // Load embed tokens
  const loadEmbedTokens = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/partner/embed-tokens?customerId=${customerId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load embed tokens');
      }

      const data = await response.json();
      setEmbedTokens(data.embedTokens || []);
    } catch (error) {
      console.error('Error loading embed tokens:', error);
      toast.error('Failed to load embed tokens');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmbedTokens();
  }, [customerId]);

  // Create new embed token
  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Please enter a name for the embed token');
      return;
    }

    try {
      setIsCreating(true);
      
      const payload = {
        name: formData.name.trim(),
        customerId,
        allowedDomains: formData.allowedDomains.filter(domain => domain.trim()),
        accessMode: formData.accessMode,
        expiresAt: formData.expiresAt || null,
      };

      const response = await fetch('/api/partner/embed-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create embed token');
      }

      const data = await response.json();
      setEmbedTokens(prev => [data.embedToken, ...prev]);
      
      // Reset form
      setFormData({
        name: '',
        allowedDomains: [''],
        accessMode: 'full',
        expiresAt: '',
      });
      setShowCreateForm(false);
      
      toast.success('Embed token created successfully');
    } catch (error: any) {
      console.error('Error creating embed token:', error);
      toast.error(error.message || 'Failed to create embed token');
    } finally {
      setIsCreating(false);
    }
  };

  // Copy embed URL to clipboard
  const copyToClipboard = async (embedUrl: string, tokenId: string) => {
    try {
      await navigator.clipboard.writeText(embedUrl);
      setCopiedToken(tokenId);
      toast.success('Embed URL copied to clipboard');
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Revoke token
  const handleRevokeToken = async (tokenId: string) => {
    try {
      const response = await fetch(`/api/partner/embed-tokens/${tokenId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'revoke' }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke token');
      }

      const data = await response.json();
      setEmbedTokens(prev => 
        prev.map(token => 
          token.id === tokenId ? data.embedToken : token
        )
      );
      
      toast.success('Embed token revoked successfully');
    } catch (error) {
      console.error('Error revoking token:', error);
      toast.error('Failed to revoke token');
    }
  };

  // Regenerate token
  const handleRegenerateToken = async (tokenId: string) => {
    try {
      const response = await fetch(`/api/partner/embed-tokens/${tokenId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'regenerate' }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate token');
      }

      const data = await response.json();
      setEmbedTokens(prev => 
        prev.map(token => 
          token.id === tokenId ? data.embedToken : token
        )
      );
      
      toast.success('Embed token regenerated successfully');
    } catch (error) {
      console.error('Error regenerating token:', error);
      toast.error('Failed to regenerate token');
    }
  };

  // Add domain field
  const addDomainField = () => {
    setFormData(prev => ({
      ...prev,
      allowedDomains: [...prev.allowedDomains, '']
    }));
  };

  // Remove domain field
  const removeDomainField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      allowedDomains: prev.allowedDomains.filter((_, i) => i !== index)
    }));
  };

  // Update domain field
  const updateDomainField = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      allowedDomains: prev.allowedDomains.map((domain, i) => 
        i === index ? value : domain
      )
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'revoked': return 'text-red-400';
      case 'expired': return 'text-amber-400';
      default: return 'text-gray-400';
    }
  };

  const getAccessModeColor = (mode: string) => {
    switch (mode) {
      case 'full': return 'text-green-400';
      case 'readonly': return 'text-amber-400';
      case 'lite': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Embed URLs</h3>
          <p className="text-sm text-gray-400 mt-1">
            Create secure embed URLs for {customerName} to access their portal from external platforms
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-200"
        >
          <FiPlus className="w-4 h-4" />
          Create Embed URL
        </button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-800/50 rounded-xl p-6 border border-gray-700"
          >
            <form onSubmit={handleCreateToken} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., GHL Embed - Client A"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Access Mode
                  </label>
                  <select
                    value={formData.accessMode}
                    onChange={(e) => setFormData(prev => ({ ...prev, accessMode: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="full">Full Access</option>
                    <option value="readonly">Read Only</option>
                    <option value="lite">Lite (Limited Features)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Allowed Embedding Domains (Optional)
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  Specify domains that can embed this token. Your whitelabel domain will be automatically included.
                </p>
                <div className="space-y-2">
                  {formData.allowedDomains.map((domain, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={domain}
                        onChange={(e) => updateDomainField(index, e.target.value)}
                        placeholder="e.g., app.knolabs.biz or *.gohighlevel.com"
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      {formData.allowedDomains.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDomainField(index)}
                          className="p-2 text-red-400 hover:text-red-300"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addDomainField}
                    className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <FiPlus className="w-3 h-3" />
                    Add Domain
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Expiration Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <FiCheck className="w-4 h-4" />
                      Create Embed URL
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Embed Tokens List */}
      {embedTokens.length === 0 ? (
        <div className="text-center py-12">
          <FiGlobe className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-400 mb-2">No Embed URLs Created</h4>
          <p className="text-gray-500 mb-4">
            Create your first embed URL to allow external access to this customer's portal
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-200"
          >
            <FiPlus className="w-4 h-4" />
            Create First Embed URL
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {embedTokens.map((token) => (
            <div
              key={token.id}
              className="bg-gray-800/50 rounded-xl p-6 border border-gray-700"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-lg font-medium text-white">{token.name}</h4>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className={`flex items-center gap-1 ${getStatusColor(token.status)}`}>
                      <FiActivity className="w-3 h-3" />
                      {token.status.charAt(0).toUpperCase() + token.status.slice(1)}
                    </span>
                    <span className={`flex items-center gap-1 ${getAccessModeColor(token.accessMode)}`}>
                      <FiEye className="w-3 h-3" />
                      {token.accessMode.charAt(0).toUpperCase() + token.accessMode.slice(1)} Access
                    </span>
                    <span className="text-gray-400 flex items-center gap-1">
                      <FiActivity className="w-3 h-3" />
                      {token.accessCount} accesses
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {token.status === 'active' && (
                    <>
                      <button
                        onClick={() => copyToClipboard(token.embedUrl, token.id)}
                        className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                        title="Copy Embed URL"
                      >
                        {copiedToken === token.id ? (
                          <FiCheck className="w-4 h-4 text-green-400" />
                        ) : (
                          <FiCopy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRegenerateToken(token.id)}
                        className="p-2 text-amber-400 hover:text-amber-300 transition-colors"
                        title="Regenerate Token"
                      >
                        <FiRefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeToken(token.id)}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors"
                        title="Revoke Token"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Embed URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={token.embedUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(token.embedUrl, token.id)}
                      className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {copiedToken === token.id ? (
                        <FiCheck className="w-4 h-4 text-green-400" />
                      ) : (
                        <FiCopy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {token.allowedDomains.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Allowed Domains
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {token.allowedDomains.map((domain, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                        >
                          {domain}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
                  <div>
                    <span className="block font-medium">Created</span>
                    <span>{new Date(token.createdAt).toLocaleDateString()}</span>
                  </div>
                  {token.lastAccessedAt && (
                    <div>
                      <span className="block font-medium">Last Access</span>
                      <span>{new Date(token.lastAccessedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {token.expiresAt && (
                    <div>
                      <span className="block font-medium">Expires</span>
                      <span>{new Date(token.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {token.revokedAt && (
                    <div>
                      <span className="block font-medium">Revoked</span>
                      <span>{new Date(token.revokedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
