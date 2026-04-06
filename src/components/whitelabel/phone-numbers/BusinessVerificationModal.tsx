'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Upload, FileText, MapPin, Building, Phone, AlertCircle, Info } from 'lucide-react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { toast } from 'sonner';

interface BusinessVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerificationComplete?: () => void; // Optional callback for completion
  phoneNumber: string;
  countryCode: string;
  numberType: string;
  customerId?: string; // Optional - for partner portal usage
}

interface BusinessAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Country-specific state/region data
const COUNTRY_REGIONS: Record<string, { label: string; options: Array<{ value: string; label: string }> }> = {
  US: {
    label: 'State',
    options: [
      { value: 'AL', label: 'Alabama' },
      { value: 'AK', label: 'Alaska' },
      { value: 'AZ', label: 'Arizona' },
      { value: 'AR', label: 'Arkansas' },
      { value: 'CA', label: 'California' },
      { value: 'CO', label: 'Colorado' },
      { value: 'CT', label: 'Connecticut' },
      { value: 'DE', label: 'Delaware' },
      { value: 'FL', label: 'Florida' },
      { value: 'GA', label: 'Georgia' },
      { value: 'HI', label: 'Hawaii' },
      { value: 'ID', label: 'Idaho' },
      { value: 'IL', label: 'Illinois' },
      { value: 'IN', label: 'Indiana' },
      { value: 'IA', label: 'Iowa' },
      { value: 'KS', label: 'Kansas' },
      { value: 'KY', label: 'Kentucky' },
      { value: 'LA', label: 'Louisiana' },
      { value: 'ME', label: 'Maine' },
      { value: 'MD', label: 'Maryland' },
      { value: 'MA', label: 'Massachusetts' },
      { value: 'MI', label: 'Michigan' },
      { value: 'MN', label: 'Minnesota' },
      { value: 'MS', label: 'Mississippi' },
      { value: 'MO', label: 'Missouri' },
      { value: 'MT', label: 'Montana' },
      { value: 'NE', label: 'Nebraska' },
      { value: 'NV', label: 'Nevada' },
      { value: 'NH', label: 'New Hampshire' },
      { value: 'NJ', label: 'New Jersey' },
      { value: 'NM', label: 'New Mexico' },
      { value: 'NY', label: 'New York' },
      { value: 'NC', label: 'North Carolina' },
      { value: 'ND', label: 'North Dakota' },
      { value: 'OH', label: 'Ohio' },
      { value: 'OK', label: 'Oklahoma' },
      { value: 'OR', label: 'Oregon' },
      { value: 'PA', label: 'Pennsylvania' },
      { value: 'RI', label: 'Rhode Island' },
      { value: 'SC', label: 'South Carolina' },
      { value: 'SD', label: 'South Dakota' },
      { value: 'TN', label: 'Tennessee' },
      { value: 'TX', label: 'Texas' },
      { value: 'UT', label: 'Utah' },
      { value: 'VT', label: 'Vermont' },
      { value: 'VA', label: 'Virginia' },
      { value: 'WA', label: 'Washington' },
      { value: 'WV', label: 'West Virginia' },
      { value: 'WI', label: 'Wisconsin' },
      { value: 'WY', label: 'Wyoming' },
    ]
  },
  GB: {
    label: 'County/Region',
    options: [
      { value: 'England', label: 'England' },
      { value: 'Scotland', label: 'Scotland' },
      { value: 'Wales', label: 'Wales' },
      { value: 'Northern Ireland', label: 'Northern Ireland' },
      { value: 'Greater London', label: 'Greater London' },
      { value: 'West Midlands', label: 'West Midlands' },
      { value: 'Greater Manchester', label: 'Greater Manchester' },
      { value: 'West Yorkshire', label: 'West Yorkshire' },
      { value: 'South Yorkshire', label: 'South Yorkshire' },
      { value: 'Merseyside', label: 'Merseyside' },
      { value: 'Tyne and Wear', label: 'Tyne and Wear' },
    ]
  },
  CA: {
    label: 'Province/Territory',
    options: [
      { value: 'AB', label: 'Alberta' },
      { value: 'BC', label: 'British Columbia' },
      { value: 'MB', label: 'Manitoba' },
      { value: 'NB', label: 'New Brunswick' },
      { value: 'NL', label: 'Newfoundland and Labrador' },
      { value: 'NS', label: 'Nova Scotia' },
      { value: 'ON', label: 'Ontario' },
      { value: 'PE', label: 'Prince Edward Island' },
      { value: 'QC', label: 'Quebec' },
      { value: 'SK', label: 'Saskatchewan' },
      { value: 'NT', label: 'Northwest Territories' },
      { value: 'NU', label: 'Nunavut' },
      { value: 'YT', label: 'Yukon' },
    ]
  },
  AU: {
    label: 'State/Territory',
    options: [
      { value: 'NSW', label: 'New South Wales' },
      { value: 'VIC', label: 'Victoria' },
      { value: 'QLD', label: 'Queensland' },
      { value: 'WA', label: 'Western Australia' },
      { value: 'SA', label: 'South Australia' },
      { value: 'TAS', label: 'Tasmania' },
      { value: 'ACT', label: 'Australian Capital Territory' },
      { value: 'NT', label: 'Northern Territory' },
    ]
  },
  DE: {
    label: 'State (Bundesland)',
    options: [
      { value: 'BW', label: 'Baden-Württemberg' },
      { value: 'BY', label: 'Bavaria (Bayern)' },
      { value: 'BE', label: 'Berlin' },
      { value: 'BB', label: 'Brandenburg' },
      { value: 'HB', label: 'Bremen' },
      { value: 'HH', label: 'Hamburg' },
      { value: 'HE', label: 'Hesse (Hessen)' },
      { value: 'MV', label: 'Mecklenburg-Vorpommern' },
      { value: 'NI', label: 'Lower Saxony (Niedersachsen)' },
      { value: 'NW', label: 'North Rhine-Westphalia' },
      { value: 'RP', label: 'Rhineland-Palatinate' },
      { value: 'SL', label: 'Saarland' },
      { value: 'SN', label: 'Saxony (Sachsen)' },
      { value: 'ST', label: 'Saxony-Anhalt' },
      { value: 'SH', label: 'Schleswig-Holstein' },
      { value: 'TH', label: 'Thuringia (Thüringen)' },
    ]
  },
  // For countries without specific regions, use a generic "Region" field
  DEFAULT: {
    label: 'State/Region',
    options: []
  }
};

