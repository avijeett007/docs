'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import VideoTutorials from '@/components/partner/VideoTutorials';
import NeonContainer from '@/components/NeonContainer';
import PartnerSidebar from '@/components/partner/PartnerSidebar';

export default function PartnerTutorialsPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');

  useEffect(() => {
    // Get partner name from localStorage
    const storedName = localStorage.getItem('partner_name');
    if (storedName) {
      setPartnerName(storedName);
    }

    // Check if token exists
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
    }
  }, [router]);

  const handleLogout = () => {
    // Clear partner data from localStorage
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    // Redirect to login page
    router.push('/partner/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />

      <main className="flex-1 pl-64 transition-all duration-300">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Tutorial Videos</h1>
            <p className="text-gray-400 mt-2">Learn how to use Knotie AI Pro with these helpful tutorials</p>
          </div>

          <NeonContainer>
            <div className="p-6">
              <VideoTutorials />
            </div>
          </NeonContainer>
        </div>
      </main>
    </div>
  );
}
