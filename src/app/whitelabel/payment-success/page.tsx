'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePartnerBranding } from '@/lib/partnerBranding';
import Image from 'next/image';
import { FiCheckCircle, FiAlertCircle, FiArrowRight } from 'react-icons/fi';

function PaymentSuccessContent() {
  const { branding, loading: brandingLoading } = usePartnerBranding();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processPayment = async () => {
      const sessionId = searchParams?.get('session_id');
      const partnerIdParam = searchParams?.get('partner_id');

      if (!sessionId) {
        setError('Invalid payment session');
        setProcessing(false);
        return;
      }

      try {
        // Pass partnerId for Stripe Connect session retrieval (BUG 3/12 fix)
        const response = await fetch('/api/whitelabel/complete-onboarding-after-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId, partnerId: partnerIdParam || undefined }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to complete onboarding');
        }

        setSuccess(true);
        setProcessing(false);
      } catch (err) {
        console.error('Error processing payment:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setProcessing(false);
      }
    };

    if (searchParams) {
      processPayment();
    }
  }, [searchParams]);

  const handleGoToLogin = () => {
    router.push('/whitelabel/login');
  };

  if (brandingLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          {branding.logo ? (
            <Image
              src={branding.logo}
              alt={branding.businessName}
              width={80}
              height={80}
              className="mx-auto rounded-xl object-contain"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-xl flex items-center justify-center text-white font-bold text-3xl mx-auto"
              style={{ background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})` }}
            >
              {branding.businessName.substring(0, 1)}
            </div>
          )}
        </div>

        {/* Content Card */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          {processing && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 mx-auto mb-6"
                   style={{ borderColor: branding.primaryColor }}></div>
              <h2 className="text-2xl font-bold text-white mb-2">Processing Payment</h2>
              <p className="text-gray-400">
                Please wait while we complete your registration...
              </p>
            </div>
          )}

          {!processing && success && (
            <div className="text-center">
              <div className="mb-6">
                <FiCheckCircle className="w-16 h-16 mx-auto"
                              style={{ color: branding.primaryColor }} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Payment Successful!
              </h2>
              <p className="text-gray-300 mb-6">
                Your subscription has been activated. Check your email for login credentials and next steps.
              </p>
              <div className="bg-gray-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-300">
                  <strong className="text-white">What's next?</strong>
                </p>
                <ul className="text-sm text-gray-400 mt-2 space-y-2 text-left">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Check your email for login credentials</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Your account is being set up automatically</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>You'll receive a confirmation email shortly</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={handleGoToLogin}
                className="w-full px-6 py-3 rounded-lg font-medium text-white transition-all hover:shadow-lg flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})` }}
              >
                Go to Login
                <FiArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {!processing && error && (
            <div className="text-center">
              <div className="mb-6">
                <FiAlertCircle className="w-16 h-16 text-red-500 mx-auto" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Payment Processing Error
              </h2>
              <p className="text-gray-300 mb-6">
                {error}
              </p>
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-200">
                  <strong>Don't worry!</strong> If your payment went through, you'll receive a confirmation email.
                  Please contact support if you need assistance.
                </p>
              </div>
              <button
                onClick={handleGoToLogin}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-400">
            Powered by {branding.businessName}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-white">Loading...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