// Get country flag emoji
const getCountryFlag = (countryCode: string): string => {
  const flags: Record<string, string> = {
    US: '🇺🇸',
    GB: '🇬🇧',
    CA: '🇨🇦',
    AU: '🇦🇺',
    DE: '🇩🇪',
    FR: '🇫🇷',
    ES: '🇪🇸',
    IT: '🇮🇹',
    NL: '🇳🇱',
    SE: '🇸🇪',
    NO: '🇳🇴',
    DK: '🇩🇰',
    FI: '🇫🇮',
    BE: '🇧🇪',
    CH: '🇨🇭',
    AT: '🇦🇹',
    IE: '🇮🇪',
    PL: '🇵🇱',
    CZ: '🇨🇿',
    HU: '🇭🇺',
    PT: '🇵🇹',
    GR: '🇬🇷',
  };
  return flags[countryCode] || '🌍';
};

// Get country name
const getCountryName = (countryCode: string): string => {
  const names: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    CA: 'Canada',
    AU: 'Australia',
    DE: 'Germany',
    FR: 'France',
    ES: 'Spain',
    IT: 'Italy',
    NL: 'Netherlands',
    SE: 'Sweden',
    NO: 'Norway',
    DK: 'Denmark',
    FI: 'Finland',
    BE: 'Belgium',
    CH: 'Switzerland',
    AT: 'Austria',
    IE: 'Ireland',
    PL: 'Poland',
    CZ: 'Czech Republic',
    HU: 'Hungary',
    PT: 'Portugal',
    GR: 'Greece',
  };
  return names[countryCode] || countryCode;
};

