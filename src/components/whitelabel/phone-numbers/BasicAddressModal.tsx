'use client';

import { useState } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';

interface BasicAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddressComplete?: () => void;
  phoneNumber: string;
  countryCode: string;
  numberType: string;
  customerId?: string;
}

interface AddressData {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export default function BasicAddressModal({
  isOpen,
  onClose,
  onAddressComplete,
  phoneNumber,
  countryCode,
  numberType,
  customerId
}: BasicAddressModalProps) {
  const [addressData, setAddressData] = useState<AddressData>({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: countryCode
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/whitelabel/phone-numbers/basic-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          numberType,
          countryCode,
          customerId,
          address: addressData
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Address saved successfully!');
        onAddressComplete?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to save address');
      }
    } catch (error) {
      console.error('Address submission error:', error);
      toast.error('Failed to save address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof AddressData, value: string) => {
    setAddressData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Address Required</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-6">
            This phone number requires a basic address for purchase. This is simpler than full business verification.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              <input
                id="street"
                type="text"
                value={addressData.street}
                onChange={(e) => handleInputChange('street', e.target.value)}
                placeholder="123 Main Street"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  value={addressData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="London"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                  State/Region
                </label>
                <input
                  id="state"
                  type="text"
                  value={addressData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  placeholder={countryCode === 'GB' ? 'England' : 'State'}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Postal Code
                </label>
                <input
                  id="postalCode"
                  type="text"
                  value={addressData.postalCode}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  placeholder={countryCode === 'GB' ? 'SW1A 1AA' : '12345'}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                />
              </div>
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <input
                  id="country"
                  type="text"
                  value={countryCode}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Address'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
