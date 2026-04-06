'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Loader2, Building2, Mail, Phone, ArrowRight, Ticket, CheckCircle, User } from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import toast from 'react-hot-toast';
import { getReferralId } from '@/lib/referral-tracking';
import { validatePhoneNumber } from '@/lib/utils/phoneValidation';
import 'react-phone-input-2/lib/style.css';

interface SimplifiedSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedPlan?: {
    planId: string;
    billingInterval: 'monthly' | 'yearly';
    planName: string;
    price: number;
  };
  googleSignupData?: GoogleSignupData;
}

interface SignupFormData {
  businessName: string;
  emailAddress: string;
  phoneNumber: string;
  couponCode: string;
}

interface GoogleSignupData {
  id: string;
  email: string;
  name: string;
  picture: string;
  timestamp: number;
}

interface ValidatedCoupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  discountType?: string;
  discountValue?: number;
  lifetimeOfferPrice?: number;
  originalPrice?: number;
  validUntil: string;
}

const SimplifiedSignupModal: React.FC<SimplifiedSignupModalProps> = ({
  isOpen,
  onClose,
  preSelectedPlan,
  googleSignupData: propGoogleSignupData
}) => {
  console.log('🎯 SimplifiedSignupModal rendered:', { isOpen, preSelectedPlan });

  useEffect(() => {
    // Check if Google auth is enabled
    setIsGoogleAuthEnabled(process.env.NEXT_PUBLIC_FEATURE_GOOGLE_AUTH === 'true');

    // Use Google signup data from props
    if (propGoogleSignupData) {
      setGoogleSignupData(propGoogleSignupData);
      setShowGoogleSignupForm(true);
      setFormData(prev => ({
        ...prev,
        emailAddress: propGoogleSignupData.email
      }));
    }
  }, [isOpen, propGoogleSignupData]);
  const [formData, setFormData] = useState<SignupFormData>({
    businessName: '',
    emailAddress: '',
    phoneNumber: '',
    couponCode: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validatedCoupon, setValidatedCoupon] = useState<ValidatedCoupon | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [showLifetimeOffer, setShowLifetimeOffer] = useState(false);
  const [isGoogleAuthEnabled, setIsGoogleAuthEnabled] = useState(false);
  const [googleSignupData, setGoogleSignupData] = useState<GoogleSignupData | null>(null);
  const [showGoogleSignupForm, setShowGoogleSignupForm] = useState(false);

  const validateForm = (): string | null => {
    if (!formData.businessName.trim()) {
      return 'Business Name is required';
    }
    if (!formData.emailAddress.trim()) {
      return 'Email Address is required';
    }
    if (!formData.phoneNumber.trim()) {
      return 'Phone Number is required';
    }

    // Email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.emailAddress)) {
      return 'Please enter a valid email address';
    }

    // Phone number validation using libphonenumber-js (supports all countries)
    const phoneValidation = validatePhoneNumber(formData.phoneNumber);
    if (!phoneValidation.isValid) {
      return phoneValidation.error || 'Please enter a valid phone number';
    }

    return null;
  };

  const handleGoogleSignup = async () => {
    if (!googleSignupData) return;

    setError('');

    // Validate required fields for Google signup
    if (!formData.businessName.trim()) {
      setError('Business Name is required');
      return;
    }
    if (!formData.phoneNumber.trim()) {
      setError('Phone Number is required');
      return;
    }

    // Validate phone number format using libphonenumber-js
    const phoneValidation = validatePhoneNumber(formData.phoneNumber);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || 'Please enter a valid phone number');
      return;
    }

    try {
      setIsLoading(true);

      // Encode the Google user data for the API using btoa (browser-compatible)
      const googleUserDataEncoded = btoa(JSON.stringify(googleSignupData));

      const response = await fetch('/api/partner/auth/google/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleUserData: googleUserDataEncoded,
          businessName: formData.businessName,
          phoneNumber: formData.phoneNumber,
          couponCode: formData.couponCode,
          validatedCoupon,
          showLifetimeOffer,
          preSelectedPlan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Handle success
      const successMessage = data.message || 'Account created successfully!';

      if (data.redirectUrl) {
        toast.success(successMessage);
        setTimeout(() => {
          window.location.href = data.redirectUrl;
        }, 1000);
      } else {
        toast.success(successMessage);
        onClose();
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // If this is a Google signup, handle it differently
    if (showGoogleSignupForm && googleSignupData) {
      await handleGoogleSignup();
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsLoading(true);

      // Debug logging
      console.log('🚀 MODAL: Submitting signup with:', {
        showLifetimeOffer,
        validatedCoupon: validatedCoupon ? { id: validatedCoupon.id, type: validatedCoupon.type } : null,
        preSelectedPlan: preSelectedPlan ? { planId: preSelectedPlan.planId } : null,
        url: '/api/partners/quick-signup'
      });

      // Create simplified partner record
      const response = await fetch('/api/partners/quick-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          preSelectedPlan,
          validatedCoupon,
          showLifetimeOffer,
          referralId: getReferralId() // Include referral ID from client-side tracking
        }),
      });

      const data = await response.json();
      console.log('📨 MODAL: API Response:', {
        ok: response.ok,
        status: response.status,
        data: data,
        redirectUrl: data.redirectUrl
      });

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Show appropriate success message based on response
      const successMessage = data.message || 'Account created successfully!';

      // Redirect to payment or next step
      if (data.redirectUrl) {
        console.log('🔄 MODAL: Redirecting to:', data.redirectUrl);

        // Check if this is a fallback URL (partners page with step parameter)
        const isFallbackUrl = data.redirectUrl.includes('/partners?') && data.redirectUrl.includes('step=');

        if (isFallbackUrl) {
          // For fallback URLs, show a different message and redirect immediately
          toast.success('Account created! Redirecting to complete setup...');
          window.location.href = data.redirectUrl;
        } else {
          // For direct payment URLs, show success and redirect with delay
          toast.success(successMessage);
          setTimeout(() => {
            window.location.href = data.redirectUrl;
          }, 1000);
        }
      } else {
        toast.success(successMessage);
        onClose();
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhoneChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      phoneNumber: value
    }));
  };

  // Validate coupon code
  const validateCoupon = async (code: string) => {
    if (!code.trim()) {
      setValidatedCoupon(null);
      setShowLifetimeOffer(false);
      return;
    }

    try {
      setCouponValidating(true);
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (data.valid && data.coupon) {
        setValidatedCoupon(data.coupon);
        setShowLifetimeOffer(data.eligibleForLifetimeOffer || false);
        if (data.eligibleForLifetimeOffer) {
          toast.success(`🎉 Lifetime offer unlocked! Special price: $${data.coupon.lifetimeOfferPrice}`);
        } else {
          toast.success(`✅ Coupon "${data.coupon.name}" applied successfully!`);
        }
      } else {
        setValidatedCoupon(null);
        setShowLifetimeOffer(false);
        if (data.error) {
          toast.error(data.error);
        }
      }
    } catch (err) {
      console.error('Error validating coupon:', err);
      setValidatedCoupon(null);
      setShowLifetimeOffer(false);
      toast.error('Failed to validate coupon');
    } finally {
      setCouponValidating(false);
    }
  };

  const handleGoogleAuthError = (error: string) => {
    setError(error);
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        businessName: '',
        emailAddress: '',
        phoneNumber: '',
        couponCode: ''
      });
      setError('');
      setValidatedCoupon(null);
      setShowLifetimeOffer(false);
      setGoogleSignupData(null);
      setShowGoogleSignupForm(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md w-full bg-gray-900 rounded-xl border border-gray-800 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <Dialog.Title className="text-xl font-semibold text-white">
                {showGoogleSignupForm
                  ? 'Complete Your Google Signup'
                  : preSelectedPlan
                    ? 'Complete Your Signup'
                    : 'Create account'
                }
              </Dialog.Title>
              <p className="text-sm text-gray-400 mt-1">
                {showGoogleSignupForm
                  ? 'Just a few more details to complete your account'
                  : preSelectedPlan
                    ? `Continue with ${preSelectedPlan.planName} plan`
                    : (
                        <>
                          Sign up for <span className="text-cyan-400 font-medium">free access forever</span>
                        </>
                      )
                }
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selected Plan Info */}
          {preSelectedPlan && (
            <div className="p-6 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">{preSelectedPlan.planName}</h3>
                  <p className="text-xs text-gray-400 capitalize">{preSelectedPlan.billingInterval} billing</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">${preSelectedPlan.price.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">/{preSelectedPlan.billingInterval === 'yearly' ? 'year' : 'month'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Google Sign-up Option (only show if not already in Google signup flow) */}
          {isGoogleAuthEnabled && !showGoogleSignupForm && (
            <div className="p-6 pb-0">
              <GoogleSignInButton
                isSignup={true}
                returnTo="/partner/dashboard"
                disabled={isLoading}
                variant="primary"
                onError={handleGoogleAuthError}
                className="w-full"
              />

              <div className="relative mt-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900 text-gray-400">or</span>
                </div>
              </div>
            </div>
          )}

          {/* Google User Info Display (for Google signup flow) */}
          {showGoogleSignupForm && googleSignupData && (
            <div className="p-6 pb-0">
              <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                <User className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-400">Signing up with Google</p>
                  <p className="text-xs text-green-300">{googleSignupData.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Business Name */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-300 mb-2">
                Business Name *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  id="businessName"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="Enter your business name"
                />
              </div>
            </div>

            {/* Email Address (hidden for Google signup) */}
            {!showGoogleSignupForm && (
              <div>
                <label htmlFor="emailAddress" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    id="emailAddress"
                    name="emailAddress"
                    value={formData.emailAddress}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    placeholder="Enter your email address"
                  />
                </div>
              </div>
            )}

            {/* Phone Number */}
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                <PhoneInput
                  country={'us'}
                  value={formData.phoneNumber}
                  onChange={handlePhoneChange}
                  disabled={isLoading}
                  inputClass="!w-full !pl-12 !pr-4 !py-3 !bg-gray-800 !border !border-gray-700 !rounded-lg !text-white !placeholder-gray-400 focus:!outline-none focus:!ring-2 focus:!ring-blue-500 focus:!border-transparent disabled:!opacity-50"
                  containerClass="!w-full"
                  buttonClass="!bg-gray-800 !border-gray-700 !rounded-l-lg hover:!bg-gray-700"
                  dropdownClass="!bg-gray-800 !border-gray-700 !text-white"
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                🎁 We&apos;ll send exclusive offers & early access to new features via WhatsApp
              </p>
            </div>

            {/* Coupon Code */}
            <div>
              <label htmlFor="couponCode" className="block text-sm font-medium text-gray-300 mb-2">
                Coupon Code (Optional)
              </label>
              <div className="relative">
                <Ticket className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  id="couponCode"
                  name="couponCode"
                  value={formData.couponCode}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setFormData(prev => ({ ...prev, couponCode: value }));
                    // Validate coupon after user stops typing
                    if (value.length >= 3) {
                      const timeoutId = setTimeout(() => validateCoupon(value), 500);
                      return () => clearTimeout(timeoutId);
                    } else {
                      setValidatedCoupon(null);
                      setShowLifetimeOffer(false);
                    }
                  }}
                  disabled={isLoading}
                  className="w-full pl-10 pr-12 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="Enter coupon code"
                />
                {couponValidating && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 animate-spin" />
                )}
                {validatedCoupon && !couponValidating && (
                  <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500 w-4 h-4" />
                )}
              </div>

              {/* Coupon Status */}
              {validatedCoupon && (
                <div className="mt-2 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">{validatedCoupon.name}</span>
                  </div>
                  {validatedCoupon.description && (
                    <p className="text-green-300 text-xs mt-1">{validatedCoupon.description}</p>
                  )}
                  {showLifetimeOffer && validatedCoupon.lifetimeOfferPrice && (
                    <div className="mt-2 text-xs">
                      <span className="text-green-400">🎉 Lifetime Offer Unlocked!</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-green-300">Special Price: ${validatedCoupon.lifetimeOfferPrice}</span>
                        {validatedCoupon.originalPrice && (
                          <span className="text-gray-400 line-through">${validatedCoupon.originalPrice}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  {showGoogleSignupForm
                    ? (preSelectedPlan ? 'Continue to Payment' : 'Complete Google Signup')
                    : (preSelectedPlan ? 'Continue to Payment' : 'Create Account')
                  }
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 text-center">
              By continuing, you agree to our Terms of Service and Privacy Policy.
              {!preSelectedPlan && (
                <span className="block mt-1">
                  You'll be able to select your plan and complete your profile after account creation.
                </span>
              )}
              <span className="block mt-2 text-blue-400">
                Already started signup? No worries - we'll continue where you left off.
              </span>
            </p>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default SimplifiedSignupModal;
