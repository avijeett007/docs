'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PartnerSidebar from './PartnerSidebar';
import clsx from 'clsx';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('Partner');

  // Fetch partner info on component mount
  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    // Fetch partner info
    const fetchPartnerInfo = async () => {
      try {
        const response = await fetch('/api/partner/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch partner info');
        }

        const data = await response.json();
        setPartnerName(data.businessName || 'Partner');
      } catch (error) {
        console.error('Error fetching partner info:', error);
      }
    };

    fetchPartnerInfo();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    router.push('/partner/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-900">
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
      <div className="flex-1 p-6">
        {children}
      </div>
    </div>
  );
}
