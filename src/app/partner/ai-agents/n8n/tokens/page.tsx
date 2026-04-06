'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiArrowLeft, FiKey, FiUsers, FiClock, FiActivity } from 'react-icons/fi';
import GuidedPartnerSidebar from '@/components/partner/GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';
import N8nTokenModal from '@/components/partner/N8nTokenModal';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
}

interface N8nToken {
  id: string;
  name: string;
  description?: string;
  scope: 'all' | Array<{ appName: string; toolName: string }>;
  tokenHash: string;
  expiresAt: string;
  usageLimit: number;
  isActive: boolean;
  createdAt: string;
  customer: Customer;
}

const N8nTokensPage = () => {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('Partner');
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokens, setTokens] = useState<N8nToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch partner info
  useEffect(() => {
    const fetchPartnerInfo = async () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) return;

        const response = await fetch('/api/partner/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setPartnerName(data.partner?.businessName || data.partner?.contactName || 'Partner');
        }
      } catch (error) {
        console.error('Failed to fetch partner info:', error);
      }
    };

    fetchPartnerInfo();
  }, []);

  // Fetch tokens
  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/n8n-tokens', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.data || []);
      } else {
        toast.error('Failed to fetch N8N tokens');
      }
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
      toast.error('Failed to fetch N8N tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    window.location.href = '/partner/login';
  };

  const handleTokenCreated = () => {
    setShowTokenModal(false);
    fetchTokens(); // Refresh the list
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCustomerName = (customer: Customer) => {
    if (customer.companyName) return customer.companyName;
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    }
    return customer.email;
  };

  const getScopeDisplay = (scope: N8nToken['scope']) => {
    if (scope === 'all') return 'All Tools';
    if (Array.isArray(scope)) {
      return `${scope.length} specific tools`;
    }
    return 'Unknown scope';
  };

  return (
    <UserGuideProvider>
      <div className="min-h-screen bg-gray-900 text-white flex">
        <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
        <div className="flex-1 ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <FiArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <FiKey className="w-8 h-8 text-blue-400" />
                  <h1 className="text-3xl font-bold text-white">N8N Token Management</h1>
                </div>
              </div>
              <p className="text-gray-400 text-lg">
                Create and manage authentication tokens for N8N workflows
              </p>
            </div>

            {/* Actions */}
            <div className="mb-6">
              <button
                onClick={() => setShowTokenModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <FiPlus className="w-4 h-4" />
                Create New Token
              </button>
            </div>

            {/* Tokens List */}
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Active Tokens</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Manage authentication tokens for your N8N workflows
                </p>
              </div>

              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-2">Loading tokens...</p>
                </div>
              ) : tokens.length === 0 ? (
                <div className="p-8 text-center">
                  <FiKey className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No tokens created yet</h3>
                  <p className="text-gray-400 mb-4">
                    Create your first N8N token to start automating workflows
                  </p>
                  <button
                    onClick={() => setShowTokenModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <FiPlus className="w-4 h-4" />
                    Create Token
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {tokens.map((token) => (
                    <div key={token.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-white">{token.name}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              token.isActive 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {token.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          
                          {token.description && (
                            <p className="text-gray-400 text-sm mb-3">{token.description}</p>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-2 text-gray-400">
                              <FiUsers className="w-4 h-4" />
                              <span>{getCustomerName(token.customer)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <FiActivity className="w-4 h-4" />
                              <span>{getScopeDisplay(token.scope)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <FiClock className="w-4 h-4" />
                              <span>Expires {formatDate(token.expiresAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* N8N Token Modal */}
      <N8nTokenModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
      />
    </UserGuideProvider>
  );
};

export default N8nTokensPage;
