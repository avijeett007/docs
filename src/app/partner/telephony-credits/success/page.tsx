'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiPhone, FiArrowRight, FiLoader } from 'react-icons/fi';
import PartnerLayout from '@/components/partner/PartnerLayout';
import NeonContainer from '@/components/NeonContainer';
import { formatTelephonyAmount } from '@/lib/types/credits';

function TelephonyCreditsSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id');
  
  const [loading, setLoading] = useState(true);
  const [purchaseDetails, setPurchaseDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');

  useEffect(() => {
    // Get partner name from localStorage
    const storedName = localStorage.getItem('partner_name');
    if (storedName) {
      setPartnerName(storedName);
    }

    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    // Verify the purchase with the backend
    verifyPurchase();
  }, [sessionId]);

  const verifyPurchase = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) {
        router.push('/partner/login');
        return;
      }

      const response = await fetch(`/api/partner/telephony-credits/verify-purchase?session_id=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to verify purchase');
      }

      const data = await response.json();
      
      if (data.success) {
        setPurchaseDetails(data.data);
      } else {
        setError(data.error || 'Purchase verification failed');
      }
    } catch (err) {
      console.error('Error verifying purchase:', err);
      setError('Failed to verify purchase');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  const handleContinue = () => {
    // Add a timestamp to force refresh of the telephony credits page
    router.push('/partner/telephony-credits?refresh=' + Date.now());
  };

  if (loading) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <FiLoader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Verifying your purchase...</p>
          </div>
        </div>
      </PartnerLayout>
    );
  }

  if (error) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="min-h-screen flex items-center justify-center">
          <NeonContainer>
            <div className="text-center p-8">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheckCircle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Purchase Verification Failed</h1>
              <p className="text-gray-400 mb-6">{error}</p>
              <button
                onClick={handleContinue}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Return to Telephony Credits
              </button>
            </div>
          </NeonContainer>
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <NeonContainer>
            <div className="text-center p-8">
              {/* Success Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative"
              >
                <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                <FiCheckCircle className="w-10 h-10 text-green-400 relative z-10" />
              </motion.div>

              {/* Success Message */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <h1 className="text-3xl font-bold text-white mb-2">
                  Purchase Successful!
                </h1>
                <p className="text-gray-400 mb-6">
                  Your telephony credits have been added to your account
                </p>
              </motion.div>

              {/* Purchase Details */}
              {purchaseDetails && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-gray-800/50 rounded-lg p-6 mb-6 text-left"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <FiPhone className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Purchase Details</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Credits Added:</span>
                      <span className="text-white font-medium">
                        {formatTelephonyAmount(purchaseDetails.creditsAdded || 0)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount Paid:</span>
                      <span className="text-white font-medium">
                        {formatTelephonyAmount(purchaseDetails.amountPaid || 0)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">New Balance:</span>
                      <span className="text-green-400 font-bold">
                        {formatTelephonyAmount(purchaseDetails.newBalance || 0)}
                      </span>
                    </div>
                    
                    {purchaseDetails.transactionId && (
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-400">Transaction ID:</span>
                        <span className="text-white font-mono text-xs break-all">
                          {purchaseDetails.transactionId}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="space-y-3"
              >
                <button
                  onClick={handleContinue}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/25"
                >
                  <span>Continue to Telephony Credits</span>
                  <FiArrowRight className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => router.push('/partner/dashboard')}
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Return to Dashboard
                </button>
              </motion.div>
            </div>
          </NeonContainer>
        </motion.div>
      </div>
    </PartnerLayout>
  );
}

export default function TelephonyCreditsSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TelephonyCreditsSuccessPageContent />
    </Suspense>
  );
}
