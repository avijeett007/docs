'use client';

import React, { useState, useEffect } from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FiLogOut } from 'react-icons/fi';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';
import WhitelabelSidebar from './WhitelabelSidebar';
import CustomerCreditPurchaseModal from './CustomerCreditPurchaseModal';
import ImpersonationBanner from './ImpersonationBanner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

interface CustomerInfo {
  id: string;
  name: string;
  email: string;
}

interface WhitelabelLayoutProps {
  children: React.ReactNode;
}

export default function WhitelabelLayout({ children }: WhitelabelLayoutProps) {
  const { branding } = usePartnerBranding();
  const router = useRouter();
  const customerAuth = useCustomerAuth();
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCreditPurchaseModal, setShowCreditPurchaseModal] = useState(false);
  const [creditRefreshTrigger, setCreditRefreshTrigger] = useState(0);

  // Get theme config from branding theme preference
  const theme = (branding.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  // Handle authentication state changes
  useEffect(() => {
    if (!customerAuth.isLoading) {
      if (!customerAuth.isAuthenticated) {
        router.push('/whitelabel/login');
        return;
      }

      // Set customer info from auth hook
      setCustomer({
        id: customerAuth.customerId,
        name: 'Customer', // This will be updated by the auth hook
        email: customerAuth.email
      });
    }
  }, [customerAuth.isLoading, customerAuth.isAuthenticated, customerAuth.customerId, customerAuth.email, router]);

  // Update document title with partner business name
  useEffect(() => {
    if (branding && branding.businessName) {
      const pageTitle = branding.portalTitle || `${branding.businessName} AI Portal`;
      document.title = pageTitle;
    }
  }, [branding]);

  const handleLogout = async () => {
    try {
      // Call the logout API endpoint
      await fetch('/api/whitelabel/auth/logout', {
        method: 'POST',
      });
      router.push('/whitelabel/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (customerAuth.isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${themeConfig.styleClasses.container}`}>
        <div className="animate-spin w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full"></div>
      </div>
    );
  }

  // Handle sidebar collapse
  const handleSidebarToggle = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
  };

  // Refresh credits in sidebar
  const refreshCredits = () => {
    setCreditRefreshTrigger(prev => prev + 1);
  };

  // Create gradient styles
  const gradientBg = `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`;

  // Create font style based on branding
  const fontStyle = {
    fontFamily: `var(--font-${branding.fontFamily?.toLowerCase() || 'inter'})`,
  };

  return (
    <div className={`min-h-screen ${themeConfig.styleClasses.container}`} style={fontStyle}>
      {/* Header */}
      <header className={`border-b border-gray-700 ${themeConfig.styleClasses.header}`}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo ? (
              <Image
                src={branding.logo}
                alt={branding.businessName}
                width={40}
                height={40}
                className="rounded"
              />
            ) : (
              <div
                className="w-10 h-10 rounded flex items-center justify-center text-white font-bold text-xl"
                style={{ background: gradientBg }}
              >
                {branding.businessName.substring(0, 1)}
              </div>
            )}
            <h1
              className="text-xl font-bold relative z-10"
              style={{
                color: branding.primaryColor,
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}
            >
              {branding.portalTitle || `${branding.businessName} AI Portal`}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right mr-4">
              <p className="text-sm text-gray-300">{customer?.name}</p>
              <p className="text-xs text-gray-400">{customer?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className={`p-2 rounded-full text-gray-300 ${themeConfig.styleClasses.button.secondary}`}
              title="Logout"
              style={{ color: branding.primaryColor }}
            >
              <FiLogOut />
            </button>
          </div>
        </div>
      </header>

      {/* Impersonation Banner */}
      {customerAuth.isImpersonating && customerAuth.impersonatedBy && customerAuth.impersonationSessionId && (
        <ImpersonationBanner
          partnerName="Partner" // This will be updated when we get partner info from the auth hook
          customerName={customer?.name || 'Customer'}
          sessionId={customerAuth.impersonationSessionId}
        />
      )}

      {/* Main content */}
      <div className={`flex ${customerAuth.isImpersonating ? 'h-[calc(100vh-128px)]' : 'h-[calc(100vh-64px)]'}`}>
        {/* Sidebar */}
        <WhitelabelSidebar
          collapsed={sidebarCollapsed}
          onToggle={handleSidebarToggle}
          onAddCreditsClick={() => setShowCreditPurchaseModal(true)}
          creditRefreshTrigger={creditRefreshTrigger}
        />

        {/* Main content */}
        <div className={`flex-1 p-4 md:p-6 overflow-y-auto transition-all duration-300`}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </div>

      {/* Credit Purchase Modal */}
      <CustomerCreditPurchaseModal
        isOpen={showCreditPurchaseModal}
        onClose={() => setShowCreditPurchaseModal(false)}
        onPurchaseSuccess={() => {
          setShowCreditPurchaseModal(false);
          refreshCredits(); // Refresh credit balance in sidebar
        }}
      />
    </div>
  );
}
