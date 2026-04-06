'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, ArrowRight, Sparkles, Gift } from 'lucide-react';

interface SuccessData {
  partner: {
    businessName: string;
    emailAddress: string;
  };
  coupon: {
    code: string;
    name: string;
  };
  payment: {
    amount: number;
    sessionId: string;
  };
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id');
  const partnerId = searchParams?.get('partnerId');
  const couponId = searchParams?.get('couponId');
  
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionId && partnerId && couponId) {
      verifyPayment();
    } else {
      setError('Missing required parameters');
      setLoading(false);
    }
  }, [sessionId, partnerId, couponId]);

  const verifyPayment = async () => {
    try {
      const response = await fetch('/api/lifetime-offer/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          partnerId,
          couponId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify payment');
      }

      setSuccessData(data);
    } catch (err) {
      console.error('Error verifying payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify payment');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-white">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (error || !successData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-purple-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Payment Verification Failed</h1>
          <p className="text-gray-300 mb-6">{error || 'Unable to verify your payment.'}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Contact Support
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-6">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-400 to-blue-500 text-black px-4 py-2 rounded-full text-sm font-bold mb-4">
            <Sparkles className="w-4 h-4" />
            PAYMENT SUCCESSFUL
            <Sparkles className="w-4 h-4" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Welcome to Lifetime Access!
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Congratulations {successData.partner.businessName}! Your lifetime access to Knotie AI Pro is now active.
          </p>
        </div>

        {/* Success Card */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 md:p-12">
            {/* Payment Details */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Payment Confirmed</h2>
              <div className="bg-green-600/20 border border-green-400/30 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                  <Gift className="w-5 h-5" />
                  <span className="font-semibold">Coupon Applied: {successData.coupon.code}</span>
                </div>
                <p className="text-green-300 text-sm">{successData.coupon.name}</p>
              </div>
              <p className="text-gray-300">
                Amount Paid: <span className="text-2xl font-bold text-white">${successData.payment.amount}</span>
              </p>
            </div>

            {/* What's Next */}
            <div className="space-y-6 mb-8">
              <h3 className="text-xl font-semibold text-white text-center">What happens next?</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-blue-600/20 rounded-lg p-6 border border-blue-400/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
                    <h4 className="font-semibold text-white">Account Activation</h4>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Your partner account is being activated with lifetime access. You'll receive a confirmation email shortly.
                  </p>
                </div>

                <div className="bg-purple-600/20 rounded-lg p-6 border border-purple-400/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
                    <h4 className="font-semibold text-white">Welcome Package</h4>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Check your email ({successData.partner.emailAddress}) for your welcome package with setup instructions.
                  </p>
                </div>

                <div className="bg-green-600/20 rounded-lg p-6 border border-green-400/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
                    <h4 className="font-semibold text-white">Dashboard Access</h4>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Access your partner dashboard to start creating and managing your AI agents.
                  </p>
                </div>

                <div className="bg-orange-600/20 rounded-lg p-6 border border-orange-400/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">4</div>
                    <h4 className="font-semibold text-white">Support & Training</h4>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Join our exclusive partner community and access priority support channels.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => window.location.href = '/partner/login'}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 flex items-center justify-center gap-2"
              >
                Access Dashboard
                <ArrowRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => window.location.href = '/support'}
                className="px-8 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-all duration-300 border border-white/20"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm">
            Thank you for choosing Knotie AI Pro! We're excited to help you build amazing voice AI experiences.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LifetimeOfferSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
