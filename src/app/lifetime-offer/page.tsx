'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Timer, ArrowRight, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { ClientOnly } from '@/components/ui/client-only';
import { HeroMemberCounter } from '@/components/ui/animated-counter';

interface LifetimeOfferData {
  partner: {
    id: string;
    businessName: string;
    emailAddress: string;
  };
  coupon: {
    id: string;
    code: string;
    name: string;
    description?: string;
    lifetimeOfferPrice: number;
    originalPrice: number;
    validUntil: string;
    remainingUses: number | null;
    hasUsageLimit: boolean;
    videoUrl?: string;
    stripePriceId?: string;
  };
}

function LifetimeOfferContent() {
  const searchParams = useSearchParams();
  const partnerId = searchParams?.get('partnerId');
  const couponId = searchParams?.get('couponId');
  
  const [offerData, setOfferData] = useState<LifetimeOfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (partnerId && couponId) {
      fetchOfferData();
    } else {
      setError('Missing required parameters');
      setLoading(false);
    }
  }, [partnerId, couponId]);

  const fetchOfferData = async () => {
    try {
      const response = await fetch(`/api/lifetime-offer/details?partnerId=${partnerId}&couponId=${couponId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load offer details');
      }

      console.log('🎥 Lifetime offer data received:', data);
      console.log('🎥 Video URL:', data.coupon?.videoUrl);
      setOfferData(data);
    } catch (err) {
      console.error('Error fetching offer data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load offer');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!offerData) return;

    try {
      setIsProcessing(true);
      
      const response = await fetch('/api/lifetime-offer/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerId: offerData.partner.id,
          couponId: offerData.coupon.id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }

    } catch (err) {
      console.error('Error processing purchase:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to process purchase');
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateSavings = () => {
    if (!offerData) return 0;
    return offerData.coupon.originalPrice - offerData.coupon.lifetimeOfferPrice;
  };

  const calculateSavingsPercentage = () => {
    if (!offerData) return 0;
    return Math.round((calculateSavings() / offerData.coupon.originalPrice) * 100);
  };

  const getTimeRemaining = () => {
    if (!offerData) return '';
    const validUntil = new Date(offerData.coupon.validUntil);
    const now = new Date();
    const diff = validUntil.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    return `${hours} hour${hours > 1 ? 's' : ''} left`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
            <div className="absolute inset-0 w-12 h-12 border-2 border-teal-400/30 rounded-full animate-ping mx-auto"></div>
          </div>
          <p className="text-blue-200/80 font-medium">Loading your exclusive offer...</p>
        </div>
      </div>
    );
  }

  if (error || !offerData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Offer Not Available</h1>
          <p className="text-blue-200/80 mb-6">{error || 'This offer is no longer available.'}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 font-semibold"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      {/* Background Effects - Aligned with KnotieDashboard */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/Knotie_logo.svg"
              alt="Knotie AI Pro"
              width={120}
              height={40}
              className="mx-auto"
            />
          </div>

          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white px-6 py-3 rounded-full text-sm font-bold mb-6 shadow-lg">
            <Sparkles className="w-4 h-4" />
            EXCLUSIVE LIFETIME OFFER
            <Sparkles className="w-4 h-4" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight">
            Welcome,
            <span className="text-transparent bg-gradient-to-r from-blue-400 via-teal-400 to-purple-400 bg-clip-text block mt-2">
              {offerData.partner.businessName}!
            </span>
          </h1>
          <p className="text-xl text-blue-200/80 max-w-2xl mx-auto">
            You've unlocked an exclusive lifetime deal with coupon <span className="font-mono bg-gradient-to-r from-blue-500/20 to-teal-500/20 px-3 py-1 rounded-lg text-blue-300 border border-blue-400/30">{offerData.coupon.code}</span>
          </p>
        </div>

        {/* Offer Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-lg rounded-2xl border border-blue-500/30 p-8 md:p-12 shadow-xl shadow-blue-500/10">
            {/* Timer and Scarcity */}
            <div className="flex flex-col items-center gap-4 mb-8">
              <div className="flex items-center justify-center gap-2 text-orange-400">
                <Timer className="w-5 h-5" />
                <span className="font-semibold">{getTimeRemaining()}</span>
              </div>

              {/* Scarcity Message */}
              {offerData.coupon.hasUsageLimit && offerData.coupon.remainingUses && (
                <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/40 rounded-lg px-6 py-3 shadow-lg animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-red-300 font-bold text-sm">
                    🔥 Only {offerData.coupon.remainingUses} spot{offerData.coupon.remainingUses > 1 ? 's' : ''} remaining!
                  </span>
                </div>
              )}
            </div>

            {/* Video Section */}
            {(() => {
              console.log('🎥 Checking video URL:', offerData.coupon.videoUrl);
              console.log('🎥 Video URL exists:', !!offerData.coupon.videoUrl);
              return offerData.coupon.videoUrl ? (
                <div className="mb-8">
                  <div className="relative w-full max-w-2xl mx-auto">
                    <div className="aspect-video rounded-lg overflow-hidden bg-gray-800">
                      <iframe
                        src={offerData.coupon.videoUrl}
                        title="Promotional Video"
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-8 text-center">
                  <p className="text-gray-400 text-sm">No video URL provided for this coupon</p>
                </div>
              );
            })()}

            {/* Pricing */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-6 mb-6">
                <span className="text-6xl md:text-8xl font-bold text-transparent bg-gradient-to-r from-blue-400 via-teal-400 to-purple-400 bg-clip-text">
                  ${offerData.coupon.lifetimeOfferPrice}
                </span>
                <div className="text-left">
                  <div className="text-2xl md:text-3xl text-gray-400 line-through">
                    ${offerData.coupon.originalPrice}
                  </div>
                  <div className="text-green-400 font-bold text-lg">
                    Save ${calculateSavings()} ({calculateSavingsPercentage()}% off)
                  </div>
                </div>
              </div>
              <p className="text-gray-300 text-lg">One-time payment • Lifetime access</p>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white mb-4">What's Included:</h3>
                {[
                  'Unlimited Voice AI Agents',
                  'Advanced Analytics Dashboard',
                  'White-label Branding',
                  'Priority Support',
                  'All Future Updates',
                  'No Monthly Fees Ever'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
              
              <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-400/30">
                <h4 className="text-lg font-semibold text-white mb-3">🎉 Bonus Features</h4>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Exclusive partner community access</li>
                  <li>• Monthly strategy calls</li>
                  <li>• Custom integrations support</li>
                  <li>• Lifetime updates guarantee</li>
                </ul>
              </div>
            </div>

            {/* CTA Button */}
            <div className="text-center">
              <button
                onClick={handlePurchase}
                disabled={isProcessing}
                className="w-full md:w-auto px-12 py-4 bg-gradient-to-r from-blue-500 to-teal-500 text-white text-xl font-bold rounded-xl hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 relative overflow-hidden group shadow-xl shadow-blue-500/25"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative flex items-center justify-center gap-3">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      🚀 Claim Lifetime Access Now
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
                    </>
                  )}
                </span>
              </button>

              <p className="text-blue-200/60 text-sm mt-4">
                🔒 Secure checkout powered by Stripe • ✅ 30-day money-back guarantee
              </p>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm">
            Join <ClientOnly fallback={<span className="text-teal-400 font-semibold">250+</span>}>
              <HeroMemberCounter className="text-teal-400 font-semibold" />
            </ClientOnly> agencies already using Knotie AI Pro
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LifetimeOfferPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    }>
      <LifetimeOfferContent />
    </Suspense>
  );
}
