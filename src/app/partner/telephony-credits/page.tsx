'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import {
  FiPhone,
  FiDollarSign,
  FiTrendingUp,
  FiAlertTriangle,
  FiSettings,
  FiRefreshCw,
  FiPlus,
  FiInfo,
  FiClock,
  FiZap,
  FiShield
} from 'react-icons/fi';
import PartnerLayout from '@/components/partner/PartnerLayout';
import TelephonyCreditPurchaseModal from '@/components/partner/TelephonyCreditPurchaseModal';
import TelephonyCreditSettingsModal from '@/components/partner/TelephonyCreditSettingsModal';
import {
  TelephonyCreditBalance,
  TelephonyCreditPackage,
  formatTelephonyBalance
} from '@/lib/types/credits';

function TelephonyCreditsPageContent() {
  const searchParams = useSearchParams();
  const [creditBalance, setCreditBalance] = useState<TelephonyCreditBalance | null>(null);
  const [creditPackages, setCreditPackages] = useState<TelephonyCreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [partnerName, setPartnerName] = useState('');

  const fetchCreditData = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Fetch balance and packages in parallel
      const [balanceResponse, packagesResponse] = await Promise.all([
        fetch('/api/partner/telephony-credits/balance', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/partner/telephony-credits/packages', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [balanceData, packagesData] = await Promise.all([
        balanceResponse.json(),
        packagesResponse.json()
      ]);

      if (balanceData.success) {
        setCreditBalance(balanceData.data);
      } else {
        setError(balanceData.error || 'Failed to fetch balance');
        return;
      }

      if (packagesData.success) {
        setCreditPackages(packagesData.data);
      } else {
        setError(packagesData.error || 'Failed to fetch packages');
        return;
      }

      // Get partner name from token
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setPartnerName(payload.businessName || 'Partner');
      } catch (e) {
        setPartnerName('Partner');
      }

    } catch (error) {
      console.error('Error fetching credit data:', error);
      setError('Failed to load credit information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditData();

    // Refresh data when user returns to the page (e.g., from success page)
    const handleFocus = () => {
      fetchCreditData();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Refresh data when coming from success page
  useEffect(() => {
    const refreshParam = searchParams?.get('refresh');
    if (refreshParam) {
      fetchCreditData();
    }
  }, [searchParams]);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    window.location.href = '/partner/login';
  };

  if (loading) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <FiRefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-400">Loading telephony credits...</p>
          </div>
        </div>
      </PartnerLayout>
    );
  }

  if (error) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <FiAlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Error Loading Credits</h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={fetchCreditData}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </PartnerLayout>
    );
  }

  const lowCreditAlert = creditBalance?.lowCreditAlert;
  const shouldShowAlert = lowCreditAlert?.shouldAlert;

  return (
    <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Telephony Credits</h1>
            <p className="text-gray-400 mt-2">Manage your telephony credit balance for calls and phone services</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowTransactionHistory(!showTransactionHistory)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700/50 hover:border-gray-600 transition-all duration-300"
            >
              <FiClock className="w-4 h-4" />
              {showTransactionHistory ? 'Hide' : 'Show'} History
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700/50 hover:border-gray-600 transition-all duration-300"
            >
              <FiSettings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => setShowPurchaseModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-green-500/25"
            >
              <FiPlus className="w-5 h-5" />
              Purchase Credits
            </button>
          </div>
        </div>

        {/* Cross-reference to AI Credits */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiInfo className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-300 mb-1">About Telephony vs AI Credits</h4>
              <p className="text-blue-200 text-sm">
                Telephony Credits are separate from AI Credits and are used specifically for phone calls, SMS, and phone number purchases.
                <a href="/partner/credits" className="text-blue-300 hover:text-blue-200 underline ml-1">
                  Manage your AI Credits here
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Low Credit Alert */}
        {shouldShowAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-300 mb-1">Low Telephony Credit Alert</h4>
                <p className="text-red-200 text-sm">
                  Your telephony credit balance ({formatTelephonyBalance(lowCreditAlert.currentBalanceCents)}) 
                  is below your threshold ({formatTelephonyBalance(lowCreditAlert.thresholdCents)}). 
                  Consider purchasing more credits to avoid service interruptions.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FiDollarSign className="w-6 h-6 text-green-500" />
              </div>
              <button
                onClick={fetchCreditData}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                <FiRefreshCw className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {formatTelephonyBalance(creditBalance?.currentBalanceCents || 0)}
            </h3>
            <p className="text-gray-400 text-sm">Current Balance</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FiTrendingUp className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              ${(creditBalance?.totalDollarsPurchased || 0).toFixed(2)}
            </h3>
            <p className="text-gray-400 text-sm">Total Purchased</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <FiPhone className="w-6 h-6 text-purple-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              ${(creditBalance?.totalDollarsUsed || 0).toFixed(2)}
            </h3>
            <p className="text-gray-400 text-sm">Total Used</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <FiZap className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {creditBalance?.autoTopUpEnabled ? 'Enabled' : 'Disabled'}
            </h3>
            <p className="text-gray-400 text-sm">Auto Top-up</p>
          </div>
        </div>

        {/* Features Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FiShield className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">Never Expire</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Unlike AI Credits, telephony credits never expire. Purchase once and use whenever needed.
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FiDollarSign className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">Cost-Based Pricing</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Telephony credits are priced at actual provider costs with no markup. You pay exactly what we pay.
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <FiZap className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">Auto Top-up</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Enable auto top-up to ensure your customers never experience service interruptions.
            </p>
          </div>
        </div>
      </div>

      {/* Purchase Modal */}
      <TelephonyCreditPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        packages={creditPackages}
        onPurchaseSuccess={() => {
          setShowPurchaseModal(false);
          fetchCreditData();
        }}
      />

      {/* Settings Modal */}
      <TelephonyCreditSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        creditBalance={creditBalance}
        onSettingsUpdate={fetchCreditData}
      />

      <Toaster position="top-right" />
    </PartnerLayout>
  );
}

export default function TelephonyCreditsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TelephonyCreditsPageContent />
    </Suspense>
  );
}
