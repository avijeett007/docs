'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  FiX,
  FiPhone,
  FiAlertCircle,
  FiCheckCircle,
  FiLoader,
  FiGlobe,
  FiUsers,
  FiShoppingCart
} from 'react-icons/fi';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface GetNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AvailableNumber {
  source: 'partner_pool' | 'global_pool' | 'twilio_search' | 'telnyx_search';
  phoneNumber: string;
  friendlyName: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  poolId?: string;
  message: string;
  countryCode?: string;
  region?: string;
  locality?: string;
  type?: string;
  provider?: string;
}

const COUNTRIES = [
  // Twilio-supported countries
  { code: 'US', name: 'United States', flag: '🇺🇸', provider: 'twilio' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', provider: 'twilio' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', provider: 'twilio' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', provider: 'twilio' },
  // Telnyx-supported countries
  { code: 'DE', name: 'Germany', flag: '🇩🇪', provider: 'telnyx' },
  { code: 'FR', name: 'France', flag: '🇫🇷', provider: 'telnyx' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', provider: 'telnyx' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', provider: 'telnyx' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', provider: 'telnyx' },
];

export default function GetNumberModal({ isOpen, onClose, onSuccess }: GetNumberModalProps) {
  const [step, setStep] = useState<'country' | 'searching' | 'confirm'>('country');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [areaCode, setAreaCode] = useState<string>('');
  const [numberType, setNumberType] = useState<'mobile' | 'local'>('local'); // Default to local for better compatibility
  const [availableNumber, setAvailableNumber] = useState<AvailableNumber | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const { branding } = usePartnerBranding();
  const primaryColor = branding?.primaryColor || '#3B82F6';
  const isDark = branding?.themePreference === 'DARK';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = isDark ? 'text-gray-300' : 'text-gray-600';

  const handleSearch = async () => {
    if (!selectedCountry) {
      toast.error('Please select a country');
      return;
    }

    setIsSearching(true);
    setStep('searching');

    try {
      const response = await fetch('/api/whitelabel/phone-numbers/get-available', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          countryCode: selectedCountry,
          areaCode: areaCode || undefined,
          numberType: numberType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAvailableNumber(data.data);
        setStep('confirm');
      } else {
        if (data.error === 'insufficient_credits') {
          // Show partner contact info for credit issues
          toast.error(data.message);
        } else {
          toast.error(data.message || 'No numbers available');
        }
        setStep('country');
      }
    } catch (error) {
      console.error('Error searching for numbers:', error);
      toast.error('Failed to search for numbers');
      setStep('country');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = async () => {
    if (!availableNumber) return;

    setIsConfirming(true);

    try {
      const response = await fetch('/api/whitelabel/phone-numbers/confirm-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId: availableNumber.poolId,
          phoneNumber: availableNumber.phoneNumber,
          source: availableNumber.source,
          friendlyName: availableNumber.friendlyName,
          countryCode: availableNumber.countryCode,
          region: availableNumber.region,
          locality: availableNumber.locality,
          type: availableNumber.type,
          capabilities: availableNumber.capabilities,
          provider: availableNumber.provider,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.data?.message || 'Phone number assigned successfully!');
        onSuccess();
        onClose();
        resetModal();
      } else {
        if (data.error === 'insufficient_credits') {
          toast.error(data.message);
        } else {
          toast.error(data.message || 'Failed to assign phone number');
        }
      }
    } catch (error) {
      console.error('Error confirming assignment:', error);
      toast.error('Failed to assign phone number');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);

    // Auto-set number type based on provider capabilities
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (country?.provider === 'telnyx') {
      // Telnyx primarily has local numbers in European countries
      setNumberType('local');
    } else {
      // Twilio supports both, default to mobile for better features
      setNumberType('mobile');
    }
  };

  const resetModal = () => {
    setStep('country');
    setSelectedCountry('');
    setAreaCode('');
    setNumberType('local'); // Reset to default
    setAvailableNumber(null);
    setIsSearching(false);
    setIsConfirming(false);
  };

  const handleClose = () => {
    onClose();
    resetModal();
  };

  const getSourceInfo = (source: string) => {
    switch (source) {
      case 'partner_pool':
        return {
          icon: FiCheckCircle,
          label: 'Ready to Use',
          color: 'text-green-600 bg-green-50 border-green-200',
          description: 'This number is ready for your business'
        };
      case 'global_pool':
        return {
          icon: FiPhone,
          label: 'Available',
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          description: 'This number is available for your business'
        };
      case 'twilio_search':
      case 'telnyx_search':
        return {
          icon: FiPhone,
          label: 'New Number',
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          description: 'Fresh number for your business'
        };
      default:
        return {
          icon: FiPhone,
          label: 'Available',
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          description: 'Ready for your business'
        };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog as="div" className="relative z-50" open={isOpen} onClose={handleClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/25 backdrop-blur-sm"
          />

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Dialog.Panel
                as={motion.div}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md transform overflow-hidden rounded-2xl p-6 text-left align-middle shadow-xl transition-all"
                style={{
                  backgroundColor: isDark ? '#1f2937' : '#ffffff',
                  border: `2px solid ${primaryColor}40`,
                  boxShadow: `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px ${primaryColor}20`
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                    >
                      <FiPhone className="h-5 w-5" />
                    </div>
                    <Dialog.Title className={`text-lg font-semibold ${textColor}`}>
                      Get A Number
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <FiX className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                {step === 'country' && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Select Country
                      </label>
                      <select
                        value={selectedCountry}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                        style={{ '--tw-ring-color': `${primaryColor}40` } as React.CSSProperties}
                      >
                        <option value="">Choose a country</option>
                        {COUNTRIES.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.flag} {country.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Number Type
                      </label>
                      <select
                        value={numberType}
                        onChange={(e) => setNumberType(e.target.value as 'mobile' | 'local')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                        style={{ '--tw-ring-color': `${primaryColor}40` } as React.CSSProperties}
                      >
                        <option value="mobile">📱 Mobile (Voice + SMS)</option>
                        <option value="local">📞 Local (Voice Only)</option>
                      </select>
                      <p className="text-xs text-gray-500">
                        {(() => {
                          const country = COUNTRIES.find(c => c.code === selectedCountry);
                          const provider = country?.provider || 'twilio';

                          if (numberType === 'mobile') {
                            return provider === 'telnyx'
                              ? 'Mobile numbers may have limited availability in some regions'
                              : 'Mobile numbers support both voice calls and text messages';
                          } else {
                            return provider === 'telnyx'
                              ? 'Local numbers are widely available and support voice calls'
                              : 'Local numbers support voice calls only (no text messages)';
                          }
                        })()}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Area Code (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 020, 212, 415"
                        value={areaCode}
                        onChange={(e) => setAreaCode(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                        style={{ '--tw-ring-color': `${primaryColor}40` } as React.CSSProperties}
                      />
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FiAlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-amber-800">
                          <p className="font-medium mb-2">Important Notice:</p>
                          <ul className="space-y-1 text-xs">
                            <li>• Numbers are for <strong>inbound calls only</strong></li>
                            <li>• For outbound calling, use "Import Numbers" with verified business numbers</li>
                            <li>• Numbers will be configured automatically for your voice agents</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleClose}
                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSearch}
                        disabled={!selectedCountry}
                        className="flex-1 px-4 py-3 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Search Numbers
                      </button>
                    </div>
                  </div>
                )}

                {step === 'searching' && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-6">
                    <div
                      className="p-4 rounded-full animate-pulse"
                      style={{ backgroundColor: `${primaryColor}20` }}
                    >
                      <FiLoader
                        className="h-8 w-8 animate-spin"
                        style={{ color: primaryColor }}
                      />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="font-semibold text-gray-900">Searching for available numbers...</p>
                      <p className="text-sm text-gray-600">
                        Finding the best available number for your business...
                      </p>
                    </div>
                  </div>
                )}

                {step === 'confirm' && availableNumber && (
                  <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {availableNumber.phoneNumber}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {availableNumber.friendlyName}
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getSourceInfo(availableNumber.source).color}`}>
                          <div className="flex items-center gap-1">
                            {React.createElement(getSourceInfo(availableNumber.source).icon, { className: "h-3 w-3" })}
                            {getSourceInfo(availableNumber.source).label}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-700">Capabilities:</span>
                          <div className="flex gap-2 flex-wrap mt-2">
                            {availableNumber.capabilities.voice && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                Voice
                              </span>
                            )}
                            {availableNumber.capabilities.sms && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                                SMS
                              </span>
                            )}
                            {availableNumber.capabilities.mms && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                                MMS
                              </span>
                            )}
                            {availableNumber.capabilities.fax && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                                Fax
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          className="rounded-lg p-4 border"
                          style={{
                            backgroundColor: `${primaryColor}10`,
                            borderColor: `${primaryColor}30`
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <FiCheckCircle
                              className="h-5 w-5 mt-0.5 flex-shrink-0"
                              style={{ color: primaryColor }}
                            />
                            <p className="text-sm" style={{ color: primaryColor }}>
                              {availableNumber.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setStep('country')}
                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        className="flex-1 px-4 py-3 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {isConfirming ? (
                          <>
                            <FiLoader className="h-4 w-4 animate-spin" />
                            Assigning...
                          </>
                        ) : (
                          'Confirm Assignment'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
