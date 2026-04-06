'use client';

import React from 'react';
import { FiEye, FiX } from 'react-icons/fi';

interface ImpersonationBannerProps {
  partnerName: string;
  customerName: string;
  sessionId: string;
  onExitPreview?: () => void;
}

export default function ImpersonationBanner({
  partnerName,
  customerName,
  sessionId,
  onExitPreview
}: ImpersonationBannerProps) {
  const handleExitPreview = () => {
    if (onExitPreview) {
      onExitPreview();
    } else {
      // Default behavior: close the window or redirect to partner dashboard
      if (window.opener) {
        // If opened in a popup, close it
        window.close();
      } else {
        // If opened in a tab, redirect to main domain
        window.location.href = 'https://knotie-ai.pro/partner/dashboard';
      }
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm border-b border-blue-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full">
              <FiEye className="w-3 h-3" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
              <span className="font-medium text-sm">
                Support Session
              </span>
              <span className="text-xs opacity-80">
                Assisting <strong>{customerName}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExitPreview}
              className="flex items-center space-x-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors text-xs font-medium"
              title="End support session"
            >
              <FiX className="w-3 h-3" />
              <span className="hidden sm:inline">End Session</span>
              <span className="sm:hidden">End</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
