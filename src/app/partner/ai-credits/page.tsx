'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiDollarSign,
  FiCreditCard,
  FiTrendingUp,
  FiAlertTriangle,
  FiSettings,
  FiRefreshCw,
  FiPlus,
  FiInfo,
  FiClock,
  FiPhone,
  FiCpu
} from 'react-icons/fi';
import PartnerLayout from '@/components/partner/PartnerLayout';
import CreditPurchaseModal from '@/components/partner/CreditPurchaseModal';
import CreditTransactionHistory from '@/components/partner/CreditTransactionHistory';
import CreditSettingsModal from '@/components/partner/CreditSettingsModal';
import CreditFAQ from '@/components/partner/CreditFAQ';
import { CreditBalance, CreditPackage } from '@/lib/types/credits';
import { formatCredits, formatPrice } from '@/lib/types/credits';

interface CreditPageProps {}

export default function KnotieCreditsPage({}: CreditPageProps) {
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
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
        fetch('/api/partner/credits/balance', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/partner/credits/packages', {
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
      }

      if (packagesData.success) {
        setCreditPackages(packagesData.data);
      } else {
        console.error('Failed to fetch packages:', packagesData.error);
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
  }, []);

  // Handle successful payment processing
  const handlePaymentSuccess = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/credits/process-success', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success(`${result.creditsAdded} credits added to your account!`);
          fetchCreditData(); // Refresh the credit balance immediately
        } else {
          toast.error('Payment processed but credits update failed. Please contact support.');
        }
      } else {
        // Fallback to webhook processing
        toast.loading('Processing payment... This may take a moment.');
        setTimeout(() => {
          fetchCreditData();
        }, 3000);
      }
    } catch (error) {
      console.error('Error processing successful payment:', error);
      // Fallback to webhook processing
      setTimeout(() => {
        fetchCreditData();
      }, 3000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    window.location.href = '/partner/login';
  };

  // Check for successful payment on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    if (sessionId) {
      handlePaymentSuccess(sessionId);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (loading) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <FiRefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-400">Loading Knotie credits...</p>
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
            <h1 className="text-3xl font-bold text-white">Knotie Credits</h1>
            <p className="text-gray-400 mt-2">Manage your Knotie credit balance and purchase additional credits</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowTransactionHistory(!showTransactionHistory)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <FiClock className="w-4 h-4" />
              {showTransactionHistory ? 'Hide' : 'Show'} History
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <FiSettings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => setShowPurchaseModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              Purchase Credits
            </button>
          </div>
        </div>

        {/* Cross-reference to Telephony Credits */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiPhone className="w-5 h-5 text-green-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-300 mb-1">Need Telephony Credits?</h4>
              <p className="text-green-200 text-sm">
                For phone calls, SMS, and phone number purchases, you'll need separate Telephony Credits. 
                <a href="/partner/telephony-credits" className="text-green-300 hover:text-green-200 underline ml-1">
                  Manage Telephony Credits here
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
                <h4 className="font-semibold text-red-300 mb-1">Low Credit Alert</h4>
                <p className="text-red-200 text-sm">
                  Your credit balance ({formatCredits(lowCreditAlert.currentBalance)}) 
                  is below your threshold ({formatCredits(lowCreditAlert.threshold)}). 
                  Consider purchasing more credits or adjusting your threshold.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FiDollarSign className="w-6 h-6 text-blue-500" />
              </div>
              <button
                onClick={fetchCreditData}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                <FiRefreshCw className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {formatCredits(creditBalance?.currentBalance || 0)}
            </h3>
            <p className="text-gray-400 text-sm">Current Balance</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FiTrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {formatCredits(creditBalance?.monthlyCreditAllocation || 0)}
            </h3>
            <p className="text-gray-400 text-sm">Monthly Allocation</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <FiCreditCard className="w-6 h-6 text-purple-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {formatCredits(creditBalance?.totalCreditsPurchased || 0)}
            </h3>
            <p className="text-gray-400 text-sm">Total Purchased</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <FiTrendingUp className="w-6 h-6 text-orange-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {formatCredits(creditBalance?.totalCreditsUsed || 0)}
            </h3>
            <p className="text-gray-400 text-sm">Total Used</p>
          </div>
        </div>

        {/* Transaction History */}
        {showTransactionHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <CreditTransactionHistory />
          </motion.div>
        )}

        {/* FAQ Section */}
        <CreditFAQ />
      </div>

      {/* Modals */}
      <CreditPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        packages={creditPackages}
        onPurchaseSuccess={() => {
          setShowPurchaseModal(false);
          fetchCreditData();
        }}
      />

      <CreditSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        creditBalance={creditBalance}
        onSettingsUpdate={fetchCreditData}
      />

      <Toaster position="top-right" />
    </PartnerLayout>
  );
}
