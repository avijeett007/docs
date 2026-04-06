'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface GoogleSignInButtonProps {
  isSignup?: boolean;
  returnTo?: string;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary';
  onError?: (error: string) => void;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  isSignup = false,
  returnTo = '/partner/dashboard',
  disabled = false,
  className = '',
  variant = 'secondary',
  onError
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleAuth = async () => {
    if (disabled || isLoading) return;

    try {
      setIsLoading(true);

      // Check if Google auth is enabled
      const isGoogleAuthEnabled = process.env.NEXT_PUBLIC_FEATURE_GOOGLE_AUTH === 'true';
      if (!isGoogleAuthEnabled) {
        const error = 'Google authentication is currently not available';
        onError?.(error);
        return;
      }

      // Get Google OAuth URL from our API
      const params = new URLSearchParams({
        returnTo,
        ...(isSignup && { signup: 'true' })
      });

      const response = await fetch(`/api/partner/auth/google?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate Google authentication');
      }

      if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authentication URL received');
      }
    } catch (error) {
      console.error('Google auth error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to authenticate with Google';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const baseClasses = "w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
    secondary: "bg-gray-800/50 text-white border border-gray-600 hover:bg-gray-700/50 hover:border-gray-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
  };

  return (
    <button
      type="button"
      onClick={handleGoogleAuth}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      )}
      <span>
        {isLoading 
          ? 'Connecting...' 
          : `Continue with Google${isSignup ? '' : ''}`
        }
      </span>
    </button>
  );
};

export default GoogleSignInButton;
