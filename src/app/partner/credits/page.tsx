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
  FiArrowRight,
  FiCpu
} from 'react-icons/fi';
import PartnerLayout from '@/components/partner/PartnerLayout';
import CreditPurchaseModal from '@/components/partner/CreditPurchaseModal';
import CreditTransactionHistory from '@/components/partner/CreditTransactionHistory';
import CreditSettingsModal from '@/components/partner/CreditSettingsModal';
import CreditFAQ from '@/components/partner/CreditFAQ';
import SupportModal from '@/components/partner/SupportModal';
import { CreditBalance, CreditPackage, TelephonyCreditBalance } from '@/lib/types/credits';
import { formatCredits, formatPrice, formatTelephonyBalance } from '@/lib/types/credits';

interface CreditPageProps {}

export default function CreditsPage({}: CreditPageProps) {
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [telephonyCreditBalance, setTelephonyCreditBalance] = useState<TelephonyCreditBalance | null>(null);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');

  useEffect(() => {
    fetchCreditData();
    fetchPartnerInfo();

    // Check for payment success in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      const sessionId = urlParams.get('session_id');

      // Show success message and process payment immediately
      toast.success('Payment successful! Processing your credits...');

      // Process the successful payment immediately (don't wait for webhook)
      if (sessionId) {
        handleSuccessfulPayment(sessionId);
      } else {
        // Fallback: refresh data after delay for webhook processing
        setTimeout(() => {
          fetchCreditData();
        }, 2000);
      }

      // Clean up URL
      window.history.replaceState({}, '', '/partner/credits');
    }

    if (urlParams.get('canceled') === 'true') {
      toast.error('Payment was canceled. No charges were made.');
      // Clean up URL
      window.history.replaceState({}, '', '/partner/credits');
    }
  }, []);

  const fetchPartnerInfo = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPartnerName(data.name || 'Partner');
        setPartnerEmail(data.email || '');
      }
    } catch (error) {
      console.error('Error fetching partner info:', error);
    }
  };

  const fetchCreditData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partner_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Fetch Knotie credits, telephony credits, and packages in parallel
      const [balanceResponse, telephonyBalanceResponse, packagesResponse] = await Promise.all([
        fetch('/api/partner/credits/balance', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/partner/telephony-credits/balance', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/partner/credits/packages', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const [balanceData, telephonyBalanceData, packagesData] = await Promise.all([
        balanceResponse.json(),
        telephonyBalanceResponse.json(),
        packagesResponse.json()
      ]);

      // Handle Knotie credits
      if (balanceResponse.ok && balanceData.success) {
        setCreditBalance(balanceData.data);
      } else {
        console.error('Failed to fetch Knotie credits:', balanceData.error);
      }

      // Handle telephony credits
      if (telephonyBalanceResponse.ok && telephonyBalanceData.success) {
        setTelephonyCreditBalance(telephonyBalanceData.data);
      } else {
        console.error('Failed to fetch telephony credits:', telephonyBalanceData.error);
      }

      // Handle packages
      if (packagesResponse.ok && packagesData.success) {
        setCreditPackages(packagesData.data.packages);
      } else {
        console.error('Failed to fetch packages:', packagesData.error);
      }
    } catch (error) {
      console.error('Error fetching credit data:', error);
      setError('Failed to load credit information');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessfulPayment = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      // Call API to process the successful payment
      const response = await fetch('/api/partner/credits/process-success', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
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

  if (loading) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3 text-gray-400">
            <FiRefreshCw className="w-6 h-6 animate-spin" />
            <span>Loading credit information...</span>
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
            <h1 className="text-3xl font-bold text-white">Credits Management</h1>
            <p className="text-gray-400 mt-2">Manage both Knotie Credits and Telephony Credits for your platform</p>
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
              className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              Buy Credits
            </button>
          </div>
        </div>

        {/* Credit Types Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Knotie Credits Card */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 hover:border-blue-500/30 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <FiCpu className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Knotie Credits</h3>
                  <p className="text-gray-400 text-sm">For AI agents, analytics, and AI features</p>
                </div>
              </div>
              <FiArrowRight className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Current Balance:</span>
                <span className="text-white font-medium">
                  {creditBalance ? formatCredits(creditBalance.currentBalance) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Monthly Allocation:</span>
                <span className="text-white font-medium">
                  {creditBalance ? formatCredits(creditBalance.monthlyCreditAllocation) : '-'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">• Volume discounts available</span>
              <span className="text-sm text-gray-400">• May expire monthly</span>
            </div>
          </div>

          {/* Telephony Credits Card */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 hover:border-green-500/30 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <FiPhone className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Telephony Credits</h3>
                  <p className="text-gray-400 text-sm">For phone calls, SMS, and phone numbers</p>
                </div>
              </div>
              <FiArrowRight className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Current Balance:</span>
                <span className="text-white font-medium">
                  {telephonyCreditBalance ? formatTelephonyBalance(telephonyCreditBalance.currentBalanceCents) : '$0.00'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Auto Top-up:</span>
                <span className="text-white font-medium">Loading...</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">• Cost-based pricing</span>
              <span className="text-sm text-gray-400">• Never expire</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/partner/ai-credits"
            className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FiCpu className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium">Manage Knotie Credits</span>
            </div>
            <FiArrowRight className="w-5 h-5 text-blue-400" />
          </a>

          <a
            href="/partner/telephony-credits"
            className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FiPhone className="w-5 h-5 text-green-400" />
              <span className="text-white font-medium">Manage Telephony Credits</span>
            </div>
            <FiArrowRight className="w-5 h-5 text-green-400" />
          </a>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-700 pt-8">
          <h2 className="text-2xl font-bold text-white mb-4">Knotie Credits Details</h2>
          <p className="text-gray-400 mb-6">Detailed view and management of your Knotie Credits</p>
        </div>

        {/* Low Credit Alert */}
        {shouldShowAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <FiAlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="font-semibold text-amber-500">Low Credit Balance</h3>
                <p className="text-amber-400 text-sm">
                  Your credit balance ({formatCredits(lowCreditAlert.currentBalance)}) is below your threshold 
                  ({formatCredits(lowCreditAlert.threshold)}). Consider purchasing more credits.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Credit Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FiDollarSign className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Current Balance</h3>
                <p className="text-gray-400 text-sm">Available credits</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCredits(creditBalance?.currentBalance || 0)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FiTrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Monthly Allocation</h3>
                <p className="text-gray-400 text-sm">From subscription</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCredits(creditBalance?.monthlyCreditAllocation || 0)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <FiCreditCard className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Total Purchased</h3>
                <p className="text-gray-400 text-sm">All-time purchases</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCredits(creditBalance?.totalCreditsPurchased || 0)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <FiTrendingUp className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Total Used</h3>
                <p className="text-gray-400 text-sm">All-time usage</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCredits(creditBalance?.totalCreditsUsed || 0)}
            </div>
          </motion.div>
        </div>

        {/* Credit Packages */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <FiCreditCard className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">Purchase Knotie Credits</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {creditPackages.map((pkg, index) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 hover:border-blue-500/50 transition-colors cursor-pointer"
                onClick={() => setShowPurchaseModal(true)}
              >
                <div className="text-center">
                  <h3 className="font-semibold text-white mb-2">{pkg.name}</h3>
                  <div className="text-2xl font-bold text-blue-400 mb-1">
                    {formatPrice(pkg.priceCents)}
                  </div>
                  {Number(pkg.discountPercentage) > 0 && (
                    <div className="text-sm text-green-400 mb-2">
                      {Number(pkg.discountPercentage)}% discount
                    </div>
                  )}
                  <div className="text-gray-400 text-sm">
                    {formatCredits(pkg.credits)} credits
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FiInfo className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-300">
                <p className="font-semibold mb-2">Credit Usage Information:</p>
                <ul className="space-y-1 text-blue-200">
                  <li>• Competitive pricing with volume discounts</li>
                  <li>• Credits never expire</li>
                  <li>• Volume discounts available for larger purchases</li>
                  <li>• Used across all AI features: Voice AI, Analytics, Chatbots, and more</li>
                </ul>
              </div>
            </div>
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
        <CreditFAQ onContactSupport={() => setShowSupportModal(true)} />
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

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        partnerName={partnerName}
        partnerEmail={partnerEmail}
        context="credits"
      />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(31, 41, 55, 0.95)',
            color: '#fff',
            border: '1px solid rgba(55, 65, 81, 0.5)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </PartnerLayout>
  );
}
