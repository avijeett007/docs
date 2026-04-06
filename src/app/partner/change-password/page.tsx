'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import NeonContainer from '@/components/NeonContainer';
import content from '@/config/partner/content.json';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { 
    title, 
    subtitle, 
    currentPasswordLabel, 
    currentPasswordPlaceholder,
    newPasswordLabel,
    newPasswordPlaceholder,
    confirmPasswordLabel,
    confirmPasswordPlaceholder,
    buttonText,
    loadingText
  } = content.changePassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/partner/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      // Store first-time login status for welcome video
      if (data.isFirstTimeLogin !== undefined) {
        localStorage.setItem('is_first_time_login', data.isFirstTimeLogin.toString());
      }

      // Store partner name if provided
      if (data.name) {
        localStorage.setItem('partner_name', data.name);
      }

      router.push('/partner/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
      <NeonContainer className="w-full max-w-md space-y-8 p-8">
        <div className="flex flex-col items-center">
          <Logo />
          <h2 className="mt-6 text-3xl font-bold">{title}</h2>
          <p className="mt-2 text-gray-400">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
                {currentPasswordLabel}
              </label>
              <input
                id="currentPassword"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-blue-400/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                placeholder={currentPasswordPlaceholder}
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                {newPasswordLabel}
              </label>
              <input
                id="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-blue-400/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                placeholder={newPasswordPlaceholder}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                {confirmPasswordLabel}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-blue-400/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-400"
                placeholder={confirmPasswordPlaceholder}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? loadingText : buttonText}
          </button>
        </form>
      </NeonContainer>
    </div>
  );
}
