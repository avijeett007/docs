'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Phone, Loader2, Check, MapPin, DollarSign } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import PurchaseConsentModal from './PurchaseConsentModal';
import BusinessVerificationModal from './BusinessVerificationModal';

interface PhoneNumberSearchProps {
  onPurchaseComplete: () => void;
  customerId?: string; // Optional - for partner portal usage
}

interface AvailablePhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  monthlyPrice: number;
  setupFee: number;
  currency?: string;
  pricingNote?: string;
  addressRequirements: string;
}

export function PhoneNumberSearch({ onPurchaseComplete, customerId }: PhoneNumberSearchProps) {
  const { branding } = usePartnerBranding();
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [searchResults, setSearchResults] = useState<AvailablePhoneNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<AvailablePhoneNumber | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  
  // Search parameters
  const [countryCode, setCountryCode] = useState('US');
  const [phoneType, setPhoneType] = useState<'local' | 'mobile' | 'tollfree'>('local');

  // Get available number types for selected country
  const getAvailableTypesForCountry = (country: string) => {
    const countryConfig: Record<string, string[]> = {
      // North America
      'US': ['local', 'tollfree'],
      'CA': ['local', 'tollfree'],

      // Europe - Major markets with Mobile support
      'GB': ['local', 'mobile', 'tollfree'],
      'AU': ['local', 'mobile', 'tollfree'],
      'NL': ['local', 'mobile'],
      'SE': ['local', 'mobile'],
      'NO': ['local', 'mobile'],
      'DK': ['local', 'mobile'],
      'FI': ['local', 'mobile'],
      'BE': ['local', 'mobile'],
      'CH': ['local', 'mobile'],
      'AT': ['local', 'mobile'],
      'IE': ['local', 'mobile'],

      // Europe - Local only markets
      'DE': ['local'],
      'FR': ['local'],
      'ES': ['local'],
      'IT': ['local'],
      'PL': ['local'],
      'CZ': ['local'],
      'HU': ['local'],
      'PT': ['local'],
      'GR': ['local'],

      // Americas
      'MX': ['local'],
      'BR': ['local'],
      'AR': ['local'],
      'CL': ['local'],
      'CO': ['local'],
      'PE': ['local'],

      // Middle East & Africa
      'AE': ['local'],
      'SA': ['local'],
      'IL': ['local'],
      'ZA': ['local'],

      // Asia Pacific
      'SG': ['local'],
      'HK': ['local'],
      'JP': ['local'],
      'KR': ['local'],
      'IN': ['local'],
      'NZ': ['local'],
    };

    return countryConfig[country] || ['local'];
  };

  const availableTypes = getAvailableTypesForCountry(countryCode);

  // Auto-adjust phone type when country changes
  const handleCountryChange = (newCountry: string) => {
    setCountryCode(newCountry);
    const availableForCountry = getAvailableTypesForCountry(newCountry);
    if (!availableForCountry.includes(phoneType)) {
      setPhoneType(availableForCountry[0] as 'local' | 'mobile' | 'tollfree');
    }
  };
  const [areaCode, setAreaCode] = useState('');
  const [contains, setContains] = useState('');
  const [capabilities, setCapabilities] = useState({
    voice: true,
    sms: true,
    mms: false,
    fax: false,
  });

  const handleSearch = async () => {
    setSearching(true);
    setSearchResults([]);
    setSelectedNumber(null);

    try {
      // Use different API endpoint based on whether customerId is provided (partner portal vs customer portal)
      const apiEndpoint = customerId
        ? `/api/partner/customers/${customerId}/phone-numbers/search`
        : '/api/phone-numbers/search';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header for partner portal
      if (customerId) {
        const token = localStorage.getItem('partner_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      // Prepare request body - different field names for different APIs
      const requestBody = customerId
        ? {
            // Partner API uses phoneType
            countryCode,
            phoneType: phoneType,
            areaCode: areaCode || undefined,
            contains: contains || undefined,
            voiceEnabled: capabilities.voice,
            smsEnabled: capabilities.sms,
            mmsEnabled: capabilities.mms,
            faxEnabled: capabilities.fax,
            limit: 20,
          }
        : {
            // Whitelabel API uses type
            countryCode,
            type: phoneType,
            areaCode: areaCode || undefined,
            contains: contains || undefined,
            voiceEnabled: capabilities.voice,
            smsEnabled: capabilities.sms,
            mmsEnabled: capabilities.mms,
            faxEnabled: capabilities.fax,
            limit: 20,
          };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // Throw the response object so we can parse it in the catch block
        throw response;
      }

      const data = await response.json();
      setSearchResults(data.data.numbers);
      
      if (data.data.numbers.length === 0) {
        toast.info('No phone numbers found. Try different search criteria.');
      }
    } catch (error) {
      console.error('Search error:', error);

      // Handle fetch errors
      if (error instanceof Response) {
        try {
          const errorData = await error.json();

          // Handle structured error responses with user-friendly messages
          if (errorData.message) {
            // Use the user-friendly message from the API
            const duration = errorData.isKnownIssue ? 8000 : 6000;

            // Different toast types based on error severity
            if (errorData.error === 'Country not supported' ||
                errorData.error === 'Number type not supported') {
              toast.warning(errorData.message, { duration });
            } else if (errorData.error === 'Service temporarily unavailable' ||
                      errorData.error === 'Pricing unavailable' ||
                      errorData.error === 'US Local Number Issue') {
              toast.error(errorData.message, { duration });
            } else if (errorData.error === 'Rate limit exceeded') {
              toast.warning(errorData.message, { duration: 5000 });
            } else if (errorData.error === 'Request timeout') {
              toast.error(errorData.message, { duration: 4000 });
            } else {
              toast.error(errorData.message, { duration });
            }
            return;
          }

          // Fallback for legacy error format
          const errorMessage = errorData.details || errorData.error || 'Failed to search phone numbers';
          toast.error(errorMessage);

        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          toast.error('Something went wrong while searching for phone numbers. Please try again later.');
        }
      } else {
        // Handle network errors or other exceptions
        const errorMessage = error instanceof Error ? error.message : 'Network error occurred';

        if (errorMessage.includes('fetch')) {
          toast.error('Unable to connect to our servers. Please check your internet connection and try again.');
        } else {
          toast.error('Something went wrong while searching for phone numbers. Please try again later.');
        }
      }
    } finally {
      setSearching(false);
    }
  };

  const handlePurchaseClick = async () => {
    if (!selectedNumber) {
      toast.error('Please select a phone number first');
      return;
    }

    // Simplified approach: Just proceed to purchase consent
    // Let the purchase API handle all address/bundle requirements dynamically
    // This eliminates the need for BasicAddressModal - use only BusinessVerificationModal for all requirements

    setShowConsentModal(true);
  };

  const handlePurchaseConfirm = async () => {
    if (!selectedNumber) return;

    setPurchasing(true);
    try {
      // Use different API endpoint based on whether customerId is provided (partner portal vs customer portal)
      const apiEndpoint = customerId
        ? `/api/partner/customers/${customerId}/phone-numbers/purchase`
        : '/api/phone-numbers/purchase';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header for partner portal
      if (customerId) {
        const token = localStorage.getItem('partner_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phoneNumber: selectedNumber.phoneNumber,
          friendlyName: selectedNumber.friendlyName,
          type: phoneType.toLowerCase(), // Ensure lowercase for schema validation
          countryCode: countryCode,
          monthlyPrice: selectedNumber.monthlyPrice,
          setupFee: selectedNumber.setupFee,
          capabilities: {
            voice: selectedNumber.capabilities.voice,
            SMS: selectedNumber.capabilities.sms,
            MMS: selectedNumber.capabilities.mms,
            fax: selectedNumber.capabilities.fax,
          },
          consentGiven: true,
          consentIpAddress: '', // Could be populated from client IP
          // Note: customerId is now in the URL path for partner API, not in body
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Phone number purchased successfully!');
        setShowConsentModal(false);

        // Only show verification modal if address verification is required
        if (result.data?.requiresAddressVerification || result.data?.requires10DLC) {
          const message = result.data?.requires10DLC
            ? 'For outbound calling, please complete 10DLC verification in your phone number settings.'
            : 'Please complete address verification to enable outbound calling.';

          toast.info(message, { duration: 5000 });
          setShowVerificationModal(true);
        }

        onPurchaseComplete();
      } else {
        if (result.error === 'Insufficient credits') {
          toast.error(result.message || 'Unable to complete purchase. Please contact support for assistance.');
        } else if (result.error === 'Bundle required' || result.requiresBundle) {
          // Handle bundle requirement error - check if it's due to Twilio account limitations
          if (result.message?.includes('Bundle required and not provided')) {
            // This means Twilio account doesn't support regulatory bundles
            toast.error('This phone number requires business verification that is not available for your account. Please contact support or try a different number.', { duration: 8000 });
            setShowConsentModal(false);
          } else {
            // Bundle required dynamically - show business verification modal
            setShowConsentModal(false);
            setShowVerificationModal(true);
            toast.info('Business address verification is required for this phone number type. Please complete verification first.');
          }
        } else if (result.error === 'Address required' || result.requiresBasicAddress ||
                   (result.details && result.details.includes('Phone Number Requires an Address'))) {
          // Address required - show business verification modal (full address + docs)
          setShowConsentModal(false);
          setShowVerificationModal(true);
          toast.info('Business address verification is required for this phone number type.');
        } else {
          // Handle detailed error messages from improved API
          const errorMessage = result.details
            ? `${result.error}: ${result.details}`
            : result.error || 'Failed to purchase phone number';

          toast.error(errorMessage, { duration: 6000 });
        }
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Failed to purchase phone number');
    } finally {
      setPurchasing(false);
    }
  };

  const formatCapabilities = (caps: any) => {
    const capabilities = [];
    if (caps.voice) capabilities.push('Voice');
    if (caps.SMS) capabilities.push('SMS');
    if (caps.MMS) capabilities.push('MMS');
    if (caps.fax) capabilities.push('Fax');
    return capabilities;
  };

  return (
    <>
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle style={{ color: branding.primaryColor }}>Search Available Phone Numbers</CardTitle>
          <CardDescription className="text-gray-300">
            Find and purchase phone numbers for your voice agents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
            <Label htmlFor="country" className="text-gray-200">Country</Label>
            <Select value={countryCode} onValueChange={handleCountryChange}>
              <SelectTrigger
                id="country"
                className="bg-gray-800 border-gray-600 text-white hover:border-gray-500 focus:border-primary"
                style={{ borderColor: `${branding.primaryColor}40` }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600 max-h-60 overflow-y-auto">
                <SelectItem value="US" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇺🇸 United States</SelectItem>
                <SelectItem value="CA" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇨🇦 Canada</SelectItem>
                <SelectItem value="GB" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇬🇧 United Kingdom</SelectItem>
                <SelectItem value="AU" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇦🇺 Australia</SelectItem>
                <SelectItem value="DE" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇩🇪 Germany</SelectItem>
                <SelectItem value="FR" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇫🇷 France</SelectItem>
                <SelectItem value="ES" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇪🇸 Spain</SelectItem>
                <SelectItem value="IT" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇮🇹 Italy</SelectItem>
                <SelectItem value="NL" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇳🇱 Netherlands</SelectItem>
                <SelectItem value="SE" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇸🇪 Sweden</SelectItem>
                <SelectItem value="NO" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇳🇴 Norway</SelectItem>
                <SelectItem value="DK" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇩🇰 Denmark</SelectItem>
                <SelectItem value="FI" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇫🇮 Finland</SelectItem>
                <SelectItem value="BE" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇧🇪 Belgium</SelectItem>
                <SelectItem value="CH" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇨🇭 Switzerland</SelectItem>
                <SelectItem value="AT" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇦🇹 Austria</SelectItem>
                <SelectItem value="IE" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇮🇪 Ireland</SelectItem>
                <SelectItem value="PL" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇵🇱 Poland</SelectItem>
                <SelectItem value="CZ" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇨🇿 Czech Republic</SelectItem>
                <SelectItem value="HU" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇭🇺 Hungary</SelectItem>
                <SelectItem value="PT" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇵🇹 Portugal</SelectItem>
                <SelectItem value="GR" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇬🇷 Greece</SelectItem>
                <SelectItem value="MX" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇲🇽 Mexico</SelectItem>
                <SelectItem value="BR" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇧🇷 Brazil</SelectItem>
                <SelectItem value="AR" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇦🇷 Argentina</SelectItem>
                <SelectItem value="CL" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇨🇱 Chile</SelectItem>
                <SelectItem value="CO" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇨🇴 Colombia</SelectItem>
                <SelectItem value="PE" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇵🇪 Peru</SelectItem>
                <SelectItem value="AE" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇦🇪 United Arab Emirates</SelectItem>
                <SelectItem value="SA" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇸🇦 Saudi Arabia</SelectItem>
                <SelectItem value="IL" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇮🇱 Israel</SelectItem>
                <SelectItem value="SG" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇸🇬 Singapore</SelectItem>
                <SelectItem value="HK" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇭🇰 Hong Kong</SelectItem>
                <SelectItem value="JP" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇯🇵 Japan</SelectItem>
                <SelectItem value="KR" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇰🇷 South Korea</SelectItem>
                <SelectItem value="IN" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇮🇳 India</SelectItem>
                <SelectItem value="ZA" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇿🇦 South Africa</SelectItem>
                <SelectItem value="NZ" className="text-white hover:bg-gray-700 focus:bg-gray-700">🇳🇿 New Zealand</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="type" className="text-gray-200">Number Type</Label>
            <Select value={phoneType} onValueChange={(value: any) => setPhoneType(value)}>
              <SelectTrigger
                id="type"
                className="bg-gray-800 border-gray-600 text-white hover:border-gray-500 focus:border-primary"
                style={{ borderColor: `${branding.primaryColor}40` }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {availableTypes.includes('local') && (
                  <SelectItem value="local" className="text-white hover:bg-gray-700 focus:bg-gray-700">Local</SelectItem>
                )}
                {availableTypes.includes('mobile') && (
                  <SelectItem value="mobile" className="text-white hover:bg-gray-700 focus:bg-gray-700">Mobile</SelectItem>
                )}
                {availableTypes.includes('tollfree') && (
                  <SelectItem value="tollfree" className="text-white hover:bg-gray-700 focus:bg-gray-700">Toll-Free</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="areaCode" className="text-gray-200">Area Code (Optional)</Label>
            <Input
              id="areaCode"
              placeholder="e.g., 415"
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value)}
              disabled={phoneType === 'tollfree'}
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 hover:border-gray-500 focus:border-primary"
              style={{ borderColor: `${branding.primaryColor}40` }}
            />
          </div>

          <div>
            <Label htmlFor="contains" className="text-gray-200">Contains (Optional)</Label>
            <Input
              id="contains"
              placeholder="e.g., 555"
              value={contains}
              onChange={(e) => setContains(e.target.value)}
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 hover:border-gray-500 focus:border-primary"
              style={{ borderColor: `${branding.primaryColor}40` }}
            />
          </div>
        </div>

        {/* Capabilities */}
        <div>
          <Label className="text-gray-200">Required Capabilities</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="voice"
                checked={capabilities.voice}
                onCheckedChange={(checked) =>
                  setCapabilities(prev => ({ ...prev, voice: checked as boolean }))
                }
                className="border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="voice" className="text-sm font-normal text-gray-200">Voice</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sms"
                checked={capabilities.sms}
                onCheckedChange={(checked) =>
                  setCapabilities(prev => ({ ...prev, sms: checked as boolean }))
                }
                className="border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="sms" className="text-sm font-normal text-gray-200">SMS</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mms"
                checked={capabilities.mms}
                onCheckedChange={(checked) =>
                  setCapabilities(prev => ({ ...prev, mms: checked as boolean }))
                }
                className="border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="mms" className="text-sm font-normal text-gray-200">MMS</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fax"
                checked={capabilities.fax}
                onCheckedChange={(checked) =>
                  setCapabilities(prev => ({ ...prev, fax: checked as boolean }))
                }
                className="border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="fax" className="text-sm font-normal text-gray-200">Fax</Label>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSearch}
          disabled={searching}
          className="w-full md:w-auto text-white transition-all hover:opacity-90"
          style={{
            background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor || branding.primaryColor})`,
            boxShadow: `0 4px 12px ${branding.primaryColor}30`
          }}
        >
          {searching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Search Numbers
            </>
          )}
        </Button>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Available Numbers</h3>
              <div className="text-xs text-gray-400">
                Prices shown in USD (GBP converted at 1.40)
              </div>
            </div>
            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {searchResults.map((number) => (
                <div
                  key={number.phoneNumber}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedNumber?.phoneNumber === number.phoneNumber
                      ? `bg-gray-800 text-white`
                      : 'border-gray-600 bg-gray-800 hover:border-gray-500 text-white'
                  }`}
                  style={{
                    borderColor: selectedNumber?.phoneNumber === number.phoneNumber
                      ? branding.primaryColor
                      : 'rgb(75 85 99)'
                  }}
                  onClick={() => setSelectedNumber(number)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedNumber?.phoneNumber === number.phoneNumber && (
                        <Check className="h-5 w-5" style={{ color: branding.primaryColor }} />
                      )}
                      <Phone className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-white">{number.phoneNumber}</div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          {number.locality && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {number.locality}, {number.region}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {number.monthlyPrice > 0 ? (
                        <>
                          <div className="flex items-center gap-1 font-medium text-white">
                            <DollarSign className="h-3 w-3" />
                            {(number.monthlyPrice / 100).toFixed(2)} {(number.currency || 'USD').toUpperCase()}/mo
                          </div>
                          {number.setupFee > 0 && (
                            <div className="text-xs text-gray-400">
                              + {(number.setupFee / 100).toFixed(2)} {(number.currency || 'USD').toUpperCase()} setup
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-amber-400">
                          Contact Support
                        </div>
                      )}
                      {number.pricingNote && (
                        <div className="text-xs text-blue-400 mt-1 max-w-40 text-right leading-tight">
                          {number.pricingNote}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {formatCapabilities(number.capabilities).map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-xs">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedNumber && (
              <Button
                onClick={handlePurchaseClick}
                disabled={purchasing}
                className="w-full text-white transition-all hover:opacity-90"
                style={{
                  background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor || branding.primaryColor})`,
                  boxShadow: `0 4px 12px ${branding.primaryColor}30`
                }}
              >
                {purchasing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Purchasing...
                  </>
                ) : (
                  <>
                    Purchase {selectedNumber.phoneNumber} for {(selectedNumber.monthlyPrice / 100).toFixed(2)} {(selectedNumber.currency || 'USD').toUpperCase()}/mo
                  </>
                )}
              </Button>
            )}

            {/* Exchange Rate Disclaimer */}
            <div className="text-xs text-gray-500 text-center mt-3 px-4">
              * Prices converted from GBP to USD at 1.40 rate. Exchange rates may vary. Final billing will be in your Twilio account's configured currency.
            </div>
          </div>
        )}
        </CardContent>
      </Card>

      {/* Purchase Consent Modal */}
      {selectedNumber && (
        <PurchaseConsentModal
          isOpen={showConsentModal}
          onClose={() => setShowConsentModal(false)}
          onConfirm={handlePurchaseConfirm}
          phoneNumber={selectedNumber.phoneNumber}
          monthlyPrice={selectedNumber.monthlyPrice}
          setupFee={selectedNumber.setupFee}
          currency={selectedNumber.currency}
          countryCode={countryCode}
          numberType={phoneType}
          loading={purchasing}
        />
      )}

      {/* Business Verification Modal */}
      {selectedNumber && (
        <BusinessVerificationModal
          isOpen={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          onVerificationComplete={() => {
            // Bundle created successfully - proceed to purchase consent
            setShowVerificationModal(false);
            setShowConsentModal(true);
            toast.success('Business verification completed! You can now proceed with the purchase.');
          }}
          phoneNumber={selectedNumber.phoneNumber}
          countryCode={countryCode}
          numberType={phoneType}
          customerId={customerId}
        />
      )}


    </>
  );
}