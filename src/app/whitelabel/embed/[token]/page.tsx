'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiLoader, FiAlertCircle, FiShield } from 'react-icons/fi';

export default function EmbedTokenPage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const validateAndLogin = async () => {
      try {
        const token = params?.token as string;

        if (!token) {
          setError('Invalid embed token');
          setStatus('error');
          return;
        }

        // Call the embed authentication API
        // Pass the original referer to preserve the embedding source domain
        const response = await fetch(`/api/whitelabel/embed/auth/${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Pass the original referer from the page load
            'X-Original-Referer': document.referrer || '',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Authentication failed');
          setStatus('error');
          return;
        }

        const data = await response.json();
        
        if (data.success) {
          setStatus('success');
          // Redirect to the whitelabel dashboard
          // Add a small delay to show success state
          setTimeout(() => {
            router.push('/whitelabel/dashboard');
          }, 1000);
        } else {
          setError(data.error || 'Authentication failed');
          setStatus('error');
        }
      } catch (error) {
        console.error('Error during embed authentication:', error);
        setError('An unexpected error occurred');
        setStatus('error');
      }
    };

    validateAndLogin();
  }, [params?.token, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-6"></div>
          <h2 className="text-2xl font-semibold text-white mb-2">Authenticating...</h2>
          <p className="text-gray-400">Please wait while we verify your access</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiShield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Authentication Successful</h2>
          <p className="text-gray-400">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiAlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            
            <div className="space-y-3 text-sm text-gray-500">
              <p>This could happen if:</p>
              <ul className="text-left space-y-1">
                <li>• The embed token has expired or been revoked</li>
                <li>• Your domain is not in the allowed list</li>
                <li>• The token is invalid or malformed</li>
              </ul>
            </div>
            
            <div className="mt-8">
              <button
                onClick={() => window.history.back()}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-white font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
