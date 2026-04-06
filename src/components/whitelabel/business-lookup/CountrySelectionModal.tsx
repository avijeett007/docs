'use client';

import React from 'react';
import { X } from 'lucide-react';

interface Country {
  code: string;
  name: string;
  flag: string;
}

interface CountrySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCountry: string;
  onCountrySelect: (countryCode: string) => void;
}

const POPULAR_COUNTRIES: Country[] = [
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
];

export default function CountrySelectionModal({
  isOpen,
  onClose,
  currentCountry,
  onCountrySelect,
}: CountrySelectionModalProps) {
  if (!isOpen) return null;

  const handleCountrySelect = (countryCode: string) => {
    onCountrySelect(countryCode);
    onClose();
  };

  const currentCountryData = POPULAR_COUNTRIES.find(c => c.code === currentCountry);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Select Your Country
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Selection */}
        {currentCountryData && (
          <div className="p-4 bg-blue-50 border-b border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Currently searching in:</p>
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{currentCountryData.flag}</span>
              <span className="font-medium text-gray-900">{currentCountryData.name}</span>
            </div>
          </div>
        )}

        {/* Country List */}
        <div className="max-h-96 overflow-y-auto">
          <div className="p-2">
            {POPULAR_COUNTRIES.map((country) => (
              <button
                key={country.code}
                onClick={() => handleCountrySelect(country.code)}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors ${
                  country.code === currentCountry 
                    ? 'bg-blue-50 border border-blue-200' 
                    : ''
                }`}
              >
                <span className="text-2xl">{country.flag}</span>
                <span className="text-left font-medium text-gray-900">
                  {country.name}
                </span>
                {country.code === currentCountry && (
                  <span className="ml-auto text-blue-600 text-sm">✓ Current</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            This helps us find businesses in your area more accurately
          </p>
        </div>
      </div>
    </div>
  );
}
