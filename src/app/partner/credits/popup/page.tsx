'use client';

import React, { useState, useEffect } from 'react';
import CreditPurchaseModal from '@/components/partner/CreditPurchaseModal';
import { CreditPackage } from '@/lib/types/credits';

export default function CreditPurchasePopup() {
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load credit packages
  const loadCreditPackages = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch('/api/partner/credits/packages', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCreditPackages(data.data.packages);
        }
      }
    } catch (error) {
      console.error('Error loading credit packages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCreditPackages();
  }, []);

  const handleClose = () => {
    window.close();
  };

  const handlePurchaseSuccess = () => {
    // Notify parent window if it exists
    if (window.opener) {
      window.opener.postMessage({ type: 'CREDIT_PURCHASE_SUCCESS' }, '*');
    }
    window.close();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Credit Purchase Modal - Always Open */}
      <CreditPurchaseModal
        isOpen={true}
        onClose={handleClose}
        packages={creditPackages}
        onPurchaseSuccess={handlePurchaseSuccess}
      />
    </div>
  );
}
