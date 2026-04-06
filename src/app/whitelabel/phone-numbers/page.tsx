'use client';

import { useState } from 'react';
import { PhoneNumberList } from '@/components/whitelabel/phone-numbers/PhoneNumberList';
import { PhoneNumberSearch } from '@/components/whitelabel/phone-numbers/PhoneNumberSearch';
import PhoneNumberImportModal from '@/components/phone-numbers/PhoneNumberImportModal';
import { Button } from '@/components/ui/button';
import { Plus, Phone, Download } from 'lucide-react';
import { toast } from 'sonner';
import GetNumberModal from '@/components/whitelabel/phone-numbers/GetNumberModal';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { PortalTheme, getThemeConfig } from '@/lib/portalThemes';

export default function PhoneNumbersPage() {
  const { branding } = usePartnerBranding();
  const [showSearch, setShowSearch] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showGetNumberModal, setShowGetNumberModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get theme config from branding theme preference with fallback
  const theme = (branding?.themePreference as PortalTheme) || PortalTheme.MODERN;
  const themeConfig = getThemeConfig(theme);

  const handlePurchaseComplete = () => {
    setShowSearch(false);
    setRefreshKey(prev => prev + 1); // Trigger list refresh
    toast.success('Phone number purchased successfully');
  };

  const handleImportComplete = () => {
    setShowImport(false);
    setRefreshKey(prev => prev + 1); // Trigger list refresh
  };

  return (
    <WhitelabelLayout>
      <div className="mb-8">
        <div className={`${themeConfig.styleClasses.card} border border-gray-700 rounded-lg p-6 mb-6`}
             style={{ borderColor: `${branding?.primaryColor || '#3b82f6'}40` }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: branding?.primaryColor || '#3b82f6' }}>
                Phone Numbers
              </h1>
              <p className="text-gray-400 mt-2">
                Manage your phone numbers for voice agents and communication
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowImport(!showImport)}
                className="flex items-center gap-2 text-white transition-all hover:opacity-90"
                style={{
                  background: `linear-gradient(to right, ${branding?.primaryColor || '#3b82f6'}80, ${branding?.secondaryColor || branding?.primaryColor || '#3b82f6'}80)`,
                  boxShadow: `0 4px 12px ${branding?.primaryColor || '#3b82f6'}20`
                }}
              >
                <Download className="h-4 w-4" />
                Import Numbers
              </Button>
              {/* TEMPORARILY HIDDEN - Original Buy Phone Number functionality preserved for future use */}
              {false && (
                <Button
                  onClick={() => setShowSearch(!showSearch)}
                  className="flex items-center gap-2 text-white transition-all hover:opacity-90"
                  style={{
                    background: `linear-gradient(to right, ${branding?.primaryColor || '#3b82f6'}, ${branding?.secondaryColor || branding?.primaryColor || '#3b82f6'})`,
                    boxShadow: `0 4px 12px ${branding?.primaryColor || '#3b82f6'}30`
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Buy Phone Number
                </Button>
              )}

              {/* NEW: Get A Number - Simplified pooling system */}
              <Button
                onClick={() => setShowGetNumberModal(true)}
                className="flex items-center gap-2 text-white transition-all hover:opacity-90"
                style={{
                  background: `linear-gradient(to right, ${branding?.primaryColor || '#3b82f6'}, ${branding?.secondaryColor || branding?.primaryColor || '#3b82f6'})`,
                  boxShadow: `0 4px 12px ${branding?.primaryColor || '#3b82f6'}30`
                }}
              >
                <Phone className="h-4 w-4" />
                Get A Number
              </Button>
            </div>
          </div>
        </div>

        {/* Simplified Phone Number Information */}
        <div className={`${themeConfig.styleClasses.card} border rounded-lg p-5 mb-6`}
             style={{
               borderColor: `${branding?.primaryColor || '#3b82f6'}60`,
               backgroundColor: `${branding?.primaryColor || '#3b82f6'}15`
             }}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: `${branding?.primaryColor || '#3b82f6'}30` }}>
              <span className="text-lg">📞</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2" style={{ color: branding?.primaryColor || '#3b82f6' }}>
                Get Your Phone Number
              </h3>
              <p className="text-sm text-gray-300 mb-3">
                Get a phone number instantly for your AI agents. Numbers are ready for inbound calls immediately.
                Perfect for customer service, lead capture, and automated support.
              </p>
              <div className="text-xs text-gray-400">
                <strong>Note:</strong> Numbers are configured for inbound calls only. For outbound calling capabilities,
                please import your own verified business number using the "Import Numbers" feature.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phone Number Search/Purchase Section */}
      {showSearch && (
        <div className="mb-8">
          <PhoneNumberSearch onPurchaseComplete={handlePurchaseComplete} />
        </div>
      )}

      {/* Phone Numbers List Section */}
      <div className={`${themeConfig.styleClasses.card} rounded-lg p-6`}>
        <div className="flex items-center mb-6">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
            style={{ backgroundColor: `${branding?.primaryColor || '#3b82f6'}20` }}
          >
            <Phone style={{ color: branding?.primaryColor || '#3b82f6' }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Your Phone Numbers</h2>
            <p className="text-gray-400 text-sm">Manage and configure your purchased phone numbers</p>
          </div>
        </div>

        <PhoneNumberList key={refreshKey} />
      </div>

      {/* Phone Number Import Modal */}
      <PhoneNumberImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImportComplete={handleImportComplete}
      />

      <GetNumberModal
        isOpen={showGetNumberModal}
        onClose={() => setShowGetNumberModal(false)}
        onSuccess={() => {
          setRefreshKey(prev => prev + 1);
          toast.success('Phone number assigned successfully!');
        }}
      />
    </WhitelabelLayout>
  );
}