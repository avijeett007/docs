'use client';

import React, { useState, useEffect } from 'react';
import {
  FiCreditCard,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiExternalLink,
  FiRefreshCw,
  FiTrash2,
  FiDollarSign
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import PremiumFeature from '@/components/ui/PremiumFeature';

interface StripeStatus {
  hasStripeAccount: boolean;
  accountId?: string;
  accountType?: 'express' | 'standard';
  onboardingCompleted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  applicationFeePercent: number;
  capabilities: Record<string, string>;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
  };
  needsOnboarding: boolean;
}

interface StripeConnectSettingsProps {
  partnerId: string;
  onStatusUpdate?: (status: StripeStatus) => void;
}

export default function StripeConnectSettings({
  partnerId,
  onStatusUpdate
}: StripeConnectSettingsProps) {
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Get current host for redirect URLs
  const getHost = () => {
    if (typeof window !== 'undefined') {
      return process.env.NODE_ENV === 'production'
        ? 'https://knotie-ai.pro'
        : `${window.location.protocol}//${window.location.host}`;
    }
    return '';
  };

  const fetchStripeStatus = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/stripe/status?partnerId=${partnerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStripeStatus(data.data);
        onStatusUpdate?.(data.data);
      } else {
        throw new Error('Failed to fetch Stripe status');
      }
    } catch (error) {
      console.error('Error fetching Stripe status:', error);
      toast.error('Failed to load Stripe status');
    } finally {
      setLoading(false);
    }
  };

  const startOnboarding = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      const host = getHost();

      const response = await fetch('/api/partner/stripe/connect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerId,
          refreshUrl: `${host}/partner/settings?stripe_refresh=true`,
          returnUrl: `${host}/partner/settings?stripe_return=true`,
          accountType: 'express',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to Stripe onboarding
        window.location.href = data.data.onboardingUrl;
      } else {
        const errorData = await response.json();
        if (errorData.error && errorData.error.includes('signed up for Connect')) {
          throw new Error('Stripe Connect is not enabled on your Stripe account. Please enable Connect in your Stripe Dashboard first.');
        }
        throw new Error(errorData.error || 'Failed to start onboarding');
      }
    } catch (error: any) {
      console.error('Error starting onboarding:', error);
      toast.error(error.message || 'Failed to start Stripe onboarding');
    } finally {
      setActionLoading(false);
    }
  };

  const refreshOnboarding = async () => {
    if (!stripeStatus?.accountId) return;

    setActionLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      const host = getHost();

      const response = await fetch('/api/partner/stripe/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerId,
          accountId: stripeStatus.accountId,
          refreshUrl: `${host}/partner/settings?stripe_refresh=true`,
          returnUrl: `${host}/partner/settings?stripe_return=true`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to Stripe onboarding
        window.location.href = data.data.onboardingUrl;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refresh onboarding');
      }
    } catch (error: any) {
      console.error('Error refreshing onboarding:', error);
      toast.error(error.message || 'Failed to refresh Stripe onboarding');
    } finally {
      setActionLoading(false);
    }
  };

  const disconnectAccount = async () => {
    if (!stripeStatus?.accountId) return;

    setActionLoading(true);
    try {
      const token = localStorage.getItem('partner_token');

      const response = await fetch('/api/partner/stripe/connect', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerId,
          accountId: stripeStatus.accountId,
        }),
      });

      if (response.ok) {
        toast.success('Stripe account disconnected successfully');
        await fetchStripeStatus(); // Refresh status
        setShowDisconnectModal(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disconnect account');
      }
    } catch (error: any) {
      console.error('Error disconnecting account:', error);
      toast.error(error.message || 'Failed to disconnect Stripe account');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchStripeStatus();
  }, [partnerId]);

  if (loading) {
    return (
      <div className="p-6 bg-gray-800/50 rounded-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const getStatusColor = (enabled: boolean) => enabled ? 'text-green-400' : 'text-red-400';
  const getStatusIcon = (enabled: boolean) => enabled ? FiCheck : FiX;

  const hasRequirements = stripeStatus?.requirements && (
    stripeStatus.requirements.currentlyDue.length > 0 ||
    stripeStatus.requirements.pastDue.length > 0
  );

  return (
    <div className="p-6 bg-gray-800/50 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <FiCreditCard className="w-5 h-5" />
            Stripe Connect
          </h3>
          <p className="text-gray-400 mt-1">
            Connect your Stripe account to collect payments from customers
          </p>
        </div>

        {stripeStatus?.hasStripeAccount ? (
          <div className="flex gap-2">
            {stripeStatus.needsOnboarding && (
              <button
                onClick={refreshOnboarding}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <FiRefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                Complete Setup
              </button>
            )}
            <button
              onClick={() => setShowDisconnectModal(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              <FiTrash2 className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={startOnboarding}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            <FiCreditCard className="w-4 h-4" />
            {actionLoading ? 'Connecting...' : 'Connect Stripe'}
          </button>
        )}
      </div>

      {stripeStatus?.hasStripeAccount ? (
        <div className="space-y-6">
          {/* Account Status */}
          <div>
            <h4 className="text-lg font-medium mb-3">Account Status</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <span className="text-gray-300">Account Type</span>
                <span className="text-white capitalize">{stripeStatus.accountType}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <span className="text-gray-300">Account ID</span>
                <span className="text-white font-mono text-sm">{stripeStatus.accountId}</span>
              </div>
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <h4 className="text-lg font-medium mb-3">Capabilities</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <span className="text-gray-300">Accept Charges</span>
                <div className="flex items-center gap-2">
                  {React.createElement(getStatusIcon(stripeStatus.chargesEnabled), {
                    className: `w-4 h-4 ${getStatusColor(stripeStatus.chargesEnabled)}`
                  })}
                  <span className={getStatusColor(stripeStatus.chargesEnabled)}>
                    {stripeStatus.chargesEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <span className="text-gray-300">Receive Payouts</span>
                <div className="flex items-center gap-2">
                  {React.createElement(getStatusIcon(stripeStatus.payoutsEnabled), {
                    className: `w-4 h-4 ${getStatusColor(stripeStatus.payoutsEnabled)}`
                  })}
                  <span className={getStatusColor(stripeStatus.payoutsEnabled)}>
                    {stripeStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Application Fee */}
          <div>
            <h4 className="text-lg font-medium mb-3">Revenue Sharing</h4>
            <div className="p-4 bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FiDollarSign className="w-4 h-4 text-green-400" />
                <span className="text-white font-medium">Platform Fee</span>
              </div>
              <p className="text-gray-300">
                We collect <span className="text-green-400 font-medium">{stripeStatus.applicationFeePercent}%</span> of each transaction as a platform fee.
                You keep the remaining <span className="text-green-400 font-medium">{(100 - stripeStatus.applicationFeePercent).toFixed(2)}%</span>.
              </p>

              {/* Premium Message */}
              <div className="mt-3 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <PremiumFeature
                    iconSize="sm"
                    tooltipText="Premium subscribers benefit from reduced transaction fees - just 1% compared to the standard 2.5% rate. This exclusive benefit helps maximize your revenue potential."
                  >
                    <span className="text-blue-300 text-sm font-medium">Premium Benefit</span>
                  </PremiumFeature>
                </div>
                <p className="text-blue-200 text-xs mt-1">
                  Premium subscribers benefit from preferential transaction fees of only <span className="font-medium text-blue-100">1%</span> versus the standard <span className="font-medium text-blue-100">2.5%</span> rate.
                </p>
              </div>
            </div>
          </div>

          {/* Requirements */}
          {hasRequirements && (
            <div>
              <h4 className="text-lg font-medium mb-3 flex items-center gap-2">
                <FiAlertCircle className="w-5 h-5 text-amber-400" />
                Outstanding Requirements
              </h4>
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-amber-300 mb-3">
                  Your Stripe account needs additional information to fully activate payment processing.
                </p>
                {stripeStatus.requirements.currentlyDue.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-amber-400 mb-1">Currently Due:</p>
                    <ul className="text-sm text-amber-300 list-disc list-inside">
                      {stripeStatus.requirements.currentlyDue.map((req, index) => (
                        <li key={index}>{req.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {stripeStatus.requirements.pastDue.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-red-400 mb-1">Past Due:</p>
                    <ul className="text-sm text-red-300 list-disc list-inside">
                      {stripeStatus.requirements.pastDue.map((req, index) => (
                        <li key={index}>{req.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={refreshOnboarding}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-3 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
                >
                  <FiExternalLink className="w-4 h-4" />
                  Complete Requirements
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <FiCreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-300 mb-2">No Stripe Account Connected</h4>
          <p className="text-gray-400 mb-4">
            Connect your Stripe account to start collecting payments from your customers.
          </p>
          <p className="text-sm text-gray-500">
            We use Stripe Connect to securely handle payments while you maintain full control of your funds.
          </p>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Disconnect Stripe Account</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to disconnect your Stripe account? This will prevent you from collecting new payments, but won't affect existing payment history.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={disconnectAccount}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
