'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiUser, FiMail, FiEye, FiEyeOff, FiAlertCircle, FiCheck, FiLoader } from 'react-icons/fi';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { usePartnerBranding } from '@/lib/partnerBranding';

// Component that uses the search params
function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');
  const { branding } = usePartnerBranding();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteData, setInviteData] = useState<{
    id: string;
    name: string;
    email: string;
    customerName: string;
  } | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate the invitation token
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid invitation link. Please contact your administrator.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/whitelabel/team-members/validate-invite?token=${token}`);

        if (!response.ok) {
          const data = await response.json();
          setError(data.message || 'Invalid or expired invitation. Please contact your administrator.');
          setLoading(false);
          return;
        }

        const data = await response.json();
        setInviteData(data.data);
        setLoading(false);
      } catch (error) {
        console.error('Error validating invitation:', error);
        setError('An error occurred while validating your invitation. Please try again later.');
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/whitelabel/team-members/accept-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to accept invitation');
      }

      setSuccess('Your account has been set up successfully! Redirecting to login...');

      // Redirect to login page after 3 seconds
      setTimeout(() => {
        router.push('/whitelabel/login');
      }, 3000);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      setError(error.message || 'An error occurred while accepting the invitation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="animate-spin h-12 w-12 mx-auto" style={{ color: branding.primaryColor }} />
          <p className="text-white text-lg">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            {branding.logo ? (
              <Image src={branding.logo} alt={`${branding.businessName} Logo`} width={150} height={50} className="mx-auto" />
            ) : (
              <h1 className="text-2xl font-bold" style={{ color: branding.primaryColor }}>{branding.businessName}</h1>
            )}
          </div>

          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 flex items-start text-red-400 mb-6">
            <FiAlertCircle className="mt-1 mr-3 flex-shrink-0" />
            <p>{error}</p>
          </div>

          <div className="text-center mt-6">
            <Link href="/whitelabel/login" className="hover:underline" style={{ color: branding.primaryColor }}>
              Return to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            {branding.logo ? (
              <Image src={branding.logo} alt={`${branding.businessName} Logo`} width={150} height={50} className="mx-auto" />
            ) : (
              <h1 className="text-2xl font-bold" style={{ color: branding.primaryColor }}>{branding.businessName}</h1>
            )}
          </div>

          <div className="bg-green-900/30 border border-green-800 rounded-lg p-4 flex items-start text-green-400 mb-6">
            <FiCheck className="mt-1 mr-3 flex-shrink-0" />
            <p>{success}</p>
          </div>

          <div className="text-center mt-6">
            <FiLoader className="animate-spin h-6 w-6 mx-auto mb-2" style={{ color: branding.primaryColor }} />
            <p className="text-gray-400">Redirecting to login page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          {branding.logo ? (
            <Image src={branding.logo} alt={`${branding.businessName} Logo`} width={150} height={50} className="mx-auto" />
          ) : (
            <h1 className="text-2xl font-bold" style={{ color: branding.primaryColor }}>{branding.businessName}</h1>
          )}
          <h1 className="text-2xl font-bold text-white mt-4">Accept Team Invitation</h1>
        </div>

        {inviteData && (
          <div className="mb-6">
            <p className="text-gray-300 mb-2">
              You've been invited to join <span className="font-semibold text-white">{inviteData.customerName}</span> as a team member.
            </p>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <FiUser className="text-gray-400 mr-2" />
                <span className="text-gray-300">{inviteData.name}</span>
              </div>
              <div className="flex items-center">
                <FiMail className="text-gray-400 mr-2" />
                <span className="text-gray-300">{inviteData.email}</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Set Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2"
                style={{ borderColor: `${branding.primaryColor}40`, '--tw-ring-color': branding.primaryColor } as React.CSSProperties}
                required
                minLength={8}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <FiEyeOff className="text-gray-400" />
                ) : (
                  <FiEye className="text-gray-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Password must be at least 8 characters long
            </p>
          </div>

          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2"
              style={{ borderColor: `${branding.primaryColor}40`, '--tw-ring-color': branding.primaryColor } as React.CSSProperties}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ backgroundColor: branding.primaryColor }}
          >
            {isSubmitting ? (
              <>
                <FiLoader className="animate-spin mr-2" />
                Setting Up Account...
              </>
            ) : (
              'Accept Invitation'
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link href="/whitelabel/login" className="hover:underline" style={{ color: branding.primaryColor }}>
            Return to login
          </Link>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
