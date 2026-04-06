'use client';

import React from 'react';
import GuidedPartnerSidebar from './GuidedPartnerSidebar';
import { UserGuideProvider } from '@/context/UserGuideContext';

interface PartnerLayoutProps {
  children: React.ReactNode;
  partnerName: string;
  onLogout: () => void;
}

export default function PartnerLayout({ children, partnerName, onLogout }: PartnerLayoutProps) {
  const handleLogout = () => {
    // Clear any stored data
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_data');
    
    // Call the provided logout handler
    onLogout();
  };

  return (
    <UserGuideProvider>
      <div className="min-h-screen bg-gray-900 text-white">
        <GuidedPartnerSidebar partnerName={partnerName} onLogout={handleLogout} />

        <main className="flex-1 pl-64 min-h-screen">
          <div className="p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </UserGuideProvider>
  );
}