export default function BusinessVerificationModal({
  isOpen,
  onClose,
  onVerificationComplete,
  phoneNumber,
  countryCode,
  numberType,
  customerId
}: BusinessVerificationModalProps) {
  const [businessAddress, setBusinessAddress] = useState<BusinessAddress>({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: countryCode
  });
  
  const [emergencyAddress, setEmergencyAddress] = useState<BusinessAddress>({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: countryCode
  });

  const [sameAsBusinessAddress, setSameAsBusinessAddress] = useState(true);
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const { branding } = usePartnerBranding();

  // Get region configuration for the selected country
  const regionConfig = COUNTRY_REGIONS[countryCode] || COUNTRY_REGIONS.DEFAULT;
  const hasRegionOptions = regionConfig.options.length > 0;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setDocuments(prev => [...prev, ...files]);
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Use different API endpoint based on whether customerId is provided (partner portal vs customer portal)
      const apiEndpoint = customerId
        ? `/api/partner/customers/${customerId}/phone-numbers/bundle`
        : '/api/phone-numbers/bundle';

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
          businessAddress,
          emergencyAddress: sameAsBusinessAddress ? businessAddress : emergencyAddress,
          phoneNumber,
          numberType,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Business verification submitted successfully! You will be notified when approved.');
        onVerificationComplete?.();
        onClose();
      } else if (result.skipVerification) {
        // Regulatory compliance not required for this number
        toast.success('No business verification required for this number. You can proceed with the purchase!');
        onVerificationComplete?.();
        onClose();
      } else {
        // Show more detailed error messages
        if (result.error?.includes('not available for your account')) {
          toast.error('Business verification is not available for your account type. Please contact support for assistance.', {
            duration: 8000
          });
        } else if (result.error?.includes('Invalid address')) {
          toast.error('Please check your address information and ensure all fields are correctly filled.', {
            duration: 6000
          });
        } else {
          toast.error(result.error || 'Failed to submit business verification. Please try again.');
        }

        // Show additional details if available
        if (result.details) {
          setTimeout(() => {
            toast.info(result.details, { duration: 6000 });
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Failed to submit verification:', error);
      toast.error('Unable to connect to verification service. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = businessAddress.street && businessAddress.city && 
                     businessAddress.state && businessAddress.postalCode && 
                     documents.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2" style={{ color: branding?.primaryColor || '#3b82f6' }}>
            <Building className="h-5 w-5" />
            Business Verification Required
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Improved Header Info */}
          <div className="p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-200 mb-2">Why is this required?</h3>
                <p className="text-sm text-blue-100 mb-3">
                  To comply with telecommunications regulations, we need to verify your business address
                  before you can purchase phone numbers. This is a one-time process that typically takes 1-2 business days.
                </p>
                <div className="text-xs text-blue-200">
                  <strong>What happens next:</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Submit your business address and documents</li>
                    <li>Our compliance team reviews your information</li>
                    <li>You'll receive an email when approved (usually within 24 hours)</li>
                    <li>Purchase phone numbers immediately after approval</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Configure Numbers Section */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Configure Numbers</CardTitle>
              <Button variant="link" className="text-blue-400 hover:text-blue-300 p-0">
                Change
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-300">Selected Country</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl">{getCountryFlag(countryCode)}</span>
                    <span className="text-white">{getCountryName(countryCode)} ({countryCode})</span>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-300">Number Type</Label>
                  <div className="mt-1">
                    <Badge variant="secondary" className="bg-gray-700 text-white capitalize">
                      {numberType}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-gray-300">Numbers Chosen</Label>
                <div className="mt-1 p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="font-mono text-white">{phoneNumber}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Address Section */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <MapPin className="h-5 w-5" />
                Select Bundles and Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Business Address */}
                <div className="space-y-4">
                  <div className="p-4 border border-gray-600 rounded-lg">
                    <h4 className="font-medium text-white mb-3">Business Address</h4>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-gray-300">Street Address</Label>
                        <Input
                          value={businessAddress.street}
                          onChange={(e) => setBusinessAddress(prev => ({ ...prev, street: e.target.value }))}
                          className="bg-gray-700 border-gray-600 text-white"
                          placeholder={
                            countryCode === 'GB' ? '123 High Street' :
                            countryCode === 'CA' ? '123 Main Street' :
                            countryCode === 'DE' ? 'Hauptstraße 123' :
                            countryCode === 'AU' ? '123 Collins Street' :
                            '123 Business Street'
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-gray-300">City</Label>
                          <Input
                            value={businessAddress.city}
                            onChange={(e) => setBusinessAddress(prev => ({ ...prev, city: e.target.value }))}
                            className="bg-gray-700 border-gray-600 text-white"
                            placeholder={
                              countryCode === 'GB' ? 'London' :
                              countryCode === 'CA' ? 'Toronto' :
                              countryCode === 'DE' ? 'Berlin' :
                              countryCode === 'AU' ? 'Sydney' :
                              'City name'
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-gray-300">{regionConfig.label}</Label>
                          {hasRegionOptions ? (
                            <Select
                              value={businessAddress.state}
                              onValueChange={(value) => setBusinessAddress(prev => ({ ...prev, state: value }))}
                            >
                              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                                <SelectValue placeholder={`Select ${regionConfig.label.toLowerCase()}`} />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-700 border-gray-600 max-h-60 overflow-y-auto">
                                {regionConfig.options.map((option) => (
                                  <SelectItem key={option.value} value={option.value} className="text-white">
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={businessAddress.state}
                              onChange={(e) => setBusinessAddress(prev => ({ ...prev, state: e.target.value }))}
                              className="bg-gray-700 border-gray-600 text-white"
                              placeholder={`Enter ${regionConfig.label.toLowerCase()}`}
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-300">
                          {countryCode === 'GB' ? 'Postcode' :
                           countryCode === 'CA' ? 'Postal Code' :
                           'Postal/ZIP Code'}
                        </Label>
                        <Input
                          value={businessAddress.postalCode}
                          onChange={(e) => setBusinessAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                          className="bg-gray-700 border-gray-600 text-white"
                          placeholder={
                            countryCode === 'GB' ? 'SW1A 1AA' :
                            countryCode === 'CA' ? 'K1A 0A6' :
                            countryCode === 'DE' ? '10115' :
                            countryCode === 'AU' ? '2000' :
                            '94105'
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Regulatory Info */}
                <div className="space-y-4">
                  <div className="p-4 border border-blue-600 rounded-lg bg-blue-900/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-blue-200 mb-2">Regulatory Compliance Requirements</h4>
                        <p className="text-sm text-blue-100 mb-3">
                          Telecommunications regulations require us to verify business addresses before
                          phone number purchases. This ensures compliance with local laws and prevents
                          service disruptions.
                        </p>
                        <div className="text-xs text-blue-200 space-y-1">
                          <div><strong>Required Documents:</strong></div>
                          <ul className="list-disc list-inside ml-2 space-y-0.5">
                            <li>Business registration certificate</li>
                            <li>Tax identification document</li>
                            <li>Government-issued ID of business owner</li>
                            <li>Proof of business address (utility bill, lease agreement)</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Document Upload */}
                  <div className="p-4 border border-gray-600 rounded-lg">
                    <h4 className="font-medium text-white mb-3">Upload Business Documents</h4>
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="document-upload"
                        />
                        <label htmlFor="document-upload" className="cursor-pointer">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                          <p className="text-sm text-gray-300 mb-2">
                            <strong>Click to upload documents</strong>
                          </p>
                          <p className="text-xs text-gray-400">
                            Accepted formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB each)
                          </p>
                        </label>
                      </div>
                      
                      {documents.length > 0 && (
                        <div className="space-y-2">
                          {documents.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-white">{file.name}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDocument(index)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-700">
            <div className="text-sm text-gray-300">
              <span className="font-medium">1</span> Number selected
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || loading}
              className="px-8"
              style={{
                backgroundColor: isFormValid ? (branding?.primaryColor || '#3b82f6') : 'rgb(75 85 99)',
                borderColor: isFormValid ? (branding?.primaryColor || '#3b82f6') : 'rgb(75 85 99)'
              }}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                'Proceed to Buy'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
